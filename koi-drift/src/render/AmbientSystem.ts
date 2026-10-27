import { AppSettings } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { MouseState } from './KoiSystem';

interface Bubble { x: number; y: number; radius: number; phase: number; speed: number }
interface Ripple { x: number; y: number; age: number; strength: number }
const LEAVES = [
  [0.035, 0.09, 1.12], [0.12, 0.035, 0.92], [0.018, 0.25, 0.74],
  [0.18, -0.005, 0.7], [0.1, 0.19, 0.61], [0.97, 0.08, 1.08],
  [1.005, 0.24, 0.82], [0.89, 0.015, 0.66], [0.015, 0.86, 0.96],
  [0.085, 0.97, 0.83], [0.18, 1.015, 0.62], [0.99, 0.96, 0.75],
  [0.015, 0.43, 0.53], [0.955, 0.32, 0.58], [0.24, 0.025, 0.51],
  [0.035, 0.72, 0.48], [0.82, -0.005, 0.63], [0.98, 0.78, 0.61],
  [0.12, 0.3, 0.49], [0.25, 0.99, 0.48],
];

export class AmbientSystem {
  private time = 0;
  private bubbles: Bubble[] = [];
  private ripples: Ripple[] = [];
  private ripplePool: Ripple[] = [];
  private rainTimer = 1;
  private mouseTimer = 0;
  private lastMouseX = -1000;
  private lastMouseY = -1000;
  private leaf = document.createElement('canvas');
  private flower = document.createElement('canvas');
  private cachedPreset = '';
  private width = 1;
  private height = 1;
  private plantCount = 0;

  private ensureSprites(settings: AppSettings): void {
    if (this.cachedPreset === settings.pondPreset) return;
    this.cachedPreset = settings.pondPreset;
    this.leaf.width = this.leaf.height = 224;
    const ctx = this.leaf.getContext('2d');
    if (!ctx) return;
    ctx.translate(112, 112);
    ctx.beginPath();
    ctx.ellipse(4, 11, 83, 74, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#061e1d70';
    ctx.fill();
    const body = new Path2D();
    body.moveTo(-5, 3);
    body.lineTo(77 * Math.cos(0.24), 72 * Math.sin(0.24));
    body.ellipse(0, 0, 77, 72, 0, 0.24, Math.PI * 2 - 0.12);
    body.closePath();
    const grad = ctx.createLinearGradient(-55, -65, 60, 70);
    const moon = settings.pondPreset === 'dusk';
    grad.addColorStop(0, moon ? '#55776c' : '#839561');
    grad.addColorStop(0.4, moon ? '#35574f' : '#526f45');
    grad.addColorStop(1, moon ? '#203e3d' : '#2c4e3c');
    ctx.fillStyle = grad;
    ctx.fill(body);
    ctx.strokeStyle = '#d6df9c44';
    ctx.lineWidth = 1.2;
    ctx.stroke(body);
    ctx.save();
    ctx.clip(body);
    for (let i = 0; i < 18; i++) {
      const angle = 0.3 + i / 18 * (Math.PI * 2 - 0.5);
      const x = Math.cos(angle) * 75;
      const y = Math.sin(angle) * 70;
      ctx.beginPath();
      ctx.moveTo(-5, 3);
      ctx.quadraticCurveTo(x * 0.55 - 7, y * 0.45, x, y);
      ctx.strokeStyle = '#c9d39025';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      for (let branch = 1; branch < 4; branch++) {
        const t = branch / 4;
        ctx.beginPath();
        ctx.moveTo(x * t - 5 * (1 - t), y * t + 3 * (1 - t));
        ctx.quadraticCurveTo(x * t + Math.cos(angle + 0.4) * 15,
          y * t + Math.sin(angle + 0.4) * 15,
          x * t + Math.cos(angle + 0.7) * 23,
          y * t + Math.sin(angle + 0.7) * 23);
        ctx.strokeStyle = '#c5d19016';
        ctx.lineWidth = 0.55;
        ctx.stroke();
      }
    }
    // Fine mottling is baked once into the leaf, not regenerated each frame.
    for (let i = 0; i < 110; i++) {
      const x = Math.sin(i * 73.13) * 75;
      const y = Math.cos(i * 19.7) * 70;
      ctx.fillStyle = i % 2 ? '#d4ce7c0c' : '#102d2510';
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + i % 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(-27, -27, 5, 2.5, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#e8f1cc72';
    ctx.fill();

    this.flower.width = this.flower.height = 160;
    const bloom = this.flower.getContext('2d');
    if (!bloom) return;
    bloom.translate(80, 80);
    bloom.fillStyle = '#031b2255';
    bloom.beginPath();
    bloom.ellipse(3, 10, 45, 31, 0, 0, Math.PI * 2);
    bloom.fill();
    for (let ring = 0; ring < 3; ring++) {
      for (let petal = 0; petal < 9; petal++) {
        bloom.save();
        bloom.rotate(petal / 9 * Math.PI * 2 + ring * 0.33);
        const length = 44 - ring * 10;
        const petalGradient = bloom.createLinearGradient(0, 0, 0, -length);
        petalGradient.addColorStop(0, '#c9a76b');
        petalGradient.addColorStop(0.45, '#e4d5b5');
        petalGradient.addColorStop(1, '#fff4e0');
        bloom.fillStyle = petalGradient;
        bloom.beginPath();
        bloom.moveTo(0, 3);
        bloom.bezierCurveTo(-17 + ring * 3, -12, -11, -length + 6, 0, -length);
        bloom.bezierCurveTo(11, -length + 6, 17 - ring * 3, -12, 0, 3);
        bloom.fill();
        bloom.strokeStyle = '#8e735135';
        bloom.lineWidth = 0.6;
        bloom.stroke();
        bloom.restore();
      }
    }
    bloom.fillStyle = '#d9b75e';
    bloom.beginPath();
    bloom.arc(0, 0, 8, 0, Math.PI * 2);
    bloom.fill();
    for (let i = 0; i < 12; i++) {
      bloom.fillStyle = '#fff1ae';
      bloom.beginPath();
      bloom.arc(Math.cos(i * 2.4) * (i % 3 + 2), Math.sin(i * 2.4) * (i % 3 + 2), 1, 0, Math.PI * 2);
      bloom.fill();
    }
  }

  public update(dt: number, width: number, height: number, settings: AppSettings,
    audio: AudioMetrics, mouse: MouseState): void {
    this.time += dt;
    this.width = width;
    this.height = height;
    this.plantCount = Math.max(0, Math.min(20, settings.kelpCount));
    this.ensureSprites(settings);
    const target = Math.max(0, Math.min(200, settings.bubbleCount));
    while (this.bubbles.length < target) {
      const i = this.bubbles.length;
      this.bubbles.push({ x: ((i * 0.618034 + 0.13) % 1), y: ((i * 0.754877 + 0.28) % 1),
        radius: 0.6 + i % 4 * 0.35, phase: i * 2.39, speed: 2 + i % 5 });
    }
    this.bubbles.length = target;
    for (const b of this.bubbles) {
      b.y -= b.speed * dt / height;
      b.x += Math.sin(this.time * 0.16 + b.phase) * dt * 0.7 / width;
      if (b.y < -0.02) b.y = 1.02;
      if (b.x < -0.02) b.x = 1.02;
      if (b.x > 1.02) b.x = -0.02;
    }
    this.rainTimer -= dt * (1 + (settings.audioReactive && audio.hasAudio ? audio.beatPulse * 2 : 0));
    if (this.rainTimer <= 0) {
      this.rainTimer = 3 + Math.random() * 4;
      this.spawnRipple(width * (0.1 + Math.random() * 0.8), height * (0.1 + Math.random() * 0.8), 0.18);
    }
    this.mouseTimer -= dt;
    if (mouse.active && this.mouseTimer <= 0 && Math.hypot(mouse.x - this.lastMouseX, mouse.y - this.lastMouseY) > 16) {
      this.spawnRipple(mouse.x, mouse.y, 0.15);
      this.lastMouseX = mouse.x;
      this.lastMouseY = mouse.y;
      this.mouseTimer = 0.35;
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += dt;
      if (this.ripples[i].age > 4) {
        this.ripplePool.push(this.ripples[i]);
        this.ripples.splice(i, 1);
      }
    }
  }

  public spawnRipple(x: number, y: number, strength: number): void {
    if (this.ripples.length >= 48) return;
    const ripple = this.ripplePool.pop() ?? { x: 0, y: 0, age: 0, strength: 0 };
    ripple.x = x;
    ripple.y = y;
    ripple.age = 0;
    ripple.strength = Math.max(0, Math.min(1, strength));
    this.ripples.push(ripple);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number,
    settings: AppSettings, _audio: AudioMetrics): void {
    // Submerged leaf stems connect the floating canopy to the bank.
    ctx.save();
    ctx.strokeStyle = '#9ca16b17';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < this.plantCount; i++) {
      const leaf = LEAVES[i];
      const x = leaf[0] * width;
      const y = leaf[1] * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (x < width / 2 ? -40 : 40), y + 45,
        x < width / 2 ? -20 : width + 20, y + 100);
      ctx.stroke();
    }
    for (const ripple of this.ripples) {
      const radius = 6 + ripple.age * (19 + ripple.strength * 16);
      const alpha = Math.sin(Math.min(1, ripple.age / 0.3) * Math.PI / 2)
        * (1 - ripple.age / 4) * ripple.strength;
      const p = settings.primaryColor;
      ctx.strokeStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
      ctx.lineWidth = 0.8;
      for (let ring = 0; ring < 3; ring++) {
        const r = Math.max(1, radius - ring * 9);
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, r, r * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  public renderForeground(ctx: CanvasRenderingContext2D, _height: number): void {
    const size = Math.max(0.65, Math.min(1.6, Math.min(this.width, this.height) / 850));
    ctx.save();
    for (const bubble of this.bubbles) {
      const alpha = 0.1 + (Math.sin(this.time * 0.3 + bubble.phase) + 1) * 0.06;
      ctx.fillStyle = `rgba(226, 229, 181, ${alpha})`;
      ctx.beginPath();
      ctx.arc(bubble.x * this.width, bubble.y * this.height, bubble.radius * size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < this.plantCount; i++) {
      const leaf = LEAVES[i];
      const s = size * leaf[2];
      ctx.save();
      ctx.translate(leaf[0] * this.width + Math.sin(this.time * 0.16 + i) * 3 * size,
        leaf[1] * this.height + Math.cos(this.time * 0.12 + i * 2) * 2 * size);
      ctx.rotate(i * 2.399 + Math.sin(this.time * 0.12 + i) * 0.025);
      ctx.drawImage(this.leaf, -112 * s, -112 * s, 224 * s, 224 * s);
      ctx.restore();
    }
    // One restrained water lily, nestled into the upper-left cluster.
    if (this.plantCount >= 4) {
      const s = size * 0.88;
      ctx.drawImage(this.flower, this.width * 0.07 - 80 * s,
        this.height * 0.105 - 80 * s + Math.sin(this.time * 0.14) * 2, 160 * s, 160 * s);
    }
    this.renderBank(ctx, size);
    ctx.restore();
  }

  private renderBank(ctx: CanvasRenderingContext2D, size: number): void {
    const count = Math.min(7, Math.ceil(this.plantCount / 2));
    ctx.lineCap = 'round';
    for (let corner = 0; corner < 2; corner++) {
      ctx.save();
      ctx.translate(corner ? this.width + 10 : -10, corner ? -10 : this.height + 10);
      ctx.rotate(corner ? Math.PI : 0);
      ctx.scale(size, size);
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.rotate(0.18 + i * 0.18 + Math.sin(this.time * 0.22 + i) * 0.018);
        const length = 140 + (i % 3) * 35;
        ctx.strokeStyle = '#657c4c88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(15, -length * 0.55, 0, -length);
        ctx.stroke();
        for (let j = 1; j < 10; j++) {
          const t = j / 10;
          const y = -length * t;
          const leafLength = 27 * Math.sin(t * Math.PI);
          for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath();
            ctx.moveTo(7 * Math.sin(t * Math.PI), y + 7);
            ctx.quadraticCurveTo(side * leafLength * 0.6, y - 7, side * leafLength, y - 17);
            ctx.quadraticCurveTo(side * leafLength * 0.8, y + 2, 7 * Math.sin(t * Math.PI), y + 7);
            ctx.fillStyle = j % 2 ? '#48613dc9' : '#6a7c4cbb';
            ctx.fill();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }
}
