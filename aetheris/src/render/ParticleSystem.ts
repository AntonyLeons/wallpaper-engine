import { AppSettings, ColorRGB } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';

export interface MouseState {
  x: number;
  y: number;
  active: boolean;
  pulseRadius: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  hueOffset: number; // 0..1 blend between primary and secondary
  speedMult: number;
}

const NUM_COLOR_BUCKETS = 10;

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private maxCapacity = 5000;

  // Cached color bucket strings to eliminate allocations during render loop
  private colorBuckets: string[] = new Array(NUM_COLOR_BUCKETS);
  private bucketParticles: Particle[][] = Array.from({ length: NUM_COLOR_BUCKETS }, () => []);
  private cachedPrimary: ColorRGB = { r: 0, g: 0, b: 0 };
  private cachedSecondary: ColorRGB = { r: 0, g: 0, b: 0 };

  constructor() {
    // Pre-allocate particle objects in memory pool to avoid GC overhead
    for (let i = 0; i < this.maxCapacity; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        baseSize: 2,
        alpha: 0,
        maxAlpha: 1,
        life: 0,
        maxLife: 100,
        hueOffset: 0,
        speedMult: 1,
      });
    }
  }

  private spawnParticle(width: number, height: number, settings: AppSettings): Particle | null {
    if (this.pool.length === 0) return null;
    const p = this.pool.pop()!;

    p.x = Math.random() * width;
    p.y = Math.random() * height;

    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 20 + 5) * settings.particleSpeed;

    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;

    p.baseSize = Math.random() * 3.5 + 1.0;
    p.size = p.baseSize;
    p.maxAlpha = Math.random() * 0.7 + 0.3;
    p.alpha = 0;
    p.maxLife = Math.random() * 8 + 4; // seconds
    p.life = 0;
    p.hueOffset = Math.random();
    p.speedMult = Math.random() * 0.5 + 0.75;

    return p;
  }

  public update(
    deltaTimeSec: number,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    const targetCount = Math.min(settings.particleCount, this.maxCapacity);

    // Adjust active particle count smoothly
    while (this.particles.length < targetCount) {
      const p = this.spawnParticle(width, height, settings);
      if (p) this.particles.push(p);
      else break;
    }

    while (this.particles.length > targetCount) {
      const p = this.particles.pop();
      if (p) this.pool.push(p);
    }

    const bassBoost = settings.audioReactive ? audio.bass * 1.5 : 0;
    const speedScale = settings.particleSpeed;

    // Update particles in-place
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaTimeSec;

      if (p.life >= p.maxLife) {
        this.recycleParticle(p, width, height, settings);
        continue;
      }

      // Life fade envelope (fade in, hold, fade out)
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < 0.15) {
        p.alpha = (lifeRatio / 0.15) * p.maxAlpha;
      } else if (lifeRatio > 0.85) {
        p.alpha = ((1 - lifeRatio) / 0.15) * p.maxAlpha;
      } else {
        p.alpha = p.maxAlpha;
      }

      // Audio reactivity: pulse size with bass
      p.size = p.baseSize * (1 + bassBoost * 0.8);

      // Mouse interactivity: gentle force field around cursor
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        const radiusSq = mouse.pulseRadius * mouse.pulseRadius;

        if (distSq < radiusSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / mouse.pulseRadius) * 60;
          p.vx += (dx / dist) * force * deltaTimeSec;
          p.vy += (dy / dist) * force * deltaTimeSec;
        }
      }

      // Move particle
      const currentSpeed = p.speedMult * speedScale * (1 + bassBoost * 0.3);
      p.x += p.vx * deltaTimeSec * currentSpeed;
      p.y += p.vy * deltaTimeSec * currentSpeed;

      // Subtle ambient drift turbulence
      p.vx += Math.sin(p.y * 0.01 + p.life) * 2 * deltaTimeSec;
      p.vy += Math.cos(p.x * 0.01 + p.life) * 2 * deltaTimeSec;

      // Screen boundary wrapping
      if (p.x < -20) p.x = width + 20;
      if (p.x > width + 20) p.x = -20;
      if (p.y < -20) p.y = height + 20;
      if (p.y > height + 20) p.y = -20;
    }
  }

  private recycleParticle(p: Particle, width: number, height: number, settings: AppSettings): void {
    p.x = Math.random() * width;
    p.y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 20 + 5) * settings.particleSpeed;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 0;
    p.maxLife = Math.random() * 8 + 4;
    p.baseSize = Math.random() * 3.5 + 1.0;
    p.maxAlpha = Math.random() * 0.7 + 0.3;
    p.alpha = 0;
    p.hueOffset = Math.random();
  }

  private updateColorBuckets(primary: ColorRGB, secondary: ColorRGB): void {
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

    for (let b = 0; b < NUM_COLOR_BUCKETS; b++) {
      const t = b / (NUM_COLOR_BUCKETS - 1);
      const r = Math.round(primary.r + (secondary.r - primary.r) * t);
      const g = Math.round(primary.g + (secondary.g - primary.g) * t);
      const blue = Math.round(primary.b + (secondary.b - primary.b) * t);
      this.colorBuckets[b] = `rgb(${r}, ${g}, ${blue})`;
    }
  }

  public render(ctx: CanvasRenderingContext2D, settings: AppSettings): void {
    if (this.particles.length === 0) return;

    this.updateColorBuckets(settings.primaryColor, settings.secondaryColor);

    // Clear bucket arrays
    for (let b = 0; b < NUM_COLOR_BUCKETS; b++) {
      this.bucketParticles[b].length = 0;
    }

    // Sort active particles into color buckets
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.alpha <= 0.01) continue;

      const bucketIdx = Math.min(NUM_COLOR_BUCKETS - 1, Math.floor(p.hueOffset * NUM_COLOR_BUCKETS));
      this.bucketParticles[bucketIdx].push(p);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Batch draw particles by color bucket
    for (let b = 0; b < NUM_COLOR_BUCKETS; b++) {
      const list = this.bucketParticles[b];
      if (list.length === 0) continue;

      ctx.fillStyle = this.colorBuckets[b];
      ctx.beginPath();

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        ctx.globalAlpha = p.alpha;
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }

      ctx.fill();
    }

    ctx.restore();
  }
}
