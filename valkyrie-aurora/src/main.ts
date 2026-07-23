import { settingsStore, SettingsStore } from './config/settings';
import { audioProcessor } from './audio/AudioProcessor';
import { LayerRenderer } from './render/LayerRenderer';
import { ClockOverlay } from './ui/ClockOverlay';
import type { WallpaperUserProperties, WallpaperGeneralProperties } from './types/wallpaper';

class ValkyrieApp {
  private canvas: HTMLCanvasElement;
  private renderer: LayerRenderer;
  private clockOverlay: ClockOverlay;

  private isRunning = true;
  private lastTimestamp = 0;
  private targetFps = 60;
  private frameInterval = 1000 / 60;

  constructor() {
    const canvas = document.getElementById('wallpaper-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element #wallpaper-canvas not found');
    }
    this.canvas = canvas;

    this.resizeCanvas();
    this.renderer = new LayerRenderer(this.canvas);
    this.clockOverlay = new ClockOverlay();

    this.setupListeners();
    this.setupWallpaperEngineAPI();

    this.startLoop();
  }

  private resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0); // Cap DPR to 2.0 for performance
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private setupListeners(): void {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isRunning = false;
      } else {
        this.isRunning = true;
        this.lastTimestamp = performance.now();
        this.loop(performance.now());
      }
    });
  }

  private setupWallpaperEngineAPI(): void {
    // Wallpaper Engine Property Listener
    window.wallpaperPropertyListener = {
      applyGeneralProperties: (properties: WallpaperGeneralProperties) => {
        if (typeof properties.fps === 'number' && properties.fps > 0) {
          this.targetFps = properties.fps;
          this.frameInterval = 1000 / this.targetFps;
        }
      },

      applyUserProperties: (properties: WallpaperUserProperties) => {
        const current = settingsStore.current;

        if (properties.schemetype?.value) {
          settingsStore.applyPreset(properties.schemetype.value);
        }

        if (properties.parallaxintensity) {
          current.parallaxIntensity = Math.max(0, Math.min(2.0, properties.parallaxintensity.value));
        }

        if (properties.breathingintensity) {
          current.breathingIntensity = Math.max(0, Math.min(2.0, properties.breathingintensity.value));
        }

        if (properties.particlecount) {
          current.particleCount = Math.max(100, Math.min(3000, properties.particlecount.value));
        }

        if (properties.particlespeed) {
          current.particleSpeed = Math.max(0.1, Math.min(3.0, properties.particlespeed.value));
        }

        if (properties.showclock) {
          current.showClock = properties.showclock.value;
          this.clockOverlay.updateVisibility();
        }

        if (properties.showseconds) {
          current.showSeconds = properties.showseconds.value;
          this.clockOverlay.updateClock();
        }

        if (properties.clockformat?.value) {
          current.clockFormat = properties.clockformat.value;
          this.clockOverlay.updateClock();
        }

        if (properties.audioreactive) {
          current.audioReactive = properties.audioreactive.value;
        }

        if (properties.audiosensitivity) {
          current.audioSensitivity = Math.max(0.5, Math.min(3.0, properties.audiosensitivity.value));
        }

        if (properties.visualizerstyle?.value) {
          current.visualizerStyle = properties.visualizerstyle.value;
        }

        if (properties.taskbaroffset) {
          current.taskbarOffset = Math.max(0, Math.min(150, properties.taskbaroffset.value));
        }

        if (properties.primarycolor) {
          const col = SettingsStore.parseWallpaperColor(properties.primarycolor.value);
          if (col) current.primaryColor = col;
        }

        if (properties.secondarycolor) {
          const col = SettingsStore.parseWallpaperColor(properties.secondarycolor.value);
          if (col) current.secondaryColor = col;
        }

        if (properties.fpslimit?.value) {
          if (properties.fpslimit.value === 'unlimited') {
            this.targetFps = 0;
            this.frameInterval = 0;
          } else {
            const parsed = parseInt(properties.fpslimit.value, 10);
            if (!isNaN(parsed) && parsed > 0) {
              this.targetFps = parsed;
              this.frameInterval = 1000 / this.targetFps;
            }
          }
        }

        settingsStore.updateCSSVariables();
      },
    };

    // Wallpaper Engine Audio Register Listener
    if (typeof window.wallpaperRegisterAudioListener === 'function') {
      window.wallpaperRegisterAudioListener((audioData: number[]) => {
        audioProcessor.processAudioData(audioData);
      });
    }
  }

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private loop(timestamp: number): void {
    if (!this.isRunning) return;

    const deltaMs = timestamp - this.lastTimestamp;

    if (this.targetFps === 0 || deltaMs >= this.frameInterval) {
      const deltaTime = Math.min(deltaMs / 1000, 0.1); // Clamp delta time to avoid large jumps
      this.lastTimestamp = timestamp - (this.targetFps === 0 ? 0 : deltaMs % this.frameInterval);

      this.renderer.render(deltaTime);
    }

    requestAnimationFrame((ts) => this.loop(ts));
  }
}

// Initialize application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ValkyrieApp());
} else {
  new ValkyrieApp();
}
