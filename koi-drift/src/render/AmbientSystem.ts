import { AppSettings, ColorRGB, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './KoiSystem';

interface KelpStrand {
  anchorX: number; // fraction of width 0..1
  heightFrac: number; // fraction of height
  phase: number;
  widthSeg: number;
  colorStr: string; // "r, g, b"
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vy: number;
  wobblePhase: number;
  wobbleAmp: number;
  alpha: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growth: number;
  strength: number;
}

const KELP_SEGMENTS = 12;

// Lighten the palette kelp so strands stay visible against dark water.
function lightenKelp(hex: string): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.substring(0, 2), 16) + (255 - parseInt(h.substring(0, 2), 16)) * 0.3);
  const g = Math.round(parseInt(h.substring(2, 4), 16) + (255 - parseInt(h.substring(2, 4), 16)) * 0.3);
  const b = Math.round(parseInt(h.substring(4, 6), 16) + (255 - parseInt(h.substring(4, 6), 16)) * 0.3);
  return `${r}, ${g}, ${b}`;
}

function mixRGB(a: ColorRGB, b: ColorRGB, t: number): ColorRGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export class AmbientSystem {
  private time = 0;
  private kelp: KelpStrand[] = [];
  private bubbles: Bubble[] = [];
  private bubblePool: Bubble[] = [];
  private ripples: Ripple[] = [];
  private ripplePool: Ripple[] = [];

  private rainTimer = 0;
  private lastMouseY = -1;
  private mouseRippleTimer = 0;

  private rippleColors: [string, string] = ['', ''];
  private cachedColors: [ColorRGB, ColorRGB] | null = null;

  private ensureKelp(count: number, colorStr: string): void {
    while (this.kelp.length < count) {
      const seed = this.kelp.length;
      this.kelp.push({
        // Golden-ratio spread across the pond with a touch of jitter.
        anchorX: 0.02 + ((seed * 0.618034) % 0.96) + Math.random() * 0.02,
        heightFrac: 0.14 + Math.random() * 0.26,
        phase: Math.random() * Math.PI * 2,
        widthSeg: 2.2 + Math.random() * 2.2,
        colorStr,
      });
    }
    while (this.kelp.length > count) {
      this.kelp.pop();
    }
    for (const strand of this.kelp) strand.colorStr = colorStr;
  }

  public update(
    deltaTimeSec: number,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    this.time += deltaTimeSec;
    this.updateColors(settings);

    // --- Kelp ---
    this.ensureKelp(settings.kelpCount, lightenKelp(PRESET_PALETTES[settings.pondPreset].kelp));

    // --- Bubbles: keep the active count at the configured density ---
    const targetBubbles = settings.bubbleCount;
    while (this.bubbles.length < targetBubbles) {
      const pooled = this.bubblePool.pop();
      const b = pooled ?? { x: 0, y: 0, radius: 2, vy: 20, wobblePhase: 0, wobbleAmp: 6, alpha: 0.5 };
      this.resetBubble(b, width, height, true);
      this.bubbles.push(b);
    }
    while (this.bubbles.length > targetBubbles) {
      const b = this.bubbles.pop();
      if (b) this.bubblePool.push(b);
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.vy * deltaTimeSec;
      b.x += Math.sin(this.time * 1.6 + b.wobblePhase) * b.wobbleAmp * deltaTimeSec;

      // Fade near the surface and recycle.
      if (b.y < height * 0.08) {
        this.bubbles.splice(i, 1);
        this.bubblePool.push(b);
      }
    }
    // Occasionally release a fresh bubble at the pond floor.
    if (this.bubbles.length < targetBubbles) {
      const respawnCount = Math.max(1, Math.round(deltaTimeSec * 12));
      for (let r = 0; r < respawnCount && this.bubbles.length < targetBubbles; r++) {
        const pooled = this.bubblePool.pop();
        const b = pooled ?? { x: 0, y: 0, radius: 2, vy: 20, wobblePhase: 0, wobbleAmp: 6, alpha: 0.5 };
        this.resetBubble(b, width, height, true);
        this.bubbles.push(b);
      }
    }

    // --- Ripples ---
    // Ambient "rain" taps: a light drizzle, intensified by bass beat pulses.
    const rainRate = 0.6 + (settings.audioReactive && audio.hasAudio ? audio.beatPulse * 6 : 0);
    this.rainTimer -= deltaTimeSec * rainRate;
    if (this.rainTimer <= 0) {
      this.rainTimer = 0.6 + Math.random() * 0.9;
      const strength = 0.14 + Math.random() * 0.16 + (settings.audioReactive && audio.hasAudio ? audio.beatPulse * 0.5 : 0);
      this.spawnRipple(Math.random() * width, height * (0.12 + Math.random() * 0.7), strength);
    }

    // Gentle ripple trail under the cursor.
    if (mouse.active) {
      if (this.lastMouseY >= 0) {
        this.mouseRippleTimer -= deltaTimeSec;
        if (this.mouseRippleTimer <= 0) {
          this.mouseRippleTimer = Math.random() * 0.2 + 0.2;
          this.spawnRipple(mouse.x + (Math.random() - 0.5) * 40, mouse.y + (Math.random() - 0.5) * 30, 0.12);
        }
      }
      this.lastMouseY = mouse.y;
    } else {
      this.lastMouseY = -1;
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.growth * deltaTimeSec;
      if (r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        this.ripplePool.push(r);
      }
    }
  }

  private updateColors(settings: AppSettings): void {
    const colorsChanged =
      !this.cachedColors ||
      this.cachedColors[0].r !== settings.primaryColor.r ||
      this.cachedColors[0].g !== settings.primaryColor.g ||
      this.cachedColors[0].b !== settings.primaryColor.b ||
      this.cachedColors[1].r !== settings.secondaryColor.r ||
      this.cachedColors[1].g !== settings.secondaryColor.g ||
      this.cachedColors[1].b !== settings.secondaryColor.b;

    if (colorsChanged) {
      this.cachedColors = [{ ...settings.primaryColor }, { ...settings.secondaryColor }];
      const rippleA = mixRGB(this.cachedColors[0], { r: 255, g: 255, b: 255 }, 0.4);
      const rippleB = mixRGB(this.cachedColors[1], this.cachedColors[0], 0.35);
      this.rippleColors = [
        `${rippleA.r}, ${rippleA.g}, ${rippleA.b}`,
        `${rippleB.r}, ${rippleB.g}, ${rippleB.b}`,
      ];
    }
  }

  private resetBubble(b: Bubble, width: number, height: number, spawnAtBottom: boolean): void {
    b.x = Math.random() * width;
    b.y = spawnAtBottom ? height * (0.92 + Math.random() * 0.1) : height * (0.15 + Math.random() * 0.85);
    b.radius = 1.2 + Math.random() * 3;
    b.vy = 18 + Math.random() * 34;
    b.wobblePhase = Math.random() * Math.PI * 2;
    b.wobbleAmp = 4 + Math.random() * 8;
    b.alpha = 0.18 + Math.random() * 0.3;
  }

  public spawnRipple(x: number, y: number, strength: number): void {
    let ripple = this.ripplePool.pop();
    if (!ripple) {
      ripple = { x: 0, y: 0, radius: 0, maxRadius: 120, growth: 60, strength: 1 };
    }
    ripple.x = x;
    ripple.y = y;
    ripple.radius = 2;
    ripple.maxRadius = 70 + strength * 160;
    ripple.growth = 55 + strength * 90;
    ripple.strength = Math.min(1, strength);
    this.ripples.push(ripple);
  }
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    // --- Kelp (drawn behind the fish) ---
    if (this.kelp.length > 0) {
      this.renderKelp(ctx, width, height, settings, audio);
    }

    // --- Ripple surface rings ---
    if (this.ripples.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const [colA, colB] = this.rippleColors;
      for (const r of this.ripples) {
        const alpha = r.strength * (1 - r.radius / r.maxRadius);
        if (alpha < 0.01) continue;
        const flat = 0.34;

        ctx.strokeStyle = `rgba(${colA}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 2.2 * alpha + 0.5);
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.radius, r.radius * flat, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${colB}, ${(alpha * 0.5).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 1.4 * alpha + 0.4);
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.radius * 0.62, r.radius * 0.62 * flat, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  public renderForeground(ctx: CanvasRenderingContext2D, height: number): void {
    // --- Bubbles (drawn above the fish) ---
    if (this.bubbles.length > 0) {
      ctx.save();
      for (const b of this.bubbles) {
        const surfaceFade = Math.min(1, (b.y - height * 0.04) / (height * 0.2));
        const a = b.alpha * surfaceFade;
        if (a <= 0.01) continue;

        ctx.strokeStyle = `rgba(220, 240, 250, ${a.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${(a * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderKelp(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    const sway = settings.audioReactive && audio.hasAudio ? 1 + audio.treble * 1.6 : 1;

    for (const strand of this.kelp) {
      const anchorX = strand.anchorX * width;
      const length = strand.heightFrac * height;

      // Swaying centerline, from the pond floor upward.
      const STEPS = KELP_SEGMENTS;
      const cx = new Float32Array(STEPS + 1);
      const cy = new Float32Array(STEPS + 1);
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const amp = 16 * Math.pow(t, 1.7) * sway;
        const swayX = Math.sin(this.time * 0.6 + strand.phase + t * 1.9) * amp +
          Math.sin(this.time * 0.23 + strand.phase * 2.1) * 6 * t;
        cx[i] = anchorX + swayX;
        cy[i] = height - length * t;
      }

      // Tapered blade: half-width shrinks from base to tip.
      const baseHalfWidth = Math.max(2.5, strand.widthSeg * 1.9);
      ctx.save();
      const grad = ctx.createLinearGradient(0, height, 0, height - length);
      grad.addColorStop(0, `rgba(${strand.colorStr}, 0.9)`);
      grad.addColorStop(1, `rgba(${strand.colorStr}, 0.4)`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(anchorX - baseHalfWidth, height);
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const w = baseHalfWidth * Math.pow(1 - t, 0.85);
        ctx.lineTo(cx[i] + w, cy[i]);
      }
      // Tip point.
      ctx.lineTo(cx[STEPS], cy[STEPS] - 4);
      for (let i = STEPS - 1; i >= 0; i--) {
        const t = i / STEPS;
        const w = baseHalfWidth * Math.pow(1 - t, 0.85);
        ctx.lineTo(cx[i] - w, cy[i]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
