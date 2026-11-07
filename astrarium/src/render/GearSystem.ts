import { PRESET_PALETTES } from '../config/settings';
import type { AppSettings, PresetPalette } from '../config/settings';
import type { AudioMetrics } from '../audio/AudioAnalyzer';
import { clamp, TAU } from './math';

interface Gear {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  sprite: HTMLCanvasElement;
}

interface GearLayout {
  ax: number;
  ay: number;
  angle: number;
  radii: number[];
}

const GEAR_LAYOUT: GearLayout[] = [
  { ax: 0.05, ay: 0.10, angle: 0.42, radii: [0.17, 0.105, 0.07] },
  { ax: 0.95, ay: 0.14, angle: 2.68, radii: [0.14, 0.088] },
  { ax: 0.07, ay: 0.90, angle: -0.5, radii: [0.155, 0.095] },
  { ax: 0.94, ay: 0.88, angle: 3.62, radii: [0.16, 0.1, 0.062] },
  { ax: 0.50, ay: 0.02, angle: 1.1, radii: [0.09, 0.055] },
  { ax: 0.50, ay: 0.98, angle: -1.9, radii: [0.085] },
];

export class GearSystem {
  private gears: Gear[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private layoutKey = '';

  private buildSprite(radius: number, palette: PresetPalette): HTMLCanvasElement {
    const size = Math.ceil(2 * (radius + 10));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.translate(size / 2, size / 2);

    const teeth = Math.max(9, Math.round(radius / 8));
    const rootRadius = radius * 0.87;
    const path = new Path2D();
    for (let i = 0; i < teeth; i++) {
      const a0 = i / teeth * TAU;
      const a1 = (i + 0.24) / teeth * TAU;
      const a2 = (i + 0.62) / teeth * TAU;
      const a3 = (i + 0.86) / teeth * TAU;
      if (i === 0) path.moveTo(Math.cos(a0) * rootRadius, Math.sin(a0) * rootRadius);
      else path.lineTo(Math.cos(a0) * rootRadius, Math.sin(a0) * rootRadius);
      path.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
      path.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
      path.lineTo(Math.cos(a3) * rootRadius, Math.sin(a3) * rootRadius);
    }
    path.closePath();

    const gradient = ctx.createRadialGradient(-radius * 0.32, -radius * 0.32, radius * 0.08, 0, 0, radius);
    gradient.addColorStop(0, palette.brassLight);
    gradient.addColorStop(0.5, palette.brass);
    gradient.addColorStop(1, palette.brassDark);
    ctx.fillStyle = gradient;
    ctx.fill(path);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = palette.brassLight;
    ctx.lineWidth = 1.2;
    ctx.stroke(path);

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = palette.brassDark;
    ctx.lineWidth = Math.max(1, radius * 0.02);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = palette.brassLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.755, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * TAU;
      const half = 0.11;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle - half) * radius * 0.22, Math.sin(angle - half) * radius * 0.22);
      ctx.lineTo(Math.cos(angle - half * 0.6) * radius * 0.72, Math.sin(angle - half * 0.6) * radius * 0.72);
      ctx.lineTo(Math.cos(angle + half * 0.6) * radius * 0.72, Math.sin(angle + half * 0.6) * radius * 0.72);
      ctx.lineTo(Math.cos(angle + half) * radius * 0.22, Math.sin(angle + half) * radius * 0.22);
      ctx.closePath();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = palette.brassDark;
      ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = palette.brassLight;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = palette.brassLight;
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * TAU + 0.3;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62, Math.max(1.5, radius * 0.018), 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    const hub = ctx.createRadialGradient(-radius * 0.05, -radius * 0.05, 0, 0, 0, radius * 0.22);
    hub.addColorStop(0, palette.brassLight);
    hub.addColorStop(1, palette.brassDark);
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = palette.brassLight;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(6, 10, 16, 0.75)';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.075, 0, TAU);
    ctx.fill();

    return canvas;
  }

  private getSprite(radius: number, preset: string, palette: PresetPalette): HTMLCanvasElement {
    const key = `${Math.round(radius)}_${preset}`;
    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = this.buildSprite(radius, palette);
      this.sprites.set(key, sprite);
    }
    return sprite;
  }

  private ensureLayout(width: number, height: number, settings: AppSettings): void {
    const key = `${width}_${height}_${settings.gearCount}_${settings.preset}`;
    if (this.layoutKey === key) return;
    this.layoutKey = key;

    const phases = this.gears.map((gear) => gear.phase);
    this.gears.length = 0;
    this.sprites.clear();

    const palette = PRESET_PALETTES[settings.preset];
    const min = Math.min(width, height);
    const centerRadius = Math.min(min * 0.34, 620);
    const count = Math.min(settings.gearCount, 12);
    let placed = 0;

    for (let i = 0; i < GEAR_LAYOUT.length && placed < count; i++) {
      const layout = GEAR_LAYOUT[i];
      let x = layout.ax * width;
      let y = layout.ay * height;
      let previousRadius = 0;
      let previousSpeed = 0;

      for (let j = 0; j < layout.radii.length && placed < count; j++) {
        const radius = Math.min(min * layout.radii[j], 300);
        if (j > 0) {
          const angle = layout.angle + Math.sin(j * 1.7 + i) * 0.18;
          x += (previousRadius + radius) * Math.cos(angle);
          y += (previousRadius + radius) * Math.sin(angle);
        }
        const speed = j === 0
          ? (i % 2 === 0 ? 1 : -1) * 0.16 * (0.17 / layout.radii[0])
          : -previousSpeed * (previousRadius / radius);
        const dx = x - width * 0.5;
        const dy = y - height * 0.5;
        const distance = Math.hypot(dx, dy) || 1;
        const clearance = centerRadius + radius * 0.85 + 14;
        if (distance < clearance) {
          const scale = clearance / distance;
          x = width * 0.5 + dx * scale;
          y = height * 0.5 + dy * scale;
        }
        this.gears.push({
          x,
          y,
          r: radius,
          phase: phases[placed] ?? placed * 0.7,
          speed,
          sprite: this.getSprite(radius, settings.preset, palette),
        });
        previousRadius = radius;
        previousSpeed = speed;
        placed++;
      }
    }
  }

  public update(dt: number, width: number, height: number, settings: AppSettings, audio: AudioMetrics): void {
    this.ensureLayout(width, height, settings);
    const boost = settings.audioReactive && audio.hasAudio ? audio.overall * 0.9 + audio.beatPulse * 0.5 : 0;
    const motion = settings.orbitSpeed * (1 + boost);
    for (const gear of this.gears) {
      gear.phase += gear.speed * motion * dt;
    }
  }

  public render(ctx: CanvasRenderingContext2D, settings: AppSettings, audio: AudioMetrics): void {
    if (this.gears.length === 0) return;
    const energy = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    const beat = settings.audioReactive && audio.hasAudio ? audio.beatPulse : 0;
    ctx.save();
    ctx.globalAlpha = clamp(0.76 + energy * 0.16 + beat * 0.1, 0, 1);
    for (const gear of this.gears) {
      ctx.save();
      ctx.translate(gear.x, gear.y);
      ctx.rotate(gear.phase);
      ctx.drawImage(gear.sprite, -gear.sprite.width / 2, -gear.sprite.height / 2);
      ctx.restore();
    }
    ctx.restore();
  }
}
