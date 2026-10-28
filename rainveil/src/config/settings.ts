import { WallpaperUserProperties } from '../types/wallpaper';

export type CityPreset = 'midnight' | 'neon' | 'ember' | 'glacier';
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

export interface ScenePalette {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  haze: string;
  cloud: string;
  farBuilding: string;
  midBuilding: string;
  nearBuilding: string;
  windowWarm: string;
  windowCool: string;
  streetTop: string;
  streetBottom: string;
  fog: string;
  moon: string;
}

export const PRESET_PALETTES: Record<CityPreset, ScenePalette> = {
  midnight: {
    skyTop: '#04060f',
    skyMid: '#0a1226',
    skyHorizon: '#2a1f47',
    haze: '#35406e',
    cloud: '#1a2340',
    farBuilding: '#0a0f1f',
    midBuilding: '#070b17',
    nearBuilding: '#03050b',
    windowWarm: '#ffd08a',
    windowCool: '#9fd8ff',
    streetTop: '#101a30',
    streetBottom: '#020308',
    fog: '#5a6fa8',
    moon: '#dbe6ff',
  },
  neon: {
    skyTop: '#06030d',
    skyMid: '#160824',
    skyHorizon: '#3a1145',
    haze: '#6b2a86',
    cloud: '#260d33',
    farBuilding: '#12081f',
    midBuilding: '#0b0515',
    nearBuilding: '#05020a',
    windowWarm: '#ffcf8a',
    windowCool: '#8ff5ff',
    streetTop: '#1d0f2c',
    streetBottom: '#050208',
    fog: '#a052c0',
    moon: '#f4e4ff',
  },
  ember: {
    skyTop: '#0a0405',
    skyMid: '#1e0b0b',
    skyHorizon: '#4a1c12',
    haze: '#7a2f1c',
    cloud: '#2a0e0c',
    farBuilding: '#170807',
    midBuilding: '#0e0504',
    nearBuilding: '#060201',
    windowWarm: '#ffb066',
    windowCool: '#ffd9a0',
    streetTop: '#24100c',
    streetBottom: '#060202',
    fog: '#b25a30',
    moon: '#ffe1c4',
  },
  glacier: {
    skyTop: '#030912',
    skyMid: '#081727',
    skyHorizon: '#153349',
    haze: '#2a6178',
    cloud: '#0e2233',
    farBuilding: '#071520',
    midBuilding: '#04101a',
    nearBuilding: '#02080d',
    windowWarm: '#ffdca8',
    windowCool: '#aef3ff',
    streetTop: '#0c2230',
    streetBottom: '#02070b',
    fog: '#5aa8bd',
    moon: '#e6fbff',
  },
};

export interface AppSettings {
  cityPreset: CityPreset;
  rainDensity: number; // 0..100
  rainSpeed: number; // 0.2..2.5
  bokehCount: number; // 0..120
  lightningEnabled: boolean;
  audioReactive: boolean;
  audioSensitivity: number;
  visualizerStyle: VisualizerStyle;
  mouseInteraction: boolean;
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
  cityPreset: 'midnight',
  rainDensity: 60,
  rainSpeed: 1.0,
  bokehCount: 45,
  lightningEnabled: true,
  audioReactive: true,
  audioSensitivity: 1.5,
  visualizerStyle: 'bars',
  mouseInteraction: true,
  showClock: true,
  showSeconds: true,
  clockFormat: '24h',
  clockPosition: 'bottom_left',
  clockPositionX: 50,
  clockPositionY: 10,
  taskbarOffset: 48,
  primaryColor: { r: 77, g: 217, b: 255 }, // #4dd9ff
  secondaryColor: { r: 255, g: 94, b: 191 }, // #ff5ebf
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

    const preset = (params.get('preset') || params.get('citypreset'))?.toLowerCase() as CityPreset;
    if (preset && preset in PRESET_PALETTES) {
      this.currentSettings.cityPreset = preset;
    }

    const density = params.get('rain') || params.get('raindensity');
    if (density !== null) {
      const val = Number(density);
      if (!isNaN(val)) this.currentSettings.rainDensity = Math.max(0, Math.min(100, val));
    }

    const speed = params.get('rainspeed') || params.get('speed');
    if (speed !== null) {
      const val = Number(speed);
      if (!isNaN(val)) this.currentSettings.rainSpeed = Math.max(0.2, Math.min(2.5, val));
    }

    const bokeh = params.get('bokeh') || params.get('bokehcount');
    if (bokeh !== null) {
      const val = parseInt(bokeh, 10);
      if (!isNaN(val)) this.currentSettings.bokehCount = Math.max(0, Math.min(120, val));
    }

    const lightning = params.get('lightning');
    if (lightning !== null) {
      this.currentSettings.lightningEnabled = lightning !== 'false' && lightning !== '0';
    }

    const vis = (params.get('visualizer') || params.get('visualizerstyle'))?.toLowerCase() as VisualizerStyle;
    if (vis && (vis === 'bars' || vis === 'waveform' || vis === 'off')) {
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

    const pos = (params.get('clockposition') || params.get('pos'))?.toLowerCase() as ClockPosition;
    if (
      pos === 'top_center' ||
      pos === 'top_left' ||
      pos === 'top_right' ||
      pos === 'center' ||
      pos === 'bottom_center' ||
      pos === 'bottom_left' ||
      pos === 'bottom_right' ||
      pos === 'custom'
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

    if (properties.citypreset?.value !== undefined) {
      const preset = String(properties.citypreset.value).toLowerCase() as CityPreset;
      if (preset in PRESET_PALETTES) {
        this.currentSettings.cityPreset = preset;
        changed = true;
      }
    }

    if (properties.raindensity?.value !== undefined) {
      const val = Number(properties.raindensity.value);
      if (!isNaN(val)) {
        this.currentSettings.rainDensity = Math.max(0, Math.min(100, val));
        changed = true;
      }
    }

    if (properties.rainspeed?.value !== undefined) {
      const val = Number(properties.rainspeed.value);
      if (!isNaN(val)) {
        this.currentSettings.rainSpeed = Math.max(0.2, Math.min(2.5, val));
        changed = true;
      }
    }

    if (properties.bokehcount?.value !== undefined) {
      const val = Number(properties.bokehcount.value);
      if (!isNaN(val)) {
        this.currentSettings.bokehCount = Math.max(0, Math.min(120, Math.round(val)));
        changed = true;
      }
    }

    if (properties.lightning?.value !== undefined) {
      this.currentSettings.lightningEnabled = Boolean(properties.lightning.value);
      changed = true;
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

    if (properties.mouseinteraction?.value !== undefined) {
      this.currentSettings.mouseInteraction = Boolean(properties.mouseinteraction.value);
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
        pos === 'top_center' ||
        pos === 'top_left' ||
        pos === 'top_right' ||
        pos === 'center' ||
        pos === 'bottom_center' ||
        pos === 'bottom_left' ||
        pos === 'bottom_right' ||
        pos === 'custom'
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
