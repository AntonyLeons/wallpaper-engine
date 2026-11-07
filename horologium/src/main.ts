import './style.css';
import { settingsManager } from './config/settings';
import { AudioAnalyzer } from './audio/AudioAnalyzer';
import { BackdropRenderer } from './render/BackdropRenderer';
import { GearSystem } from './render/GearSystem';
import type { MouseState } from './render/GearSystem';
import { VisualizerRenderer } from './render/VisualizerRenderer';
import { ClockOverlay } from './ui/ClockOverlay';
import type { WallpaperUserProperties } from './types/wallpaper';

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

class Application {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioAnalyzer: AudioAnalyzer;
  private backdropRenderer: BackdropRenderer;
  private gearSystem: GearSystem;
  private visualizerRenderer: VisualizerRenderer;
  private clockOverlay: ClockOverlay;

  private isRunning = false;
  private lastFrameTime = 0;
  private nextFrameTime = 0;
  private lastFpsLimit = 0;
  private frameId: number | null = null;
  private readonly animate = (now: number): void => {
    this.frameId = null;
    this.tick(now);
  };

  private mouse: MouseState = {
    x: -1000,
    y: -1000,
    active: false,
    lensRadius: 180,
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

    this.audioAnalyzer = new AudioAnalyzer();
    this.backdropRenderer = new BackdropRenderer();
    this.gearSystem = new GearSystem();
    this.visualizerRenderer = new VisualizerRenderer();
    this.clockOverlay = new ClockOverlay();

    this.initEvents();
    this.handleResize();
    this.startLoop();
  }

  private initEvents(): void {
    window.addEventListener('resize', () => this.handleResize());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopLoop();
      else this.startLoop();
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });

    window.addEventListener('mousedown', (e) => {
      this.mouse.lensRadius = 260;
      this.gearSystem.spawnShockwave(e.clientX, e.clientY, 1);
    });

    window.addEventListener('mouseup', () => {
      this.mouse.lensRadius = 180;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.mouse.x = e.touches[0].clientX;
        this.mouse.y = e.touches[0].clientY;
        this.mouse.active = true;
      }
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.mouse.x = e.touches[0].clientX;
        this.mouse.y = e.touches[0].clientY;
        this.mouse.active = true;
        this.gearSystem.spawnShockwave(this.mouse.x, this.mouse.y, 1);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.mouse.active = false;
    });
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
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
    this.nextFrameTime = this.lastFrameTime;
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
    if (targetFps !== this.lastFpsLimit) {
      this.lastFpsLimit = targetFps;
      this.nextFrameTime = now;
    }
    if (targetFps > 0) {
      const frameInterval = 1000 / targetFps;
      const timingTolerance = 0.25;
      if (now + timingTolerance < this.nextFrameTime) {
        this.frameId = requestAnimationFrame(this.animate);
        return;
      }
      const elapsedSlots = Math.floor((now + timingTolerance - this.nextFrameTime) / frameInterval);
      this.nextFrameTime += (elapsedSlots + 1) * frameInterval;
    }

    const deltaTimeSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const audioMetrics = this.audioAnalyzer.update(deltaTimeSec, settings.audioSensitivity);

    this.backdropRenderer.render(this.ctx, width, height, settings);
    this.gearSystem.update(deltaTimeSec, width, height, settings, audioMetrics, this.mouse);
    this.gearSystem.render(this.ctx, width, height, settings, audioMetrics, this.mouse);

    this.clockOverlay.update(settings);

    if (settings.visualizerStyle !== 'off') {
      const clockBounds = settings.visualizerPosition === 'follow_clock'
        && settings.showClock && settings.audioReactive && audioMetrics.hasAudio
        ? this.clockOverlay.getBounds() : null;
      this.visualizerRenderer.render(this.ctx, width, height, deltaTimeSec, settings, audioMetrics, clockBounds);
    }

    this.frameId = requestAnimationFrame(this.animate);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Application());
} else {
  new Application();
}
