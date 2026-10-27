import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.argv[2] || path.join(root, '.temp/koi-pond-reddit.mp4'));
mkdirSync(path.dirname(output), { recursive: true });
const fps = 30;
const duration = 20;
const sampleRate = 48000;
const notes = [57, 64, 60, 67, 64, 72, 67, 60].map((midi, i) => ({
  frequency: 440 * 2 ** ((midi - 69) / 12), start: i * 2.5,
}));
// An original, quiet bell-and-pad cue; no external audio or licensed recordings.
const wav = Buffer.alloc(44 + sampleRate * duration * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < sampleRate * duration; i++) {
  const time = i / sampleRate;
  let value = (Math.sin(time * Math.PI * 220) + Math.sin(time * Math.PI * 329.6276)) * 0.025;
  for (const note of notes) {
    const age = time - note.start;
    if (age < 0 || age > 9) continue;
    const envelope = (1 - Math.exp(-age * 14)) * Math.exp(-age / 2.6);
    value += (Math.sin(age * Math.PI * 2 * note.frequency)
      + Math.sin(age * Math.PI * 4 * note.frequency) * 0.18) * envelope * 0.2;
  }
  const fade = Math.min(1, time / 1.2, (duration - time) / 1.5);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * fade)) * 32767), 44 + i * 2);
}
const audioPath = output.replace(/\.mp4$/i, '-soundtrack.wav');
writeFileSync(audioPath, wav);
const bundle = await build({
  stdin: { contents: `
    export { KoiSystem } from './src/render/KoiSystem';
    export { WaterRenderer } from './src/render/WaterRenderer';
    export { AmbientSystem } from './src/render/AmbientSystem';
    export { ClockOverlay } from './src/ui/ClockOverlay';
    export { VisualizerRenderer } from './src/render/VisualizerRenderer';
    export { AudioAnalyzer } from './src/audio/AudioAnalyzer';
    export { DEFAULT_SETTINGS } from './src/config/settings';
  `, resolveDir: root },
  bundle: true, write: false, format: 'esm',
});
const browser = await puppeteer.launch({ headless: true });
let encoder;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.addStyleTag({ content: readFileSync(path.join(root, 'src/style.css'), 'utf8') + '\n.clock-hud { transition: none; }' });
  await page.evaluate(async ({ source, notes, fps }) => {
    const { KoiSystem, WaterRenderer, AmbientSystem, ClockOverlay, VisualizerRenderer, AudioAnalyzer, DEFAULT_SETTINGS } =
      await import('data:text/javascript;base64,' + btoa(source));
    let seed = 76;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let time = 0;
    Date.now = () => Date.UTC(2026, 9, 27, 10, 24, 0) + time * 1000;
    Object.defineProperty(performance, 'now', { value: () => time * 1000 });
    const canvas = document.createElement('canvas');
    canvas.id = 'wallpaper-canvas'; canvas.width = 1920; canvas.height = 1080;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    const koi = new KoiSystem(), water = new WaterRenderer(), ambient = new AmbientSystem();
    const clock = new ClockOverlay(), visualizer = new VisualizerRenderer(), analyzer = new AudioAnalyzer();
    const settings = { ...DEFAULT_SETTINGS, fishSpeed: 0.65, taskbarOffset: 24 };
    const mouse = { x: 0, y: 0, active: false, pulseRadius: 180 };
    const samples = new Array(128).fill(0);
    const paint = (dt) => {
      // Match the known harmonics/envelopes of the synthesized soundtrack.
      samples.fill(0.015);
      const fade = Math.max(0, Math.min(1, time / 1.2, (20 - time) / 1.5));
      for (const note of notes) {
        const age = time - note.start;
        if (age < 0 || age > 9) continue;
        const level = (1 - Math.exp(-age * 14)) * Math.exp(-age / 2.6) * fade;
        for (let harmonic = 1; harmonic <= 2; harmonic++) {
          const bin = Math.log2(note.frequency * harmonic / 20) / Math.log2(1000) * 63;
          for (let i = 0; i < 64; i++) {
            const value = level * Math.exp(-(((i - bin) / 2.4) ** 2)) * (harmonic === 1 ? 0.75 : 0.2);
            samples[i] += value; samples[i + 64] += value;
          }
        }
      }
      analyzer.onAudioData(samples);
      const audio = analyzer.update(dt, settings.audioSensitivity);
      koi.update(dt, 1920, 1080, settings, audio, mouse);
      ambient.update(dt, 1920, 1080, settings, audio, mouse);
      water.render(ctx, 1920, 1080, dt, settings, audio, mouse);
      ambient.render(ctx, 1920, 1080, settings, audio);
      koi.render(ctx, 1920, 1080);
      ambient.renderForeground(ctx, 1080);
      visualizer.render(ctx, 1920, 1080, dt, settings, audio);
      clock.update(settings);
    };
    // Place all fish on-screen initially, then let the live simulation take over.
    paint(0);
    for (const fish of koi.kois) fish.dartTimer += 8;
    window.renderPreviewFrame = frame => {
      time = frame / fps;
      mouse.active = time >= 7 && time <= 14;
      const u = Math.max(0, Math.min(1, (time - 7) / 7));
      mouse.x = 750 + Math.sin(u * Math.PI * 1.3) * 260;
      mouse.y = 440 + Math.sin(u * Math.PI * 2) * 100;
      if (frame === 8 * fps) ambient.spawnRipple(mouse.x, mouse.y, 0.65);
      paint(frame === 0 ? 0 : 1 / fps);
    };
  }, { source: bundle.outputFiles[0].text, notes, fps });
  encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
    '-i', audioPath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-t', String(duration),
    '-movflags', '+faststart', output], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let encoderErrors = '';
  encoder.stderr.on('data', data => { encoderErrors = (encoderErrors + data).slice(-10000); });
  const finished = new Promise((resolve, reject) => {
    encoder.on('error', reject);
    encoder.on('close', code => code === 0 ? resolve() : reject(new Error(encoderErrors)));
    encoder.stdin.on('error', reject);
  });
  for (let frame = 0; frame < duration * fps; frame++) {
    await page.evaluate(frame => window.renderPreviewFrame(frame), frame);
    const image = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (frame === fps * 3) writeFileSync(output.replace(/\.mp4$/i, '-poster.jpg'), image);
    if (!encoder.stdin.write(image)) await once(encoder.stdin, 'drain');
    if (frame % (fps * 5) === 0) console.log(`Rendered ${frame / fps}/${duration} seconds`);
    if (errors.length) throw new Error(errors.join('\n'));
  }
  encoder.stdin.end();
  await finished;
  console.log(`Saved ${output}`);
} catch (error) {
  encoder?.kill();
  throw error;
} finally {
  await browser.close();
}
