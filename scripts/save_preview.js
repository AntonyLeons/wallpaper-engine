import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save_preview') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const base64Data = body.replace(/^data:image\/(jpeg|png);base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const rootPreview = path.join(rootDir, 'preview.jpg');
        const distPreview = path.join(rootDir, 'dist', 'preview.jpg');

        fs.writeFileSync(rootPreview, buffer);
        fs.writeFileSync(distPreview, buffer);

        console.log('PREVIEW_SAVE_SUCCESS');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => process.exit(0), 500);
      } catch (err) {
        console.error('Failed to save preview:', err);
        res.writeHead(500);
        res.end(String(err));
      }
    });
    return;
  }

  // Serve static files (generate_preview.html, cosmic.png, synthwave.png, etc.)
  let reqPath = req.url === '/' ? '/generate_preview.html' : req.url;
  let filePath = path.join(rootDir, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/html';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.js') contentType = 'application/javascript';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(9876, () => {
  console.log('Preview generator server running on http://localhost:9876');
});
