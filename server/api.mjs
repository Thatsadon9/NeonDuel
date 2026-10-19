/**
 * Leaderboard API — Neon Postgres (node-postgres, pooled DATABASE_URL) + Neon Object Storage (Files SDK).
 *
 *   GET  /api/health                → checks both services
 *   GET  /api/leaderboard?mode=campaign|endless&hard=0&limit=10
 *   POST /api/scores                → { name, mode, stage, won, hard, weapon, time, kills, parries, perfects,
 *                                       executions, maxCombo, bestRank, shot?: "data:image/jpeg;base64,..." }
 *
 * Used as Connect-style middleware by both the Vite dev server and server/index.mjs (production).
 */
import pg from 'pg';
import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './env.mjs';

loadEnv();

export const BUCKET = 'assets'; // declared in neon.ts
const MAX_BODY = 400 * 1024; // screenshot is a small JPEG
const WEAPONS = new Set(['katana', 'daggers', 'hammer']);

/** keep strict TLS (current pg behaviour) explicitly, which also silences pg's sslmode deprecation warning */
export function pgUrl(u) {
  try {
    const url = new URL(u);
    const mode = url.searchParams.get('sslmode');
    if (!mode || mode === 'require' || mode === 'prefer' || mode === 'verify-ca') url.searchParams.set('sslmode', 'verify-full');
    return url.toString();
  } catch {
    return u;
  }
}

let pool = null;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  // long-running Node server → one pg pool reused across requests, on the pooled (-pooler) endpoint
  pool ??= new pg.Pool({ connectionString: pgUrl(process.env.DATABASE_URL), max: 5, idleTimeoutMillis: 30_000 });
  return pool;
}
let files = null;
function storage() {
  if (!process.env.AWS_ENDPOINT_URL_S3) throw new Error('object storage env vars are not set');
  files ??= new Files({ adapter: neon({ bucket: BUCKET, defaultUrlExpiresIn: 3600 }) });
  return files;
}

/** score formula (server-side only) */
export function computeScore(r) {
  const combat = r.kills * 10 + r.parries * 30 + r.perfects * 25 + r.executions * 120 + r.bestRank * 150 + Math.min(r.maxCombo, 200) * 5;
  if (r.mode === 'endless') {
    // rounds dominate; later rounds are worth more
    const rounds = r.stage * 1200 + r.stage * r.stage * 25;
    return Math.round((rounds + combat) * (r.hard ? 1.5 : 1));
  }
  const winBonus = r.won ? 5000 + Math.max(0, 1800 - r.time) * 3 : 0;
  return Math.round((r.stage * 1000 + combat + winBonus) * (r.hard ? 1.5 : 1));
}

// --- tiny per-IP rate limit for submissions
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 6;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const int = (v, lo, hi) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < lo || n > hi) throw Object.assign(new Error('invalid number'), { status: 400 });
  return n;
};

function validate(b) {
  const name = String(b.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  if (!name) throw Object.assign(new Error('name is required'), { status: 400 });
  if (!WEAPONS.has(b.weapon)) throw Object.assign(new Error('invalid weapon'), { status: 400 });
  const mode = b.mode === 'endless' ? 'endless' : 'campaign';
  return {
    name,
    mode,
    stage: int(b.stage, 0, mode === 'endless' ? 100000 : 10),
    won: mode === 'campaign' && !!b.won,
    hard: !!b.hard,
    weapon: b.weapon,
    time: Math.max(0, Math.min(36000, Number(b.time) || 0)),
    kills: int(b.kills ?? 0, 0, 100000),
    parries: int(b.parries ?? 0, 0, 100000),
    perfects: int(b.perfects ?? 0, 0, 100000),
    executions: int(b.executions ?? 0, 0, 100000),
    maxCombo: int(b.maxCombo ?? 0, 0, 100000),
    bestRank: int(b.bestRank ?? 0, 0, 6),
  };
}

async function withShotUrls(rows) {
  const st = process.env.AWS_ENDPOINT_URL_S3 ? storage() : null;
  return Promise.all(rows.map(async (r) => ({
    id: r.id, name: r.name, mode: r.mode, score: r.score, stage: r.stage, won: r.won, hard: r.hard, weapon: r.weapon,
    time: r.time_s, kills: r.kills, parries: r.parries, bestRank: r.best_rank, createdAt: r.created_at,
    shotUrl: st && r.shot_key ? await st.url(r.shot_key).catch(() => null) : null,
  })));
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;

  if (route === 'GET /api/health') {
    const out = { postgres: 'unknown', storage: 'unknown' };
    try {
      const r = await db().query('SELECT count(*)::int AS runs FROM runs');
      out.postgres = `ok (${r.rows[0].runs} runs)`;
    } catch (e) {
      out.postgres = 'error: ' + e.message;
    }
    try {
      const key = `health/${randomUUID()}.txt`;
      await storage().upload(key, 'ok', { contentType: 'text/plain' });
      const back = await (await storage().download(key)).text();
      await storage().delete(key);
      out.storage = back === 'ok' ? 'ok (write/read/delete)' : 'error: read mismatch';
    } catch (e) {
      out.storage = 'error: ' + e.message;
    }
    return send(res, out.postgres.startsWith('ok') && out.storage.startsWith('ok') ? 200 : 503, out);
  }

  if (route === 'GET /api/leaderboard') {
    const hard = url.searchParams.get('hard') === '1';
    const mode = url.searchParams.get('mode') === 'endless' ? 'endless' : 'campaign';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const r = await db().query(
      `SELECT id, name, mode, score, stage, won, hard, weapon, time_s, kills, parries, best_rank, shot_key, created_at
         FROM runs WHERE mode = $1 AND hard = $2 ORDER BY score DESC, created_at ASC LIMIT $3`,
      [mode, hard, limit],
    );
    return send(res, 200, { entries: await withShotUrls(r.rows) });
  }

  if (route === 'POST /api/scores') {
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '?').split(',')[0].trim();
    if (limited(ip)) return send(res, 429, { error: 'too many submissions, try again in a minute' });
    const body = await readJson(req);
    const run = validate(body);
    const score = computeScore(run);
    const id = randomUUID();
    // screenshot → object storage first; the row stores only the key
    let shotKey = null;
    const m = typeof body.shot === 'string' && body.shot.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (m) {
      const bytes = Buffer.from(m[1], 'base64');
      if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        shotKey = `runs/${id}.jpg`;
        await storage().upload(shotKey, bytes, { contentType: 'image/jpeg' });
      }
    }
    await db().query(
      `INSERT INTO runs (id, name, mode, score, stage, won, hard, weapon, time_s, kills, parries, perfects, executions, max_combo, best_rank, shot_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id, run.name, run.mode, score, run.stage, run.won, run.hard, run.weapon, run.time, run.kills, run.parries, run.perfects, run.executions, run.maxCombo, run.bestRank, shotKey],
    );
    const rank = await db().query('SELECT count(*)::int + 1 AS rank FROM runs WHERE mode = $1 AND hard = $2 AND score > $3', [run.mode, run.hard, score]);
    return send(res, 201, { id, score, rank: rank.rows[0].rank, shotKey });
  }

  return send(res, 404, { error: 'not found' });
}

/** Connect-style middleware: handles /api/*, passes everything else on */
export function apiMiddleware(req, res, next) {
  if (!req.url?.startsWith('/api/')) return next?.();
  handle(req, res).catch((e) => {
    const status = e.status ?? 500;
    if (status >= 500) console.error('[api]', e);
    send(res, status, { error: status >= 500 ? 'server error' : e.message });
  });
}
