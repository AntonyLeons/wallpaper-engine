import { AppSettings, ColorRGB } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './ParticleSystem';

export class BackgroundRenderer {
  private time = 0;
  private cachedPrimaryStr = '';
  private cachedSecondaryStr = '';
  private cachedPrimary: ColorRGB = { r: 0, g: 0, b: 0 };
  private cachedSecondary: ColorRGB = { r: 0, g: 0, b: 0 };

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
    if (mouse.active) {
      this.renderMouseGlow(ctx, mouse);
    }

    // 3. Draw Audio Visualizer Overlay
    if (settings.visualizerStyle !== 'off') {
      this.renderAudioVisualizer(ctx, width, height, settings, audio);
    }
  }

  private updateColorCache(primary: ColorRGB, secondary: ColorRGB): void {
    if (
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

    ctx.save();

    if (settings.visualizerStyle === 'bars') {
      // Bottom Spectrum Bars
      const barWidth = width / numBins;
      const maxHeight = height * 0.25;

      const spectrumGrad = ctx.createLinearGradient(0, 0, width, 0);
      spectrumGrad.addColorStop(0, `rgb(${this.cachedPrimaryStr})`);
      spectrumGrad.addColorStop(1, `rgb(${this.cachedSecondaryStr})`);

      ctx.fillStyle = spectrumGrad;
      ctx.globalAlpha = 0.75;

      for (let i = 0; i < numBins; i++) {
        const val = spectrum[i];
        const h = val * maxHeight;
        const x = i * barWidth;
        const y = height - h;
        ctx.fillRect(x + 2, y, barWidth - 4, h);
      }
    } else if (settings.visualizerStyle === 'circular') {
      // Circular Pulse Ring in Center
      const cx = width * 0.5;
      const cy = height * 0.5;
      const baseRadius = Math.min(width, height) * 0.18;

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 3;

      ctx.beginPath();
      for (let i = 0; i <= numBins; i++) {
        const idx = i % numBins;
        const val = spectrum[idx];
        const angle = (i / numBins) * Math.PI * 2 - Math.PI / 2;
        const r = baseRadius + val * baseRadius * 0.8;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const ringGrad = ctx.createLinearGradient(cx - baseRadius, cy, cx + baseRadius, cy);
      ringGrad.addColorStop(0, `rgb(${this.cachedPrimaryStr})`);
      ringGrad.addColorStop(1, `rgb(${this.cachedSecondaryStr})`);

      ctx.strokeStyle = ringGrad;
      ctx.stroke();
    } else if (settings.visualizerStyle === 'waveform') {
      // Flowing Waveform across screen bottom half
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 3.5;
      ctx.beginPath();

      const centerY = height * 0.85;
      const step = width / (numBins - 1);

      for (let i = 0; i < numBins; i++) {
        const val = spectrum[i];
        const x = i * step;
        const y = centerY - val * height * 0.15;

        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpX, centerY - spectrum[i - 1] * height * 0.15, x, y);
        }
      }

      ctx.strokeStyle = `rgba(${this.cachedPrimaryStr}, 0.85)`;
      ctx.stroke();
    }

    ctx.restore();
  }
}
