export interface WallpaperProperty {
  value: string | number | boolean;
}

export interface WallpaperUserProperties {
  schemetype?: WallpaperProperty;
  particlecount?: WallpaperProperty;
  particlespeed?: WallpaperProperty;
  showclock?: WallpaperProperty;
  clockformat?: WallpaperProperty;
  audioreactive?: WallpaperProperty;
  audiosensitivity?: WallpaperProperty;
  visualizerstyle?: WallpaperProperty;
  primarycolor?: WallpaperProperty;
  secondarycolor?: WallpaperProperty;
  fpslimit?: WallpaperProperty;
  [key: string]: WallpaperProperty | undefined;
}

export interface WallpaperPropertyListener {
  applyUserProperties?: (properties: WallpaperUserProperties) => void;
  applyGeneralProperties?: (properties: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    wallpaperPropertyListener?: WallpaperPropertyListener;
    wallpaperRegisterAudioListener?: (
      callback: (audioArray: number[]) => void
    ) => void;
  }
}
