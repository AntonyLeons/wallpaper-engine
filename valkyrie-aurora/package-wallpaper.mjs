import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');
// Inline the small runtime so Chrome can open the production wallpaper over file://.
let html = readFileSync(resolve(dist, 'index.html'), 'utf8');
html = html.replace(/<script\b[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, path) => {
  const source = readFileSync(resolve(dist, path), 'utf8');
  return `<script type="module">${source.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g,
  (_, path) => `<style>${readFileSync(resolve(dist, path), 'utf8')}</style>`);
writeFileSync(resolve(dist, 'index.html'), html);
copyFileSync(resolve(root, 'project.json'), resolve(dist, 'project.json'));
if (existsSync(resolve(root, 'preview.jpg'))) copyFileSync(resolve(root, 'preview.jpg'), resolve(dist, 'preview.jpg'));
