import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const themeRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = path.join(themeRoot, 'dist');
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.png': 'image/png', '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(distRoot, relative);
  if (!file.startsWith(distRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/index.html`;
const problems = [];

const browser = await puppeteer.launch({ headless: true });
try {
  const cases = [
    { name: '16:9 1080p', width: 1920, height: 1080, query: '' },
    { name: '16:10 1440p', width: 2560, height: 1600, query: '?preset=silver&visualizer=radial&planets=9&gears=12&stars=300' },
    { name: '21:9', width: 3440, height: 1440, query: '?preset=verdigris&visualizer=off&clock=0&hands=0' },
    { name: '32:9', width: 3840, height: 1080, query: '?preset=rose&visualizer=radial&pos=custom&x=20&y=80' },
    { name: 'portrait', width: 1080, height: 1920, query: '?planets=0&gears=0&stars=0' },
    { name: '4K', width: 3840, height: 2160, query: '' },
    { name: 'small', width: 640, height: 360, query: '?clock=1&seconds=0&format=12h' },
  ];

  for (const testCase of cases) {
    const page = await browser.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${testCase.name}: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`${testCase.name}: ${String(error)}`));
    await page.setViewport({ width: testCase.width, height: testCase.height, deviceScaleFactor: 1 });
    await page.goto(base + testCase.query, { waitUntil: 'load' });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const failed = await page.evaluate(() => {
      const canvas = document.getElementById('wallpaper-canvas');
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return 'missing canvas';
      return canvas.width > 0 && canvas.height > 0 ? '' : 'empty canvas';
    });
    if (failed) problems.push(`${testCase.name}: ${failed}`);
    await page.close();
  }

  const propertyPage = await browser.newPage();
  propertyPage.on('console', (message) => {
    if (message.type() === 'error') problems.push(`properties: ${message.text()}`);
  });
  propertyPage.on('pageerror', (error) => problems.push(`properties: ${String(error)}`));
  await propertyPage.evaluateOnNewDocument(() => {
    window.__weCalls = { user: 0, general: 0 };
    window.wallpaperPropertyListener = {
      applyUserProperties() { window.__weCalls.user++; },
      applyGeneralProperties() { window.__weCalls.general++; },
    };
  });
  await propertyPage.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await propertyPage.goto(base, { waitUntil: 'load' });
  await propertyPage.evaluate(() => {
    window.wallpaperPropertyListener.applyUserProperties({
      preset: { value: 'silver' },
      orbitspeed: { value: 99 },
      planetcount: { value: 999 },
      gearcount: { value: -5 },
      stardensity: { value: 'invalid' },
      audioreactive: { value: true },
      audiosensitivity: { value: 0.8 },
      visualizerstyle: { value: 'radial' },
      mouseparallax: { value: false },
      clockhands: { value: false },
      showclock: { value: false },
      showseconds: { value: false },
      clockformat: { value: '12h' },
      clockposition: { value: 'custom' },
      clockpositionx: { value: 25 },
      clockpositiony: { value: 75 },
      taskbaroffset: { value: 80 },
      primarycolor: { value: '0.1 0.9 0.4' },
      secondarycolor: { value: '#ff8800' },
    });
    window.wallpaperPropertyListener.applyGeneralProperties({ fps: 30 });
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const state = await propertyPage.evaluate(() => ({
    calls: window.__weCalls,
    clockHidden: document.getElementById('clock-container')?.style.opacity === '0',
  }));
  if (state.calls.user !== 1 || state.calls.general !== 1) {
    problems.push('properties: existing Wallpaper Engine callbacks were not preserved');
  }
  if (!state.clockHidden) problems.push('properties: showclock=false did not hide the clock');
  await propertyPage.close();

  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`preview: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`preview: ${String(error)}`));
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    const RealDate = Date;
    const fixed = new RealDate(2026, 9, 27, 10, 24, 0).getTime();
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    }
    window.Date = FixedDate;

    window.wallpaperRegisterAudioListener = (callback) => {
      const values = Array.from({ length: 128 }, (_, i) =>
        0.08 + Math.pow(Math.sin(i * 0.19 + 0.4), 2) * 0.62 * (1 - (i % 64) / 90));
      setInterval(() => callback(values), 90);
    };
  });
  await page.goto(base + '?preset=brass&visualizer=orbit', { waitUntil: 'load' });
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await page.screenshot({
    path: path.join(themeRoot, 'preview.jpg'),
    type: 'jpeg',
    quality: 92,
  });
  await page.close();
  console.log('Saved astrarium/preview.jpg (1024 x 1024)');
} finally {
  await browser.close();
  server.close();
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else {
  console.log('Browser checks passed: 7 viewports, property callbacks, no console errors.');
}
