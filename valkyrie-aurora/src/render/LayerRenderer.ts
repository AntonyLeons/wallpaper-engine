import { settingsStore } from '../config/settings';
import { audioProcessor } from '../audio/AudioProcessor';

export class LayerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private bgImage: HTMLImageElement | null = null;
  private bodyImage: HTMLImageElement | null = null;
  private frontHairImage: HTMLImageElement | null = null;

  // Eye Animation Frames Sequence
  private eyeOpenFrame: HTMLImageElement | null = null;
  private eyeHalfFrame: HTMLImageElement | null = null;
  private eyeClosedFrame: HTMLImageElement | null = null;

  // Smooth Parallax Mouse State
  private targetMouseX = 0;
  private targetMouseY = 0;
  private currentMouseX = 0;
  private currentMouseY = 0;

  // Animation Phases
  private breathingPhase = 0;
  private hairBreezePhase = 0;

  // Natural Multi-Frame Eye Blinking
  private blinkTimer = 0;
  private nextBlinkInterval = 3.8; // Seconds
  private blinkDuration = 0.18;   // 180ms sequence
  private currentEyeState: 'open' | 'half' | 'closed' = 'open';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Failed to get 2D context');
    this.ctx = context;

    this.loadAssets();
    this.setupMouseListeners();
  }

  private loadAssets(): void {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = src;
      });

    Promise.all([
      load('./assets/background.png'),
      load('./assets/character_body.png'),
      load('./assets/character_hair_front.png'),
      load('./assets/eyes_open.png'),
      load('./assets/eyes_half.png'),
      load('./assets/eyes_closed.png'),
    ]).then(([bg, body, hairFront, eOpen, eHalf, eClosed]) => {
      this.bgImage = bg;
      this.bodyImage = body;
      this.frontHairImage = hairFront;
      this.eyeOpenFrame = eOpen;
      this.eyeHalfFrame = eHalf;
      this.eyeClosedFrame = eClosed;
    });
  }

  private setupMouseListeners(): void {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      this.targetMouseX = (e.clientX - cx) / cx;
      this.targetMouseY = (e.clientY - cy) / cy;
    });

    window.addEventListener('mouseleave', () => {
      this.targetMouseX = 0;
      this.targetMouseY = 0;
    });
  }

  public render(deltaTime: number): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const settings = settingsStore.current;

    // Smooth Mouse Parallax Lerp
    this.currentMouseX += (this.targetMouseX - this.currentMouseX) * 0.05;
    this.currentMouseY += (this.targetMouseY - this.currentMouseY) * 0.05;

    this.breathingPhase += deltaTime * 1.4;
    this.hairBreezePhase += deltaTime * 2.2;
    this.updateBlinkFrame(deltaTime);

    // Deep Dark Canvas Clear
    this.ctx.fillStyle = '#080512';
    this.ctx.fillRect(0, 0, w, h);

    // 1. Distant Background Layer (Depth Parallax)
    if (this.bgImage) {
      const p = settings.parallaxIntensity * 12;
      const ox = -this.currentMouseX * p;
      const oy = -this.currentMouseY * p;
      const scale = Math.max((w + 40) / this.bgImage.width, (h + 40) / this.bgImage.height);
      const dw = this.bgImage.width * scale;
      const dh = this.bgImage.height * scale;
      this.ctx.drawImage(this.bgImage, (w - dw) * 0.5 + ox, (h - dh) * 0.5 + oy, dw, dh);
    }

    // 2. Audio Glow Pulse (if enabled)
    if (settings.audioReactive && settings.visualizerStyle === 'glow_pulse') {
      const bass = audioProcessor.bass * settings.audioSensitivity;
      if (bass > 0.05) {
        const pCol = settings.primaryColor;
        const rad = Math.min(w, h) * (0.28 + bass * 0.22);
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        const g = this.ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, rad);
        g.addColorStop(0, `rgba(${pCol.r}, ${pCol.g}, ${pCol.b}, ${Math.min(0.45, bass * 0.35)})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
      }
    }

    // 3. Multi-Layer Character & Hair Animation Engine (100% Pixel-Aligned)
    if (this.bodyImage) {
      const p = settings.parallaxIntensity * 26;
      const ox = this.currentMouseX * p;
      const oy = this.currentMouseY * p;

      const breathY = Math.sin(this.breathingPhase) * 6 * settings.breathingIntensity;
      const audioScale = settings.audioReactive ? audioProcessor.bass * settings.audioSensitivity * 0.015 : 0;
      const scale = (h / this.bodyImage.height) * 0.95 * (1.0 + audioScale);

      const dw = this.bodyImage.width * scale;
      const dh = this.bodyImage.height * scale;

      const audioBreeze = settings.audioReactive ? audioProcessor.bass * settings.audioSensitivity * 2.0 : 0;
      const breezeX = Math.sin(this.hairBreezePhase) * (2.0 + audioBreeze);

      const bodyX = (w - dw) * 0.5 + ox + breezeX;
      const bodyY = (h - dh) * 0.65 + oy + breathY;

      this.ctx.save();
      this.ctx.shadowColor = 'rgba(220, 230, 255, 0.35)';
      this.ctx.shadowBlur = 20;

      // 3A. Draw Character Body Base
      this.ctx.drawImage(this.bodyImage, bodyX, bodyY, dw, dh);

      // 3B. Draw Multi-Frame Eye Animation (100% Pixel Aligned)
      const eyeFrame =
        this.currentEyeState === 'closed'
          ? this.eyeClosedFrame
          : this.currentEyeState === 'half'
          ? this.eyeHalfFrame
          : this.eyeOpenFrame;

      if (eyeFrame) {
        this.ctx.drawImage(eyeFrame, bodyX, bodyY, dw, dh);
      }

      // 3C. Draw Front Hair Layer (100% Pixel Aligned with ZERO offset)
      if (this.frontHairImage) {
        this.ctx.drawImage(this.frontHairImage, bodyX, bodyY, dw, dh);
      }

      this.ctx.restore();
    }

    // 4. Audio Spectrum Bars (if enabled)
    if (settings.audioReactive && settings.visualizerStyle === 'bars') {
      this.renderAudioSpectrumBars(w, h);
    }
  }

  private updateBlinkFrame(deltaTime: number): void {
    this.blinkTimer += deltaTime;

    if (this.blinkTimer >= this.nextBlinkInterval) {
      const t = this.blinkTimer - this.nextBlinkInterval;
      if (t <= this.blinkDuration) {
        const progress = t / this.blinkDuration; // 0 to 1
        if (progress < 0.25 || progress > 0.75) {
          this.currentEyeState = 'half';
        } else {
          this.currentEyeState = 'closed';
        }
      } else {
        this.currentEyeState = 'open';
        this.blinkTimer = 0;
        this.nextBlinkInterval = 3.0 + Math.random() * 3.5;
      }
    } else {
      this.currentEyeState = 'open';
    }
  }

  private renderAudioSpectrumBars(width: number, height: number): void {
    const settings = settingsStore.current;
    const spectrum = audioProcessor.getFrequencySpectrum();
    const p = settings.primaryColor;
    const s = settings.secondaryColor;

    const numBars = 48;
    const barSpacing = 4;
    const totalWidth = width * 0.6;
    const barWidth = (totalWidth - (numBars - 1) * barSpacing) / numBars;
    const startX = (width - totalWidth) * 0.5;
    const baseY = height - settings.taskbarOffset - 20;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < numBars; i++) {
      const val = (spectrum[i] || 0) * settings.audioSensitivity;
      const barHeight = Math.max(4, val * 150);
      const x = startX + i * (barWidth + barSpacing);
      const y = baseY - barHeight;

      const grad = this.ctx.createLinearGradient(x, baseY, x, y);
      grad.addColorStop(0, `rgba(${s.r}, ${s.g}, ${s.b}, 0.35)`);
      grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0.85)`);

      this.ctx.fillStyle = grad;
      this.ctx.shadowColor = `rgb(${p.r}, ${p.g}, ${p.b})`;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();
    }

    this.ctx.restore();
  }
}
