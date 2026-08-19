import { audioProcessor } from '../audio/AudioProcessor';
import { settingsStore } from '../config/settings';

interface Snowflake { x: number; y: number; speed: number; size: number; opacity: number; }

/** A deliberately small renderer for an always-on desktop wallpaper. */
export class LayerRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scene = new Image();
  private readonly snow: Snowflake[] = [];
  private time = 0;
  private pointerX = 0;
  private targetPointerX = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) throw new Error('Failed to get 2D canvas context');
    this.ctx = context;
    this.scene.src = './assets/valkyrie-fjord.png';
    for (let i = 0; i < 110; i += 1) this.snow.push({ x: Math.random(), y: Math.random(), speed: 0.018 + Math.random() * 0.045, size: 0.5 + Math.random() * 1.2, opacity: 0.08 + Math.random() * 0.25 });
    window.addEventListener('mousemove', (event) => { this.targetPointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2; }, { passive: true });
    window.addEventListener('mouseleave', () => { this.targetPointerX = 0; });
  }

  public render(deltaTime: number): void {
    const { ctx, canvas } = this;
    const settings = settingsStore.current;
    const width = canvas.width;
    const height = canvas.height;
    this.time += deltaTime;
    this.pointerX += (this.targetPointerX - this.pointerX) * Math.min(1, deltaTime * 2.2);
    ctx.clearRect(0, 0, width, height);
    this.drawCoverImage(width, height, settings.parallaxIntensity);
    const audioLevel = settings.audioReactive ? audioProcessor.overall * settings.audioSensitivity : 0;
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const alpha = Math.min(0.2, 0.055 + audioLevel * 0.06) * settings.auroraIntensity;
    const wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`);
    wash.addColorStop(0.52, 'rgba(1, 7, 18, 0)');
    wash.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha * 0.55})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    this.drawSnow(width, height, deltaTime, Math.round(settings.particleCount * 0.22));
  }

  private drawCoverImage(width: number, height: number, parallax: number): void {
    if (!this.scene.complete || this.scene.naturalWidth === 0) {
      this.ctx.fillStyle = '#040914'; this.ctx.fillRect(0, 0, width, height); return;
    }
    const scale = Math.max(width / this.scene.naturalWidth, height / this.scene.naturalHeight);
    const drawWidth = this.scene.naturalWidth * scale;
    const drawHeight = this.scene.naturalHeight * scale;
    const overscan = 18 * parallax;
    const x = (width - drawWidth) * 0.5 - this.pointerX * overscan;
    const y = (height - drawHeight) * 0.5;
    this.ctx.drawImage(this.scene, x - overscan, y - overscan, drawWidth + overscan * 2, drawHeight + overscan * 2);
  }

  private drawSnow(width: number, height: number, deltaTime: number, requestedCount: number): void {
    const count = Math.min(this.snow.length, Math.max(18, requestedCount));
    this.ctx.fillStyle = 'rgba(230, 248, 255, 0.55)';
    for (let index = 0; index < count; index += 1) {
      const flake = this.snow[index];
      flake.y += flake.speed * deltaTime;
      flake.x += Math.sin(this.time * 0.45 + index) * 0.0009 * deltaTime;
      if (flake.y > 1.03) { flake.y = -0.03; flake.x = Math.random(); }
      if (flake.x < -0.03) flake.x = 1.03;
      if (flake.x > 1.03) flake.x = -0.03;
      this.ctx.globalAlpha = flake.opacity;
      this.ctx.fillRect(flake.x * width, flake.y * height, flake.size, flake.size);
    }
    this.ctx.globalAlpha = 1;
  }
}
