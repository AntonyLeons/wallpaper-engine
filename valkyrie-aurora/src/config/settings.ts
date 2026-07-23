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
  celestial: {
    primary: { r: 255, g: 195, b: 85 },   // Warm Celestial Gold
    secondary: { r: 240, g: 110, b: 170 }, // Soft Rose
  },
  lunar: {
    primary: { r: 245, g: 130, b: 190 },  // Lunar Rose Pink
    secondary: { r: 160, g: 140, b: 245 }, // Moonlit Lavender
  },
  starry: {
    primary: { r: 175, g: 135, b: 245 },  // Starry Lavender
    secondary: { r: 100, g: 205, b: 255 }, // Sky Blue
  },
  emerald: {
    primary: { r: 100, g: 230, b: 185 },  // Ethereal Jade
    secondary: { r: 120, g: 215, b: 245 }, // Moonlit Turquoise
  },
};

export class SettingsStore {
  public current: SettingsState = {
    schemeType: 'celestial',
    parallaxIntensity: 1.0,
    breathingIntensity: 1.0,
    particleCount: 1200,
    particleSpeed: 1.0,
    showClock: true,
    showSeconds: true,
    clockFormat: '24h',
    audioReactive: true,
    audioSensitivity: 1.5,
    visualizerStyle: 'bars',
    taskbarOffset: 48,
    primaryColor: { r: 255, g: 195, b: 85 },
    secondaryColor: { r: 240, g: 110, b: 170 },
    fpsLimit: 60,
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
