import { AppSettings } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class VisualizerRenderer {
  private time = 0;
  private barGradient: CanvasGradient | null = null;
  private waveGradient: CanvasGradient | null = null;
  private gradientKey = '';

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    deltaTimeSec: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    this.time += deltaTimeSec;
    if (!settings.audioReactive || !audio.hasAudio || settings.visualizerStyle === 'off') return;

    const opacity = clamp((audio.overall - 0.008) / 0.06, 0, 1);
    if (opacity <= 0.01) return;

    const count = Math.min(32, audio.spectrum.length);
    if (count < 2) return;

    const span = Math.min(width * 0.56, 780);
    const left = (width - span) * 0.5;
    const bottom = height - settings.taskbarOffset - 28;
    const maxHeight = Math.min(height * 0.13, 96);
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const key = `${width}_${height}_${bottom}_${maxHeight}_${p.r}_${p.g}_${p.b}_${s.r}_${s.g}_${s.b}`;

    if (key !== this.gradientKey) {
      this.gradientKey = key;

      this.barGradient = ctx.createLinearGradient(0, bottom, 0, bottom - maxHeight);
      this.barGradient.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 0.92)`);
      this.barGradient.addColorStop(0.55, `rgba(${s.r}, ${s.g}, ${s.b}, 0.7)`);
      this.barGradient.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, 0.22)`);

      this.waveGradient = ctx.createLinearGradient(left, 0, left + span, 0);
      this.waveGradient.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 0.15)`);
      this.waveGradient.addColorStop(0.5, `rgba(${p.r}, ${p.g}, ${p.b}, 0.9)`);
      this.waveGradient.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, 0.15)`);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (settings.visualizerStyle === 'bars') {
      const barWidth = Math.max(2, (span / count) * 0.52);
      ctx.fillStyle = this.barGradient ?? `rgba(${p.r}, ${p.g}, ${p.b}, 0.6)`;

      for (let i = 0; i < count; i++) {
        const value = clamp(audio.spectrum[i], 0, 1);
        const envelope = Math.sin(((i + 0.5) / count) * Math.PI);
        const barHeight = 2 + value * maxHeight * envelope;
        const x = left + (i / (count - 1)) * span - barWidth * 0.5;

        ctx.globalAlpha = opacity * (0.35 + value * 0.65);
        ctx.fillRect(x, bottom - barHeight, barWidth, barHeight);
      }

      ctx.globalAlpha = opacity * 0.22;
      ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
      ctx.fillRect(left, bottom + 3, span, 1);
    } else {
      const centerY = bottom - 18;
      const amplitude = Math.min(height * 0.055, 48);
      ctx.strokeStyle = this.waveGradient ?? `rgba(${p.r}, ${p.g}, ${p.b}, 0.7)`;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = pass === 0 ? opacity * 0.18 : opacity * 0.85;
        ctx.lineWidth = pass === 0 ? 9 : 1.6;
        ctx.beginPath();

        for (let i = 0; i < count; i++) {
          const value = clamp(audio.spectrum[i], 0, 1);
          const x = left + (i / (count - 1)) * span;
          const envelope = Math.sin(((i + 0.5) / count) * Math.PI);
          const y = centerY + Math.sin(i * 0.5 + this.time * 1.8) * value * amplitude * envelope;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
