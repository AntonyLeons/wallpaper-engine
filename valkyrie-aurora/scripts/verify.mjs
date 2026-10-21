import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.cache');
mkdirSync(output, { recursive: true });
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
assert(!/https?:\/\//.test(html), 'Production must not need remote assets');
assert(!/<script[^>]+src=/.test(html), 'Runtime must work over file://');
const browser = await puppeteer.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument(() => {
    window.__audio = null; window.__frames = 0; window.__drawMs = 0;
    window.wallpaperRegisterAudioListener = callback => { window.__audio = callback; };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) { window.__frames++; return clear.apply(this, args); };
  });
  const url = pathToFileURL(resolve(root, 'dist/index.html')).href;
  for (const [name, width, height] of [['desktop',1920,1080],['wide',2560,1080],['superwide',3840,1080],['portrait',1080,1920],['16-10',1920,1200],['4k',3840,2160]]) {
    await page.setViewport({width, height, deviceScaleFactor: 1});
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#artwork').naturalWidth > 0 && document.querySelector('#clock-time').textContent.length > 0);
    const result = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return { canvas: [c.width,c.height], overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
    });
    assert(!result.overflow, `${name} overflow`);
    assert(result.canvas[0] <= 1280 && result.canvas[1] <= 800, `${name} effects budget`);
    await page.screenshot({ path: resolve(output, `${name}.jpg`), type: 'jpeg', quality: 85 });
    console.log(name, JSON.stringify(result));
  }
  await page.evaluate(() => {
    const p = window.wallpaperPropertyListener;
    p.applyUserProperties({ showclock: {value:false}, particlecount:{value:NaN}, primarycolor:{value:'Infinity 0 0'}, parallaxintensity:{value:999} });
    p.applyUserProperties({ showseconds:{value:true} });
  });
  assert(await page.$eval('#clock-container', e=>e.classList.contains('hidden')), 'Partial updates must preserve clock visibility');
  await page.evaluate(() => {
    window.wallpaperPropertyListener.applyUserProperties({showclock:{value:true}, clockformat:{value:'12h'},fpslimit:{value:'120'}});
    window.wallpaperPropertyListener.applyGeneralProperties({fps:15});
    window.__audio(Array(128).fill(.5));
    window.__audio(Array(128).fill(NaN));
    window.__frames = 0;
  });
  await new Promise(r => setTimeout(r, 1100));
  const frames = await page.evaluate(()=>window.__frames);
  assert(frames >= 10 && frames <= 19, `Engine FPS limit violated: ${frames}`);
  console.log('Engine FPS cap:',frames,'frames / 1.1s');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await new Promise(r=>setTimeout(r,100));
  const stopped = await page.evaluate(()=>window.__frames);
  await new Promise(r=>setTimeout(r,250));
  assert.equal(await page.evaluate(()=>window.__frames),stopped,'Reduced motion must stop continuous rendering');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));});
  const hiddenFrames=await page.evaluate(()=>window.__frames);
  await new Promise(r=>setTimeout(r,250));
  assert.equal(await page.evaluate(()=>window.__frames),hiddenFrames,'Hidden document must stop continuous rendering');
  await page.evaluate(()=>{delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));});
  await new Promise(r=>setTimeout(r,250));
  assert(await page.evaluate(()=>window.__frames)>hiddenFrames,'Rendering must resume');
  const fallback = await browser.newPage();
  fallback.on('pageerror', e=>errors.push(e.message));
  await fallback.evaluateOnNewDocument(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
  await fallback.goto(url);
  assert(await fallback.$eval('#artwork',e=>e.naturalWidth>0),'Static fallback without Canvas');
  assert(await fallback.$eval('#clock-time',e=>e.textContent.length>0),'Clock without WE APIs');
  assert.deepEqual(errors,[],'Browser console errors');
  console.log('PASS: file://, six ratios, API absence, invalid inputs, partial updates, FPS, audio, reduced motion, pause/resume, Canvas fallback.');
} finally { await browser.close(); }
