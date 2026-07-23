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

export interface WallpaperMediaProperties {
  title?: string;
  artist?: string;
  subTitle?: string;
  albumTitle?: string;
  albumCoverUrl?: string;
}

export interface WallpaperMediaPlayback {
  state?: number; // 0 = stopped, 1 = playing, 2 = paused
}

declare global {
  interface Window {
    wallpaperPropertyListener?: WallpaperPropertyListener;
    wallpaperRegisterAudioListener?: (
      callback: (audioArray: number[]) => void
    ) => void;
    wallpaperRegisterMediaPropertiesListener?: (
      callback: (mediaProps: WallpaperMediaProperties) => void
    ) => void;
    wallpaperRegisterMediaPlaybackListener?: (
      callback: (playback: WallpaperMediaPlayback) => void
    ) => void;
  }
}
