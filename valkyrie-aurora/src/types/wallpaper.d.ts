export interface WallpaperColorProperty {
  value: string; // Space-separated floats, e.g. "0.95 0.25 0.65"
}

export interface WallpaperSliderProperty {
  value: number;
}

export interface WallpaperBoolProperty {
  value: boolean;
}

export interface WallpaperComboProperty {
  value: string;
}

export interface WallpaperGeneralProperties {
  fps?: number;
}

export interface WallpaperUserProperties {
  schemetype?: WallpaperComboProperty;
  parallaxintensity?: WallpaperSliderProperty;
  breathingintensity?: WallpaperSliderProperty;
  particlecount?: WallpaperSliderProperty;
  particlespeed?: WallpaperSliderProperty;
  showclock?: WallpaperBoolProperty;
  showseconds?: WallpaperBoolProperty;
  clockformat?: WallpaperComboProperty;
  audioreactive?: WallpaperBoolProperty;
  audiosensitivity?: WallpaperSliderProperty;
  visualizerstyle?: WallpaperComboProperty;
  taskbaroffset?: WallpaperSliderProperty;
  primarycolor?: WallpaperColorProperty;
  secondarycolor?: WallpaperColorProperty;
  fpslimit?: WallpaperComboProperty;
}

export interface WallpaperPropertyListener {
  applyGeneralProperties?: (properties: WallpaperGeneralProperties) => void;
  applyUserProperties?: (properties: WallpaperUserProperties) => void;
}

declare global {
  interface Window {
    wallpaperPropertyListener?: WallpaperPropertyListener;
    wallpaperRegisterAudioListener?: (callback: (audioData: number[]) => void) => void;
  }
}
