export interface WallpaperProperty {
  value: string | number | boolean;
}

export interface WallpaperUserProperties {
  preset?: WallpaperProperty;
  orbitspeed?: WallpaperProperty;
  planetcount?: WallpaperProperty;
  gearcount?: WallpaperProperty;
  stardensity?: WallpaperProperty;
  audioreactive?: WallpaperProperty;
  audiosensitivity?: WallpaperProperty;
  visualizerstyle?: WallpaperProperty;
  mouseparallax?: WallpaperProperty;
  clockhands?: WallpaperProperty;
  showclock?: WallpaperProperty;
  showseconds?: WallpaperProperty;
  clockformat?: WallpaperProperty;
  clockposition?: WallpaperProperty;
  clockpositionx?: WallpaperProperty;
  clockpositiony?: WallpaperProperty;
  taskbaroffset?: WallpaperProperty;
  primarycolor?: WallpaperProperty;
  secondarycolor?: WallpaperProperty;
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
  state?: number;
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
