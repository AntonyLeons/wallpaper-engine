import { AppSettings, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './RainSystem';

const H = 1080;
const WATERLINE = 758;
const TAU = Math.PI * 2;

function mixHex(a: string, b: string, amount: number): string {
  const left = parseInt(a.slice(1), 16);
  const right = parseInt(b.slice(1), 16);
  const channel = (shift: number): number => Math.round(
    ((left >> shift) & 255) * (1 - amount) + ((right >> shift) & 255) * amount
  );
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

function seeded(seed: number): () => number {
  return () => {
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Architecture is cached on resize / palette changes. Only water, traffic,
 * beacons and distant storm light are animated in the live pass. */
export class CityRenderer {
  private readonly scene = document.createElement('canvas');
  private readonly water = document.createElement('canvas');
  private readonly foreground = document.createElement('canvas');
  private key = '';
  private width = 1920;
  private time = 0;
  private parallax = 0;
  private energy = 0;
  private flash = 0;
  private stormIn = 20;
  private primary = '77,217,255';
  private secondary = '255,94,191';
  private facadeColors: string[] = [];
  private windowCool = '#9dcbd2';
  private beacons: { x: number; y: number; phase: number }[] = [];

  public update(dt: number, width: number, height: number, settings: AppSettings,
    audio: AudioMetrics, mouse: MouseState): void {
    this.time += dt;
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const key = `${width}:${height}:${settings.cityPreset}:${p.r},${p.g},${p.b}:${s.r},${s.g},${s.b}`;
    if (key !== this.key) {
      this.key = key;
      this.primary = `${p.r},${p.g},${p.b}`;
      this.secondary = `${s.r},${s.g},${s.b}`;
      this.build(width, height, settings);
    }
    const target = settings.mouseInteraction && mouse.active ? mouse.x / width - 0.5 : 0;
    this.parallax += (target - this.parallax) * (1 - Math.exp(-dt * 2));
    const energy = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    this.energy += (energy - this.energy) * (1 - Math.exp(-dt * 3));
    this.flash *= Math.exp(-dt * 7);
    this.stormIn -= dt;
    if (this.stormIn < 0) {
      this.stormIn = 22 + Math.random() * 28;
      if (settings.lightningEnabled) this.flash = 0.5 + Math.random() * 0.5;
    }
    if (!settings.lightningEnabled) this.flash = 0;
  }

  private glow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number,
    ry: number, color: string, alpha: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${color},${alpha})`);
    gradient.addColorStop(0.38, `rgba(${color},${alpha * 0.4})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  private build(viewWidth: number, viewHeight: number, settings: AppSettings): void {
    this.width = Math.max(1120, viewWidth / Math.max(1, viewHeight) * H);
    const w = this.width;
    // Bound texture memory even on super-ultrawide and high-DPI screens.
    const scale = Math.min(1.25, 2560 / w);
    for (const canvas of [this.scene, this.foreground]) {
      canvas.width = Math.ceil(w * scale);
      canvas.height = Math.ceil(H * scale);
    }
    const ctx = this.scene.getContext('2d');
    const front = this.foreground.getContext('2d');
    if (!ctx || !front) return;
    ctx.scale(scale, scale);
    front.scale(scale, scale);
    this.beacons = [];
    const rand = seeded(48179);
    const palette = PRESET_PALETTES[settings.cityPreset];
    this.facadeColors = [0.48, 0.35, 0.25, 0.17, 0.08].map(
      amount => mixHex(palette.nearBuilding, palette.haze, amount)
    );
    this.windowCool = palette.windowCool;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.38, palette.skyMid);
    sky.addColorStop(0.7, palette.haze);
    sky.addColorStop(1, palette.streetBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, H);
    this.glow(ctx, w * 0.61, 570, w * 0.48, 530, this.primary, 0.17);
    this.glow(ctx, w * 0.27, 650, w * 0.32, 350, this.secondary, 0.13);
    for (let i = 0; i < 18; i++) {
      this.glow(ctx, rand() * w, rand() * 480, 240 + rand() * 500,
        35 + rand() * 80, '1,5,13', 0.22 + rand() * 0.25);
    }
    for (let layer = 0; layer < 3; layer++) {
      let x = -45;
      while (x < w + 70) {
        const bw = 24 + rand() * (layer === 2 ? 106 : 53);
        const top = 430 + rand() * 220 - layer * 43;
        this.building(ctx, x, top, bw, WATERLINE - top, layer, rand, palette.windowWarm);
        x += bw + 4 + rand() * 10;
      }
      this.glow(ctx, w * 0.55, 690, w * 0.75, 200 - layer * 40,
        this.primary, 0.09 - layer * 0.025);
    }
    // A stepped lantern tower creates a recognisable focal point.
    this.building(ctx, w * 0.61 - 125, 315, 112, 443, 3, rand, palette.windowWarm);
    this.tower(ctx, w * 0.61, rand, palette.windowWarm);
    this.building(ctx, w * 0.61 + 115, 387, 83, 371, 3, rand, palette.windowWarm);
    this.building(ctx, w * 0.17, 298, 132, 460, 3, rand, palette.windowWarm);
    this.building(ctx, w * 0.82, 338, 110, 420, 3, rand, palette.windowWarm);
    this.facadeLighting(ctx, w * 0.17 + 8, 614, 88, this.secondary);
    this.facadeLighting(ctx, w * 0.61 + 122, 675, 54, this.primary);
    this.facadeLighting(ctx, w * 0.82 + 8, 701, 68, '255,187,124');
    // Low-lying mist softens the base of the skyline, leaving the crowns clear.
    this.glow(ctx, w * 0.34, 704, w * 0.42, 118, this.secondary, 0.075);
    this.glow(ctx, w * 0.64, 695, w * 0.44, 104, this.primary, 0.14);
    this.building(ctx, -55, 160, Math.min(w * 0.115, 210), 640, 4, rand, palette.windowWarm);
    this.building(ctx, w - Math.min(w * 0.10, 180), 230, 220, 570, 4, rand, palette.windowWarm);
    // Waterfront promenade, railings and small pools of warm light.
    ctx.fillStyle = '#070f19';
    ctx.fillRect(0, 741, w, 21);
    ctx.strokeStyle = 'rgba(155,197,206,0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 746);
    ctx.lineTo(w, 746);
    for (let x = 0; x < w; x += 28) {
      ctx.moveTo(x, 740);
      ctx.lineTo(x, 758);
    }
    ctx.stroke();
    for (let x = 65; x < w; x += 147) {
      ctx.fillStyle = '#182a33';
      ctx.fillRect(x, 712, 2, 36);
      ctx.fillStyle = '#f5cf9f';
      ctx.fillRect(x - 3, 711, 8, 2);
      this.glow(ctx, x + 1, 716, 29, 25, '255,189,112', 0.25);
    }
    const ground = ctx.createLinearGradient(0, WATERLINE, 0, H);
    ground.addColorStop(0, palette.streetTop);
    ground.addColorStop(1, palette.streetBottom);
    ctx.fillStyle = ground;
    ctx.fillRect(0, WATERLINE, w, H - WATERLINE);
    this.water.width = Math.min(1280, Math.round(w));
    this.water.height = 320;
    this.water.getContext('2d')?.drawImage(this.scene, 0, 390 * scale,
      this.scene.width, (WATERLINE - 390) * scale, 0, 0, this.water.width, 320);
    // Fine grain and water surface detail are sampled once, not every frame.
    for (let i = 0; i < 17000; i++) {
      front.fillStyle = rand() < 0.5 ? 'rgba(207,226,230,0.035)' : 'rgba(0,0,0,0.09)';
      front.fillRect(rand() * w, rand() * H, 0.8 + rand(), 0.7);
    }
    for (let i = 0; i < 1300; i++) {
      const y = WATERLINE + rand() * (H - WATERLINE);
      front.fillStyle = rand() < 0.7 ? 'rgba(1,7,14,0.35)' : 'rgba(143,186,200,0.08)';
      front.fillRect(rand() * w, y, 2 + rand() * 42 * (y / H), 0.5 + rand());
    }
    const shade = front.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(1,4,10,0.3)');
    shade.addColorStop(0.35, 'rgba(1,4,10,0)');
    shade.addColorStop(0.72, 'rgba(1,4,10,0)');
    shade.addColorStop(1, 'rgba(1,4,10,0.7)');
    front.fillStyle = shade;
    front.fillRect(0, 0, w, H);
  }

  private building(ctx: CanvasRenderingContext2D, x: number, y: number, w: number,
    h: number, layer: number, rand: () => number, warm: string): void {
    const side = w * 0.17;
    ctx.fillStyle = this.facadeColors[layer];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `rgba(1,5,12,${0.2 + layer * 0.06})`;
    ctx.fillRect(x + w - side, y, side, h);
    ctx.fillStyle = 'rgba(153,207,218,0.1)';
    ctx.fillRect(x, y, w - side, 1);
    ctx.fillRect(x, y, 1, h);
    const gapX = layer < 2 ? 5 : 8;
    const gapY = layer < 2 ? 8 : 12;
    const tone = rand();
    for (let row = 0, wy = y + 9; wy < y + h - 6; wy += gapY, row++) {
      const floorLit = rand() < 0.27;
      for (let wx = x + 5; wx < x + w - side - 4; wx += gapX) {
        const lit = rand();
        ctx.globalAlpha = (lit < (floorLit ? 0.85 : 0.28) ? 0.25 + rand() * 0.5 : 0.035)
          * (layer === 0 ? 0.38 : layer === 4 ? 0.35 : 1);
        ctx.fillStyle = tone < 0.3 || row % 13 === 0 ? warm : this.windowCool;
        ctx.fillRect(wx, wy, gapX * 0.42, layer < 2 ? 1.5 : 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,4,12,0.35)';
    for (let wy = y + 50; wy < y + h; wy += 62) ctx.fillRect(x, wy, w, 4);
    for (let wx = x + 16; wx < x + w - side; wx += 25) ctx.fillRect(wx, y, 2, h);
    ctx.fillStyle = this.facadeColors[layer];
    ctx.fillRect(x + w * 0.25, y - 8, w * 0.4, 8);
    if (layer > 1 && rand() < 0.7) {
      const ax = x + w * 0.45;
      ctx.fillStyle = '#263a44';
      ctx.fillRect(ax, y - 32, 1, 25);
      this.beacons.push({ x: ax, y: y - 33, phase: rand() * TAU });
    }
    if (layer > 1 && rand() < 0.55) {
      const color = rand() < 0.6 ? this.primary : this.secondary;
      ctx.fillStyle = `rgba(${color},0.48)`;
      ctx.fillRect(x + 2, y + 3, w - side - 4, 1.5);
      this.glow(ctx, x + w * 0.45, y + 4, w * 0.7, 16, color, 0.08);
    }
    if (layer === 4) {
      ctx.strokeStyle = '#1a2931';
      for (let wy = y + 40; wy < y + h; wy += 52) {
        ctx.strokeRect(x + w * 0.3, wy, 24, 13);
        ctx.fillStyle = '#030b12';
        ctx.fillRect(x + w * 0.3 + 3, wy + 3, 18, 7);
      }
    }
  }

  private tower(ctx: CanvasRenderingContext2D, x: number, rand: () => number, warm: string): void {
    this.glow(ctx, x + 42, 380, 210, 330, this.primary, 0.13);
    this.building(ctx, x, 240, 100, 518, 3, rand, warm);
    this.building(ctx, x + 11, 212, 78, 40, 3, rand, warm);
    this.building(ctx, x + 23, 190, 54, 24, 3, rand, warm);
    ctx.fillStyle = '#243e4d';
    ctx.fillRect(x + 49, 137, 2, 54);
    this.beacons.push({ x: x + 50, y: 136, phase: 0 });
    ctx.save();
    ctx.shadowColor = `rgb(${this.primary})`;
    ctx.shadowBlur = 13;
    ctx.fillStyle = `rgba(${this.primary},0.75)`;
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 8 + i * 17, 247, 1.6, 432 - i * 18);
    for (const [left, top, width] of [[23, 190, 54], [11, 212, 78], [0, 240, 100]]) {
      ctx.fillRect(x + left, top, width, 2);
    }
    ctx.restore();
  }

  private facadeLighting(ctx: CanvasRenderingContext2D, x: number, y: number,
    width: number, color: string): void {
    // Recessed light follows the floor slabs; no floating panels or lettering.
    ctx.save();
    this.glow(ctx, x + width / 2, y + 7, width * 0.8, 22, color, 0.065);
    for (let floor = 0; floor < 2; floor++) {
      ctx.fillStyle = 'rgba(2,6,12,0.7)';
      ctx.fillRect(x, y + floor * 12, width, 3);
      ctx.fillStyle = `rgba(${color},${floor === 0 ? 0.4 : 0.2})`;
      for (let offset = 1; offset < width - 7; offset += 8) {
        ctx.fillRect(x + offset, y + floor * 12 + 1, 6, 1);
      }
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const scale = Math.max(width / this.width, height / H) * 1.015;
    const x = (width - this.width * scale) * 0.5 + this.parallax * 9;
    const y = (height - H * scale) * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.drawImage(this.scene, 0, 0, this.width, H);
    for (let row = 0; row < 104; row++) {
      const t = row / 104;
      const sy = (1 - t) * (this.water.height - 3);
      const dx = Math.sin(row * 0.17 + this.time * 1.2) * (1 + t * 8)
        + Math.sin(row * 0.61 - this.time * 0.6) * 2;
      ctx.globalAlpha = (0.55 - t * 0.29) * (0.8 + Math.sin(row * 2.3) * 0.2);
      ctx.drawImage(this.water, 0, sy, this.water.width, 3,
        dx, WATERLINE + t * (H - WATERLINE), this.width, (H - WATERLINE) / 104 + 0.6);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(this.foreground, 0, 0, this.width, H);
    for (const light of this.beacons) {
      ctx.globalAlpha = 0.2 + Math.max(0, Math.sin(this.time * 1.8 + light.phase)) * 0.6;
      ctx.fillStyle = '#ff8579';
      ctx.fillRect(light.x - 1, light.y, 2, 2);
    }
    for (let i = 0; i < 9; i++) {
      const cx = ((this.time * (i % 2 ? 12 : -8) + i * this.width / 9) % this.width + this.width) % this.width;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = i % 2 ? '#ffb99c' : '#b6dfe0';
      ctx.fillRect(cx, 735 + i % 3 * 2, 4, 1.5);
    }
    if (this.energy > 0.01 || this.flash > 0.005) {
      ctx.globalAlpha = this.energy * 0.065 + this.flash * 0.15;
      ctx.fillStyle = '#b6dce9';
      ctx.fillRect(0, 0, this.width, WATERLINE);
    }
    ctx.restore();
  }

  public renderForeground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = '#03080e';
    ctx.fillRect(0, 0, 10, height);
    ctx.fillRect(width - 10, 0, 10, height);
    ctx.fillRect(0, 0, width, 8);
    ctx.fillRect(0, height - 12, width, 12);
    ctx.fillStyle = 'rgba(115,164,177,0.14)';
    ctx.fillRect(10, 0, 1, height);
    ctx.fillRect(width - 11, 0, 1, height);
    ctx.fillRect(0, height - 13, width, 1);
    ctx.restore();
  }
}
