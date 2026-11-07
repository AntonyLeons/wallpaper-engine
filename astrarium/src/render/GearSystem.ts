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

    const teeth = Math.max(12, Math.round(radius / 5));
    const rootRadius = radius * 0.94;
    const pitch = TAU / teeth;
    const outline = new Path2D();
    outline.moveTo(rootRadius, 0);
    for (let i = 0; i < teeth; i++) {
      const angle = i * pitch;
      outline.arc(0, 0, rootRadius, angle, angle + pitch * 0.19);
      outline.lineTo(radius * Math.cos(angle + pitch * 0.36), radius * Math.sin(angle + pitch * 0.36));
      outline.arc(0, 0, radius, angle + pitch * 0.36, angle + pitch * 0.64);
      outline.lineTo(rootRadius * Math.cos(angle + pitch * 0.81), rootRadius * Math.sin(angle + pitch * 0.81));
      outline.arc(0, 0, rootRadius, angle + pitch * 0.81, angle + pitch);
    }
    outline.closePath();

    // Open sectors leave five tapered spokes and let the star field show through.
    const openings = new Path2D();
    const spokes = 5;
    for (let i = 0; i < spokes; i++) {
      const angle = i * TAU / spokes;
      const end = angle + TAU / spokes;
      const outer = radius * 0.76;
      const inner = radius * 0.31;
      openings.moveTo(outer * Math.cos(angle + 0.09), outer * Math.sin(angle + 0.09));
      openings.arc(0, 0, outer, angle + 0.09, end - 0.09);
      openings.arc(0, 0, inner, end - 0.23, angle + 0.23, true);
      openings.closePath();
    }
    const wheel = new Path2D(outline);
    wheel.addPath(openings);

    const metal = ctx.createLinearGradient(-radius, -radius, radius, radius);
    metal.addColorStop(0, palette.brassLight);
    metal.addColorStop(0.32, palette.brass);
    metal.addColorStop(0.57, palette.brassDark);
    metal.addColorStop(0.82, palette.brass);
    metal.addColorStop(1, palette.brassDark);
    ctx.fillStyle = palette.brassDark;
    ctx.save();
    ctx.translate(1, Math.max(1, radius * 0.018));
    ctx.fill(wheel, 'evenodd');
    ctx.restore();
    ctx.fillStyle = metal;
    ctx.fill(wheel, 'evenodd');

    ctx.globalAlpha = 0.58;
    ctx.strokeStyle = palette.brassLight;
    ctx.lineWidth = 0.8;
    ctx.stroke(outline);
    ctx.globalAlpha = 0.36;
    ctx.stroke(openings);
    for (const ring of [0.81, 0.875, 0.24, 0.17]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * ring, 0, TAU);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.brassDark;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.brass;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.085, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = palette.brassDark;
    ctx.lineWidth = Math.max(1, radius * 0.018);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.055, 0);
    ctx.lineTo(radius * 0.055, 0);
    ctx.stroke();

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
        const radius = Math.min(min * layout.radii[j] * 0.85, 255);
        const previous = j > 0 ? this.gears[this.gears.length - 1] : undefined;
        const spacing = previousRadius + radius + 3;
        if (j > 0) {
          const angle = layout.angle + Math.sin(j * 1.7 + i) * 0.18;
          x += spacing * Math.cos(angle);
          y += spacing * Math.sin(angle);
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
        if (previous && Math.hypot(x - previous.x, y - previous.y) < spacing) {
          // Continue outward along the clearance ray until the wheel clears its neighbor.
          const ux = dx / distance;
          const uy = dy / distance;
          const ox = x - previous.x;
          const oy = y - previous.y;
          const along = ox * ux + oy * uy;
          const push = Math.sqrt(along * along + spacing * spacing - ox * ox - oy * oy) - along;
          x += ux * push;
          y += uy * push;
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
    ctx.globalAlpha = clamp(0.64 + energy * 0.16 + beat * 0.1, 0, 1);
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
