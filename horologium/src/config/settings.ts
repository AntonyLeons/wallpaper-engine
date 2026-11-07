import type { WallpaperUserProperties } from '../types/wallpaper';

export type ClockworkPreset = 'brass' | 'verdigris' | 'midnight' | 'rose';
export type VisualizerStyle = 'bars' | 'waveform' | 'off';

export const VISUALIZER_POSITIONS = [
  'follow_clock',
  'top_left', 'top_center', 'top_right', 'center',
  'bottom_left', 'bottom_center', 'bottom_right', 'custom',
] as const;
export type VisualizerPosition = typeof VISUALIZER_POSITIONS[number];

export const CLOCK_POSITIONS = [
  'top_center', 'top_left', 'top_right', 'center',
  'bottom_center', 'bottom_left', 'bottom_right', 'custom',
] as const;
export type ClockPosition = typeof CLOCK_POSITIONS[number];

export type ClockFormat = '12h' | '24h';

function isVisualizerPosition(value: string): value is VisualizerPosition {
  return (VISUALIZER_POSITIONS as readonly string[]).includes(value);
}

function isClockPosition(value: string): value is ClockPosition {
  return (CLOCK_POSITIONS as readonly string[]).includes(value);
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface PresetPalette {
  backdropTop: string;
  backdropBottom: string;
  metalLight: string;
  metalMid: string;
  metalDark: string;
  engraving: string;
  rivet: string;
  glow: string;
  planets: string[];
}

export const PRESET_PALETTES: Record<ClockworkPreset, PresetPalette> = {
  brass: {
    backdropTop: '#191208',
    backdropBottom: '#070504',
    metalLight: '#f0cf92',
    metalMid: '#a87a3b',
    metalDark: '#3d2a12',
    engraving: '#d8ae67',
    rivet: '#f7e0ad',
    glow: '#ffbf62',
    planets: ['#f6dc9c', '#d98442', '#9ec9c1', '#e8c37d', '#c9623c'],
  },
  verdigris: {
    backdropTop: '#0d1a17',
    backdropBottom: '#040908',
    metalLight: '#b4e2cd',
    metalMid: '#4f9a86',
    metalDark: '#173a35',
    engraving: '#83cdb3',
    rivet: '#dcf5e8',
    glow: '#79e6c0',
    planets: ['#d8f0e2', '#e6b878', '#8fd4c2', '#d98463', '#a9c6e8'],
  },
  midnight: {
    backdropTop: '#0d1320',
    backdropBottom: '#03060c',
    metalLight: '#b9c8e8',
    metalMid: '#5c6d99',
    metalDark: '#202a45',
    engraving: '#93a9d8',
    rivet: '#e6eeff',
    glow: '#8fb6ff',
    planets: ['#e2eaff', '#f0c98c', '#9fb8e8', '#c98f8f', '#8ee0dc'],
  },
  rose: {
    backdropTop: '#1c1011',
    backdropBottom: '#080505',
    metalLight: '#f6cdb9',
    metalMid: '#c07c70',
    metalDark: '#482626',
    engraving: '#e4a58f',
    rivet: '#ffe4d2',
    glow: '#ff9c82',
    planets: ['#ffe0cd', '#d98f6c', '#f0c2a8', '#b28fb8', '#e8b7a0'],
  },
};

export interface AppSettings {
  clockworkPreset: ClockworkPreset;
  gearCount: number;
  rotationSpeed: number;
  orbitCount: number;
  sparkCount: number;
  glowIntensity: number;
  audioReactive: boolean;
  audioSensitivity: number;
  visualizerStyle: VisualizerStyle;
  visualizerPosition: VisualizerPosition;
  visualizerPositionX: number;
  visualizerPositionY: number;
  mouseParallax: boolean;
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
  clockworkPreset: 'brass',
  gearCount: 7,
  rotationSpeed: 1,
  orbitCount: 5,
  sparkCount: 40,
  glowIntensity: 1,
  audioReactive: true,
  audioSensitivity: 1.5,
  visualizerStyle: 'bars',
  visualizerPosition: 'follow_clock',
  visualizerPositionX: 50,
  visualizerPositionY: 100,
  mouseParallax: true,
  showClock: true,
  showSeconds: true,
  clockFormat: '24h',
  clockPosition: 'bottom_right',
  clockPositionX: 50,
  clockPositionY: 10,
  taskbarOffset: 48,
  primaryColor: { r: 255, g: 184, b: 77 },
  secondaryColor: { r: 77, g: 209, b: 199 },
  fpsLimit: 0,
};

type SettingsChangeListener = (settings: AppSettings) => void;
type NumericSetting = {
  [K in keyof AppSettings]: AppSettings[K] extends number ? K : never;
}[keyof AppSettings];

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
    const s = this.currentSettings;

    const preset = (params.get('preset') || params.get('clockworkpreset'))?.toLowerCase();
    if (preset && preset in PRESET_PALETTES) s.clockworkPreset = preset as ClockworkPreset;

    const style = (params.get('visualizer') || params.get('visualizerstyle'))?.toLowerCase();
    if (style === 'bars' || style === 'waveform' || style === 'off') s.visualizerStyle = style;

    const gaugePos = params.get('visualizerposition')?.toLowerCase();
    if (gaugePos && isVisualizerPosition(gaugePos)) s.visualizerPosition = gaugePos;

    const gears = params.get('gears') || params.get('gearcount');
    if (gears !== null) s.gearCount = this.clampNumber(gears, 3, 12, true);

    const speed = params.get('speed') || params.get('rotationspeed');
    if (speed !== null) s.rotationSpeed = this.clampNumber(speed, 0.1, 3, false);

    const orbits = params.get('orbits') || params.get('orbitcount');
    if (orbits !== null) s.orbitCount = this.clampNumber(orbits, 0, 12, true);

    const sparks = params.get('sparks') || params.get('sparkcount');
    if (sparks !== null) s.sparkCount = this.clampNumber(sparks, 0, 120, true);

    const glow = params.get('glow') || params.get('glowintensity');
    if (glow !== null) s.glowIntensity = this.clampNumber(glow, 0, 2, false);

    const sensitivity = params.get('sensitivity') || params.get('audiosensitivity');
    if (sensitivity !== null) s.audioSensitivity = this.clampNumber(sensitivity, 0.1, 5, false);

    const gaugeX = params.get('visualizerpositionx');
    if (gaugeX !== null) s.visualizerPositionX = this.clampNumber(gaugeX, 0, 100, false);
    const gaugeY = params.get('visualizerpositiony');
    if (gaugeY !== null) s.visualizerPositionY = this.clampNumber(gaugeY, 0, 100, false);

    const clock = params.get('clock') || params.get('showclock');
    if (clock !== null) s.showClock = clock !== 'false' && clock !== '0';

    const seconds = params.get('seconds') || params.get('showseconds');
    if (seconds !== null) s.showSeconds = seconds !== 'false' && seconds !== '0';

    const format = (params.get('format') || params.get('clockformat'))?.toLowerCase();
    if (format === '12h' || format === '24h') s.clockFormat = format;

    const position = (params.get('clockposition') || params.get('pos'))?.toLowerCase();
    if (position && isClockPosition(position)) s.clockPosition = position;

    const clockX = params.get('clockpositionx') || params.get('x');
    if (clockX !== null) s.clockPositionX = this.clampNumber(clockX, 0, 100, false);
    const clockY = params.get('clockpositiony') || params.get('y');
    if (clockY !== null) s.clockPositionY = this.clampNumber(clockY, 0, 100, false);

    const parallax = params.get('parallax') || params.get('mouseparallax');
    if (parallax !== null) s.mouseParallax = parallax !== 'false' && parallax !== '0';

    const offset = params.get('offset') || params.get('taskbaroffset');
    if (offset !== null) s.taskbarOffset = this.clampNumber(offset, 0, 200, true);

    const primary = this.parseColor(params.get('primarycolor') ?? '');
    if (primary) s.primaryColor = primary;
    const secondary = this.parseColor(params.get('secondarycolor') ?? '');
    if (secondary) s.secondaryColor = secondary;
  }

  private clampNumber(raw: string, min: number, max: number, round: boolean): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) return min;
    const clamped = Math.max(min, Math.min(max, value));
    return round ? Math.round(clamped) : clamped;
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
    const apply = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (this.currentSettings[key] === value) return;
      this.currentSettings[key] = value;
      changed = true;
    };
    const number = (key: string, min: number, max: number, round: boolean) => {
      const raw = properties[key]?.value;
      if (typeof raw !== 'number' && (typeof raw !== 'string' || raw.trim() === '')) return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      const clamped = Math.max(min, Math.min(max, value));
      return round ? Math.round(clamped) : clamped;
    };
    const string = (key: string) => {
      const raw = properties[key]?.value;
      return typeof raw === 'string' ? raw.toLowerCase() : null;
    };
    const bool = (key: string) => {
      const raw = properties[key]?.value;
      return raw === undefined ? null : Boolean(raw);
    };
    const applyNumber = (property: string, setting: NumericSetting, min: number, max: number, round = false) => {
      const value = number(property, min, max, round);
      if (value !== null) apply(setting, value);
    };
    const applyColor = (property: string, setting: 'primaryColor' | 'secondaryColor') => {
      const raw = properties[property]?.value;
      if (raw === undefined) return;
      const parsed = this.parseColor(raw);
      if (!parsed) return;
      const current = this.currentSettings[setting];
      if (current.r === parsed.r && current.g === parsed.g && current.b === parsed.b) return;
      apply(setting, parsed);
    };

    const preset = string('clockworkpreset');
    if (preset && preset in PRESET_PALETTES) apply('clockworkPreset', preset as ClockworkPreset);

    applyNumber('gearcount', 'gearCount', 3, 12, true);
    applyNumber('rotationspeed', 'rotationSpeed', 0.1, 3);
    applyNumber('orbitcount', 'orbitCount', 0, 12, true);
    applyNumber('sparkcount', 'sparkCount', 0, 120, true);
    applyNumber('glowintensity', 'glowIntensity', 0, 2);
    applyNumber('audiosensitivity', 'audioSensitivity', 0.1, 5);
    applyNumber('visualizerpositionx', 'visualizerPositionX', 0, 100);
    applyNumber('visualizerpositiony', 'visualizerPositionY', 0, 100);
    applyNumber('clockpositionx', 'clockPositionX', 0, 100);
    applyNumber('clockpositiony', 'clockPositionY', 0, 100);
    applyNumber('taskbaroffset', 'taskbarOffset', 0, 200, true);

    const style = string('visualizerstyle');
    if (style === 'bars' || style === 'waveform' || style === 'off') apply('visualizerStyle', style);

    const gaugePosition = string('visualizerposition');
    if (gaugePosition && isVisualizerPosition(gaugePosition)) apply('visualizerPosition', gaugePosition);

    const clockPosition = string('clockposition');
    if (clockPosition && isClockPosition(clockPosition)) apply('clockPosition', clockPosition);

    const format = string('clockformat');
    if (format === '12h' || format === '24h') apply('clockFormat', format);

    for (const [property, setting] of [
      ['audioreactive', 'audioReactive'],
      ['mouseparallax', 'mouseParallax'],
      ['showclock', 'showClock'],
      ['showseconds', 'showSeconds'],
    ] as const) {
      const value = bool(property);
      if (value !== null) apply(setting, value);
    }

    applyColor('primarycolor', 'primaryColor');
    applyColor('secondarycolor', 'secondaryColor');

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
          r: Math.round(Math.max(0, Math.min(255, r * scale))),
          g: Math.round(Math.max(0, Math.min(255, g * scale))),
          b: Math.round(Math.max(0, Math.min(255, b * scale))),
        };
      }
    }

    if (rawColor.startsWith('#')) {
      let hex = rawColor.replace('#', '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length === 6 && /^[0-9a-fA-F]{6}$/.test(hex)) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
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
