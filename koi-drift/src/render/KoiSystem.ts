import { AppSettings, ColorRGB, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';

export interface MouseState {
  x: number;
  y: number;
  active: boolean;
  pulseRadius: number;
}

interface Segment {
  x: number;
  y: number;
}

interface KoiPatch {
  segIndex: number;
  dx: number; // lateral offset, -0.5..0.5 relative to half width
  radius: number;
  color: string;
}

interface Koi {
  scale: number;
  speedFactor: number;
  heading: number;
  wanderAngle: number;
  phase: number;
  head: Segment;
  spine: Segment[];
  baseColor: string;
  patches: KoiPatch[];
  dartTimer: number;
  dartBoost: number;
}

const SEGMENT_COUNT = 18;
// Body half-width profile from head to tail, multiplied by scale.
const WIDTH_PROFILE = [
  0.55, 0.80, 0.94, 1.0, 1.0, 0.98, 0.94, 0.88, 0.80, 0.71, 0.61, 0.51, 0.42, 0.32, 0.24, 0.17, 0.11, 0.07,
];
const BASE_BODY_WIDTH = 11.5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, v)));
}

function hexToRGB(hex: string): ColorRGB {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export class KoiSystem {
  private kois: Koi[] = [];
  private readonly maxKois = 12;
  private time = 0;

  public update(
    deltaTimeSec: number,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    this.time += deltaTimeSec;

    // Keep the population in sync with settings, spawning new koi when it grows.
    while (this.kois.length < Math.min(settings.fishCount, this.maxKois)) {
      this.spawnKoi(this.kois.length, width, height, settings);
    }
    while (this.kois.length > Math.min(settings.fishCount, this.maxKois)) {
      this.kois.pop();
    }

    const audioBoost = settings.audioReactive && audio.hasAudio ? audio.bass * 0.9 : 0;
    const midBoost = settings.audioReactive && audio.hasAudio ? audio.mid * 0.5 : 0;

    for (const koi of this.kois) {
      // Occasionally dart forward like startled koi.
      koi.dartTimer -= deltaTimeSec;
      if (koi.dartTimer <= 0) {
        koi.dartTimer = 9 + Math.random() * 16;
        koi.dartBoost = 1;
      }
      koi.dartBoost = Math.max(0, koi.dartBoost - deltaTimeSec * 0.9);

      // --- Steering ---
      koi.wanderAngle += Math.sin(this.time * 0.7 + koi.phase * 3.1) * 1.4 * deltaTimeSec;

      let steerX = Math.cos(koi.wanderAngle);
      let steerY = Math.sin(koi.wanderAngle);

      // Keep away from pond edges.
      const margin = 110 * koi.scale;
      let edgeWeight = 0;
      if (koi.head.x < margin) edgeWeight = Math.max(edgeWeight, 1 - koi.head.x / margin);
      if (koi.head.x > width - margin) edgeWeight = Math.max(edgeWeight, 1 - (width - koi.head.x) / margin);
      if (koi.head.y < margin) edgeWeight = Math.max(edgeWeight, 1 - koi.head.y / margin);
      if (koi.head.y > height - margin) edgeWeight = Math.max(edgeWeight, 1 - (height - koi.head.y) / margin);

      if (edgeWeight > 0) {
        const toCenter = Math.atan2(height * 0.5 - koi.head.y, width * 0.5 - koi.head.x);
        steerX += Math.cos(toCenter) * edgeWeight * 2.2;
        steerY += Math.sin(toCenter) * edgeWeight * 2.2;
      }

      // Gentle curiosity: follow the cursor when enabled.
      if (settings.mouseFollow && mouse.active) {
        const dx = mouse.x - koi.head.x;
        const dy = mouse.y - koi.head.y;
        const distSq = dx * dx + dy * dy;
        const followRadius = 460;
        if (distSq > 90 && distSq < followRadius * followRadius) {
          const dist = Math.sqrt(distSq);
          const weight = (1 - dist / followRadius) * 0.9;
          steerX += (dx / dist) * weight;
          steerY += (dy / dist) * weight;
        }
      }

      const targetAngle = Math.atan2(steerY, steerX);

      // Smoothly turn toward the target heading.
      let angleDiff = targetAngle - koi.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const turnRate = 2.6 + midBoost * 2.0;
      koi.heading += clamp(angleDiff, -turnRate * deltaTimeSec, turnRate * deltaTimeSec);

      // Undulation: slight heading oscillation produces the swim wave downstream.
      const swimPhaseRate = 3.2 + (1 + audioBoost) * 1.4;
      koi.phase += deltaTimeSec * swimPhaseRate;
      const wiggle = Math.sin(koi.phase * 0.5) * (0.14 + audioBoost * 0.12 + koi.dartBoost * 0.05);
      const moveHeading = koi.heading + wiggle;

      // --- Movement ---
      const baseSpeed = 62 * settings.fishSpeed * koi.speedFactor;
      const speed = baseSpeed * (1 + audioBoost * 0.55 + koi.dartBoost * 1.1);
      koi.head.x += Math.cos(moveHeading) * speed * deltaTimeSec;
      koi.head.y += Math.sin(moveHeading) * speed * deltaTimeSec;

      // Hard clamp so fish never leave the pond.
      koi.head.x = clamp(koi.head.x, -30, width + 30);
      koi.head.y = clamp(koi.head.y, -30, height + 30);

      // --- Spine follow chain ---
      const segLen = 6.4 * koi.scale;
      koi.spine[0].x = koi.head.x;
      koi.spine[0].y = koi.head.y;
      for (let i = 1; i < koi.spine.length; i++) {
        const prev = koi.spine[i - 1];
        const seg = koi.spine[i];
        let dx = seg.x - prev.x;
        let dy = seg.y - prev.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-5) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        seg.x = prev.x + (dx / d) * segLen;
        seg.y = prev.y + (dy / d) * segLen;
      }
    }
  }

  private spawnKoi(index: number, width: number, height: number, settings: AppSettings): void {
    const palette = PRESET_PALETTES[settings.pondPreset];
    const rng = mulberry32(1717 + index * 7919);
    const paletteIdx = Math.floor(rng() * palette.koiBase.length);

    const patchCount = 2 + Math.floor(rng() * 3);
    const patches: KoiPatch[] = [];
    for (let pIdx = 0; pIdx < patchCount; pIdx++) {
      // Avoid the very head and very tail so patches stay well shaped.
      patches.push({
        segIndex: 3 + Math.floor(rng() * (SEGMENT_COUNT - 8)),
        dx: rng() * 1.0 - 0.5,
        radius: (0.5 + rng() * 0.9) / Math.max(1, patchCount - pIdx),
        color: palette.koPatch[(paletteIdx + pIdx) % palette.koPatch.length],
      });
    }

    const koi: Koi = {
      scale: 0.85 + rng() * 0.75,
      speedFactor: 0.8 + rng() * 0.45,
      heading: rng() * Math.PI * 2,
      wanderAngle: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      head: { x: 0, y: 0 },
      spine: [],
      baseColor: palette.koiBase[paletteIdx % palette.koiBase.length],
      patches,
      dartTimer: rng() * 14,
      dartBoost: 0,
    };

    // Lay the spine out behind the head along the initial heading.
    const segLen = 6.4 * koi.scale;
    koi.head.x = 60 + rng() * Math.max(10, width - 120);
    koi.head.y = 60 + rng() * Math.max(10, height - 120);
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      koi.spine.push({
        x: koi.head.x - Math.cos(koi.heading) * segLen * i,
        y: koi.head.y - Math.sin(koi.heading) * segLen * i,
      });
    }

    this.kois.push(koi);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (const koi of this.kois) {
      this.renderKoi(ctx, koi);
    }
  }

  private renderKoi(ctx: CanvasRenderingContext2D, koi: Koi): void {
    const spine = koi.spine;
    const n = spine.length;
    const scale = koi.scale;

    // Per-segment heading angles (direction toward the head).
    const cosA = new Float32Array(n);
    const sinA = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = i === 0
        ? koi.heading
        : Math.atan2(spine[i - 1].y - spine[i].y, spine[i - 1].x - spine[i].x);
      cosA[i] = Math.cos(a);
      sinA[i] = Math.sin(a);
    }

    // Head tip, slightly beyond the first spine joint.
    const noseX = spine[0].x + cosA[0] * 7.5 * scale;
    const noseY = spine[0].y + sinA[0] * 7.5 * scale;

    // --- Tail fin: translucent fan rooted inside the body so it reads attached ---
    const jointX = spine[n - 2].x;
    const jointY = spine[n - 2].y;
    const fanLen = 19 * scale;
    const sway = Math.sin(koi.phase * 0.5) * 0.45;
    const tailAngle = Math.atan2(spine[n - 1].y - jointY, spine[n - 1].x - jointX);
    const mA = tailAngle - 0.5 + sway;
    const mB = tailAngle - 0.5 + sway + 1.0;
    const baseRGB = hexToRGB(koi.baseColor);

    const fanGrad = ctx.createLinearGradient(jointX, jointY, jointX - cosA[n - 2] * fanLen, jointY - sinA[n - 2] * fanLen);
    fanGrad.addColorStop(0, `rgba(${baseRGB.r}, ${baseRGB.g}, ${baseRGB.b}, 0.8)`);
    fanGrad.addColorStop(1, `rgba(${baseRGB.r}, ${baseRGB.g}, ${baseRGB.b}, 0.12)`);

    ctx.fillStyle = fanGrad;
    ctx.beginPath();
    // Broad base spanning perpendicular to the body at the last-but-one joint.
    const baseHalfW = 4.5 * scale;
    ctx.moveTo(jointX + sinA[n - 2] * baseHalfW, jointY - cosA[n - 2] * baseHalfW);
    ctx.quadraticCurveTo(
      jointX + Math.cos(mA) * fanLen * 0.55,
      jointY + Math.sin(mA) * fanLen * 0.55,
      jointX + Math.cos(mA) * fanLen,
      jointY + Math.sin(mA) * fanLen
    );
    ctx.quadraticCurveTo(
      jointX + Math.cos(tailAngle) * fanLen * 0.85,
      jointY + Math.sin(tailAngle) * fanLen * 0.85,
      jointX + Math.cos(mB) * fanLen,
      jointY + Math.sin(mB) * fanLen
    );
    ctx.lineTo(jointX - sinA[n - 2] * baseHalfW, jointY + cosA[n - 2] * baseHalfW);
    ctx.closePath();
    ctx.fill();

    // --- Pectoral fins near the head ---
    const finPhase = Math.sin(koi.phase * 0.8);
    const finX = spine[2].x;
    const finY = spine[2].y;
    const finLen = 8.5 * scale;
    const finBase = Math.atan2(spine[1].y - spine[2].y, spine[1].x - spine[2].x);

    ctx.fillStyle = `rgba(${baseRGB.r}, ${baseRGB.g}, ${baseRGB.b}, 0.55)`;
    for (const side of [1, -1]) {
      const a1 = finBase + side * (1.95 + finPhase * 0.22);
      const a2 = finBase + side * (2.6 + finPhase * 0.22);
      const tipX = finX + Math.cos(a1) * finLen;
      const tipY = finY + Math.sin(a1) * finLen;
      const backX2 = finX + Math.cos(a2) * finLen * 0.65;
      const backY2 = finY + Math.sin(a2) * finLen * 0.65;

      ctx.beginPath();
      ctx.moveTo(finX, finY);
      ctx.quadraticCurveTo(
        finX + Math.cos(finBase + side * 1.2) * finLen * 0.6,
        finY + Math.sin(finBase + side * 1.2) * finLen * 0.6,
        tipX, tipY
      );
      ctx.quadraticCurveTo(
        finX + Math.cos(a2) * finLen * 0.45,
        finY + Math.sin(a2) * finLen * 0.45,
        backX2, backY2
      );
      ctx.closePath();
      ctx.fill();
    }

    // --- Body outline (nose -> right side -> tail -> left side -> nose) ---
    const body = new Path2D();
    body.moveTo(noseX, noseY);
    for (let i = 0; i < n; i++) {
      const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale;
      body.lineTo(spine[i].x + sinA[i] * w, spine[i].y - cosA[i] * w);
    }
    body.lineTo(spine[n - 1].x - cosA[n - 1] * 4 * scale, spine[n - 1].y - sinA[n - 1] * 4 * scale);
    for (let i = n - 1; i >= 0; i--) {
      const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale;
      body.lineTo(spine[i].x - sinA[i] * w, spine[i].y + cosA[i] * w);
    }
    body.closePath();

    // --- Body fill with head-to-tail gradient ---
    const bodyGrad = ctx.createLinearGradient(spine[0].x, spine[0].y, spine[n - 1].x, spine[n - 1].y);
    bodyGrad.addColorStop(0, koi.baseColor);
    const darkTail = { r: Math.round(baseRGB.r * 0.78), g: Math.round(baseRGB.g * 0.78), b: Math.round(baseRGB.b * 0.78) };
    bodyGrad.addColorStop(1, `rgb(${darkTail.r}, ${darkTail.g}, ${darkTail.b})`);
    ctx.fillStyle = bodyGrad;
    ctx.fill(body);

    // --- Patches and shading, clipped to the body ---
    ctx.save();
    ctx.clip(body);

    for (const patch of koi.patches) {
      const segIdx = clampInt(patch.segIndex, 0, n - 1);
      const s = spine[segIdx];
      const angle = segIdx === 0 ? koi.heading : Math.atan2(spine[segIdx - 1].y - s.y, spine[segIdx - 1].x - s.x);
      const w = WIDTH_PROFILE[segIdx] * BASE_BODY_WIDTH * scale;
      const px = s.x + Math.sin(angle) * patch.dx * 2 * w;
      const py = s.y - Math.cos(angle) * patch.dx * 2 * w;
      const pr = patch.radius * BASE_BODY_WIDTH * 1.15 * scale;

      ctx.fillStyle = patch.color;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 1.45, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark dorsal stripe along the spine for depth.
    const shadeStart = { r: Math.round(baseRGB.r * 0.62), g: Math.round(baseRGB.g * 0.62), b: Math.round(baseRGB.b * 0.62) };
    const stripeGrad = ctx.createLinearGradient(spine[0].x, spine[0].y, spine[n - 1].x, spine[n - 1].y);
    stripeGrad.addColorStop(0, `rgba(${shadeStart.r}, ${shadeStart.g}, ${shadeStart.b}, 0.35)`);
    stripeGrad.addColorStop(1, `rgba(${shadeStart.r}, ${shadeStart.g}, ${shadeStart.b}, 0.12)`);
    ctx.fillStyle = stripeGrad;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const c = cosA[i];
      const s2 = sinA[i];
      const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale;
      const topX = spine[i].x - s2 * w;
      const topY = spine[i].y + c * w;
      if (i === 0) ctx.moveTo(topX - c * 8 * scale, topY - s2 * 8 * scale);
      else ctx.lineTo(topX, topY);
    }
    for (let i = n - 1; i >= 0; i--) {
      const c = cosA[i];
      const s2 = sinA[i];
      const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale;
      const midX = spine[i].x + s2 * w * 0.12;
      const midY = spine[i].y - c * w * 0.12;
      ctx.lineTo(midX, midY);
    }
    ctx.closePath();
    ctx.fill();

    // Wet sheen highlight near the head.
    ctx.globalCompositeOperation = 'lighter';
    const hx = spine[1].x;
    const hy = spine[1].y;
    const sheen = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16 * scale);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(hx, hy, 16 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
