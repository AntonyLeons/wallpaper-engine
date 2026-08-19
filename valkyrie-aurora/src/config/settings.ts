export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface SettingsState {
  schemeType: string;
  parallaxIntensity: number;
  breathingIntensity: number;
  particleCount: number;
  particleSpeed: number;
  auroraIntensity: number;
  haloGlowIntensity: number;
  showConstellations: boolean;
  showMeteors: boolean;
  showClock: boolean;
  showSeconds: boolean;
  clockFormat: string;
  audioReactive: boolean;
  audioSensitivity: number;
  visualizerStyle: string;
  taskbarOffset: number;
  primaryColor: ColorRGB;
  secondaryColor: ColorRGB;
  fpsLimit: number;
}

export const PRESET_THEMES: Record<string, { primary: ColorRGB; secondary: ColorRGB }> = {
  emerald: {
    primary: { r: 52, g: 245, b: 180 },   // Shimmering Emerald Aurora
    secondary: { r: 38, g: 195, b: 255 }, // Arctic Turquoise
  },
  celestial: {
    primary: { r: 255, g: 200, b: 85 },   // Radiant Celestial Gold
    secondary: { r: 250, g: 90, b: 165 },  // Soft Divine Rose
  },
  bifrost: {
    primary: { r: 190, g: 95, b: 255 },   // Bifrost Amethyst
    secondary: { r: 55, g: 225, b: 255 },  // Cosmic Neon Cyan
  },
  glacial: {
    primary: { r: 125, g: 225, b: 255 },  // Glacial Ice Blue
    secondary: { r: 175, g: 155, b: 255 }, // Moonlit Sapphire
  },
  bloodmoon: {
    primary: { r: 255, g: 60, b: 90 },    // Bloodmoon Crimson
    secondary: { r: 255, g: 155, b: 45 },  // Solar Flame Amber
  },
};

export class SettingsStore {
  public current: SettingsState = {
    schemeType: 'emerald',
    parallaxIntensity: 1.0,
    breathingIntensity: 1.0,
    particleCount: 220,
    particleSpeed: 1.0,
    auroraIntensity: 1.0,
    haloGlowIntensity: 1.0,
    showConstellations: true,
    showMeteors: true,
    showClock: true,
    showSeconds: true,
    clockFormat: '24h',
    audioReactive: true,
    audioSensitivity: 1.5,
    visualizerStyle: 'aurora_ribbon',
    taskbarOffset: 48,
    primaryColor: { r: 52, g: 245, b: 180 },
    secondaryColor: { r: 38, g: 195, b: 255 },
    fpsLimit: 30,
  };

  public static parseWallpaperColor(value?: string): ColorRGB | null {
    if (!value) return null;
    const parts = value.trim().split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return null;

    return {
      r: Math.min(255, Math.max(0, Math.round(parts[0] * 255))),
      g: Math.min(255, Math.max(0, Math.round(parts[1] * 255))),
      b: Math.min(255, Math.max(0, Math.round(parts[2] * 255))),
    };
  }

  public applyPreset(presetKey: string): void {
    const preset = PRESET_THEMES[presetKey];
    if (preset) {
      this.current.schemeType = presetKey;
      this.current.primaryColor = { ...preset.primary };
      this.current.secondaryColor = { ...preset.secondary };
      this.updateCSSVariables();
    }
  }

  public updateCSSVariables(): void {
    const p = this.current.primaryColor;
    const s = this.current.secondaryColor;
    document.documentElement.style.setProperty('--primary-color', `rgb(${p.r}, ${p.g}, ${p.b})`);
    document.documentElement.style.setProperty('--secondary-color', `rgb(${s.r}, ${s.g}, ${s.b})`);
    document.documentElement.style.setProperty('--taskbar-offset', `${this.current.taskbarOffset}px`);
  }
}

export const settingsStore = new SettingsStore();
