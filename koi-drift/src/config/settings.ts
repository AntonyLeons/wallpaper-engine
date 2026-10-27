import { WallpaperUserProperties } from '../types/wallpaper';

export type PondPreset = 'lagoon' | 'sunset' | 'jade' | 'dusk';
export type VisualizerStyle = 'bars' | 'waveform' | 'off';
export type ClockFormat = '12h' | '24h';
export type ClockPosition =
  | 'top_center'
  | 'top_left'
  | 'top_right'
  | 'center'
  | 'bottom_center'
  | 'bottom_left'
  | 'bottom_right'
  | 'custom';

export interface ColorRGB {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

export interface PresetPalette {
  waterTop: string;
  waterMid: string;
  waterBottom: string;
  caustic: string; // hex for caustic highlights
  koiBase: string[]; // fish base colors
  koPatch: string[]; // fish patch colors
  kelp: string;
  tint: string; // additive tint
}

export const PRESET_PALETTES: Record<PondPreset, PresetPalette> = {
  lagoon: {
    waterTop: '#1e6a72',
    waterMid: '#0d3a48',
    waterBottom: '#061c26',
    caustic: '#9fe8dc',
    koiBase: ['#f4f1e8', '#e8944a', '#f4f1e8', '#d8452b'],
    koPatch: ['#e07830', '#f4f1e8', '#d8452b', '#f4f1e8'],
    kelp: '#1d4d3a',
    tint: '#2a8a7a',
  },
  sunset: {
    waterTop: '#7a4a3a',
    waterMid: '#3a2436',
    waterBottom: '#140d1e',
    caustic: '#ffd9a0',
    koiBase: ['#f8efd8', '#e07830', '#f8efd8', '#b03028'],
    koPatch: ['#c8401e', '#f8efd8', '#e08838', '#802018'],
    kelp: '#33402a',
    tint: '#b06a3a',
  },
  jade: {
    waterTop: '#3f8a6a',
    waterMid: '#1c4a3a',
    waterBottom: '#0a2018',
    caustic: '#d8f0c8',
    koiBase: ['#f8efd8', '#e89838', '#f8efd8', '#c83828'],
    koPatch: ['#e08028', '#f8efd8', '#c83828', '#f8efd8'],
    kelp: '#1a4030',
    tint: '#3a9a78',
  },
  dusk: {
    waterTop: '#141a34',
    waterMid: '#0a1024',
    waterBottom: '#04060f',
    caustic: '#a8c0f0',
    koiBase: ['#e8e4d8', '#d87830', '#e8e4d8', '#a82018'],
    koPatch: ['#c84818', '#e8e4d8', '#a82018', '#e8e4d8'],
    kelp: '#101e28',
    tint: '#28407a',
  },
};

export interface AppSettings {
  pondPreset: PondPreset;
  fishCount: number;
  fishSpeed: number;
  kelpCount: number;
  bubbleCount: number;
  audioReactive: boolean;
  audioSensitivity: number;
  visualizerStyle: VisualizerStyle;
  mouseFollow: boolean;
  showClock: boolean;
  showSeconds: boolean;
  clockFormat: ClockFormat;
  clockPosition: ClockPosition;
  clockPositionX: number; // 0..100 (%)
  clockPositionY: number; // 0..100 (%)
  taskbarOffset: number; // in pixels
  primaryColor: ColorRGB;
  secondaryColor: ColorRGB;
  fpsLimit: number; // 0 for unlimited
}

export const DEFAULT_SETTINGS: AppSettings = {
  pondPreset: 'lagoon',
  fishCount: 6,
  fishSpeed: 1.0,
  kelpCount: 10,
  bubbleCount: 80,
  audioReactive: true,
  audioSensitivity: 1.5,
  visualizerStyle: 'bars',
  mouseFollow: true,
  showClock: true,
  showSeconds: true,
  clockFormat: '24h',
  clockPosition: 'bottom_right',
  clockPositionX: 50,
  clockPositionY: 10,
  taskbarOffset: 48,
  primaryColor: { r: 125, g: 222, b: 199 }, // #7ddec7
  secondaryColor: { r: 255, g: 171, b: 89 }, // #ffab59
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

    const preset = (params.get('preset') || params.get('pondpreset'))?.toLowerCase() as PondPreset;
    if (preset && (preset in PRESET_PALETTES)) {
      this.currentSettings.pondPreset = preset;
    }

    const vis = (params.get('visualizer') || params.get('visualizerstyle'))?.toLowerCase() as VisualizerStyle;
    if (vis && (vis === 'bars' || vis === 'waveform' || vis === 'off')) {
      this.currentSettings.visualizerStyle = vis;
    }

    const fish = params.get('fish') || params.get('fishcount');
    if (fish !== null) {
      const val = parseInt(fish, 10);
      if (!isNaN(val)) this.currentSettings.fishCount = Math.max(1, Math.min(12, val));
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

    const pos = (params.get('clockposition') || params.get('pos'))?.toLowerCase() as ClockPosition;
    if (
      pos &&
      (pos === 'top_center' || pos === 'top_left' || pos === 'top_right' || pos === 'center' ||
        pos === 'bottom_center' || pos === 'bottom_left' || pos === 'bottom_right' || pos === 'custom')
    ) {
      this.currentSettings.clockPosition = pos;
    }

    const clockX = params.get('clockpositionx') || params.get('x');
    if (clockX !== null) {
      const val = parseFloat(clockX);
      if (!isNaN(val)) this.currentSettings.clockPositionX = Math.max(0, Math.min(100, val));
    }

    const clockY = params.get('clockpositiony') || params.get('y');
    if (clockY !== null) {
      const val = parseFloat(clockY);
      if (!isNaN(val)) this.currentSettings.clockPositionY = Math.max(0, Math.min(100, val));
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

    if (properties.pondpreset?.value !== undefined) {
      const preset = String(properties.pondpreset.value).toLowerCase() as PondPreset;
      if (preset in PRESET_PALETTES) {
        this.currentSettings.pondPreset = preset;
        changed = true;
      }
    }

    if (properties.fishcount?.value !== undefined) {
      const val = Number(properties.fishcount.value);
      if (!isNaN(val)) {
        this.currentSettings.fishCount = Math.max(1, Math.min(12, Math.round(val)));
        changed = true;
      }
    }

    if (properties.fishspeed?.value !== undefined) {
      const val = Number(properties.fishspeed.value);
      if (!isNaN(val)) {
        this.currentSettings.fishSpeed = Math.max(0.1, Math.min(4.0, val));
        changed = true;
      }
    }

    if (properties.kelpcount?.value !== undefined) {
      const val = Number(properties.kelpcount.value);
      if (!isNaN(val)) {
        this.currentSettings.kelpCount = Math.max(0, Math.min(20, Math.round(val)));
        changed = true;
      }
    }

    if (properties.bubblecount?.value !== undefined) {
      const val = Number(properties.bubblecount.value);
      if (!isNaN(val)) {
        this.currentSettings.bubbleCount = Math.max(0, Math.min(200, Math.round(val)));
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
      if (vis === 'bars' || vis === 'waveform' || vis === 'off') {
        this.currentSettings.visualizerStyle = vis;
        changed = true;
      }
    }

    if (properties.mousefollow?.value !== undefined) {
      this.currentSettings.mouseFollow = Boolean(properties.mousefollow.value);
      changed = true;
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

    if (properties.clockposition?.value !== undefined) {
      const pos = String(properties.clockposition.value).toLowerCase() as ClockPosition;
      if (
        pos === 'top_center' || pos === 'top_left' || pos === 'top_right' || pos === 'center' ||
        pos === 'bottom_center' || pos === 'bottom_left' || pos === 'bottom_right' || pos === 'custom'
      ) {
        this.currentSettings.clockPosition = pos;
        changed = true;
      }
    }

    if (properties.clockpositionx?.value !== undefined) {
      const val = Number(properties.clockpositionx.value);
      if (!isNaN(val)) {
        this.currentSettings.clockPositionX = Math.max(0, Math.min(100, val));
        changed = true;
      }
    }

    if (properties.clockpositiony?.value !== undefined) {
      const val = Number(properties.clockpositiony.value);
      if (!isNaN(val)) {
        this.currentSettings.clockPositionY = Math.max(0, Math.min(100, val));
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
    const parts = rawColor.trim().split(/\s+/);
    if (parts.length === 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
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
