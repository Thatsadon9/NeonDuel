/**
 * Background removal for generated art delivered on a solid background (usually black).
 *
 *  - 'glow'  : for emissive art (VFX, energy orbs). Brightness becomes alpha and colour is un-premultiplied,
 *              so glows turn into soft translucent halos. Exact for anything meant to be drawn additively.
 *  - 'flood' : for solid subjects (cards, illustrations, icons). Flood-fills the background from the image
 *              border through pixels close to the background colour; only those pixels become (partly)
 *              transparent, so dark ink *inside* the subject stays solid. Edges are anti-aliased.
 *
 * CLI:  node tools/bg-remove.mjs <file|dir>... [--out <dir>] [--mode auto|glow|flood] [--threshold 24] [--band 0.1]
 *       default output: <input dir>/_transparent/
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** which method suits a given asset name */
export function bgModeFor(name) {
  const n = name.replace(/\.png$/, '');
  if (/^(vfx_|proj_orb|proj_wave|boss_colossus_core|boss_hex_ring)/.test(n)) return { mode: 'glow' };
  if (/^art_weapon_/.test(n)) return { mode: 'flood', threshold: 16 };
  if (/^ui_card_/.test(n)) return { mode: 'flood', threshold: 22, band: 0.09 }; // only the corners outside the frame
  if (/^icon_/.test(n)) return { mode: 'flood', threshold: 48 };
  if (/^arena_floor/.test(n)) return { mode: 'flood', threshold: 14 };
  if (/^bg_void/.test(n)) return { mode: 'none' }; // a texture: keep it opaque
  return { mode: 'flood', threshold: 24 };
}

/** true if the image is (almost) fully opaque, i.e. it still has a background */
export function isOpaque(img) {
  const d = img.data;
  let n = 0, op = 0;
  for (let i = 3; i < d.length; i += 4 * 5) {
    n++;
    if (d[i] > 250) op++;
  }
  return op / n > 0.98;
}

/** average colour of the outer border — the background colour to remove */
function borderColor(img) {
  const { data: d, w, h } = img;
  const s = [0, 0, 0];
  let n = 0;
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++;
  };
  for (let x = 0; x < w; x++) add(x, 0), add(x, h - 1);
  for (let y = 0; y < h; y++) add(0, y), add(w - 1, y);
  return s.map((v) => v / n);
}

/** in-place; img = { data: Buffer RGBA, w, h } */
export function removeBackground(img, opts = {}) {
  const mode = opts.mode ?? 'flood';
  const d = img.data;
  if (mode === 'none') return img;
  if (mode === 'glow') {
    const floor = opts.floor ?? 4; // ignore compression noise in the black
    for (let i = 0; i < d.length; i += 4) {
      const m = Math.max(d[i], d[i + 1], d[i + 2]);
      const a = Math.max(0, Math.min(255, ((m - floor) * 255) / (255 - floor)));
      if (a > 0) {
        const k = 255 / Math.max(m, 1);
        d[i] = Math.min(255, Math.round(d[i] * k));
        d[i + 1] = Math.min(255, Math.round(d[i + 1] * k));
        d[i + 2] = Math.min(255, Math.round(d[i + 2] * k));
      }
      d[i + 3] = Math.round(a * (d[i + 3] / 255));
    }
    return img;
  }
  // flood
  const T = opts.threshold ?? 24;
  const { w, h } = img;
  const bg = borderColor(img);
  const dist = (p) => Math.max(Math.abs(d[p] - bg[0]), Math.abs(d[p + 1] - bg[1]), Math.abs(d[p + 2] - bg[2]));
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  // optional: only remove background within this fraction of the size from the border (protects enclosed panels)
  const band = opts.band ? Math.round(Math.min(w, h) * opts.band) : 0;
  const push = (x, y) => {
    const k = y * w + x;
    if (seen[k]) return;
    if (band && x >= band && y >= band && x < w - band && y < h - band) return;
    if (dist(k * 4) > T) return;
    seen[k] = 1;
    queue[qt++] = k;
  };
  for (let x = 0; x < w; x++) push(x, 0), push(x, h - 1);
  for (let y = 0; y < h; y++) push(0, y), push(w - 1, y);
  while (qh < qt) {
    const k = queue[qh++];
    const x = k % w, y = (k / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // background pixels fade by how far they are from the bg colour (anti-aliased, keeps faint glows)
  const bgIsDark = bg[0] + bg[1] + bg[2] < 3 * 128;
  for (let k = 0; k < w * h; k++) {
    if (!seen[k]) continue;
    const p = k * 4;
    const t = dist(p) / T; // 0 = pure background … 1 = edge of the subject
    const a = Math.max(0, Math.min(1, t * t * (3 - 2 * t)));
    if (a > 0 && bgIsDark) {
      // un-premultiply against black so halos keep their colour instead of going grey
      const k2 = 1 / Math.max(a, 0.05);
      d[p] = Math.min(255, Math.round(d[p] * Math.min(k2, 3)));
      d[p + 1] = Math.min(255, Math.round(d[p + 1] * Math.min(k2, 3)));
      d[p + 2] = Math.min(255, Math.round(d[p + 2] * Math.min(k2, 3)));
    }
    d[p + 3] = Math.round(a * d[p + 3]);
  }
  return img;
}

// ------------------------------------------------------------------ CLI
async function processFile(file, outDir, forced) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data, w: info.width, h: info.height };
  const name = path.basename(file);
  if (!isOpaque(img) && !forced.mode) return `${name}: already transparent — skipped`;
  const opts = { ...bgModeFor(name), ...forced };
  if (opts.mode === 'none') return `${name}: texture — kept opaque`;
  removeBackground(img, opts);
  fs.mkdirSync(outDir, { recursive: true });
  await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(outDir, name));
  return `${name}: ${opts.mode}${opts.threshold ? ' (threshold ' + opts.threshold + ')' : ''} → ${path.join(outDir, name)}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const out = get('--out');
  const mode = get('--mode');
  const threshold = get('--threshold');
  const bandArg = get('--band');
  const forced = {};
  if (mode && mode !== 'auto') forced.mode = mode;
  if (threshold) forced.threshold = Number(threshold);
  if (bandArg) forced.band = Number(bandArg);
  if (!args.length) {
    console.log('usage: node tools/bg-remove.mjs <file|dir>... [--out dir] [--mode auto|glow|flood] [--threshold n]');
    process.exit(1);
  }
  const files = args.flatMap((a) => (fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter((f) => f.endsWith('.png')).map((f) => path.join(a, f)) : [a]));
  for (const f of files) {
    const outDir = out ?? path.join(path.dirname(f), '_transparent');
    try {
      console.log(await processFile(f, outDir, forced));
    } catch (e) {
      console.log(`${path.basename(f)}: FAILED ${e.message}`);
    }
  }
}
