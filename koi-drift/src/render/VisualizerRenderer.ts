import { AppSettings } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';

export class VisualizerRenderer {
  private time = 0;
  private gradient: CanvasGradient | null = null;
  private cacheKey = '';

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number,
    settings: AppSettings, audio: AudioMetrics,
    clockBounds: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width'> | null = null): void {
    this.time += dt;
    if (!settings.audioReactive || !audio.hasAudio || settings.visualizerStyle === 'off') return;
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const followClock = settings.visualizerPosition === 'follow_clock' && settings.showClock && clockBounds;
    const span = Math.min(width * 0.38, 360,
      followClock ? Math.max(120, clockBounds.width) : Infinity);
    // Keep the complete waveform inside the viewport, even at 0% / 100%.
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
        // Prefer below the clock; move above when the taskbar or bottom edge is close.
        const below = clockBounds.bottom + 34;
        baseline = below <= maxY ? below : clockBounds.top - 34;
        baseline = Math.max(minY, Math.min(maxY, baseline));
      } else {
        // Keep audio visible when the optional clock is switched off.
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
        ctx.moveTo(x, baseline - length * 0.5);
        ctx.lineTo(x, baseline + length * 0.5);
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
          const y = baseline + Math.sin(i * 0.4 + this.time * 1.7 + line * 0.8)
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
