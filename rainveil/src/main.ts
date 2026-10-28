import './style.css';
import { settingsManager } from './config/settings';
import { AudioAnalyzer } from './audio/AudioAnalyzer';
import { RainSystem, MouseState } from './render/RainSystem';
import { CityRenderer } from './render/CityRenderer';
import { GlowSystem } from './render/GlowSystem';
import { VisualizerRenderer } from './render/VisualizerRenderer';
import { ClockOverlay } from './ui/ClockOverlay';
import { WallpaperUserProperties } from './types/wallpaper';

// Register immediately, while preserving callbacks supplied by other integrations.
const propertyListener = window.wallpaperPropertyListener ?? {};
const previousApplyUserProperties = propertyListener.applyUserProperties;
const previousApplyGeneralProperties = propertyListener.applyGeneralProperties;

propertyListener.applyUserProperties = (properties: WallpaperUserProperties) => {
  previousApplyUserProperties?.(properties);
  settingsManager.updateFromWallpaperEngine(properties);
};

propertyListener.applyGeneralProperties = (properties: Record<string, unknown>) => {
  previousApplyGeneralProperties?.(properties);
  if (typeof properties.fps === 'number') {
    settingsManager.setGlobalFps(properties.fps);
  }
};

window.wallpaperPropertyListener = propertyListener;

// Register audio processing as early as possible, before the DOM is ready.
const audioAnalyzer = new AudioAnalyzer();

class Application {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioAnalyzer: AudioAnalyzer;
  private rainSystem: RainSystem;
  private cityRenderer: CityRenderer;
  private glowSystem: GlowSystem;
  private visualizerRenderer: VisualizerRenderer;
  private clockOverlay: ClockOverlay;

  private isRunning = false;
  private lastFrameTime = 0;
  private frameId: number | null = null;

  private readonly animate = (now: number): void => {
    this.frameId = null;
    this.tick(now);
  };

  private mouse: MouseState = {
    x: -1000,
    y: -1000,
    active: false,
    pulseRadius: 180,
  };

  constructor() {
    this.canvas = document.getElementById('wallpaper-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element #wallpaper-canvas not found!');
    }

    const context = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) {
      throw new Error('Failed to get 2D rendering context!');
    }
    this.ctx = context;

    this.audioAnalyzer = audioAnalyzer;
    this.rainSystem = new RainSystem();
    this.cityRenderer = new CityRenderer();
    this.glowSystem = new GlowSystem();
    this.visualizerRenderer = new VisualizerRenderer();
    this.clockOverlay = new ClockOverlay();

    this.initEvents();
    this.handleResize();
    this.startLoop();
  }

  private initEvents(): void {
    window.addEventListener('resize', () => this.handleResize());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopLoop();
      } else {
        this.startLoop();
      }
    });

    window.addEventListener('mousemove', (event) => {
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
      this.mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });

    window.addEventListener('mousedown', (event) => {
      this.mouse.pulseRadius = 260;
      this.rainSystem.spawnSplash(event.clientX, event.clientY, 0.9);
    });

    window.addEventListener('mouseup', () => {
      this.mouse.pulseRadius = 180;
    });

    window.addEventListener(
      'touchmove',
      (event) => {
        if (event.touches.length > 0) {
          this.mouse.x = event.touches[0].clientX;
          this.mouse.y = event.touches[0].clientY;
          this.mouse.active = true;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchstart',
      (event) => {
        if (event.touches.length > 0) {
          const touch = event.touches[0];
          this.mouse.x = touch.clientX;
          this.mouse.y = touch.clientY;
          this.mouse.active = true;
          this.rainSystem.spawnSplash(touch.clientX, touch.clientY, 0.8);
        }
      },
      { passive: true }
    );

    window.addEventListener('touchend', () => {
      this.mouse.active = false;
    });
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // A modest cap prevents an 8K backing canvas on 4K high-DPI displays.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private startLoop(): void {
    if (this.isRunning || document.hidden) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameId = requestAnimationFrame(this.animate);
  }

  private stopLoop(): void {
    this.isRunning = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    const settings = settingsManager.settings;
    const targetFps = settings.fpsLimit;

    if (targetFps > 0) {
      const frameInterval = 1000 / targetFps;
      const elapsed = now - this.lastFrameTime;
      if (elapsed < frameInterval - 1) {
        this.frameId = requestAnimationFrame(this.animate);
        return;
      }
    }

    const deltaTimeSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const audioMetrics = this.audioAnalyzer.update(deltaTimeSec, settings.audioSensitivity);

    this.cityRenderer.update(deltaTimeSec, width, height, settings, audioMetrics, this.mouse);
    this.rainSystem.update(deltaTimeSec, width, height, settings, audioMetrics, this.mouse);
    this.glowSystem.update(deltaTimeSec, width, height, settings, audioMetrics, this.mouse);

    this.cityRenderer.render(this.ctx, width, height);
    this.glowSystem.render(this.ctx);
    this.rainSystem.render(this.ctx, settings, audioMetrics, this.mouse);
    this.visualizerRenderer.render(this.ctx, width, height, deltaTimeSec, settings, audioMetrics);
    this.cityRenderer.renderForeground(this.ctx, width, height);
    this.clockOverlay.update(settings);

    this.frameId = requestAnimationFrame(this.animate);
  }
}

// Bootstrap application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Application());
} else {
  new Application();
}
