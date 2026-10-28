import { AppSettings } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';

const TAU = Math.PI * 2;

export interface MouseState {
  x: number;
  y: number;
  active: boolean;
  pulseRadius: number;
}

interface RainStreak {
  x: number;
  y: number;
  len: number;
  speed: number;
  width: number;
}

interface GlassDroplet {
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  wobble: number;
  trail: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
  duration: number;
  maxRadius: number;
  strength: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class RainSystem {
  private streaks: RainStreak[] = [];
  private droplets: GlassDroplet[] = [];
  private splashes: Splash[] = [];
  private dropSprite: HTMLCanvasElement | null = null;

  private time = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private splashCooldown = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private mouseInitialized = false;

  public spawnSplash(x: number, y: number, strength = 1): void {
    if (this.splashes.length > 24) this.splashes.shift();

    this.splashes.push({
      x,
      y,
      age: 0,
      duration: 0.9 + strength * 0.45,
      maxRadius: 34 + strength * 62,
      strength,
    });
  }

  public update(
    deltaTimeSec: number,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    this.time += deltaTimeSec;

    const widthScale = clamp(width / 1920, 0.6, 2);
    const desiredStreaks = Math.min(720, Math.round(settings.rainDensity * 5 * widthScale));
    const desiredDroplets = Math.min(400, Math.round(settings.rainDensity * 3.8 * widthScale));

    this.syncStreaks(desiredStreaks, width, height);
    this.syncDroplets(desiredDroplets, width, height);
    this.handleResize(width, height);

    const speedFactor = 0.55 + settings.rainSpeed * 0.85;
    const treble = settings.audioReactive && audio.hasAudio ? audio.treble : 0;

    for (const streak of this.streaks) {
      streak.y += streak.speed * speedFactor * deltaTimeSec * (1 + treble * 0.5);
      streak.x += streak.speed * 0.2 * speedFactor * deltaTimeSec;

      if (streak.y - streak.len > height) {
        streak.y = -streak.len - Math.random() * height * 0.25;
        streak.x = Math.random() * (width + 120) - 60;
      }
      if (streak.x > width + 50) {
        streak.x -= width + 100;
      }
    }

    const mouseMoved =
      mouse.active &&
      this.mouseInitialized &&
      (mouse.x - this.lastMouseX) ** 2 + (mouse.y - this.lastMouseY) ** 2 > 16;
    const wipeRadius = Math.max(44, mouse.pulseRadius * 0.55);

    this.splashCooldown = Math.max(0, this.splashCooldown - deltaTimeSec);

    for (const droplet of this.droplets) {
      const speed = droplet.vy * speedFactor;
      droplet.x += Math.sin(this.time * 0.8 + droplet.phase + droplet.wobble) * 1.6 * deltaTimeSec;
      droplet.y += speed * deltaTimeSec * (1 + treble * 0.4);

      if (settings.mouseInteraction && mouse.active) {
        const dx = droplet.x - mouse.x;
        const dy = droplet.y - mouse.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < wipeRadius * wipeRadius) {
          const dist = Math.max(1, Math.sqrt(distSq));
          const influence = 1 - dist / wipeRadius;
          droplet.y += influence * 28 * deltaTimeSec;

          if (mouseMoved && influence > 0.35) {
            this.resetDroplet(droplet, width, height);
            if (this.splashCooldown <= 0) {
              this.spawnSplash(mouse.x, mouse.y, 0.28);
              this.splashCooldown = 0.16;
            }
            continue;
          }
        }
      }

      if (droplet.y - droplet.r * 1.8 > height) {
        this.resetDroplet(droplet, width, height);
      }
      if (droplet.x < -20) droplet.x = width + 20;
      if (droplet.x > width + 20) droplet.x = -20;
    }

    if (mouse.active) {
      this.lastMouseX = mouse.x;
      this.lastMouseY = mouse.y;
      this.mouseInitialized = true;
    } else {
      this.mouseInitialized = false;
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const splash = this.splashes[i];
      splash.age += deltaTimeSec;
      if (splash.age >= splash.duration) {
        this.splashes.splice(i, 1);
      }
    }
  }

  private syncStreaks(count: number, width: number, height: number): void {
    while (this.streaks.length < count) {
      this.streaks.push(this.createStreak(width, height, true));
    }
    while (this.streaks.length > count) {
      this.streaks.pop();
    }
  }

  private syncDroplets(count: number, width: number, height: number): void {
    while (this.droplets.length < count) {
      this.droplets.push(this.createDroplet(width, height, true));
    }
    while (this.droplets.length > count) {
      this.droplets.pop();
    }
  }

  private createStreak(width: number, height: number, spread: boolean): RainStreak {
    const near = Math.random() < 0.34;
    return {
      x: Math.random() * (width + 100) - 30,
      y: spread ? Math.random() * height : -Math.random() * height * 0.4 - 20,
      len: (near ? 16 : 8) + Math.random() * (near ? 42 : 26),
      speed: (near ? 720 : 430) + Math.random() * (near ? 520 : 320),
      width: near ? 1.1 + Math.random() * 0.9 : 0.6 + Math.random() * 0.5,
    };
  }

  private createDroplet(width: number, height: number, spread: boolean): GlassDroplet {
    return {
      x: Math.random() * width,
      y: spread ? Math.random() * height : -Math.random() * height * 0.4,
      r: 0.7 + Math.pow(Math.random(), 2.5) * 4.8,
      vy: 0.8 + Math.random() * 13,
      phase: Math.random() * TAU,
      wobble: Math.random() * TAU,
      trail: Math.random() < 0.3 ? 8 + Math.random() * 32 : 0,
    };
  }

  private resetDroplet(droplet: GlassDroplet, width: number, height: number): void {
    droplet.x = Math.random() * width;
    droplet.y = -Math.random() * height * 0.35 - droplet.r * 2;
    droplet.r = 0.7 + Math.pow(Math.random(), 2.5) * 4.8;
    droplet.vy = 0.8 + Math.random() * 13;
    droplet.phase = Math.random() * TAU;
    droplet.wobble = Math.random() * TAU;
    droplet.trail = Math.random() < 0.3 ? 8 + Math.random() * 32 : 0;
  }

  private handleResize(width: number, height: number): void {
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;

    for (const streak of this.streaks) {
      if (streak.x > width + 60) streak.x = Math.random() * width;
      if (streak.y > height) streak.y = Math.random() * height;
    }
    for (const droplet of this.droplets) {
      if (droplet.x > width) droplet.x = Math.random() * width;
      if (droplet.y > height) droplet.y = Math.random() * height;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    ctx.save();
    this.renderStreaks(ctx);
    this.renderPointerHeat(ctx, settings, mouse);
    this.renderDroplets(ctx, settings, audio);
    this.renderSplashes(ctx, settings);
    ctx.restore();
  }

  private renderStreaks(ctx: CanvasRenderingContext2D): void {
    if (this.streaks.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(155, 190, 210, 0.055)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const streak of this.streaks) {
      if (streak.width > 1.3) continue;
      const slant = streak.len * 0.2;
      ctx.moveTo(streak.x - slant, streak.y - streak.len);
      ctx.lineTo(streak.x, streak.y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(185, 215, 225, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const streak of this.streaks) {
      if (streak.width <= 1.3) continue;
      const slant = streak.len * 0.2;
      ctx.moveTo(streak.x - slant, streak.y - streak.len);
      ctx.lineTo(streak.x, streak.y);
    }
    ctx.stroke();

    ctx.restore();
  }

  private renderPointerHeat(
    ctx: CanvasRenderingContext2D,
    settings: AppSettings,
    mouse: MouseState
  ): void {
    if (!settings.mouseInteraction || !mouse.active) return;

    const p = settings.primaryColor;
    const radius = Math.max(42, mouse.pulseRadius * 0.6);
    const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
    gradient.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 0.10)`);
    gradient.addColorStop(0.55, `rgba(${p.r}, ${p.g}, ${p.b}, 0.04)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private renderDroplets(
    ctx: CanvasRenderingContext2D,
    settings: AppSettings,
    audio: AudioMetrics
  ): void {
    if (this.droplets.length === 0) return;
    const sprite = this.ensureDropSprite();
    const reactive = settings.audioReactive && audio.hasAudio ? audio.treble : 0;
    const p = settings.primaryColor;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (const droplet of this.droplets) {
      if (droplet.trail > 0) {
        ctx.strokeStyle = 'rgba(165, 205, 215, 0.065)';
        ctx.lineWidth = Math.max(0.6, droplet.r * 0.35);
        ctx.beginPath();
        ctx.moveTo(droplet.x, droplet.y - droplet.trail);
        ctx.bezierCurveTo(droplet.x - 2, droplet.y - droplet.trail * 0.6,
          droplet.x + 2, droplet.y - droplet.trail * 0.3, droplet.x, droplet.y);
        ctx.stroke();
      }

      const w = droplet.r * 2.7;
      const h = droplet.r * 3.5;
      ctx.globalAlpha = clamp(0.5 + reactive * 0.3, 0, 0.9);
      ctx.drawImage(sprite, droplet.x - w * 0.5, droplet.y - h * 0.55, w, h);

      if (reactive > 0.08) {
        ctx.globalAlpha = reactive * 0.22;
        ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
        ctx.beginPath();
        ctx.arc(droplet.x, droplet.y, droplet.r * 2.2, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderSplashes(ctx: CanvasRenderingContext2D, settings: AppSettings): void {
    if (this.splashes.length === 0) return;
    const p = settings.primaryColor;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const splash of this.splashes) {
      const t = clamp(splash.age / splash.duration, 0, 1);
      const radius = splash.maxRadius * (1 - Math.pow(1 - t, 3));
      const alpha = (1 - t) * (1 - t) * 0.5 * splash.strength;

      ctx.strokeStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(splash.x, splash.y, radius, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = `rgba(205, 232, 255, ${alpha * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(splash.x, splash.y, radius * 0.72, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }

  private ensureDropSprite(): HTMLCanvasElement {
    if (this.dropSprite) return this.dropSprite;

    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.dropSprite = canvas;
      return canvas;
    }

    const body = ctx.createRadialGradient(24, 34, 2, 24, 34, 22);
    body.addColorStop(0, 'rgba(2, 8, 17, 0.45)');
    body.addColorStop(0.55, 'rgba(6, 18, 28, 0.35)');
    body.addColorStop(0.82, 'rgba(140, 195, 210, 0.24)');
    body.addColorStop(0.94, 'rgba(195, 228, 235, 0.48)');
    body.addColorStop(1, 'rgba(190, 225, 255, 0)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(24, 34, 19, 26, 0, 0, TAU);
    ctx.fill();

    const highlight = ctx.createRadialGradient(17, 20, 0, 17, 20, 8);
    highlight.addColorStop(0, 'rgba(225, 249, 255, 0.75)');
    highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(17, 20, 6, 8, -0.25, 0, TAU);
    ctx.fill();

    const rim = ctx.createLinearGradient(24, 12, 24, 58);
    rim.addColorStop(0, 'rgba(255, 255, 255, 0)');
    rim.addColorStop(1, 'rgba(215, 240, 255, 0.32)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(24, 36, 17, 23, 0, 0, TAU);
    ctx.stroke();

    this.dropSprite = canvas;
    return canvas;
  }
}
