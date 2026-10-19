/**
 * Asset importer: takes raw generated art (any size, transparent or black background) and turns it into
 * game-ready sprites in src/assets/sprites/ — cropped to the subject, scaled to the right world size,
 * centred on the body (not the scarf/blade), with pivots written to sprites.auto.json.
 *
 *   node tools/import-assets.mjs            # import everything from assets.config.json → sourceDir
 *   node tools/import-assets.mjs <name>...  # import specific files (e.g. player_idle)
 *   node tools/import-assets.mjs --force    # re-import everything (after changing scale rules)
 *
 * Source lookup per file: <sourceDir>/_originals/<name>.png (full-res) → falls back to <sourceDir>/<name>.png
 * Tweak per-file results in tools/asset-tweaks.json: { "player_idle": { "scale": 1.1, "pivot": [0.5, 0.5] } }
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeBackground, bgModeFor } from './bg-remove.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/assets/sprites');
const AUTO = path.join(OUT, 'sprites.auto.json');
const TWEAKS = path.join(ROOT, 'tools/asset-tweaks.json');
const PPU = 2; // pixels per world unit

export function sourceDir() {
  if (process.env.ASSET_DIR) return path.resolve(process.env.ASSET_DIR);
  try {
    const dir = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.config.json'), 'utf8')).sourceDir;
    // relative paths are resolved from the project root (e.g. "../Asset")
    return dir ? path.resolve(ROOT, dir) : null;
  } catch {
    return null;
  }
}
function tweaks() {
  try {
    return JSON.parse(fs.readFileSync(TWEAKS, 'utf8'));
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------ rules
// collision radius of every character (world units)
const BODY_R = {
  player: 16, enemy_rusher: 15, enemy_gunner: 14, enemy_bulwark: 20, enemy_bomber: 13,
  boss_vanguard: 30, boss_hex: 26, boss_kael: 22, boss_vex: 20, boss_colossus: 54, boss_mirror: 18,
};
const BODY_K = 1.35; // visual body diameter relative to the hitbox
const STATES = ['idle', 'move', 'windup', 'attack', 'hurt', 'death', 'stagger', 'dash', 'guard', 'charge'];

/** additive (black-background ok) art: [size px of the long side, mode] — 'center' keeps the art centred on the image centre */
const ADDITIVE = {
  proj_orb: [64, 'center'], proj_orb_parry: [72, 'center'], proj_wave: [128, 'center'],
  boss_colossus_core: [110, 'center'], boss_hex_ring: [220, 'center'],
  vfx_slash: [256, 'center'], vfx_slash_spin: [256, 'center'], vfx_thrust: [256, 'tight'], vfx_hit: [128, 'center'],
  vfx_hit_crit: [160, 'center'], vfx_parry: [256, 'center'], vfx_block: [96, 'center'], vfx_explosion: [256, 'center'],
  vfx_shockwave: [256, 'center'], vfx_portal: [128, 'center'], vfx_execute: [320, 'center'], vfx_storm_blade: [64, 'tight'],
  vfx_vortex: [256, 'center'],
};
/** plain transparent art fitted into a box [w, h] */
const STATIC = {
  weapon_katana: [140, 0], weapon_daggers: [72, 0], weapon_hammer: [120, 0], // [length, 0] = fit width
  proj_knife: [48, 0], proj_missile: [40, 0], proj_mine: [32, 32], proj_mine_armed: [32, 32],
  pillar: [160, 160], pillar_cracked: [160, 160], ui_cursor: [32, 32], ui_logo: [1200, 300],
  ui_card_common: [260, 340], ui_card_rare: [260, 340], ui_card_epic: [260, 340], ui_card_legendary: [260, 340],
};

function classify(name) {
  const base = name.replace(/_glow$/, '').replace(/_p2$/, '');
  if (/_shield$/.test(base)) return { kind: 'shield', owner: base.replace(/_shield$/, '') };
  if (base === 'boss_colossus_arm') return { kind: 'arm' };
  if (ADDITIVE[base]) return { kind: 'additive', size: ADDITIVE[base][0], mode: ADDITIVE[base][1] };
  if (STATIC[base]) return { kind: 'static', box: STATIC[base] };
  if (base === 'arena_floor') return { kind: 'floor' };
  if (base === 'arena_edge') return { kind: 'edge' };
  if (base === 'bg_void') return { kind: 'tile' };
  if (base.startsWith('icon_')) return { kind: 'icon', box: [128, 128] };
  if (base.startsWith('portrait_')) return { kind: 'static', box: [640, 640], palette: true };
  if (base.startsWith('art_weapon_')) return { kind: 'static', box: [560, 280] };
  for (const ent of Object.keys(BODY_R).sort((a, b) => b.length - a.length)) {
    if (base.startsWith(ent + '_')) {
      const rest = base.slice(ent.length + 1);
      // bosses may have per-move names (boss_vanguard_slam_windup)
      if (STATES.includes(rest) || ent.startsWith('boss_')) return { kind: 'body', ent };
    }
  }
  return null;
}

// ------------------------------------------------------------------ pixel helpers
async function load(file, maxSide = 1400) {
  const img = sharp(file).ensureAlpha();
  const meta = await img.metadata();
  const k = Math.min(1, maxSide / Math.max(meta.width, meta.height));
  const { data, info } = await img.resize(Math.round(meta.width * k), Math.round(meta.height * k)).raw().toBuffer({ resolveWithObject: true });
  let opaque = true;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) { opaque = false; break; }
  const out = { data, w: info.width, h: info.height, opaque };
  // art delivered on a solid background gets it removed (glow-safe for VFX, flood-fill for solid subjects)
  if (opaque) {
    const mode = bgModeFor(path.basename(file));
    if (mode.mode !== 'none') {
      removeBackground(out, mode);
      out.opaque = false;
    }
  }
  return out;
}

function bbox(img, test) {
  const { data, w, h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (test(data, i)) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } : { x0, y0, x1, y1 };
}
const alphaTest = (d, i) => d[i + 3] > 40;
const faintTest = (d, i) => d[i + 3] > 10; // keeps soft glow edges inside the crop
const lumTest = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) > 22;

/** crop a region (may extend outside the image; fills with transparent or black) */
function crop(img, x0, y0, cw, ch, fillBlack) {
  x0 = Math.round(x0); y0 = Math.round(y0); cw = Math.max(1, Math.round(cw)); ch = Math.max(1, Math.round(ch));
  const out = Buffer.alloc(cw * ch * 4);
  if (fillBlack) for (let i = 3; i < out.length; i += 4) out[i] = 255;
  for (let y = 0; y < ch; y++) {
    const sy = y + y0;
    if (sy < 0 || sy >= img.h) continue;
    for (let x = 0; x < cw; x++) {
      const sx = x + x0;
      if (sx < 0 || sx >= img.w) continue;
      img.data.copy(out, (y * cw + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
    }
  }
  return { data: out, w: cw, h: ch };
}
async function save(buf, outW, outH, file, opts = {}) {
  await sharp(buf.data, { raw: { width: buf.w, height: buf.h, channels: 4 } })
    .resize(Math.max(1, Math.round(outW)), Math.max(1, Math.round(outH)), { kernel: 'lanczos3', fit: 'fill' })
    // large textures are palette-quantised to keep load times down
    .png(opts.palette ? { compressionLevel: 9, palette: true, quality: 92, effort: 8 } : { compressionLevel: 9 })
    .toFile(file);
}
/** area + density peak of the opaque subject: the "body centre" ignoring thin scarves/blades */
async function bodyMetrics(img) {
  let area = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 128) area++;
  const req = Math.sqrt(area / Math.PI);
  const { data } = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .extractChannel(3).blur(Math.max(1, req * 0.55)).raw().toBuffer({ resolveWithObject: true });
  let best = -1, cx = img.w / 2, cy = img.h / 2;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const v = data[y * img.w + x];
    if (v > best) (best = v), (cx = x), (cy = y);
  }
  return { area, req, cx, cy, box: bbox(img, alphaTest) };
}

// ------------------------------------------------------------------ importer
const transforms = new Map(); // base name → function(img) for matching _glow layers
const entityScale = new Map(); // entity → px-per-source-px from its idle image

function findSource(src, name) {
  for (const p of [path.join(src, '_originals', name + '.png'), path.join(src, name + '.png')]) if (fs.existsSync(p)) return p;
  return null;
}

async function entityIdleScale(src, ent, maxSide) {
  if (entityScale.has(ent)) return entityScale.get(ent);
  const f = findSource(src, ent + '_idle');
  if (!f) return null;
  const img = await load(f, maxSide);
  const m = await bodyMetrics(img);
  const s = (BODY_R[ent] * 2 * PPU * BODY_K) / (2 * m.req);
  entityScale.set(ent, s);
  return s;
}

export async function importOne(name, src = sourceDir(), auto = readAuto(), force = false) {
  const cls = classify(name);
  if (!cls) return { name, skipped: 'unknown name' };
  const file = findSource(src, name);
  if (!file) return { name, skipped: 'missing' };
  const tw = tweaks()[name] ?? {};
  const outFile = path.join(OUT, name + '.png');
  // skip work (and the page reload it would cause) when the output is newer than the source and the tweaks file
  if (!force && fs.existsSync(outFile)) {
    const outT = fs.statSync(outFile).mtimeMs;
    const twT = fs.existsSync(TWEAKS) ? fs.statSync(TWEAKS).mtimeMs : 0;
    if (outT >= fs.statSync(file).mtimeMs && outT >= twT) return { name, skipped: 'up-to-date' };
  }
  const isGlow = name.endsWith('_glow');
  if (isGlow && transforms.has(name.slice(0, -5))) {
    const img = await load(file, 1400);
    await transforms.get(name.slice(0, -5))(img, outFile);
    return { name, kind: 'glow' };
  }
  let img;
  switch (cls.kind) {
    case 'body': {
      img = await load(file, 1400);
      const m = await bodyMetrics(img);
      let s = (await entityIdleScale(src, cls.ent, 1400)) ?? (BODY_R[cls.ent] * 2 * PPU * BODY_K) / (2 * m.req);
      s *= tw.scale ?? 1;
      const b = m.box;
      const E = Math.max(m.cx - b.x0, b.x1 - m.cx, m.cy - b.y0, b.y1 - m.cy) + 4;
      const side = Math.ceil(2 * E * s);
      const t = async (im, out) => save(crop(im, m.cx - E, m.cy - E, 2 * E, 2 * E, false), side, side, out);
      transforms.set(name, t);
      await t(img, outFile);
      if (tw.pivot) auto[name] = { pivot: tw.pivot };
      else delete auto[name];
      return { name, kind: 'body', size: side };
    }
    case 'shield': {
      img = await load(file, 1400);
      const b = bbox(img, alphaTest);
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const H = BODY_R[cls.owner] * 2 * PPU * BODY_K * 0.95 * (tw.scale ?? 1);
      const W = (bw / bh) * H;
      await save(crop(img, b.x0, b.y0, bw, bh, false), W, H, outFile);
      // the shield's back edge starts just ahead of the body centre, so it reads as held in front
      auto[name] = { pivot: tw.pivot ?? [-0.12, 0.5] };
      return { name, kind: 'shield', size: `${Math.round(W)}×${Math.round(H)}` };
    }
    case 'arm': {
      img = await load(file, 1400);
      const b = bbox(img, alphaTest);
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const W = BODY_R.boss_colossus * PPU * 1.5 * (tw.scale ?? 1);
      await save(crop(img, b.x0, b.y0, bw, bh, false), W, (bh / bw) * W, outFile);
      return { name, kind: 'arm' };
    }
    case 'additive': {
      img = await load(file, 1400);
      const test = img.opaque ? lumTest : faintTest;
      const b = bbox(img, test);
      const size = cls.size * (tw.scale ?? 1);
      if (cls.mode === 'tight') {
        const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
        const k = size / Math.max(bw, bh);
        await save(crop(img, b.x0 - 2, b.y0 - 2, bw + 4, bh + 4, img.opaque), (bw + 4) * k, (bh + 4) * k, outFile);
      } else {
        const cx = img.w / 2, cy = img.h / 2;
        const E = Math.max(cx - b.x0, b.x1 - cx, cy - b.y0, b.y1 - cy) + 2;
        await save(crop(img, cx - E, cy - E, 2 * E, 2 * E, img.opaque), size, size, outFile);
      }
      return { name, kind: 'additive' };
    }
    case 'static':
    case 'icon': {
      img = await load(file, 1400);
      const b = bbox(img, img.opaque ? lumTest : cls.kind === 'icon' ? faintTest : alphaTest);
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const [bxw, bxh] = cls.box;
      const k = bxh ? Math.min(bxw / bw, bxh / bh) : bxw / bw;
      await save(crop(img, b.x0, b.y0, bw, bh, img.opaque && cls.kind !== 'icon'), bw * k * (tw.scale ?? 1), bh * k * (tw.scale ?? 1), outFile, { palette: !!cls.palette });
      return { name, kind: cls.kind };
    }
    case 'floor': {
      img = await load(file, 2048);
      const s = Math.min(img.w, img.h);
      await save(crop(img, (img.w - s) / 2, (img.h - s) / 2, s, s, true), 1536, 1536, outFile, { palette: true });
      return { name, kind: 'floor' };
    }
    case 'edge': {
      img = await load(file, 2048);
      const b = bbox(img, alphaTest);
      const s = Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const sq = crop(img, cx - s / 2, cy - s / 2, s, s, false);
      // measure where the wall starts (inner radius / half width), averaged over 4 directions
      const half = s / 2;
      let sum = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let r = 0; r < half; r++) {
          const x = Math.round(half + dx * r), y = Math.round(half + dy * r);
          if (sq.data[(y * s + x) * 4 + 3] > 100) {
            sum += r / half;
            n++;
            break;
          }
        }
      }
      await save(sq, 1536, 1536, outFile, { palette: true });
      auto[name] = { inner: n ? +(sum / n).toFixed(3) : 0.95 };
      return { name, kind: 'edge', inner: auto[name].inner };
    }
    case 'tile': {
      img = await load(file, 1400);
      const s = Math.min(img.w, img.h);
      const T = 256;
      const tile = await sharp(crop(img, (img.w - s) / 2, (img.h - s) / 2, s, s, true).data, { raw: { width: s, height: s, channels: 4 } }).resize(T, T).raw().toBuffer();
      const flipX = await sharp(tile, { raw: { width: T, height: T, channels: 4 } }).flop().raw().toBuffer();
      const flipY = await sharp(tile, { raw: { width: T, height: T, channels: 4 } }).flip().raw().toBuffer();
      const flipXY = await sharp(tile, { raw: { width: T, height: T, channels: 4 } }).flip().flop().raw().toBuffer();
      const raw = { raw: { width: T, height: T, channels: 4 } };
      // mirrored 2×2 → always seamless
      await sharp({ create: { width: T * 2, height: T * 2, channels: 4, background: '#000000ff' } })
        .composite([{ input: tile, ...raw, left: 0, top: 0 }, { input: flipX, ...raw, left: T, top: 0 }, { input: flipY, ...raw, left: 0, top: T }, { input: flipXY, ...raw, left: T, top: T }])
        .png().toFile(outFile);
      return { name, kind: 'tile' };
    }
  }
}

function readAuto() {
  try {
    return JSON.parse(fs.readFileSync(AUTO, 'utf8'));
  } catch {
    return {};
  }
}
function writeAuto(auto) {
  const sorted = Object.fromEntries(Object.entries(auto).sort(([a], [b]) => a.localeCompare(b)));
  const next = JSON.stringify(sorted, null, 2) + '\n';
  if (!fs.existsSync(AUTO) || fs.readFileSync(AUTO, 'utf8') !== next) fs.writeFileSync(AUTO, next);
}

/** names available in the source folder (top level + _originals) */
export function listSource(src = sourceDir()) {
  const names = new Set();
  for (const d of [src, path.join(src, '_originals')]) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.png') && !f.startsWith('.') && !f.startsWith('original-')) names.add(f.slice(0, -4));
  }
  // glow layers after their base so the same crop is reused
  return [...names].sort((a, b) => Number(a.endsWith('_glow')) - Number(b.endsWith('_glow')) || a.localeCompare(b));
}

export async function importMany(names, src = sourceDir(), log = console.log, force = false) {
  fs.mkdirSync(OUT, { recursive: true });
  const auto = readAuto();
  const results = [];
  for (const n of names) {
    try {
      const r = await importOne(n, src, auto, force);
      results.push(r);
      if (!r.skipped) log(`[assets] ${n} → ${r.kind}${r.size ? ' ' + r.size : ''}${r.inner ? ' inner ' + r.inner : ''}`);
      else if (r.skipped === 'unknown name') log(`[assets] skip ${n} (ชื่อไม่ตรงช่องใดในเกม)`);
    } catch (e) {
      log(`[assets] FAILED ${n}: ${e.message}`);
    }
  }
  writeAuto(auto);
  return results;
}

export function resetCaches() {
  transforms.clear();
  entityScale.clear();
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = sourceDir();
  if (!src || !fs.existsSync(src)) {
    console.error('ไม่พบโฟลเดอร์ asset — ตั้งค่า sourceDir ใน assets.config.json หรือ env ASSET_DIR');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const names = args.length ? args : listSource(src);
  const res = await importMany(names, src, console.log, force || args.length > 0);
  console.log(`[assets] done: ${res.filter((r) => !r.skipped).length} imported, ${res.filter((r) => r.skipped === 'up-to-date').length} up-to-date, ${res.filter((r) => r.skipped && r.skipped !== 'up-to-date').length} skipped`);
}
