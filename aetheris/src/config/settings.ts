import { WallpaperUserProperties } from '../types/wallpaper';

export type SchemeType = 'cosmic' | 'synthwave' | 'quantum' | 'obsidian';
export type VisualizerStyle = 'bars' | 'circular' | 'waveform' | 'off';
export type ClockFormat = '12h' | '24h';

export interface ColorRGB {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

export interface AppSettings {
  schemeType: SchemeType;
  particleCount: number;
  particleSpeed: number;
  showClock: boolean;
  showSeconds: boolean;
  clockFormat: ClockFormat;
  audioReactive: boolean;
  audioSensitivity: number;
  visualizerStyle: VisualizerStyle;
  taskbarOffset: number; // in pixels
  primaryColor: ColorRGB;
  secondaryColor: ColorRGB;
  fpsLimit: number; // 0 for unlimited
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemeType: 'cosmic',
  particleCount: 1500,
  particleSpeed: 1.0,
  showClock: true,
  showSeconds: true,
  clockFormat: '24h',
  audioReactive: true,
  audioSensitivity: 1.5,
  visualizerStyle: 'bars',
  taskbarOffset: 48,
  primaryColor: { r: 102, g: 153, b: 255 }, // #6699ff
  secondaryColor: { r: 230, g: 51, b: 204 }, // #e633cc
  fpsLimit: 0,
};

type SettingsChangeListener = (settings: AppSettings) => void;

class SettingsManager {
  private currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
  private listeners: SettingsChangeListener[] = [];

  constructor() {
    this.parseURLSearchParams();
  }

  public get settings(): Readonly<AppSettings> {
    return this.currentSettings;
  }

  private parseURLSearchParams(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const theme = (params.get('theme') || params.get('schemetype'))?.toLowerCase() as SchemeType;
    if (theme && ['cosmic', 'synthwave', 'quantum', 'obsidian'].includes(theme)) {
      this.currentSettings.schemeType = theme;
    }

    const vis = (params.get('visualizer') || params.get('visualizerstyle'))?.toLowerCase() as VisualizerStyle;
    if (vis && ['bars', 'circular', 'waveform', 'off'].includes(vis)) {
      this.currentSettings.visualizerStyle = vis;
    }

    const clock = params.get('clock') || params.get('showclock');
    if (clock !== null) {
      this.currentSettings.showClock = clock !== 'false' && clock !== '0';
    }

    const seconds = params.get('seconds') || params.get('showseconds');
    if (seconds !== null) {
      this.currentSettings.showSeconds = seconds !== 'false' && seconds !== '0';
    }

    const format = (params.get('clockformat') || params.get('format'))?.toLowerCase() as ClockFormat;
    if (format && (format === '12h' || format === '24h')) {
      this.currentSettings.clockFormat = format;
    }

    const offset = params.get('taskbaroffset') || params.get('offset');
    if (offset !== null) {
      const val = parseInt(offset, 10);
      if (!isNaN(val)) this.currentSettings.taskbarOffset = Math.max(0, Math.min(200, val));
    }
  }

  public subscribe(listener: SettingsChangeListener): () => void {
    this.listeners.push(listener);
    listener(this.currentSettings);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public updateFromWallpaperEngine(properties: WallpaperUserProperties): void {
    let changed = false;

    if (properties.schemetype?.value !== undefined) {
      const scheme = String(properties.schemetype.value).toLowerCase() as SchemeType;
      if (['cosmic', 'synthwave', 'quantum', 'obsidian'].includes(scheme)) {
        this.currentSettings.schemeType = scheme;
        changed = true;
      }
    }

    if (properties.particlecount?.value !== undefined) {
      const val = Number(properties.particlecount.value);
      if (!isNaN(val)) {
        this.currentSettings.particleCount = Math.max(200, Math.min(4000, Math.round(val)));
        changed = true;
      }
    }

    if (properties.particlespeed?.value !== undefined) {
      const val = Number(properties.particlespeed.value);
      if (!isNaN(val)) {
        this.currentSettings.particleSpeed = Math.max(0.05, Math.min(5.0, val));
        changed = true;
      }
    }

    if (properties.showclock?.value !== undefined) {
      this.currentSettings.showClock = Boolean(properties.showclock.value);
      changed = true;
    }

    if (properties.showseconds?.value !== undefined) {
      this.currentSettings.showSeconds = Boolean(properties.showseconds.value);
      changed = true;
    }

    if (properties.clockformat?.value !== undefined) {
      const fmt = String(properties.clockformat.value).toLowerCase() as ClockFormat;
      if (fmt === '12h' || fmt === '24h') {
        this.currentSettings.clockFormat = fmt;
        changed = true;
      }
    }

    if (properties.audioreactive?.value !== undefined) {
      this.currentSettings.audioReactive = Boolean(properties.audioreactive.value);
      changed = true;
    }

    if (properties.audiosensitivity?.value !== undefined) {
      const val = Number(properties.audiosensitivity.value);
      if (!isNaN(val)) {
        this.currentSettings.audioSensitivity = Math.max(0.1, Math.min(5.0, val));
        changed = true;
      }
    }

    if (properties.visualizerstyle?.value !== undefined) {
      const vis = String(properties.visualizerstyle.value).toLowerCase() as VisualizerStyle;
      if (['bars', 'circular', 'waveform', 'off'].includes(vis)) {
        this.currentSettings.visualizerStyle = vis;
        changed = true;
      }
    }

    if (properties.taskbaroffset?.value !== undefined) {
      const val = Number(properties.taskbaroffset.value);
      if (!isNaN(val)) {
        this.currentSettings.taskbarOffset = Math.max(0, Math.min(200, Math.round(val)));
        changed = true;
      }
    }

    if (properties.primarycolor?.value !== undefined) {
      const parsed = this.parseColor(properties.primarycolor.value);
      if (parsed) {
        this.currentSettings.primaryColor = parsed;
        changed = true;
      }
    }

    if (properties.secondarycolor?.value !== undefined) {
      const parsed = this.parseColor(properties.secondarycolor.value);
      if (parsed) {
        this.currentSettings.secondaryColor = parsed;
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  public setGlobalFps(fps: number): void {
    const nextFps = Number.isFinite(fps) && fps > 0 ? Math.min(240, Math.max(1, Math.round(fps))) : 0;
    if (this.currentSettings.fpsLimit !== nextFps) {
      this.currentSettings.fpsLimit = nextFps;
      this.notifyListeners();
    }
  }

  private parseColor(rawColor: string | number | boolean): ColorRGB | null {
    if (typeof rawColor !== 'string') return null;

    // Wallpaper Engine format: "r g b" (normalized 0.0 to 1.0)
    const normalizedMatch = rawColor.trim().split(/\s+/);
    if (normalizedMatch.length === 3) {
      const r = parseFloat(normalizedMatch[0]);
      const g = parseFloat(normalizedMatch[1]);
      const b = parseFloat(normalizedMatch[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        // If values are <= 1.0, scale up to 255
        const scale = r <= 1.0 && g <= 1.0 && b <= 1.0 && (r > 0 || g > 0 || b > 0) ? 255 : 1;
        return {
          r: Math.round(Math.max(0, Math.min(255, r * scale))),
          g: Math.round(Math.max(0, Math.min(255, g * scale))),
          b: Math.round(Math.max(0, Math.min(255, b * scale))),
        };
      }
    }

    // Hex format: #rrggbb or #rgb
    if (rawColor.startsWith('#')) {
      const hex = rawColor.replace('#', '');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
        };
      }
    }

    return null;
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentSettings);
    }
  }
}

export const settingsManager = new SettingsManager();
