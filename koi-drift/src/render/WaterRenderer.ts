import { AppSettings, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './KoiSystem';

export class WaterRenderer {
  private time = 0;
  private backdrop = document.createElement('canvas');
  private caustics = document.createElement('canvas');
  private pattern: CanvasPattern | null = null;
  private cacheKey = '';

  constructor() {
    // One seamless light lattice, reused at two scales instead of full-screen effects.
    this.caustics.width = this.caustics.height = 512;
    const ctx = this.caustics.getContext('2d');
    if (!ctx) return;
    const path = new Path2D();
    const sites: { x: number; y: number }[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        sites.push({ x: (col + 0.5 + Math.sin(col * 73 + row * 17) * 0.38) * 102.4,
          y: (row + 0.5 + Math.cos(col * 31 + row * 43) * 0.38) * 102.4 });
      }
    }
    // Periodic Voronoi cells make an irregular, seamless caustic network.
    for (const site of sites) {
      let polygon = [{ x: -512, y: -512 }, { x: 1024, y: -512 },
        { x: 1024, y: 1024 }, { x: -512, y: 1024 }];
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          for (const other of sites) {
            if (other === site && tx === 0 && ty === 0) continue;
            const ox = other.x + tx * 512;
            const oy = other.y + ty * 512;
            const nx = ox - site.x;
            const ny = oy - site.y;
            const d = (ox * ox + oy * oy - site.x * site.x - site.y * site.y) / 2;
            const clipped: { x: number; y: number }[] = [];
            for (let i = 0; i < polygon.length; i++) {
              const a = polygon[i];
              const b = polygon[(i + 1) % polygon.length];
              const da = a.x * nx + a.y * ny - d;
              const db = b.x * nx + b.y * ny - d;
              if (da <= 0) clipped.push(a);
              if ((da < 0) !== (db < 0)) {
                const t = da / (da - db);
                clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
              }
            }
            polygon = clipped;
          }
        }
      }
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          for (let i = 0; i < polygon.length; i++) {
            const prev = polygon[(i + polygon.length - 1) % polygon.length];
            const point = polygon[i];
            const next = polygon[(i + 1) % polygon.length];
            const x = point.x * 0.86 + prev.x * 0.14 + tx * 512;
            const y = point.y * 0.86 + prev.y * 0.14 + ty * 512;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
            path.quadraticCurveTo(point.x + tx * 512, point.y + ty * 512,
              point.x * 0.86 + next.x * 0.14 + tx * 512,
              point.y * 0.86 + next.y * 0.14 + ty * 512);
          }
          path.closePath();
        }
      }
    }
    ctx.strokeStyle = 'rgba(195, 235, 205, 0.09)';
    ctx.lineWidth = 7;
    ctx.stroke(path);
    ctx.strokeStyle = 'rgba(219, 244, 209, 0.2)';
    ctx.lineWidth = 1.1;
    ctx.stroke(path);
  }

  private ensureCache(ctx: CanvasRenderingContext2D, width: number, height: number, settings: AppSettings): void {
    const key = `${width}_${height}_${settings.pondPreset}`;
    if (this.cacheKey === key) return;
    this.cacheKey = key;
    const ratio = Math.min(1, 1536 / Math.max(width, height));
    this.backdrop.width = Math.max(1, Math.round(width * ratio));
    this.backdrop.height = Math.max(1, Math.round(height * ratio));
    const bg = this.backdrop.getContext('2d');
    if (!bg) return;
    const w = this.backdrop.width;
    const h = this.backdrop.height;
    const palette = PRESET_PALETTES[settings.pondPreset];
    const gradient = bg.createLinearGradient(0, 0, w * 0.7, h);
    gradient.addColorStop(0, palette.waterTop);
    gradient.addColorStop(0.48, palette.waterMid);
    gradient.addColorStop(1, palette.waterBottom);
    bg.fillStyle = gradient;
    bg.fillRect(0, 0, w, h);
    const sun = bg.createRadialGradient(w * 0.3, h * 0.23, 0, w * 0.3, h * 0.23, Math.max(w, h) * 0.66);
    sun.addColorStop(0, settings.pondPreset === 'dusk' ? '#afc5d51b' : '#e2dd9b27');
    sun.addColorStop(1, '#dfefc000');
    bg.fillStyle = sun;
    bg.fillRect(0, 0, w, h);

    // A scattered stone bed fades into the deep centre of the pond.
    for (let i = 0; i < 170; i++) {
      const x = ((Math.sin(i * 127.1 + 4) * 43758.5453) % 1 + 1) % 1 * w;
      const y = ((Math.sin(i * 311.7 + 8) * 19241.71) % 1 + 1) % 1 * h;
      const edge = Math.max(Math.abs(x / w - 0.5) * 2, Math.abs(y / h - 0.5) * 2);
      if (edge < 0.62) continue;
      const r = (5 + (i % 7) * 2.8) * ratio;
      bg.beginPath();
      bg.ellipse(x + 2, y + 4, r * 1.2, r * 0.76, i, 0, Math.PI * 2);
      bg.fillStyle = 'rgba(0, 13, 16, 0.15)';
      bg.fill();
      bg.beginPath();
      bg.ellipse(x, y, r, r * 0.7, i, 0, Math.PI * 2);
      bg.fillStyle = i % 3 === 0 ? 'rgba(155, 163, 127, 0.12)' : 'rgba(106, 141, 125, 0.1)';
      bg.fill();
      bg.strokeStyle = 'rgba(202, 211, 167, 0.065)';
      bg.lineWidth = 1;
      bg.stroke();
    }
    const vignette = bg.createRadialGradient(w * 0.48, h * 0.43, Math.min(w, h) * 0.12,
      w * 0.48, h * 0.43, Math.max(w, h) * 0.67);
    vignette.addColorStop(0, '#02131100');
    vignette.addColorStop(0.65, '#02131116');
    vignette.addColorStop(1, '#010e13b0');
    bg.fillStyle = vignette;
    bg.fillRect(0, 0, w, h);
    this.pattern = ctx.createPattern(this.caustics, 'repeat');
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number,
    settings: AppSettings, audio: AudioMetrics, mouse: MouseState): void {
    this.time += dt;
    this.ensureCache(ctx, width, height, settings);
    ctx.drawImage(this.backdrop, 0, 0, width, height);
    const energy = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    if (this.pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = this.pattern;
      const zoom = Math.max(0.75, Math.min(1.7, Math.min(width, height) / 800));
      for (let layer = 0; layer < 2; layer++) {
        ctx.save();
        const s = zoom * (layer === 0 ? 1 : 1.37);
        const x = Math.sin(this.time * 0.065 + layer * 2) * 30 + this.time * (layer ? -1.3 : 1.8);
        const y = Math.cos(this.time * 0.08 + layer) * 22;
        ctx.scale(s, s);
        ctx.translate(x % 512, y);
        ctx.globalAlpha = (layer ? 0.08 : 0.13) + energy * 0.08;
        ctx.fillRect(-1024, -1024, width / s + 2048, height / s + 2048);
        ctx.restore();
      }
      ctx.restore();
    }
    if (settings.mouseFollow && mouse.active) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = `rgb(${settings.primaryColor.r}, ${settings.primaryColor.g}, ${settings.primaryColor.b})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 22 + Math.sin(this.time) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
