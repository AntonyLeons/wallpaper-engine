import { AppSettings } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';

export class VisualizerRenderer {
  private time = 0;
  private gradient: CanvasGradient | null = null;
  private cacheKey = '';

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number,
    settings: AppSettings, audio: AudioMetrics): void {
    this.time += dt;
    if (!settings.audioReactive || !audio.hasAudio || settings.visualizerStyle === 'off') return;
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const span = Math.min(width * 0.38, 360);
    const left = (width - span) / 2;
    const bottom = height - settings.taskbarOffset - 24;
    const key = `${width}_${height}_${p.r}_${p.g}_${p.b}_${s.r}_${s.g}_${s.b}`;
    if (this.cacheKey !== key) {
      this.cacheKey = key;
      this.gradient = ctx.createLinearGradient(left, 0, left + span, 0);
      this.gradient.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 0.16)`);
      this.gradient.addColorStop(0.5, 'rgba(235, 224, 186, 0.6)');
      this.gradient.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, 0.16)`);
    }
    ctx.save();
    ctx.strokeStyle = this.gradient ?? '#ded5ad66';
    ctx.lineCap = 'round';
    const count = Math.min(32, audio.spectrum.length);
    if (count < 2) { ctx.restore(); return; }
    if (settings.visualizerStyle === 'bars') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const value = Math.max(0, Math.min(1, audio.spectrum[i]));
        const envelope = Math.sin((i + 0.5) / count * Math.PI);
        const length = 1 + value * 34 * envelope;
        const x = left + i / (count - 1) * span;
        ctx.moveTo(x, bottom - length * 0.5);
        ctx.lineTo(x, bottom + length * 0.5);
      }
      ctx.stroke();
    } else {
      ctx.lineWidth = 1.2;
      for (let line = 0; line < 2; line++) {
        ctx.globalAlpha = line ? 0.3 : 0.8;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const value = Math.max(0, Math.min(1, audio.spectrum[i]));
          const x = left + i / (count - 1) * span;
          const y = bottom + Math.sin(i * 0.4 + this.time * 1.7 + line * 0.8)
            * value * 22 * Math.sin(i / (count - 1) * Math.PI);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
