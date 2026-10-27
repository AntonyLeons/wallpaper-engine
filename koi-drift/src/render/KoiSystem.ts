import { AppSettings, PRESET_PALETTES } from '../config/settings';
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
  shape: Path2D;
}

interface Koi {
  scale: number;
  speedFactor: number;
  heading: number;
  wanderAngle: number;
  phase: number;
  head: Segment;
  spine: Segment[];
  cosA: Float32Array;
  sinA: Float32Array;
  outline: Float32Array;
  paletteIndex: number;
  baseColor: string;
  patches: KoiPatch[];
  dartTimer: number;
  dartBoost: number;
}

const SEGMENT_COUNT = 18;
// Body half-width profile from head to tail, multiplied by scale.
const WIDTH_PROFILE = [
  0.50, 0.72, 0.88, 0.98, 1.0, 1.0, 0.98, 0.93, 0.86, 0.77, 0.66, 0.55, 0.44, 0.34, 0.25, 0.18, 0.12, 0.10,
];
const BASE_BODY_WIDTH = 14.5;

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

export class KoiSystem {
  private kois: Koi[] = [];
  private readonly maxKois = 12;
  private time = 0;
  private cachedPreset = '';

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

    if (this.cachedPreset !== settings.pondPreset) {
      this.cachedPreset = settings.pondPreset;
      const palette = PRESET_PALETTES[settings.pondPreset];
      for (const koi of this.kois) {
        koi.baseColor = palette.koiBase[koi.paletteIndex % palette.koiBase.length];
        for (const patch of koi.patches) {
          patch.color = palette.koPatch[koi.paletteIndex % palette.koPatch.length];
        }
      }
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
      koi.wanderAngle += Math.sin(this.time * 0.38 + koi.speedFactor * 4.1) * 0.32 * deltaTimeSec;

      let steerX = Math.cos(koi.wanderAngle);
      let steerY = Math.sin(koi.wanderAngle);

      const baseSpeed = 62 * settings.fishSpeed * koi.speedFactor;
      const cruiseSpeed = baseSpeed * (1 + audioBoost * 0.55 + koi.dartBoost * 1.1);
      const turnRate = 0.9 + midBoost * 0.55;
      // Personal space is measured against neighbours' bodies, not only their heads.
      for (const other of this.kois) {
        if (other === koi) continue;
        let closestX = 0;
        let closestY = 0;
        let closestSq = Infinity;
        for (let i = 0; i < SEGMENT_COUNT; i += 3) {
          const dx = koi.head.x - other.spine[i].x;
          const dy = koi.head.y - other.spine[i].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < closestSq) {
            closestSq = d2;
            closestX = dx;
            closestY = dy;
          }
        }
        const radius = 80 * (koi.scale + other.scale);
        if (closestSq < radius * radius) {
          const distance = Math.sqrt(closestSq);
          const weight = (1 - distance / radius) ** 2 * 4;
          if (distance > 0.01) {
            steerX += closestX / distance * weight;
            steerY += closestY / distance * weight;
          } else {
            // Deterministic escape direction for an exact overlap.
            steerX += Math.cos(koi.phase) * weight;
            steerY += Math.sin(koi.phase) * weight;
          }
        }
      }

      // Approach a comfortable orbit around the cursor rather than one shared point.
      if (settings.mouseFollow && mouse.active) {
        const cursorX = clamp(mouse.x, 0, width);
        const cursorY = clamp(mouse.y, 0, height);
        const dx = cursorX - koi.head.x;
        const dy = cursorY - koi.head.y;
        const distance = Math.hypot(dx, dy);
        const orbitRadius = 110 * koi.scale;
        if (distance > 0.01 && distance < 460) {
          const weight = clamp((distance - orbitRadius) / 180, -0.7, 0.55);
          steerX += dx / distance * weight;
          steerY += dy / distance * weight;
        }
      }

      const targetAngle = Math.atan2(steerY, steerX);

      // Smoothly turn toward the target heading.
      let angleDiff = targetAngle - koi.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      koi.heading += clamp(angleDiff, -turnRate * deltaTimeSec, turnRate * deltaTimeSec);

      // Undulation: slight heading oscillation produces the swim wave downstream.
      const swimPhaseRate = 3.2 + (1 + audioBoost) * 1.4;
      koi.phase += deltaTimeSec * swimPhaseRate;
      const wiggle = Math.sin(koi.phase * 0.5) * (0.045 + audioBoost * 0.04 + koi.dartBoost * 0.03);
      const moveHeading = koi.heading + wiggle;

      // --- Movement ---
      // Keep cruising through the viewport edge; it is not a physical pond wall.
      const speed = cruiseSpeed;
      koi.head.x += Math.cos(moveHeading) * speed * deltaTimeSec;
      koi.head.y += Math.sin(moveHeading) * speed * deltaTimeSec;

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
        // Keep the head steady; let a small travelling wave build toward the tail.
        const tailWeight = i / (koi.spine.length - 1);
        const bend = Math.sin(koi.phase - i * 0.42) * tailWeight * tailWeight
          * deltaTimeSec * (0.7 + koi.dartBoost * 0.5);
        const c = Math.cos(bend);
        const s = Math.sin(bend);
        seg.x = prev.x + ((dx * c - dy * s) / d) * segLen;
        seg.y = prev.y + ((dx * s + dy * c) / d) * segLen;
      }
      this.wrapBody(koi, width, height);
    }
  }

  private spawnKoi(index: number, width: number, height: number, settings: AppSettings): void {
    const palette = PRESET_PALETTES[settings.pondPreset];
    const rng = mulberry32(1717 + index * 7919);
    const paletteIdx = Math.floor(rng() * palette.koiBase.length);

    // Broad, asymmetric islands of pigment, generated only when a fish spawns.
    const patchCount = 3 + Math.floor(rng() * 2);
    const patches: KoiPatch[] = [];
    for (let pIdx = 0; pIdx < patchCount; pIdx++) {
      const shape = new Path2D();
      const lobes = 9;
      const points: Segment[] = [];
      for (let j = 0; j < lobes; j++) {
        const angle = j / lobes * Math.PI * 2;
        const radius = 0.72 + rng() * 0.38;
        points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      }
      shape.moveTo((points[0].x + points[lobes - 1].x) / 2,
        (points[0].y + points[lobes - 1].y) / 2);
      for (let j = 0; j < lobes; j++) {
        const next = points[(j + 1) % lobes];
        shape.quadraticCurveTo(points[j].x, points[j].y,
          (points[j].x + next.x) / 2, (points[j].y + next.y) / 2);
      }
      shape.closePath();
      patches.push({
        segIndex: 1 + pIdx * 3,
        dx: rng() * 0.8 - 0.4,
        radius: 0.65 + rng() * 0.45,
        color: palette.koPatch[paletteIdx % palette.koPatch.length],
        shape,
      });
    }

    const heading = rng() * Math.PI * 2;
    const koi: Koi = {
      scale: 0.85 + rng() * 0.75,
      speedFactor: 0.8 + rng() * 0.45,
      heading,
      wanderAngle: heading,
      phase: rng() * Math.PI * 2,
      head: { x: 0, y: 0 },
      spine: [],
      cosA: new Float32Array(SEGMENT_COUNT),
      sinA: new Float32Array(SEGMENT_COUNT),
      outline: new Float32Array(SEGMENT_COUNT * 4),
      paletteIndex: paletteIdx,
      baseColor: palette.koiBase[paletteIdx % palette.koiBase.length],
      patches,
      dartTimer: rng() * 14,
      dartBoost: 0,
    };

    // Choose a well-spaced body centre, with room for the entire initial fish.
    const segLen = 6.4 * koi.scale;
    const halfLength = (SEGMENT_COUNT - 1) * segLen * 0.5;
    const insetX = Math.min(width * 0.45, halfLength + 42 * koi.scale);
    const insetY = Math.min(height * 0.45, halfLength + 42 * koi.scale);
    let bestX = width / 2;
    let bestY = height / 2;
    let bestDistance = -1;
    for (let attempt = 0; attempt < 32; attempt++) {
      const x = insetX + rng() * Math.max(0, width - insetX * 2);
      const y = insetY + rng() * Math.max(0, height - insetY * 2);
      let distance = Infinity;
      for (const other of this.kois) {
        const centre = other.spine[8];
        distance = Math.min(distance, (x - centre.x) ** 2 + (y - centre.y) ** 2);
      }
      if (distance > bestDistance) {
        bestX = x;
        bestY = y;
        bestDistance = distance;
      }
    }
    koi.head.x = bestX + Math.cos(koi.heading) * halfLength;
    koi.head.y = bestY + Math.sin(koi.heading) * halfLength;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      koi.spine.push({
        x: koi.head.x - Math.cos(koi.heading) * segLen * i,
        y: koi.head.y - Math.sin(koi.heading) * segLen * i,
      });
    }
    this.wrapBody(koi, width, height);

    this.kois.push(koi);
  }

  private wrapBody(koi: Koi, width: number, height: number): void {
    // Re-enter on the opposite side only when every fin and the shadow are hidden.
    // Translate the whole chain together, preserving heading, speed and swim phase.
    const padding = 36 * koi.scale;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const segment of koi.spine) {
      minX = Math.min(minX, segment.x - padding);
      minY = Math.min(minY, segment.y - padding);
      maxX = Math.max(maxX, segment.x + padding);
      maxY = Math.max(maxY, segment.y + padding);
    }
    // Only wrap an outward-moving fish, so a flexing tail cannot trigger a
    // second wrap while the head is already swimming inward from the other edge.
    const forwardX = Math.cos(koi.heading);
    const forwardY = Math.sin(koi.heading);
    const dx = maxX < 0 && forwardX < 0 ? width - minX
      : minX > width && forwardX > 0 ? -maxX : 0;
    const dy = maxY < 0 && forwardY < 0 ? height - minY
      : minY > height && forwardY > 0 ? -maxY : 0;
    if (dx !== 0 || dy !== 0) {
      for (const segment of koi.spine) {
        segment.x += dx;
        segment.y += dy;
      }
      koi.head.x = koi.spine[0].x;
      koi.head.y = koi.spine[0].y;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    for (const koi of this.kois) {
      const padding = 36 * koi.scale;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const joint of koi.spine) {
        minX = Math.min(minX, joint.x);
        minY = Math.min(minY, joint.y);
        maxX = Math.max(maxX, joint.x);
        maxY = Math.max(maxY, joint.y);
      }
      // Keep simulating hidden fish so their off-screen crossings stay continuous.
      if (maxX + padding < 0 || maxY + padding < 0
        || minX - padding > width || minY - padding > height) continue;
      this.renderKoi(ctx, koi);
    }
  }

  private renderKoi(ctx: CanvasRenderingContext2D, koi: Koi): void {
    const { spine, cosA, sinA, outline, scale } = koi;
    const n = spine.length;
    for (let i = 0; i < n; i++) {
      // Central tangents keep the silhouette smooth through a turn.
      const front = spine[Math.max(0, i - 1)];
      const back = spine[Math.min(n - 1, i + 1)];
      const angle = Math.atan2(front.y - back.y, front.x - back.x);
      cosA[i] = Math.cos(angle);
      sinA[i] = Math.sin(angle);
      const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale;
      outline[i * 2] = spine[i].x + sinA[i] * w;
      outline[i * 2 + 1] = spine[i].y - cosA[i] * w;
      const opposite = (n * 2 - 1 - i) * 2;
      outline[opposite] = spine[i].x - sinA[i] * w;
      outline[opposite + 1] = spine[i].y + cosA[i] * w;
    }

    // Fins are drawn in joint-local coordinates; no textures or effect buffers.
    ctx.save();
    ctx.translate(spine[n - 1].x, spine[n - 1].y);
    ctx.rotate(Math.atan2(sinA[n - 1], cosA[n - 1]) + Math.sin(koi.phase) * 0.24);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(238, 226, 199, 0.6)';
    ctx.strokeStyle = 'rgba(255, 246, 219, 0.26)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(2, -1.6);
    ctx.bezierCurveTo(-9, -5, -17, -15, -28, -16);
    ctx.bezierCurveTo(-26, -9, -22, -3, -18, 0);
    ctx.bezierCurveTo(-22, 3, -26, 9, -28, 16);
    ctx.bezierCurveTo(-17, 15, -9, 5, 2, 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let ray = -3; ray <= 3; ray++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-12, ray * 1.5, -24 + (3 - Math.abs(ray)) * 2, ray * 4.4);
      ctx.stroke();
    }
    ctx.restore();

    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(spine[3].x, spine[3].y);
      ctx.rotate(Math.atan2(sinA[3], cosA[3]));
      ctx.scale(scale, scale * side);
      const flutter = Math.sin(koi.phase * 0.7 + side * 0.4) * 2;
      ctx.fillStyle = 'rgba(239, 228, 204, 0.45)';
      ctx.strokeStyle = 'rgba(255, 244, 218, 0.23)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(5, 9);
      ctx.bezierCurveTo(3, 20, -5, 28 + flutter, -17, 25 + flutter);
      ctx.bezierCurveTo(-19, 20, -12, 13, -6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let ray = 0; ray < 3; ray++) {
        ctx.beginPath();
        ctx.moveTo(2 - ray * 2, 11);
        ctx.quadraticCurveTo(-4 - ray * 3, 18, -9 - ray * 3, 25 + flutter - ray);
        ctx.stroke();
      }
      ctx.restore();
    }

    // A continuous quadratic contour removes the old polygonal nose and sides.
    const body = new Path2D();
    const count = n * 2;
    body.moveTo((outline[0] + outline[(count - 1) * 2]) / 2,
      (outline[1] + outline[(count - 1) * 2 + 1]) / 2);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      body.quadraticCurveTo(outline[i * 2], outline[i * 2 + 1],
        (outline[i * 2] + outline[next * 2]) / 2,
        (outline[i * 2 + 1] + outline[next * 2 + 1]) / 2);
    }
    body.closePath();

    // A small offset silhouette anchors the fish beneath the water surface.
    ctx.save();
    ctx.translate(4 * scale, 7 * scale);
    ctx.fillStyle = 'rgba(1, 17, 23, 0.22)';
    ctx.fill(body);
    ctx.restore();
    ctx.fillStyle = koi.baseColor;
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    for (const patch of koi.patches) {
      const i = patch.segIndex;
      const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale;
      ctx.save();
      ctx.translate(spine[i].x + sinA[i] * patch.dx * w,
        spine[i].y - cosA[i] * patch.dx * w);
      ctx.rotate(Math.atan2(sinA[i], cosA[i]));
      const radius = patch.radius * BASE_BODY_WIDTH * scale;
      ctx.scale(radius * 1.35, radius);
      ctx.fillStyle = patch.color;
      ctx.fill(patch.shape);
      ctx.restore();
    }

    // Layered, narrow contours model rounded flanks without per-frame gradients.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const w = WIDTH_PROFILE[i] * BASE_BODY_WIDTH * scale * 0.88 * side;
        const x = spine[i].x + sinA[i] * w;
        const y = spine[i].y - cosA[i] * w;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = side === 1 ? 'rgba(63, 53, 39, 0.2)' : 'rgba(255, 250, 228, 0.22)';
      ctx.lineWidth = 4 * scale;
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 1; i < n - 4; i++) {
      const x = spine[i].x - sinA[i] * 2 * scale;
      const y = spine[i].y + cosA[i] * 2 * scale;
      if (i === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 252, 230, 0.23)';
    ctx.lineWidth = 2.2 * scale;
    ctx.stroke();
    ctx.restore();

    // Small lateral eyes and quiet gill arcs give the broad head a clear face.
    ctx.save();
    ctx.translate(spine[1].x, spine[1].y);
    ctx.rotate(Math.atan2(sinA[1], cosA[1]));
    ctx.scale(scale, scale);
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.ellipse(2.7, side * 8.2, 2.1, 1.4, side * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#a48c61';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(3, side * 8.3, 1.25, 1, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#162629';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3.4, side * 8.3 - 0.3, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 240, 0.8)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-5, side * 4.5);
      ctx.quadraticCurveTo(-10, side * 8, -7, side * 11);
      ctx.strokeStyle = 'rgba(65, 50, 36, 0.22)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
    ctx.restore();
  }
}
