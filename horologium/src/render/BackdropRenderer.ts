import { PRESET_PALETTES } from '../config/settings';
import type { AppSettings } from '../config/settings';
import { withAlpha } from '../util/color';

export class BackdropRenderer {
  private backdrop = document.createElement('canvas');
  private cacheKey = '';

  private ensureCache(width: number, height: number, settings: AppSettings): void {
    const key = `${width}_${height}_${settings.clockworkPreset}`;
    if (this.cacheKey === key) return;
    this.cacheKey = key;

    const ratio = Math.min(1, 1536 / Math.max(width, height));
    this.backdrop.width = Math.max(1, Math.round(width * ratio));
    this.backdrop.height = Math.max(1, Math.round(height * ratio));
    const ctx = this.backdrop.getContext('2d');
    if (!ctx) return;

    const w = this.backdrop.width;
    const h = this.backdrop.height;
    const palette = PRESET_PALETTES[settings.clockworkPreset];

    const base = ctx.createLinearGradient(0, 0, w * 0.35, h);
    base.addColorStop(0, palette.backdropTop);
    base.addColorStop(1, palette.backdropBottom);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const lamp = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, Math.max(w, h) * 0.72);
    lamp.addColorStop(0, withAlpha(palette.glow, 0.13));
    lamp.addColorStop(0.42, withAlpha(palette.glow, 0.045));
    lamp.addColorStop(1, withAlpha(palette.glow, 0));
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, w, h);

    const spacing = Math.max(28, Math.round(Math.min(w, h) / 18));
    ctx.beginPath();
    for (let x = spacing / 2; x < w; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.strokeStyle = withAlpha(palette.engraving, 0.04);
    ctx.lineWidth = 1;
    ctx.stroke();

    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = Math.min(w, h) * 0.34;
    ctx.strokeStyle = withAlpha(palette.engraving, 0.075);
    ctx.beginPath();
    for (const factor of [0.22, 0.42, 0.62, 0.82, 1, 1.14, 1.3]) {
      ctx.moveTo(cx + radius * factor, cy);
      ctx.arc(cx, cy, radius * factor, 0, Math.PI * 2);
    }
    ctx.stroke();

    ctx.strokeStyle = withAlpha(palette.engraving, 0.035);
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const angle = i / 36 * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(angle) * radius * 0.18, cy + Math.sin(angle) * radius * 0.18);
      ctx.lineTo(cx + Math.cos(angle) * radius * 1.34, cy + Math.sin(angle) * radius * 1.34);
    }
    ctx.stroke();

    ctx.strokeStyle = withAlpha(palette.engraving, 0.09);
    ctx.strokeRect(w * 0.018, h * 0.028, w * 0.964, h * 0.944);
    ctx.strokeStyle = withAlpha(palette.engraving, 0.16);
    const corner = Math.min(w, h) * 0.035;
    for (const [x, y, sx, sy] of [
      [w * 0.018, h * 0.028, 1, 1],
      [w * 0.982, h * 0.028, -1, 1],
      [w * 0.018, h * 0.972, 1, -1],
      [w * 0.982, h * 0.972, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * corner, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * corner);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(cx, h * 0.46, Math.min(w, h) * 0.16,
      cx, h * 0.46, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.65, 'rgba(0, 0, 0, 0.16)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, settings: AppSettings): void {
    this.ensureCache(width, height, settings);
    ctx.drawImage(this.backdrop, 0, 0, width, height);
  }
}
