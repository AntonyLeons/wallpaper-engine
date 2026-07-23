import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read target theme from CLI args (e.g. `node scripts/generate_preview.js aetheris`)
const themeName = process.argv[2] || 'aetheris';
const targetDir = path.join(rootDir, themeName);

if (!fs.existsSync(targetDir)) {
  console.error(`Error: Theme directory "${themeName}" does not exist at ${targetDir}`);
  process.exit(1);
}

const tempFramesDir = path.join(targetDir, 'temp_frames');

if (!fs.existsSync(tempFramesDir)) {
  fs.mkdirSync(tempFramesDir, { recursive: true });
} else {
  // Clear old frames
  fs.readdirSync(tempFramesDir).forEach((file) => {
    fs.unlinkSync(path.join(tempFramesDir, file));
  });
}

let frameCount = 0;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle saving individual frames for animated preview.gif
  if (req.method === 'POST' && req.url === '/save_frame') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const base64Data = body.replace(/^data:image\/(png|jpeg);base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        frameCount++;

        const filename = `frame_${String(frameCount).padStart(4, '0')}.png`;
        fs.writeFileSync(path.join(tempFramesDir, filename), buffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ frame: frameCount }));
      } catch (err) {
        console.error('Error saving frame:', err);
        res.writeHead(500);
        res.end(String(err));
      }
    });
    return;
  }

  // Handle single snapshot preview.jpg save if needed
  if (req.method === 'POST' && req.url === '/save_snapshot') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const base64Data = body.replace(/^data:image\/(png|jpeg);base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const rootPreview = path.join(targetDir, 'preview.jpg');
        const distPreview = path.join(targetDir, 'dist', 'preview.jpg');

        fs.writeFileSync(rootPreview, buffer);
        if (fs.existsSync(path.join(targetDir, 'dist'))) {
          fs.writeFileSync(distPreview, buffer);
        }

        console.log(`SNAPSHOT_SUCCESS: Single snapshot saved to ${rootPreview}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Error saving snapshot:', err);
        res.writeHead(500);
        res.end(String(err));
      }
    });
    return;
  }

  // Handle finishing GIF encoding
  if (req.method === 'POST' && req.url === '/finish_recording') {
    console.log(`Finished receiving ${frameCount} frames for [${themeName}]. Encoding preview.gif with FFmpeg...`);

    const rootGif = path.join(targetDir, 'preview.gif');
    const distGif = path.join(targetDir, 'dist', 'preview.gif');

    const inputPattern = path.join(tempFramesDir, 'frame_%04d.png');
    const ffmpegCmd = `ffmpeg -y -framerate 15 -i "${inputPattern}" -vf "scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" -loop 0 "${rootGif}"`;

    exec(ffmpegCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg encoding error:', error);
        console.error(stderr);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
        return;
      }

      if (fs.existsSync(path.join(targetDir, 'dist'))) {
        fs.copyFileSync(rootGif, distGif);
      }

      console.log(`ENCODE_SUCCESS: preview.gif generated for theme [${themeName}]!`);

      // Cleanup frames
      try {
        fs.readdirSync(tempFramesDir).forEach((file) => fs.unlinkSync(path.join(tempFramesDir, file)));
        fs.rmdirSync(tempFramesDir);
      } catch (e) {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, frames: frameCount }));
      setTimeout(() => process.exit(0), 1000);
    });
    return;
  }

  // Serve static assets from the target theme directory
  let reqPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(targetDir, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/html';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.css') contentType = 'text/css';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(9876, () => {
  console.log(`Universal Preview Generator Server running on http://localhost:9876 for theme [${themeName}]`);
});
