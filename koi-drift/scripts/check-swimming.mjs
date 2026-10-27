import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Exercise actual simulation code without requiring a browser or allocating artwork.
globalThis.Path2D = class { moveTo() {} quadraticCurveTo() {} closePath() {} };
const themeRoot = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  stdin: { contents: "export { KoiSystem } from './src/render/KoiSystem'; export { DEFAULT_SETTINGS } from './src/config/settings';", resolveDir: themeRoot },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { KoiSystem, DEFAULT_SETTINGS } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const audio = { bass: 1, mid: 1, treble: 1, overall: 1, beatPulse: 1, spectrum: new Float32Array(32), hasAudio: true };
const originalRandom = Math.random;
let seed = 321;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
try {
  for (const [width, height, count, speed, cursor, dt = 1 / 60] of [
    [1920, 1080, 6, 1, false], [720, 1280, 12, 2, false],
    [1280, 720, 12, 2, true], [3840, 1080, 12, 2, false],
    [1280, 720, 12, 2, true, 1 / 15], [640, 960, 12, 2, true, 0.1],
  ]) {
    const system = new KoiSystem();
    const settings = { ...DEFAULT_SETTINGS, fishCount: count, fishSpeed: speed, audioReactive: speed === 2 };
    const mouse = { x: 0, y: 0, active: cursor, pulseRadius: 180 };
    let wraps = 0;
    const wrap = system.wrapBody.bind(system);
    system.wrapBody = (fish, w, h) => {
      const padding = 36 * fish.scale;
      const minX = Math.min(...fish.spine.map(p => p.x)) - padding;
      const maxX = Math.max(...fish.spine.map(p => p.x)) + padding;
      const minY = Math.min(...fish.spine.map(p => p.y)) - padding;
      const maxY = Math.max(...fish.spine.map(p => p.y)) + padding;
      const before = fish.spine.map(p => ({ ...p }));
      const heading = fish.heading;
      const phase = fish.phase;
      wrap(fish, w, h);
      const dx = fish.spine[0].x - before[0].x;
      const dy = fish.spine[0].y - before[0].y;
      if (dx || dy) {
        wraps++;
        assert.ok(maxX < 0 || minX > w || maxY < 0 || minY > h, 'never teleport a visible fish');
        if (dx) assert.ok(Math.max(...fish.spine.map(p => p.x)) + padding <= 0.001 || Math.min(...fish.spine.map(p => p.x)) - padding >= w - 0.001, 'horizontal re-entry starts fully outside');
        if (dy) assert.ok(Math.max(...fish.spine.map(p => p.y)) + padding <= 0.001 || Math.min(...fish.spine.map(p => p.y)) - padding >= h - 0.001, 'vertical re-entry starts fully outside');
        for (let i = 0; i < before.length; i++) {
          assert.ok(Math.abs(fish.spine[i].x - before[i].x - dx) < 0.001);
          assert.ok(Math.abs(fish.spine[i].y - before[i].y - dy) < 0.001);
        }
        assert.equal(fish.heading, heading);
        assert.equal(fish.phase, phase);
      }
    };
    let crowded = 0;
    let samples = 0;
    for (let step = 0; step < 180 / dt; step++) {
      // Hold the cursor at an edge, then at the centre, to exercise both crowding cases.
      mouse.x = step * dt < 90 ? 0 : width / 2;
      mouse.y = step * dt < 90 ? 0 : height / 2;
      system.update(dt, width, height, settings, audio, mouse);
      for (const fish of system.kois) {
        for (const joint of fish.spine) {
          assert.ok(Number.isFinite(joint.x) && Number.isFinite(joint.y));
          const reach = 6.4 * fish.scale * 17 + 72 * fish.scale;
          assert.ok(joint.x >= -reach && joint.x <= width + reach);
          assert.ok(joint.y >= -reach && joint.y <= height + reach);
        }
      }
      if (step * dt > 10 && step % Math.max(1, Math.round(0.5 / dt)) === 0) {
        for (let a = 0; a < system.kois.length; a++) {
          for (let b = a + 1; b < system.kois.length; b++) {
            const first = system.kois[a].spine[8];
            const second = system.kois[b].spine[8];
            if (Math.hypot(first.x - second.x, first.y - second.y) < 65) crowded++;
            samples++;
          }
        }
      }
    }
    const crowdRate = crowded / samples;
    assert.ok(crowdRate < 0.04, `persistent clustering: ${(crowdRate * 100).toFixed(2)}%`);
    assert.ok(wraps > 0, 'fish should be free to leave and re-enter');
    // Resizing must preserve chain length and keep fish within the wrapping region.
    system.update(1 / 30, 640, 960, settings, audio, mouse);
    for (const fish of system.kois) {
      for (const joint of fish.spine) {
        assert.ok(Number.isFinite(joint.x) && Number.isFinite(joint.y));
      }
      for (let i = 1; i < fish.spine.length; i++) {
        assert.ok(Math.abs(Math.hypot(fish.spine[i].x - fish.spine[i - 1].x, fish.spine[i].y - fish.spine[i - 1].y) - 6.4 * fish.scale) < 0.001);
      }
    }
    console.log(`${width}x${height}, ${count} koi, speed ${speed}, cursor ${cursor}, dt ${dt.toFixed(3)}: ${wraps} invisible re-entries passed; close pairs ${(crowdRate * 100).toFixed(2)}%`);
  }
} finally { Math.random = originalRandom; }
