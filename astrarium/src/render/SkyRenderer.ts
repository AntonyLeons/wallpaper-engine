import { AppSettings, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { PointerState } from '../types/scene';
import { mulberry32, TAU } from './math';

interface Mote {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
}

const PRESET_SEEDS: Record<AppSettings['preset'], number> = {
  brass: 0,
  silver: 1,
  verdigris: 2,
  rose: 3,
};

export class SkyRenderer {
  private backdrop = document.createElement('canvas');
  private cacheKey = '';
  private time = 0;
  private motes: Mote[] = [];
  private moteKey = '';

  private ensureCache(width: number, height: number, settings: AppSettings): void {
    const key = `${width}_${height}_${settings.preset}_${settings.starDensity}`;
    if (this.cacheKey === key) return;
    this.cacheKey = key;

    const ratio = Math.min(1, 1536 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    this.backdrop.width = w;
    this.backdrop.height = h;
    const bg = this.backdrop.getContext('2d');
    if (!bg) return;

    const palette = PRESET_PALETTES[settings.preset];
    const sky = bg.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, Math.max(w, h) * 0.78);
    sky.addColorStop(0, palette.skyInner);
    sky.addColorStop(1, palette.skyOuter);
    bg.fillStyle = sky;
    bg.fillRect(0, 0, w, h);

    const rng = mulberry32(9137 + PRESET_SEEDS[settings.preset] * 7919);
    const chartX = w * 0.5;
    const chartY = h * 0.46;
    const maxR = Math.min(w, h) * 0.72;

    bg.save();
    bg.translate(chartX, chartY);
    bg.strokeStyle = palette.chart;
    bg.lineWidth = Math.max(0.7, ratio);
    bg.setLineDash([3 * ratio, 8 * ratio]);
    for (let ring = 1; ring <= 4; ring++) {
      bg.beginPath();
      bg.arc(0, 0, (maxR * ring) / 4, 0, TAU);
      bg.stroke();
    }
    bg.setLineDash([]);
    for (let spoke = 0; spoke < 12; spoke++) {
      const angle = (spoke / 12) * TAU;
      bg.beginPath();
      bg.moveTo(Math.cos(angle) * maxR * 0.12, Math.sin(angle) * maxR * 0.12);
      bg.lineTo(Math.cos(angle) * maxR, Math.sin(angle) * maxR);
      bg.stroke();
    }
    bg.restore();

    const stars: Star[] = [];
    for (let i = 0; i < settings.starDensity; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const radius = Math.max(0.55 * ratio, (0.45 + rng() * 1.25) * ratio);
      const alpha = 0.25 + rng() * 0.65;
      stars.push({ x, y });

      bg.globalAlpha = alpha;
      bg.fillStyle = palette.star;
      bg.beginPath();
      bg.arc(x, y, radius, 0, TAU);
      bg.fill();

      if (i % 9 === 0) {
        bg.globalAlpha = alpha * 0.4;
        bg.strokeStyle = palette.star;
        bg.lineWidth = Math.max(0.5, ratio * 0.6);
        const flare = radius * 4;
        bg.beginPath();
        bg.moveTo(x - flare, y);
        bg.lineTo(x + flare, y);
        bg.moveTo(x, y - flare);
        bg.lineTo(x, y + flare);
        bg.stroke();
      }
    }

    bg.globalAlpha = 1;
    bg.strokeStyle = palette.chart;
    bg.lineWidth = Math.max(0.5, ratio * 0.6);
    const linkLimit = Math.min(stars.length - 1, 26);
    for (let i = 1; i <= linkLimit; i++) {
      const a = stars[i - 1];
      const b = stars[i];
      if (Math.hypot(b.x - a.x, b.y - a.y) > Math.min(w, h) * 0.28) continue;
      bg.globalAlpha = 0.16;
      bg.beginPath();
      bg.moveTo(a.x, a.y);
      bg.lineTo(b.x, b.y);
      bg.stroke();
    }

    bg.globalAlpha = 0.035;
    bg.fillStyle = palette.star;
    for (let i = 0; i < 1100; i++) {
      const x = rng() * w;
      const y = rng() * h;
      bg.fillRect(x, y, Math.max(0.5, ratio * 0.7), Math.max(0.5, ratio * 0.7));
    }
    bg.globalAlpha = 1;

    const vignette = bg.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.18,
      w * 0.5, h * 0.46, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, '#00000000');
    vignette.addColorStop(0.7, '#00000022');
    vignette.addColorStop(1, '#000000cc');
    bg.fillStyle = vignette;
    bg.fillRect(0, 0, w, h);
  }

  private ensureMotes(width: number, height: number, settings: AppSettings): void {
    const key = `${width}_${height}_${settings.starDensity}`;
    if (this.moteKey === key) return;
    this.moteKey = key;

    const count = Math.round(18 + settings.starDensity * 0.16);
    const rng = mulberry32(4471 + count * 31);
    this.motes.length = 0;
    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: rng() * width,
        y: rng() * height,
        radius: 0.7 + rng() * 1.7,
        phase: rng() * TAU,
        drift: 4 + rng() * 12,
        alpha: 0.12 + rng() * 0.3,
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number,
    settings: AppSettings, audio: AudioMetrics, pointer: PointerState): void {
    this.time += dt;
    this.ensureCache(width, height, settings);
    ctx.drawImage(this.backdrop, 0, 0, width, height);
    this.ensureMotes(width, height, settings);

    const energy = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    const shift = settings.mouseParallax && pointer.active ? (pointer.x - width * 0.5) * 0.006 : 0;
    const starColor = PRESET_PALETTES[settings.preset].star;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = starColor;
    for (const mote of this.motes) {
      mote.y -= mote.drift * dt * (1 + energy * 0.7);
      mote.phase += dt * 0.55;
      if (mote.y < -12) mote.y = height + 12;
      const x = mote.x + Math.sin(mote.phase + this.time * 0.2) * 9 + shift;
      ctx.globalAlpha = mote.alpha * (0.65 + energy * 0.5);
      ctx.beginPath();
      ctx.arc(x, mote.y, mote.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
