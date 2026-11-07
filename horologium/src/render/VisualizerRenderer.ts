import type { AppSettings } from '../config/settings';
import type { AudioMetrics } from '../audio/AudioAnalyzer';
import { cssColor } from '../util/color';

type ClockBounds = Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width'>;

export class VisualizerRenderer {
  private time = 0;
  private gradient: CanvasGradient | null = null;
  private cacheKey = '';

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dt: number,
    settings: AppSettings,
    audio: AudioMetrics,
    clockBounds: ClockBounds | null = null
  ): void {
    this.time += dt;
    if (!settings.audioReactive || !audio.hasAudio || settings.visualizerStyle === 'off') return;

    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const followClock = settings.visualizerPosition === 'follow_clock' && settings.showClock && clockBounds;
    const span = Math.min(width * 0.38, 380, followClock ? Math.max(140, clockBounds.width) : Infinity);
    const insetX = Math.min(followClock ? 1 : width * 0.04, (width - span) / 2);
    const minX = insetX;
    const maxX = width - span - insetX;
    const minY = Math.min(24, height / 2);
    const maxY = Math.max(minY, height - settings.taskbarOffset - 24);
    let left = (width - span) / 2;
    let baseline = Math.max(minY, Math.min(maxY, height / 2));
    const position = settings.visualizerPosition;

    if (position === 'follow_clock') {
      if (followClock) {
        left = Math.max(minX, Math.min(maxX, (clockBounds.left + clockBounds.right - span) / 2));
        const below = clockBounds.bottom + 34;
        baseline = below <= maxY ? below : clockBounds.top - 34;
        baseline = Math.max(minY, Math.min(maxY, baseline));
      } else {
        baseline = maxY;
      }
    } else if (position === 'custom') {
      left = minX + (maxX - minX) * settings.visualizerPositionX / 100;
      baseline = minY + (maxY - minY) * settings.visualizerPositionY / 100;
    } else {
      if (position.endsWith('_left')) left = minX;
      if (position.endsWith('_right')) left = maxX;
      if (position.startsWith('top_')) baseline = minY;
      if (position.startsWith('bottom_')) baseline = maxY;
    }

    const key = `${left}_${span}_${p.r}_${p.g}_${p.b}_${s.r}_${s.g}_${s.b}`;
    if (this.cacheKey !== key) {
      this.cacheKey = key;
      this.gradient = ctx.createLinearGradient(left, 0, left + span, 0);
      this.gradient.addColorStop(0, cssColor(p, 0.22));
      this.gradient.addColorStop(0.5, cssColor(s, 0.82));
      this.gradient.addColorStop(1, cssColor(p, 0.22));
    }

    ctx.save();
    ctx.strokeStyle = cssColor(p, 0.24);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, baseline);
    ctx.lineTo(left + span, baseline);
    ctx.moveTo(left, baseline - 6);
    ctx.lineTo(left, baseline + 6);
    ctx.moveTo(left + span, baseline - 6);
    ctx.lineTo(left + span, baseline + 6);
    ctx.stroke();

    ctx.strokeStyle = cssColor(p, 0.12);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = left + i / 16 * span;
      const tick = i % 4 === 0 ? 5 : 2.5;
      ctx.moveTo(x, baseline + 5);
      ctx.lineTo(x, baseline + 5 + tick);
    }
    ctx.stroke();

    const count = Math.min(32, audio.spectrum.length);
    if (count < 2) {
      ctx.restore();
      return;
    }

    ctx.strokeStyle = this.gradient ?? cssColor(s, 0.7);
    ctx.lineCap = 'round';

    if (settings.visualizerStyle === 'bars') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const value = Math.max(0, Math.min(1, audio.spectrum[i]));
        const envelope = Math.sin((i + 0.5) / count * Math.PI);
        const length = 1 + value * 38 * envelope;
        const x = left + i / (count - 1) * span;
        ctx.moveTo(x, baseline - length * 0.5);
        ctx.lineTo(x, baseline + length * 0.5);
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = cssColor(p, 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const x = left + i / 8 * span;
        ctx.moveTo(x, baseline - 22);
        ctx.lineTo(x, baseline + 22);
      }
      ctx.stroke();

      ctx.strokeStyle = this.gradient ?? cssColor(s, 0.7);
      for (let line = 0; line < 2; line++) {
        ctx.globalAlpha = line ? 0.32 : 0.85;
        ctx.lineWidth = line ? 1 : 1.5;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const value = Math.max(0, Math.min(1, audio.spectrum[i]));
          const x = left + i / (count - 1) * span;
          const y = baseline + Math.sin(i * 0.4 + this.time * 1.7 + line * 0.8)
            * value * 24 * Math.sin(i / (count - 1) * Math.PI);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
