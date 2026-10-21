import { settingsStore, SettingsStore } from './config/settings';
import { audioProcessor } from './audio/AudioProcessor';
import { LayerRenderer } from './render/LayerRenderer';
import { ClockOverlay } from './ui/ClockOverlay';
import type { WallpaperUserProperties } from './types/wallpaper';

const settings = settingsStore.current;
const clock = new ClockOverlay();
const canvas = document.getElementById('wallpaper-canvas') as HTMLCanvasElement;
const renderer = new LayerRenderer(canvas);
let engineFps = 0;
let frameId = 0;
let last = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finite = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

function applyProperties(p: WallpaperUserProperties): void {
  if (!p || typeof p !== 'object') return;
  if (p.schemetype && typeof p.schemetype.value === 'string') settingsStore.applyPreset(p.schemetype.value);
  if (p.visualizerstyle && ['aurora_ribbon', 'sacred_rings', 'bars', 'wave_pulse', 'off'].includes(p.visualizerstyle.value)) settings.visualizerStyle = p.visualizerstyle.value;
  if (p.clockformat && ['12h', '24h'].includes(p.clockformat.value)) settings.clockFormat = p.clockformat.value;
  if (p.fpslimit) {
    const value = p.fpslimit.value;
    if (['30', '60', '120', 'unlimited'].includes(value)) settings.fpsLimit = value === 'unlimited' ? 0 : Number(value);
  }
  const sliders = [
    ['auroraintensity', 'auroraIntensity', 0, 2.5], ['haloglowintensity', 'haloGlowIntensity', 0, 2.5],
    ['parallaxintensity', 'parallaxIntensity', 0, 2], ['breathingintensity', 'breathingIntensity', 0, 2],
    ['particlecount', 'particleCount', 0, 500], ['particlespeed', 'particleSpeed', .1, 3],
    ['audiosensitivity', 'audioSensitivity', .5, 3], ['taskbaroffset', 'taskbarOffset', 0, 150],
  ] as const;
  for (const [key, setting, min, max] of sliders) {
    if (p[key]) settings[setting] = finite(p[key]?.value, min, max, settings[setting]);
  }
  const bools = [
    ['showconstellations', 'showConstellations'], ['showmeteors', 'showMeteors'],
    ['showclock', 'showClock'], ['showseconds', 'showSeconds'], ['audioreactive', 'audioReactive'],
  ] as const;
  for (const [key, setting] of bools) if (typeof p[key]?.value === 'boolean') settings[setting] = p[key]!.value;
  for (const [key, setting] of [['primarycolor', 'primaryColor'], ['secondarycolor', 'secondaryColor']] as const) {
    const color = SettingsStore.parseWallpaperColor(p[key]?.value);
    if (color) settings[setting] = color;
  }
  settingsStore.updateCSSVariables();
  clock.updateVisibility();
  renderer.render(0);
}

// Installed during module evaluation, independent of image decoding and load events.
const previous = window.wallpaperPropertyListener;
window.wallpaperPropertyListener = {
  ...previous,
  applyGeneralProperties(p) {
    previous?.applyGeneralProperties?.(p);
    if (p && typeof p.fps === 'number' && Number.isFinite(p.fps)) engineFps = Math.max(0, p.fps);
  },
  applyUserProperties(p) { previous?.applyUserProperties?.(p); applyProperties(p); },
};
window.wallpaperRegisterAudioListener?.(data => audioProcessor.processAudioData(data));

function loop(now: number): void {
  frameId = 0;
  if (document.hidden || reducedMotion.matches) return;
  const fps = Math.min(settings.fpsLimit || Infinity, engineFps || Infinity);
  const interval = Number.isFinite(fps) ? 1000 / fps : 0;
  const elapsed = now - last;
  if (!last || elapsed >= interval - .3) {
    renderer.render(last ? Math.min(elapsed / 1000, .1) : 0);
    last = now - (interval ? elapsed % interval : 0);
  }
  frameId = requestAnimationFrame(loop);
}
function resume(): void {
  cancelAnimationFrame(frameId);
  frameId = 0; last = 0;
  if (document.hidden) return;
  if (!reducedMotion.matches) frameId = requestAnimationFrame(loop);
  else renderer.render(0);
}
window.addEventListener('resize', () => { renderer.resize(); renderer.render(0); });
document.addEventListener('visibilitychange', resume);
reducedMotion.addEventListener('change', resume);
const artwork = document.getElementById('artwork') as HTMLImageElement;
artwork.addEventListener('error', () => { artwork.style.display = 'none'; }, { once: true });
settingsStore.updateCSSVariables();
clock.updateVisibility();
resume();
