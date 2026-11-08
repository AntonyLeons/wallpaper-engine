import type { WallpaperUserProperties } from '../types/wallpaper';

export type OrreryPreset = 'brass' | 'silver' | 'verdigris' | 'rose';
export type VisualizerStyle = 'orbit' | 'radial' | 'off';
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
  r: number;
  g: number;
  b: number;
}

export interface PresetPalette {
  skyInner: string;
  skyOuter: string;
  chart: string;
  star: string;
  brass: string;
  brassLight: string;
  brassDark: string;
  sun: string;
  sunGlow: string;
  planets: string[];
  dialText: string;
}

export const PRESET_PALETTES: Record<OrreryPreset, PresetPalette> = {
  brass: {
    skyInner: '#1e2a36',
    skyOuter: '#070c13',
    chart: 'rgba(198, 166, 108, 0.10)',
    star: '#ead9b2',
    brass: '#b99154',
    brassLight: '#f2dda8',
    brassDark: '#574125',
    sun: '#ffe7ad',
    sunGlow: '255, 198, 102',
    planets: ['#d9a05b', '#8fb8c9', '#d4795c', '#c9c2a5', '#7f9e7a', '#c68bb2', '#e0c07a', '#86a7b8', '#c98f6d'],
    dialText: '#e7d2a3',
  },
  silver: {
    skyInner: '#18293e',
    skyOuter: '#050a16',
    chart: 'rgba(172, 202, 232, 0.10)',
    star: '#deebff',
    brass: '#8fa6bd',
    brassLight: '#e8f2ff',
    brassDark: '#3a5068',
    sun: '#eaf4ff',
    sunGlow: '150, 200, 255',
    planets: ['#9fb6cf', '#d6e2f0', '#7f9fc4', '#c3b3d9', '#8fc9cf', '#e0d6c3', '#a8c0dc', '#d3a7b8', '#b4c9bb'],
    dialText: '#dfeaf7',
  },
  verdigris: {
    skyInner: '#14302c',
    skyOuter: '#04110f',
    chart: 'rgba(112, 192, 166, 0.10)',
    star: '#d2efe1',
    brass: '#7bb39b',
    brassLight: '#dcf3e1',
    brassDark: '#2c594a',
    sun: '#dcf6c6',
    sunGlow: '140, 225, 170',
    planets: ['#c78a5c', '#8fcbb4', '#d9dfae', '#6fa8a0', '#c9a2c0', '#e2c489', '#88b9a0', '#b9d6c5', '#d79b73'],
    dialText: '#d5efdc',
  },
  rose: {
    skyInner: '#2c1d30',
    skyOuter: '#0b0710',
    chart: 'rgba(222, 162, 178, 0.10)',
    star: '#f6dbe4',
    brass: '#c98d84',
    brassLight: '#f8d8c6',
    brassDark: '#6a3e47',
    sun: '#ffdad0',
    sunGlow: '255, 160, 150',
    planets: ['#e5a58f', '#b49ac9', '#f0c8a8', '#9db8d0', '#d98fa8', '#c7b98f', '#e8b7b0', '#a9c4b6', '#d8a1b8'],
    dialText: '#f3d9d2',
  },
};

export interface AppSettings {
  preset: OrreryPreset;
  orbitSpeed: number;
  planetCount: number;
  gearCount: number;
  showGears: boolean;
  starDensity: number;
  audioReactive: boolean;
  audioSensitivity: number;
  visualizerStyle: VisualizerStyle;
  mouseParallax: boolean;
  clockHands: boolean;
  showClock: boolean;
  showSeconds: boolean;
  clockFormat: ClockFormat;
  clockPosition: ClockPosition;
  clockPositionX: number;
  clockPositionY: number;
  taskbarOffset: number;
  primaryColor: ColorRGB;
  secondaryColor: ColorRGB;
  fpsLimit: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  preset: 'brass',
  orbitSpeed: 1,
  planetCount: 6,
  gearCount: 6,
  showGears: true,
  starDensity: 140,
  audioReactive: true,
  audioSensitivity: 1.5,
  visualizerStyle: 'orbit',
  mouseParallax: true,
  clockHands: true,
  showClock: true,
  showSeconds: true,
  clockFormat: '24h',
  clockPosition: 'bottom_right',
  clockPositionX: 50,
  clockPositionY: 10,
  taskbarOffset: 48,
  primaryColor: { r: 230, g: 186, b: 110 },
  secondaryColor: { r: 120, g: 196, b: 200 },
  fpsLimit: 0,
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function isPreset(value: string): value is OrreryPreset {
  return value in PRESET_PALETTES;
}

function isVisualizerStyle(value: string): value is VisualizerStyle {
  return value === 'orbit' || value === 'radial' || value === 'off';
}

function isClockPosition(value: string): value is ClockPosition {
  return value === 'top_center' || value === 'top_left' || value === 'top_right'
    || value === 'center' || value === 'bottom_center' || value === 'bottom_left'
    || value === 'bottom_right' || value === 'custom';
}

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

    const preset = (params.get('preset') || params.get('orrerypreset'))?.toLowerCase();
    if (preset && isPreset(preset)) this.currentSettings.preset = preset;

    const style = (params.get('visualizer') || params.get('visualizerstyle'))?.toLowerCase();
    if (style && isVisualizerStyle(style)) this.currentSettings.visualizerStyle = style;

    const speed = params.get('speed') || params.get('orbitspeed');
    if (speed !== null) {
      const value = Number(speed);
      if (Number.isFinite(value)) this.currentSettings.orbitSpeed = clamp(value, 0.1, 3);
    }

    const planets = params.get('planets') || params.get('planetcount');
    if (planets !== null) {
      const value = Number(planets);
      if (Number.isFinite(value)) this.currentSettings.planetCount = clamp(Math.round(value), 0, 9);
    }

    const gears = params.get('gears') || params.get('gearcount');
    if (gears !== null) {
      const value = Number(gears);
      if (Number.isFinite(value)) this.currentSettings.gearCount = clamp(Math.round(value), 0, 12);
    }

    const showGears = params.get('showgears');
    if (showGears !== null) this.currentSettings.showGears = showGears !== 'false' && showGears !== '0';

    const stars = params.get('stars') || params.get('stardensity');
    if (stars !== null) {
      const value = Number(stars);
      if (Number.isFinite(value)) this.currentSettings.starDensity = clamp(Math.round(value), 0, 300);
    }

    const clock = params.get('clock') || params.get('showclock');
    if (clock !== null) this.currentSettings.showClock = clock !== 'false' && clock !== '0';

    const hands = params.get('hands') || params.get('clockhands');
    if (hands !== null) this.currentSettings.clockHands = hands !== 'false' && hands !== '0';

    const seconds = params.get('seconds') || params.get('showseconds');
    if (seconds !== null) this.currentSettings.showSeconds = seconds !== 'false' && seconds !== '0';

    const parallax = params.get('parallax') || params.get('mouseparallax');
    if (parallax !== null) this.currentSettings.mouseParallax = parallax !== 'false' && parallax !== '0';

    const format = (params.get('clockformat') || params.get('format'))?.toLowerCase();
    if (format === '12h' || format === '24h') this.currentSettings.clockFormat = format;

    const position = (params.get('clockposition') || params.get('pos'))?.toLowerCase();
    if (position && isClockPosition(position)) this.currentSettings.clockPosition = position;

    const clockX = params.get('clockpositionx') || params.get('x');
    if (clockX !== null) {
      const value = Number(clockX);
      if (Number.isFinite(value)) this.currentSettings.clockPositionX = clamp(value, 0, 100);
    }

    const clockY = params.get('clockpositiony') || params.get('y');
    if (clockY !== null) {
      const value = Number(clockY);
      if (Number.isFinite(value)) this.currentSettings.clockPositionY = clamp(value, 0, 100);
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

    if (properties.preset?.value !== undefined) {
      const preset = String(properties.preset.value).toLowerCase();
      if (isPreset(preset)) {
        this.currentSettings.preset = preset;
        changed = true;
      }
    }

    if (properties.orbitspeed?.value !== undefined) {
      const value = Number(properties.orbitspeed.value);
      if (Number.isFinite(value)) {
        this.currentSettings.orbitSpeed = clamp(value, 0.1, 3);
        changed = true;
      }
    }

    if (properties.planetcount?.value !== undefined) {
      const value = Number(properties.planetcount.value);
      if (Number.isFinite(value)) {
        this.currentSettings.planetCount = clamp(Math.round(value), 0, 9);
        changed = true;
      }
    }

    if (typeof properties.showgears?.value === 'boolean') {
      this.currentSettings.showGears = properties.showgears.value;
      changed = true;
    }

    if (properties.gearcount?.value !== undefined) {
      const value = Number(properties.gearcount.value);
      if (Number.isFinite(value)) {
        this.currentSettings.gearCount = clamp(Math.round(value), 0, 12);
        changed = true;
      }
    }

    if (properties.stardensity?.value !== undefined) {
      const value = Number(properties.stardensity.value);
      if (Number.isFinite(value)) {
        this.currentSettings.starDensity = clamp(Math.round(value), 0, 300);
        changed = true;
      }
    }

    if (properties.audioreactive?.value !== undefined) {
      this.currentSettings.audioReactive = Boolean(properties.audioreactive.value);
      changed = true;
    }

    if (properties.audiosensitivity?.value !== undefined) {
      const value = Number(properties.audiosensitivity.value);
      if (Number.isFinite(value)) {
        this.currentSettings.audioSensitivity = clamp(value, 0.1, 5);
        changed = true;
      }
    }

    if (properties.visualizerstyle?.value !== undefined) {
      const style = String(properties.visualizerstyle.value).toLowerCase();
      if (isVisualizerStyle(style)) {
        this.currentSettings.visualizerStyle = style;
        changed = true;
      }
    }

    if (properties.mouseparallax?.value !== undefined) {
      this.currentSettings.mouseParallax = Boolean(properties.mouseparallax.value);
      changed = true;
    }

    if (properties.clockhands?.value !== undefined) {
      this.currentSettings.clockHands = Boolean(properties.clockhands.value);
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
      const format = String(properties.clockformat.value).toLowerCase();
      if (format === '12h' || format === '24h') {
        this.currentSettings.clockFormat = format;
        changed = true;
      }
    }

    if (properties.clockposition?.value !== undefined) {
      const position = String(properties.clockposition.value).toLowerCase();
      if (isClockPosition(position)) {
        this.currentSettings.clockPosition = position;
        changed = true;
      }
    }

    if (properties.clockpositionx?.value !== undefined) {
      const value = Number(properties.clockpositionx.value);
      if (Number.isFinite(value)) {
        this.currentSettings.clockPositionX = clamp(value, 0, 100);
        changed = true;
      }
    }

    if (properties.clockpositiony?.value !== undefined) {
      const value = Number(properties.clockpositiony.value);
      if (Number.isFinite(value)) {
        this.currentSettings.clockPositionY = clamp(value, 0, 100);
        changed = true;
      }
    }

    if (properties.taskbaroffset?.value !== undefined) {
      const value = Number(properties.taskbaroffset.value);
      if (Number.isFinite(value)) {
        this.currentSettings.taskbarOffset = clamp(Math.round(value), 0, 200);
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

    if (changed) this.notifyListeners();
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

    const parts = rawColor.trim().split(/\s+/);
    if (parts.length === 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        const scale = r <= 1 && g <= 1 && b <= 1 && (r > 0 || g > 0 || b > 0) ? 255 : 1;
        return {
          r: Math.round(clamp(r * scale, 0, 255)),
          g: Math.round(clamp(g * scale, 0, 255)),
          b: Math.round(clamp(b * scale, 0, 255)),
        };
      }
    }

    if (rawColor.startsWith('#')) {
      const hex = rawColor.slice(1);
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
