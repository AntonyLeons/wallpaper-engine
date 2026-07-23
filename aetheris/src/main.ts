import './style.css';
import { settingsManager, SchemeType } from './config/settings';
import { AudioAnalyzer } from './audio/AudioAnalyzer';
import { ParticleSystem, MouseState } from './render/ParticleSystem';
import { BackgroundRenderer } from './render/BackgroundRenderer';
import { ClockOverlay } from './ui/ClockOverlay';
import { WallpaperUserProperties } from './types/wallpaper';

// Register wallpaperPropertyListener immediately at global top-level per official Wallpaper Engine docs
window.wallpaperPropertyListener = {
  applyUserProperties: (properties: WallpaperUserProperties) => {
    settingsManager.updateFromWallpaperEngine(properties);
  },
};

class Application {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioAnalyzer: AudioAnalyzer;
  private particleSystem: ParticleSystem;
  private backgroundRenderer: BackgroundRenderer;
  private clockOverlay: ClockOverlay;

  private isRunning = false;
  private lastFrameTime = 0;

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

    this.audioAnalyzer = new AudioAnalyzer();
    this.particleSystem = new ParticleSystem();
    this.backgroundRenderer = new BackgroundRenderer();
    this.clockOverlay = new ClockOverlay();

    this.initEvents();
    this.handleResize();

    const params = new URLSearchParams(window.location.search);
    if (params.get('record') === 'true') {
      this.runAutomatedRecorder();
    } else {
      this.startLoop();
    }
  }

  private initEvents(): void {
    window.addEventListener('resize', () => this.handleResize());

    // Pause animation when background tab / hidden display to respect performance
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopLoop();
      } else {
        this.startLoop();
      }
    });

    // Mouse interactivity
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });

    window.addEventListener('mousedown', () => {
      this.mouse.pulseRadius = 260;
    });

    window.addEventListener('mouseup', () => {
      this.mouse.pulseRadius = 180;
    });

    // Touch interactivity
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.mouse.x = e.touches[0].clientX;
        this.mouse.y = e.touches[0].clientY;
        this.mouse.active = true;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.mouse.active = false;
    });
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Cap devicePixelRatio at 2.0 to ensure 4K monitors remain smooth
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale 2D context for high-DPI displays
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  private stopLoop(): void {
    this.isRunning = false;
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    const settings = settingsManager.settings;
    const targetFps = settings.fpsLimit;

    // FPS Limiter Logic
    if (targetFps > 0) {
      const frameInterval = 1000 / targetFps;
      const elapsed = now - this.lastFrameTime;
      if (elapsed < frameInterval - 1) {
        requestAnimationFrame((t) => this.tick(t));
        return;
      }
    }

    const deltaTimeSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    // 1. Process Audio
    const audioMetrics = this.audioAnalyzer.update(deltaTimeSec, settings.audioSensitivity);

    // 2. Update Particles
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.particleSystem.update(deltaTimeSec, width, height, settings, audioMetrics, this.mouse);

    // 3. Render Background & Visualizer
    this.backgroundRenderer.render(this.ctx, width, height, deltaTimeSec, settings, audioMetrics, this.mouse);

    // 4. Render Particles
    this.particleSystem.render(this.ctx, settings);

    // 5. Update UI Clock Overlay
    this.clockOverlay.update(settings);

    requestAnimationFrame((t) => this.tick(t));
  }

  private async runAutomatedRecorder(): Promise<void> {
    const statusOverlay = document.createElement('div');
    statusOverlay.style.position = 'fixed';
    statusOverlay.style.top = '20px';
    statusOverlay.style.right = '20px';
    statusOverlay.style.zIndex = '99999';
    statusOverlay.style.background = 'rgba(0,0,0,0.85)';
    statusOverlay.style.color = '#00ffcc';
    statusOverlay.style.padding = '12px 20px';
    statusOverlay.style.borderRadius = '8px';
    statusOverlay.style.fontFamily = 'monospace';
    statusOverlay.style.fontSize = '14px';
    statusOverlay.style.border = '1px solid #00ffcc';
    document.body.appendChild(statusOverlay);

    const themes: { name: SchemeType; title: string }[] = [
      { name: 'cosmic', title: 'Cosmic Nebula' },
      { name: 'synthwave', title: 'Synthwave Horizon' },
      { name: 'quantum', title: 'Quantum Field' },
      { name: 'obsidian', title: 'Obsidian Dark' },
    ];

    const targetFps = 15;
    const frameIntervalMs = 1000 / targetFps;
    const secondsPerTheme = 3.0; // 3 seconds per theme to let particles generate & populate
    const framesPerTheme = Math.round(secondsPerTheme * targetFps); // 45 frames per theme

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dt = 1 / targetFps;

    for (let t = 0; t < themes.length; t++) {
      const theme = themes[t];
      settingsManager.updateFromWallpaperEngine({ schemetype: { value: theme.name } });

      for (let f = 0; f < framesPerTheme; f++) {
        const settings = settingsManager.settings;
        const audioMetrics = this.audioAnalyzer.update(dt, settings.audioSensitivity);

        // Advance simulation
        this.particleSystem.update(dt, width, height, settings, audioMetrics, this.mouse);
        this.backgroundRenderer.render(this.ctx, width, height, dt, settings, audioMetrics, this.mouse);
        this.particleSystem.render(this.ctx, settings);
        this.clockOverlay.renderToCanvas(this.ctx, width, height, settings);
        this.clockOverlay.update(settings);

        statusOverlay.textContent = `Recording [Theme ${t + 1}/4: ${theme.title}] Frame ${f + 1}/${framesPerTheme}...`;

        const dataUrl = this.canvas.toDataURL('image/png');
        await fetch('http://localhost:9876/save_frame', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: dataUrl,
        });

        await new Promise((r) => setTimeout(r, frameIntervalMs));
      }
    }

    statusOverlay.textContent = 'Encoding preview.gif with FFmpeg...';
    statusOverlay.style.color = '#ffff00';

    await fetch('http://localhost:9876/finish_recording', { method: 'POST' });
    statusOverlay.textContent = 'SUCCESS! preview.gif encoded!';
    statusOverlay.style.color = '#00ff66';
  }
}

// Bootstrap application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Application());
} else {
  new Application();
}
