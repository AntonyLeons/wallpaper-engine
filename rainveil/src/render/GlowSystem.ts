import { AppSettings, ColorRGB, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './RainSystem';

const TAU = Math.PI * 2;

interface Orb {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  color: 0 | 1 | 2 | 3;
  alpha: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (isNaN(value)) return '255, 255, 255';
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export class GlowSystem {
  private orbs: Orb[] = [];
  private sprites: HTMLCanvasElement[] = [];
  private spriteKey = '';
  private pulse = 0;
  private lastWidth = 0;
  private lastHeight = 0;

  public update(
    deltaTimeSec: number,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    const palette = PRESET_PALETTES[settings.cityPreset];
    this.ensureSprites(settings.primaryColor, settings.secondaryColor, palette.windowWarm, palette.windowCool);

    const targetPulse = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    this.pulse += (targetPulse - this.pulse) * (1 - Math.exp(-5 * deltaTimeSec));

    this.syncCount(settings.bokehCount, width, height);
    this.handleResize(width, height);

    for (const orb of this.orbs) {
      orb.x += orb.vx * deltaTimeSec;
      orb.y += orb.vy * deltaTimeSec;

      if (settings.mouseInteraction && mouse.active) {
        const dx = orb.x - mouse.x;
        const dy = orb.y - mouse.y;
        const radius = mouse.pulseRadius * 1.2;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / radius) * 16;
          orb.x += (dx / dist) * force * deltaTimeSec;
          orb.y += (dy / dist) * force * deltaTimeSec;
        }
      }

      if (orb.x < -orb.r * 2) orb.x = width + orb.r * 2;
      if (orb.x > width + orb.r * 2) orb.x = -orb.r * 2;
      if (orb.y < -orb.r * 2) orb.y = height + orb.r * 2;
      if (orb.y > height + orb.r * 2) orb.y = -orb.r * 2;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.orbs.length === 0 || this.sprites.length < 4) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const orb of this.orbs) {
      const sprite = this.sprites[orb.color];
      if (!sprite) continue;

      const scale = 1 + this.pulse * 0.55;
      const size = orb.r * 2 * scale;
      const twinkle = 0.7 + 0.3 * Math.sin(orb.phase + this.pulse * 2);
      ctx.globalAlpha = clamp(orb.alpha * twinkle * (0.75 + this.pulse * 0.7), 0, 0.65);
      ctx.drawImage(sprite, orb.x - size * 0.5, orb.y - size * 0.5, size, size);
    }

    ctx.restore();
  }

  private ensureSprites(primary: ColorRGB, secondary: ColorRGB, warm: string, cool: string): void {
    const key = `${primary.r},${primary.g},${primary.b}|${secondary.r},${secondary.g},${secondary.b}|${warm}|${cool}`;
    if (key === this.spriteKey) return;

    this.spriteKey = key;
    this.sprites = [
      this.createSprite(`${primary.r}, ${primary.g}, ${primary.b}`),
      this.createSprite(`${secondary.r}, ${secondary.g}, ${secondary.b}`),
      this.createSprite(hexToRgb(warm)),
      this.createSprite(hexToRgb(cool)),
    ];
  }

  private createSprite(rgb: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${rgb}, 0.9)`);
    gradient.addColorStop(0.18, `rgba(${rgb}, 0.6)`);
    gradient.addColorStop(0.42, `rgba(${rgb}, 0.2)`);
    gradient.addColorStop(0.72, `rgba(${rgb}, 0.055)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
  }

  private syncCount(count: number, width: number, height: number): void {
    const target = clamp(Math.round(count), 0, 120);
    while (this.orbs.length < target) {
      this.orbs.push(this.createOrb(width, height, true));
    }
    while (this.orbs.length > target) {
      this.orbs.pop();
    }
  }

  private createOrb(width: number, height: number, spread: boolean): Orb {
    const near = Math.random() < 0.32;
    return {
      x: Math.random() * width,
      y: spread ? height * (0.18 + Math.random() * 0.77) : height * (0.18 + Math.random() * 0.4),
      r: near ? 9 + Math.random() * 15 : 3 + Math.random() * 7,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 4,
      phase: Math.random() * TAU,
      color: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
      alpha: near ? 0.08 + Math.random() * 0.1 : 0.14 + Math.random() * 0.16,
    };
  }

  private handleResize(width: number, height: number): void {
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;

    for (const orb of this.orbs) {
      if (orb.x > width + orb.r) orb.x = Math.random() * width;
      if (orb.y > height + orb.r) orb.y = height * (0.18 + Math.random() * 0.77);
    }
  }
}
