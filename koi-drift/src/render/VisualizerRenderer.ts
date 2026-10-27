import { AppSettings, ColorRGB } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { PRESET_PALETTES } from '../config/settings';

function hexToRGBStr(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}`;
}

function mix(a: ColorRGB, b: ColorRGB, t: number): ColorRGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export class VisualizerRenderer {
  private barColors: string[] = [];
  private time = 0;

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    deltaTimeSec: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    this.time += deltaTimeSec;
    this.ensureBarColors(settings, audio.spectrum.length);
    // Only visualize live audio; the idle spectrum stays hidden.
    if (!settings.audioReactive || !audio.hasAudio) return;

    const spectrum = audio.spectrum;
    const numBins = spectrum.length;

    // Keep the visualizer clear of the taskbar.
    const autoTaskbarHeight =
      typeof window !== 'undefined' && window.screen
        ? Math.max(0, window.screen.height - window.screen.availHeight)
        : 0;
    const taskbarOffset = settings.taskbarOffset > 0 ? settings.taskbarOffset : Math.max(48, autoTaskbarHeight);
    const bottomY = height - taskbarOffset;

    if (settings.visualizerStyle === 'bars') {
      // Soft, rounded spectrum beads rising from the pond floor.
      const maxBarLength = height * 0.22;
      const count = Math.min(32, numBins);

      for (let i = 0; i < count; i++) {
        const value = Math.max(0, Math.min(1, spectrum[i]));
        if (value < 0.02) continue;

        const length = value * maxBarLength;
        const color = this.barColors[i % this.barColors.length];

        const x = width * (0.06 + (0.88 * i) / count);
        const y0 = bottomY;
        const y1 = bottomY - length;

        ctx.strokeStyle = `rgba(${color}, ${(0.2 + value * 0.5).toFixed(3)})`;
        ctx.lineWidth = Math.max(2.5, Math.min(9, width / count * 0.16));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y0 - 4);
        ctx.lineTo(x, y1 + 6);
        ctx.stroke();

        // Bright cap dot.
        ctx.fillStyle = `rgba(${color}, ${(0.35 + value * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y1, ctx.lineWidth * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (settings.visualizerStyle === 'waveform') {
      // A gently breathing waterline that reacts to the overall level.
      const centerY = bottomY - height * 0.035;
      const amplitude = height * (0.012 + audio.overall * 0.05);
      const step = width / (numBins - 1);

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      const c0 = mix(settings.primaryColor, settings.secondaryColor, 0.0);
      const c1 = mix(settings.primaryColor, settings.secondaryColor, 1.0);
      grad.addColorStop(0, `rgba(${c0.r}, ${c0.g}, ${c0.b}, 0.55)`);
      grad.addColorStop(0.5, `rgba(${hexToRGBStr(PRESET_PALETTES[settings.pondPreset].caustic)}, 0.75)`);
      grad.addColorStop(1, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.55)`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2, height * 0.0028);
      ctx.beginPath();
      for (let i = 0; i < numBins; i++) {
        const value = Math.max(0, Math.min(1, spectrum[i]));
        const x = i * step;
        const y = centerY - Math.sin((i / numBins) * Math.PI * 4 + this.time * 2.2) * value * amplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Faint reflection below the waterline.
      ctx.globalAlpha = 0.3;
      ctx.lineWidth *= 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private ensureBarColors(settings: AppSettings, binCount: number): void {
    this.barColors = new Array<string>(binCount);
    for (let i = 0; i < binCount; i++) {
      const t = i / Math.max(1, binCount - 1);
      const c = mix(settings.primaryColor, settings.secondaryColor, t);
      this.barColors[i] = `${c.r}, ${c.g}, ${c.b}`;
    }
  }
}
