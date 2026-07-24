import { AppSettings, ColorRGB } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './ParticleSystem';

export class BackgroundRenderer {
  private time = 0;
  private cachedPrimaryStr = '';
  private cachedSecondaryStr = '';
  private cachedPrimary: ColorRGB = { r: 0, g: 0, b: 0 };
  private cachedSecondary: ColorRGB = { r: 0, g: 0, b: 0 };
  private hasCachedColors = false;
  private spectrumBinCount = 0;
  private spectrumCos = new Float32Array(0);
  private spectrumSin = new Float32Array(0);
  private waveformShape = new Float32Array(0);
  private spectrumColors: string[] = [];

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    deltaTimeSec: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    this.time += deltaTimeSec;
    this.updateColorCache(settings.primaryColor, settings.secondaryColor);

    // 1. Draw Theme Background
    switch (settings.schemeType) {
      case 'synthwave':
        this.renderSynthwaveTheme(ctx, width, height, settings, audio);
        break;
      case 'quantum':
        this.renderQuantumTheme(ctx, width, height, settings, audio);
        break;
      case 'obsidian':
        this.renderObsidianTheme(ctx, width, height, settings, audio);
        break;
      case 'cosmic':
      default:
        this.renderCosmicTheme(ctx, width, height, settings, audio);
        break;
    }

    // 2. Draw Interactive Mouse Glow
    if (settings.showMouseGlow && mouse.active) {
      this.renderMouseGlow(ctx, mouse);
    }

    // 3. Draw Audio Visualizer Overlay
    if (settings.visualizerStyle !== 'off') {
      this.renderAudioVisualizer(ctx, width, height, settings, audio);
    }
  }

  private updateColorCache(primary: ColorRGB, secondary: ColorRGB): void {
    if (
      this.hasCachedColors &&
      this.cachedPrimary.r === primary.r &&
      this.cachedPrimary.g === primary.g &&
      this.cachedPrimary.b === primary.b &&
      this.cachedSecondary.r === secondary.r &&
      this.cachedSecondary.g === secondary.g &&
      this.cachedSecondary.b === secondary.b
    ) {
      return;
    }

    this.cachedPrimary = { ...primary };
    this.cachedSecondary = { ...secondary };
    this.cachedPrimaryStr = `${primary.r}, ${primary.g}, ${primary.b}`;
    this.cachedSecondaryStr = `${secondary.r}, ${secondary.g}, ${secondary.b}`;
    this.hasCachedColors = true;
    this.updateSpectrumColors();
  }

  private ensureSpectrumCache(numBins: number): void {
    if (numBins === this.spectrumBinCount) return;

    this.spectrumBinCount = numBins;
    this.spectrumCos = new Float32Array(numBins);
    this.spectrumSin = new Float32Array(numBins);
    this.waveformShape = new Float32Array(numBins);

    const denominator = Math.max(1, numBins - 1);
    for (let i = 0; i < numBins; i++) {
      const progress = i / denominator;
      const angle = progress * Math.PI * 2 - Math.PI / 2;
      this.spectrumCos[i] = Math.cos(angle);
      this.spectrumSin[i] = Math.sin(angle);
      this.waveformShape[i] = Math.sin(progress * Math.PI * 3);
    }

    this.updateSpectrumColors();
  }

  private updateSpectrumColors(): void {
    if (this.spectrumBinCount === 0) return;

    this.spectrumColors = new Array<string>(this.spectrumBinCount);
    const denominator = Math.max(1, this.spectrumBinCount - 1);
    for (let i = 0; i < this.spectrumBinCount; i++) {
      const mix = i / denominator;
      const r = Math.round(this.cachedPrimary.r + (this.cachedSecondary.r - this.cachedPrimary.r) * mix);
      const g = Math.round(this.cachedPrimary.g + (this.cachedSecondary.g - this.cachedPrimary.g) * mix);
      const b = Math.round(this.cachedPrimary.b + (this.cachedSecondary.b - this.cachedPrimary.b) * mix);
      this.spectrumColors[i] = `${r}, ${g}, ${b}`;
    }
  }

  private getReactiveOpacity(audio: AudioMetrics): number {
    return audio.hasAudio ? Math.min(1, Math.max(0, (audio.overall - 0.012) / 0.08)) : 0;
  }

  private renderCosmicTheme(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    const bass = settings.audioReactive ? audio.bass : 0;

    // Dark void background
    ctx.fillStyle = '#060711';
    ctx.fillRect(0, 0, width, height);

    // Glowing Nebula Core 1 (Primary)
    const cx1 = width * 0.3 + Math.sin(this.time * 0.2) * 50;
    const cy1 = height * 0.4 + Math.cos(this.time * 0.25) * 40;
    const r1 = Math.max(width, height) * (0.45 + bass * 0.08);

    const grad1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, r1);
    grad1.addColorStop(0, `rgba(${this.cachedPrimaryStr}, 0.35)`);
    grad1.addColorStop(0.5, `rgba(${this.cachedPrimaryStr}, 0.1)`);
    grad1.addColorStop(1, 'rgba(6, 7, 17, 0)');

    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    // Glowing Nebula Core 2 (Secondary)
    const cx2 = width * 0.7 + Math.cos(this.time * 0.18) * 60;
    const cy2 = height * 0.6 + Math.sin(this.time * 0.22) * 50;
    const r2 = Math.max(width, height) * (0.4 + bass * 0.06);

    const grad2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, r2);
    grad2.addColorStop(0, `rgba(${this.cachedSecondaryStr}, 0.3)`);
    grad2.addColorStop(0.5, `rgba(${this.cachedSecondaryStr}, 0.08)`);
    grad2.addColorStop(1, 'rgba(6, 7, 17, 0)');

    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);
  }

  private renderSynthwaveTheme(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    const bass = settings.audioReactive ? audio.bass : 0;

    // Dark sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0a0518');
    skyGrad.addColorStop(0.5, '#190a38');
    skyGrad.addColorStop(1, '#05020a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Neon Sun at horizon center
    const sunX = width * 0.5;
    const horizonY = height * 0.65;
    const sunRadius = Math.min(width, height) * (0.15 + bass * 0.03);

    ctx.save();
    const sunGrad = ctx.createLinearGradient(sunX, horizonY - sunRadius, sunX, horizonY + sunRadius);
    sunGrad.addColorStop(0, 'rgb(255, 220, 100)');
    sunGrad.addColorStop(0.5, `rgb(${this.cachedSecondaryStr})`);
    sunGrad.addColorStop(1, `rgb(${this.cachedPrimaryStr})`);

    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, horizonY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Synthwave 3D Perspective Grid
    ctx.save();
    ctx.strokeStyle = `rgba(${this.cachedPrimaryStr}, 0.4)`;
    ctx.lineWidth = 1.5;

    // Horizon Line
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    // Perspective lines radiating from sun center
    const numLines = 24;
    for (let i = 0; i <= numLines; i++) {
      const xRatio = i / numLines;
      const bottomX = (xRatio - 0.5) * width * 3 + width * 0.5;

      ctx.beginPath();
      ctx.moveTo(sunX, horizonY);
      ctx.lineTo(bottomX, height);
      ctx.stroke();
    }

    // Moving horizontal grid lines
    const speed = (this.time * 60) % 40;
    for (let y = horizonY; y < height; y += (y - horizonY + 10) * 0.15 + speed * 0.1) {
      if (y > horizonY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderQuantumTheme(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    const mid = settings.audioReactive ? audio.mid : 0;

    ctx.fillStyle = '#030814';
    ctx.fillRect(0, 0, width, height);

    // Dynamic wave light strands
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const numWaves = 4;

    for (let w = 0; w < numWaves; w++) {
      const isPrimary = w % 2 === 0;
      const colStr = isPrimary ? this.cachedPrimaryStr : this.cachedSecondaryStr;
      const alpha = (0.15 + mid * 0.1).toFixed(2);

      ctx.strokeStyle = `rgba(${colStr}, ${alpha})`;
      ctx.lineWidth = 3 + w * 2;
      ctx.beginPath();

      const speed = this.time * (0.4 + w * 0.1);
      const yOffset = height * (0.3 + w * 0.15);

      for (let x = 0; x <= width; x += 30) {
        const y = yOffset + Math.sin(x * 0.003 + speed + w) * 80 + Math.cos(x * 0.007 - speed) * 40;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderObsidianTheme(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    const bass = settings.audioReactive ? audio.bass : 0;

    // Ultra dark matte black background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Subtle luxury ambient center glow
    const cx = width * 0.5;
    const cy = height * 0.5;
    const radius = Math.min(width, height) * (0.4 + bass * 0.05);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${this.cachedPrimaryStr}, 0.15)`);
    grad.addColorStop(1, 'rgba(10, 10, 12, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  private renderMouseGlow(ctx: CanvasRenderingContext2D, mouse: MouseState): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.pulseRadius);
    grad.addColorStop(0, `rgba(${this.cachedPrimaryStr}, 0.25)`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, mouse.pulseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderAudioVisualizer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    const spectrum = audio.spectrum;
    const numBins = spectrum.length;
    this.ensureSpectrumCache(numBins);

    // Detect taskbar height dynamically or use configured taskbarOffset
    const autoTaskbarHeight = typeof window !== 'undefined' && window.screen ? Math.max(0, window.screen.height - window.screen.availHeight) : 0;
    const taskbarOffset = settings.taskbarOffset > 0 ? settings.taskbarOffset : Math.max(48, autoTaskbarHeight);
    const bottomY = height - taskbarOffset;

    ctx.save();

    if (settings.visualizerStyle === 'bars') {
      // Bottom Spectrum Bars (rendered cleanly above taskbar)
      const barWidth = width / numBins;
      const maxHeight = height * 0.25;
      const p = settings.primaryColor;
      const s = settings.secondaryColor;

      for (let i = 0; i < numBins; i++) {
        const val = spectrum[i];
        if (val <= 0.001) continue;
        const h = val * maxHeight;
        const x = i * barWidth;
        const y = bottomY - h;

        const t = i / numBins;
        const r = Math.round(p.r + (s.r - p.r) * t);
        const g = Math.round(p.g + (s.g - p.g) * t);
        const b = Math.round(p.b + (s.b - p.b) * t);

        const barGrad = ctx.createLinearGradient(x, bottomY, x, y);
        barGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
        barGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.15)`);

        ctx.fillStyle = barGrad;
        ctx.fillRect(x + 2, y, barWidth - 4, h);
      }
    } else if (settings.visualizerStyle === 'circular') {
      // Layered circular spectrum: an aura, a core ring, and rounded reactive bars.
      const cx = width * 0.5;
      const cy = height * 0.5;
      const baseRadius = Math.min(width, height) * 0.18;
      const minDimension = Math.min(width, height);
      const barWidth = Math.max(3, minDimension * 0.0036);
      const coreWidth = Math.max(5, minDimension * 0.006);
      const maxBarLength = baseRadius * 0.42;

      ctx.globalCompositeOperation = 'lighter';
      const ringGrad = ctx.createLinearGradient(cx - baseRadius, cy, cx + baseRadius, cy);
      ringGrad.addColorStop(0, `rgb(${this.cachedPrimaryStr})`);
      ringGrad.addColorStop(1, `rgb(${this.cachedSecondaryStr})`);

      const aura = ctx.createRadialGradient(cx, cy, baseRadius * 0.55, cx, cy, baseRadius * 1.5);
      aura.addColorStop(0, 'rgba(0, 0, 0, 0)');
      aura.addColorStop(0.55, `rgba(${this.cachedPrimaryStr}, 0.08)`);
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // No reactive spokes at rest; the audio release envelope controls their final fade-out.
      const reactiveOpacity = this.getReactiveOpacity(audio);
      if (reactiveOpacity > 0) {
        ctx.lineCap = 'butt';
        for (let i = 0; i < numBins; i++) {
          const value = Math.max(0, Math.min(1, spectrum[i]));
          const length = minDimension * 0.004 + value * maxBarLength;
          // Start at the core's outer edge, with the foreground core defining the join.
          const barStartRadius = baseRadius + coreWidth * 0.5;
          const cos = this.spectrumCos[i];
          const sin = this.spectrumSin[i];
          const x1 = cx + cos * barStartRadius;
          const y1 = cy + sin * barStartRadius;
          const x2 = cx + cos * (barStartRadius + length);
          const y2 = cy + sin * (barStartRadius + length);
          const color = this.spectrumColors[i];

          ctx.strokeStyle = `rgba(${color}, ${0.22 * reactiveOpacity})`;
          ctx.lineWidth = barWidth * 3.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.fillStyle = `rgba(${color}, ${0.22 * reactiveOpacity})`;
          ctx.beginPath();
          ctx.arc(x2, y2, barWidth * 1.75, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(${color}, ${reactiveOpacity})`;
          ctx.lineWidth = barWidth;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.fillStyle = `rgba(${color}, ${reactiveOpacity})`;
          ctx.beginPath();
          ctx.arc(x2, y2, barWidth * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw the core last, masking every spoke's flat inner edge for a seamless join.
      ctx.strokeStyle = ringGrad;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = coreWidth * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.lineWidth = coreWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad;
      ctx.stroke();
    } else if (settings.visualizerStyle === 'waveform') {
      // A centered, glowing waveform that disappears fully when audio has decayed away.
      ctx.globalCompositeOperation = 'lighter';
      const reactiveOpacity = this.getReactiveOpacity(audio);
      if (reactiveOpacity > 0) {
        const centerY = bottomY - height * 0.1;
        const step = width / (numBins - 1);
        const amplitude = Math.min(height * 0.18, width * 0.1);
        const waveGrad = ctx.createLinearGradient(0, centerY, width, centerY);
        waveGrad.addColorStop(0, `rgb(${this.cachedPrimaryStr})`);
        waveGrad.addColorStop(0.5, `rgb(${this.cachedSecondaryStr})`);
        waveGrad.addColorStop(1, `rgb(${this.cachedPrimaryStr})`);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < numBins; i++) {
          const value = Math.max(0, Math.min(1, spectrum[i]));
          const x = i * step;
          const y = centerY - this.waveformShape[i] * value * amplitude;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevValue = Math.max(0, Math.min(1, spectrum[i - 1]));
            const prevY = centerY - this.waveformShape[i - 1] * prevValue * amplitude;
            ctx.quadraticCurveTo((x - step * 0.5), prevY, x, y);
          }
        }

        // Re-stroke the same path for a wide, soft neon aura and a crisp centre trace.
        ctx.strokeStyle = waveGrad;
        ctx.globalAlpha = 0.2 * reactiveOpacity;
        ctx.lineWidth = Math.max(10, height * 0.012);
        ctx.stroke();

        ctx.globalAlpha = 0.92 * reactiveOpacity;
        ctx.lineWidth = Math.max(2.5, height * 0.0032);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
