import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A purpose-composed Workshop thumbnail using the actual wallpaper renderers.
// Fish placement and scale below affect this still image only.
const themeRoot = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: "export { KoiSystem } from './src/render/KoiSystem'; export { ClockOverlay } from './src/ui/ClockOverlay'; export { VisualizerRenderer } from './src/render/VisualizerRenderer'; export { WaterRenderer } from './src/render/WaterRenderer'; export { AmbientSystem } from './src/render/AmbientSystem'; export { DEFAULT_SETTINGS, PRESET_PALETTES } from './src/config/settings';",
    resolveDir: themeRoot,
  },
  bundle: true, write: false, format: 'esm',
});
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await page.addStyleTag({ content: readFileSync(new URL('../src/style.css', import.meta.url), 'utf8') });
  // Enlarge the genuine clock styling for legibility in the Workshop tile.
  await page.addStyleTag({ content: `
    .clock-hud { left: 50% !important; top: 60px !important; bottom: auto !important;
      right: auto !important; transform: translateX(-50%) !important;
      align-items: center; padding: 0; text-align: center; transition: none; }
    .clock-hud::before { display: none; }
    .clock-time { font-size: 100px; }
    .clock-date { font-size: 13px; margin-top: 12px; }
  ` });
  await page.evaluate(async source => {
    const { KoiSystem, WaterRenderer, AmbientSystem, ClockOverlay, VisualizerRenderer, DEFAULT_SETTINGS, PRESET_PALETTES } =
      await import('data:text/javascript;base64,' + btoa(source));
    let seed = 44;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.id = 'wallpaper-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    const settings = { ...DEFAULT_SETTINGS, fishCount: 2, kelpCount: 10, bubbleCount: 45, showClock: true, showSeconds: false, clockPosition: 'top_center' };
    const audio = { bass: 0, mid: 0, treble: 0, overall: 0, beatPulse: 0, spectrum: new Float32Array(32), hasAudio: false };
    const mouse = { x: 0, y: 0, active: false, pulseRadius: 180 };
    const water = new WaterRenderer();
    const ambient = new AmbientSystem();
    const fish = new KoiSystem();
    fish.update(0, size, size, settings, audio, mouse);
    ambient.update(0, size, size, settings, audio, mouse);
    water.render(ctx, size, size, 3, settings, audio, mouse);
    ambient.render(ctx, size, size, settings, audio);
    const poses = [
      { x: 0.70, y: 0.28, angle: -0.9, bend: 0.65, scale: 3.2, base: 0 },
      { x: 0.31, y: 0.70, angle: 2.25, bend: 0.65, scale: 2.9, base: 3 },
    ];
    for (let index = 0; index < poses.length; index++) {
      const pose = poses[index];
      const koi = fish.kois[index];
      koi.scale = pose.scale;
      koi.heading = pose.angle;
      koi.phase = index * 1.6;
      koi.head.x = pose.x * size;
      koi.head.y = pose.y * size;
      koi.baseColor = PRESET_PALETTES.lagoon.koiBase[pose.base];
      for (const patch of koi.patches) patch.color = PRESET_PALETTES.lagoon.koPatch[pose.base];
      koi.spine[0].x = koi.head.x;
      koi.spine[0].y = koi.head.y;
      for (let i = 1; i < koi.spine.length; i++) {
        const angle = pose.angle + pose.bend * i / (koi.spine.length - 1);
        koi.spine[i].x = koi.spine[i - 1].x - Math.cos(angle) * 6.4 * pose.scale;
        koi.spine[i].y = koi.spine[i - 1].y - Math.sin(angle) * 6.4 * pose.scale;
      }
    }
    fish.render(ctx, size, size);
    ambient.renderForeground(ctx, size);
    // A representative active spectrum advertises audio support in this still.
    const sampleAudio = { ...audio, hasAudio: true, overall: 0.6,
      spectrum: Float32Array.from({ length: 32 }, (_, i) =>
        0.2 + Math.sin(i * 1.7 + 0.3) ** 2 * 0.7) };
    const visualizer = new VisualizerRenderer();
    ctx.save();
    ctx.scale(1.5, 1.8);
    visualizer.render(ctx, size / 1.5, size / 1.8, 0,
      { ...settings, visualizerStyle: 'bars', taskbarOffset: size / 1.8 - 225 / 1.8 - 24 }, sampleAudio);
    ctx.restore();
    // Stable sample time; this override exists only inside the thumbnail browser.
    Date.now = () => Date.UTC(2026, 9, 27, 10, 24, 0);
    const clock = new ClockOverlay();
    clock.update(settings);
  }, bundle.outputFiles[0].text);
  await page.screenshot({ path: fileURLToPath(new URL('../preview.jpg', import.meta.url)), type: 'jpeg', quality: 95 });
  console.log('Saved koi-drift/preview.jpg (1024 x 1024)');
} finally {
  await browser.close();
}
