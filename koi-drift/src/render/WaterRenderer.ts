import { AppSettings, ColorRGB, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './KoiSystem';

function hexToRGBStr(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}`;
}

export class WaterRenderer {
  private time = 0;
  private cachedPreset: string = '';
  private cachedPrimary: ColorRGB = { r: 0, g: 0, b: 0 };
  private cachedSecondary: ColorRGB = { r: 0, g: 0, b: 0 };
  private cachedPrimaryStr = '';
  private hasCached = false;
  private causticStr = '159, 232, 220';
  private tintR = 0;
  private tintG = 0;
  private tintB = 0;

  private rayAngles = new Float32Array(6);
  private raySeeds = new Float32Array(6);

  constructor() {
    for (let i = 0; i < this.rayAngles.length; i++) {
      this.raySeeds[i] = Math.random() * Math.PI * 2;
      this.rayAngles[i] = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    }
  }

  private ensureCache(settings: AppSettings): void {
    if (
      this.hasCached &&
      this.cachedPreset === settings.pondPreset &&
      this.cachedPrimary.r === settings.primaryColor.r &&
      this.cachedPrimary.g === settings.primaryColor.g &&
      this.cachedPrimary.b === settings.primaryColor.b &&
      this.cachedSecondary.r === settings.secondaryColor.r &&
      this.cachedSecondary.g === settings.secondaryColor.g &&
      this.cachedSecondary.b === settings.secondaryColor.b
    ) {
      return;
    }

    this.cachedPreset = settings.pondPreset;
    this.cachedPrimary = { ...settings.primaryColor };
    this.cachedSecondary = { ...settings.secondaryColor };
    this.cachedPrimaryStr = `${this.cachedPrimary.r}, ${this.cachedPrimary.g}, ${this.cachedPrimary.b}`;
    this.causticStr = hexToRGBStr(PRESET_PALETTES[settings.pondPreset].caustic);
    const tint = hexToRGBStr(PRESET_PALETTES[settings.pondPreset].tint).split(/,\s*/);
    this.tintR = parseInt(tint[0], 10);
    this.tintG = parseInt(tint[1], 10);
    this.tintB = parseInt(tint[2], 10);
    this.hasCached = true;
  }

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
    this.ensureCache(settings);

    const luminanceBoost = settings.audioReactive && audio.hasAudio ? audio.overall * 0.35 : 0;

    // 1. Base water gradient
    const palette = PRESET_PALETTES[settings.pondPreset];
    const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
    waterGrad.addColorStop(0, palette.waterTop);
    waterGrad.addColorStop(0.55, palette.waterMid);
    waterGrad.addColorStop(1, palette.waterBottom);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Slow ambient tint drift (deep water glow)
    const glowCX = width * 0.5 + Math.sin(this.time * 0.05) * width * 0.12;
    const glowCY = height * 0.72 + Math.cos(this.time * 0.04) * height * 0.05;
    const glowR = Math.max(width, height) * 0.7;
    const glow = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, glowR);
    const glowAlpha = 0.1 + luminanceBoost * 0.12;
    glow.addColorStop(0, `rgba(${Math.round(this.tintR)}, ${Math.round(this.tintG)}, ${Math.round(this.tintB)}, ${glowAlpha})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // 3. Caustic light rays from the surface (additive, gentle)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rayCount = this.rayAngles.length;
    const baseWidth = Math.min(width, height) * 0.055;
    const rayLen = height * 0.62;
    for (let i = 0; i < rayCount; i++) {
      const drift = Math.sin(this.time * (0.12 + i * 0.013) + this.raySeeds[i]) * 0.05;
      const angle = this.rayAngles[i] + drift;
      const originX = width * (0.08 + (i / rayCount) * 0.86);
      const originY = -height * 0.02;

      const farX = originX + Math.cos(angle) * rayLen;
      const farY = originY + Math.sin(angle) * rayLen;
      const halfWidth = baseWidth * (0.7 + 0.5 * Math.sin(this.time * 0.23 + i * 1.7));

      const rx = Math.cos(angle + Math.PI / 2) * halfWidth;
      const ry = Math.sin(angle + Math.PI / 2) * halfWidth;

      const rayGrad = ctx.createLinearGradient(originX, originY, farX, farY);
      const a = 0.05 + luminanceBoost * 0.1 + 0.015 * Math.sin(this.time * 0.6 + i * 2.1);
      rayGrad.addColorStop(0, `rgba(${this.causticStr}, ${Math.max(0, a).toFixed(3)})`);
      rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(originX - rx, originY - ry);
      ctx.lineTo(originX + rx, originY + ry);
      ctx.lineTo(farX + rx * 2.4, farY + ry * 2.4);
      ctx.lineTo(farX - rx * 2.4, farY - ry * 2.4);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Surface shimmer band near the top edge
    const bandY = height * 0.028;
    for (let s = 0; s < 3; s++) {
      const y = bandY + s * 5 + Math.sin(this.time * (0.9 + s * 0.35) + s * 2) * 4;
      ctx.fillStyle = `rgba(${this.causticStr}, ${(0.07 + luminanceBoost * 0.1).toFixed(3)})`;
      ctx.fillRect(0, y, width, 3);
    }
    ctx.restore();

    // 5. Mouse light shaft (soft glow following cursor, replaces particle glow)
    if (settings.mouseFollow && mouse.active) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const radius = mouse.pulseRadius * 1.4;
      const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
      mg.addColorStop(0, `rgba(${this.cachedPrimaryStr}, 0.14)`);
      mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
