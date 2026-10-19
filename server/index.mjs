/**
 * Production server: serves the built game from dist/ and the leaderboard API from /api.
 *   npm run build && npm start      (PORT defaults to 3000)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { apiMiddleware } from './api.mjs';

const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end();
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) file = path.join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  // hashed build assets can be cached forever
  if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(file).pipe(res);
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ not found — run `npm run build` first');
  process.exit(1);
}
http.createServer((req, res) => apiMiddleware(req, res, () => serveStatic(req, res))).listen(PORT, () => {
  console.log(`NEON DUEL running at http://localhost:${PORT}`);
});
