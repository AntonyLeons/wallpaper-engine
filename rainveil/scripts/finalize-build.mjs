import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const entry = path.join(dist, 'index.html');
let html = fs.readFileSync(entry, 'utf8');

// Vite's external ES module entry is blocked by Chrome on file://. Inline the
// self-contained bundle and stylesheet, keeping the production page offline.
html = html.replace(/<script\b[^>]*src="(\.\/assets\/[^\"]+)"[^>]*><\/script>/g,
  (_tag, asset) => {
    const source = fs.readFileSync(path.join(dist, asset), 'utf8');
    if (/\bimport\s*(?:\(|["'{*])|\bimport\.meta/.test(source)) {
      throw new Error('Rainveil must remain a self-contained browser bundle.');
    }
    // Inline modules are deferred until the canvas is parsed, including file://.
    return `<script type="module">${source.replace(/<\/script/gi, '<\\/script')}</script>`;
  });
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="(\.\/assets\/[^\"]+)"[^>]*>/g,
  (_tag, asset) => `<style>${fs.readFileSync(path.join(dist, asset), 'utf8')}</style>`);
fs.writeFileSync(entry, html);
fs.copyFileSync(path.join(root, 'project.json'), path.join(dist, 'project.json'));
if (fs.existsSync(path.join(root, 'preview.jpg'))) {
  fs.copyFileSync(path.join(root, 'preview.jpg'), path.join(dist, 'preview.jpg'));
}
