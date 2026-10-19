/**
 * DAILY / WEEKLY CHALLENGES — everyone gets the same seed: same weapon, same modifiers, same waves and card offers.
 *  Daily  = Endless with 2 modifiers (score = rounds survived)
 *  Weekly = Act I campaign with 3 modifiers (score = stages / victory / time)
 * Content is re-seeded at the start of every stage and before every card roll, so what you see doesn't depend on
 * how the previous fight went.
 */
import { ALL_WEAPONS, type WeaponId } from './weapons';

export type ModId = 'glass' | 'focus_drought' | 'heavy_feet' | 'glass_cannon' | 'no_heal' | 'iron_boss' | 'elite_storm'
  | 'vampiric' | 'volatile' | 'swift' | 'armored' | 'frenzied';

export const MODS: Record<ModId, { name: string; desc: string; color: string }> = {
  glass: { name: 'GLASS BODY', desc: 'HP สูงสุดของเรา 60', color: '#ff4d6d' },
  focus_drought: { name: 'FOCUS DROUGHT', desc: 'ได้ Focus น้อยลง 40%', color: '#b98cff' },
  heavy_feet: { name: 'HEAVY FEET', desc: 'Dash ใช้ Stamina ×1.8', color: '#ffd24d' },
  glass_cannon: { name: 'GLASS CANNON', desc: 'ทั้งเราและศัตรูดาเมจ ×1.5', color: '#ff9a3c' },
  no_heal: { name: 'NO REST', desc: 'ผ่านด่านไม่ฟื้น HP', color: '#ff2d4a' },
  iron_boss: { name: 'IRON BOSSES', desc: 'บอส HP +30%', color: '#8fa8ff' },
  elite_storm: { name: 'ELITE STORM', desc: 'ศัตรูเป็น Elite บ่อยขึ้นมาก (+30%)', color: '#ffe14d' },
  vampiric: { name: 'VAMPIRIC', desc: 'ศัตรูที่ตีโดนเราฟื้น HP', color: '#ff4d6d' },
  volatile: { name: 'VOLATILE', desc: 'ศัตรูตายแล้วระเบิด', color: '#ff2d4a' },
  swift: { name: 'SWIFT', desc: 'ศัตรูเร็วขึ้น 20%', color: '#7dfff0' },
  armored: { name: 'ARMORED', desc: 'ศัตรูรับดาเมจน้อยลง 20%', color: '#8fa8ff' },
  frenzied: { name: 'FRENZIED', desc: 'บอสพักสั้นลงเกือบครึ่ง', color: '#ff4dcf' },
};
/** modifiers that are the existing endless affixes */
export const AFFIX_MODS: ModId[] = ['vampiric', 'volatile', 'swift', 'armored', 'frenzied'];

export interface Challenge {
  kind: 'daily' | 'weekly';
  /** leaderboard key, e.g. D2026-10-19 / W2026-43 */
  key: string;
  seed: number;
  mods: ModId[];
  weapon: WeaponId;
  title: string;
}

/** string → 32-bit seed */
export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** small fast PRNG */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: T[], n: number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function make(kind: 'daily' | 'weekly', key: string): Challenge {
  const seed = hashStr(key);
  const rng = mulberry32(seed);
  const mods = pick(rng, Object.keys(MODS) as ModId[], kind === 'daily' ? 2 : 3);
  const weapon = pick(rng, ALL_WEAPONS, 1)[0];
  return { kind, key, seed, mods, weapon, title: kind === 'daily' ? 'DAILY RIFT' : 'WEEKLY GAUNTLET' };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** today's challenge (UTC date, same for everyone) */
export function daily(now = new Date()): Challenge {
  return make('daily', `D${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`);
}
/** this week's challenge (ISO week, UTC) */
export function weekly(now = new Date()): Challenge {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return make('weekly', `W${d.getUTCFullYear()}-${pad(week)}`);
}
/** time left until the challenge rotates */
export function timeLeft(kind: 'daily' | 'weekly', now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (kind === 'weekly') end.setUTCDate(end.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7));
  const s = Math.max(0, (end.getTime() - now.getTime()) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

// ---------------------------------------------------------------- local bests
const BEST_KEY = 'neonduel.challenge.best.v1';
export function bestOf(key: string): number {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')[key] ?? 0;
  } catch {
    return 0;
  }
}
export function recordBest(key: string, score: number) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
    if ((all[key] ?? 0) < score) all[key] = score;
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- seeded randomness during a challenge
const nativeRandom = Math.random;
/** re-seed Math.random for a deterministic slice of content */
export function seedRandom(seed: number, ...parts: (string | number)[]) {
  Math.random = mulberry32(hashStr(seed + ':' + parts.join(':')));
}
export function restoreRandom() {
  Math.random = nativeRandom;
}
