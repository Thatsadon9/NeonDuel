/**
 * FRONT GUARD indicator — one shared, loud visual for "this side is protected, go around".
 * A glowing fan covering the exact blocking angle + a thick rim + a shield badge at the front.
 * Plain arcs / fills only (no gradients or dashes) so it survives the online draw-list recorder.
 */
import { fx } from './fx';
import { W } from '../game/world';

export const GUARD_COL = '#7fd4ff';
const GUARD_HIT = '#ffffff';

/** last time each actor blocked something (rim flash) */
const lastBlock = new WeakMap<object, number>();
let hintsLeft = 3;

/**
 * call from preHit / damageTakenMul when the front stopped (or soaked) a hit.
 * `full` = fully blocked (BLOCKED text) vs. soaked by armor (ARMOR text).
 */
export function guardHit(a: { x: number; y: number; r: number }, full = true, label = full ? 'BLOCKED' : 'ARMOR') {
  const t = lastBlock.get(a) ?? -9;
  lastBlock.set(a, W.time);
  if (W.time - t < 0.25) return; // don't spam text on multi-hits
  fx.text(a.x, a.y - a.r - 18, label, full ? GUARD_COL : '#a9c4ff', full ? 22 : 16);
  if (full && hintsLeft > 0) {
    hintsLeft--;
    fx.text(a.x, a.y - a.r - 40, '↻ อ้อมไปตีด้านหลัง!', '#ffe14d', 16);
  }
}

export interface GuardOpts {
  /** half-angle of the protected cone (rad) — must match the preHit check */
  arc: number;
  /** 0..1 remaining guard (e.g. Bulwark shield HP) → rim thickness / cracks */
  hp?: number;
  /** false = damage reduction only (dimmer, no badge) */
  full?: boolean;
  color?: string;
  /** how far the fan reaches past the body */
  reach?: number;
  angle?: number;
}

export function drawFrontGuard(ctx: CanvasRenderingContext2D, a: { x: number; y: number; r: number; facing: number }, o: GuardOpts) {
  const full = o.full ?? true;
  const hp = Math.max(0, Math.min(1, o.hp ?? 1));
  const f = o.angle ?? a.facing;
  const col = o.color ?? GUARD_COL;
  const r0 = a.r + 2;
  const r1 = a.r + (o.reach ?? Math.max(22, a.r * 0.9));
  const since = W.time - (lastBlock.get(a) ?? -9);
  const flash = Math.max(0, 1 - since / 0.22);
  const pulse = 0.5 + 0.5 * Math.sin(W.time * 5 + a.x * 0.01);
  const k = full ? 1 : 0.6;
  const lo = f - o.arc, hi = f + o.arc;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // fan (stacked bands fake a soft outward glow)
  ctx.fillStyle = col;
  for (let i = 0; i < 3; i++) {
    const ra = r0 + ((r1 - r0) * i) / 3, rb = r0 + ((r1 - r0) * (i + 1)) / 3;
    ctx.globalAlpha = (0.05 + 0.05 * i + 0.04 * pulse + 0.25 * flash) * k;
    ctx.beginPath();
    ctx.arc(a.x, a.y, rb, lo, hi);
    ctx.arc(a.x, a.y, ra, hi, lo, true);
    ctx.closePath();
    ctx.fill();
  }
  // edge spokes so the exact cone is readable
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.globalAlpha = (0.45 + 0.3 * pulse) * k;
  ctx.beginPath();
  for (const e of [lo, hi]) {
    ctx.moveTo(a.x + Math.cos(e) * r0, a.y + Math.sin(e) * r0);
    ctx.lineTo(a.x + Math.cos(e) * r1, a.y + Math.sin(e) * r1);
  }
  ctx.stroke();
  // thick rim: glow pass + core pass
  const w = (full ? 8 : 5) * (0.55 + 0.45 * hp);
  ctx.strokeStyle = flash > 0 ? GUARD_HIT : col;
  ctx.globalAlpha = (0.3 + 0.3 * flash) * k;
  ctx.lineWidth = w * 2.6;
  ctx.beginPath();
  ctx.arc(a.x, a.y, r1, lo, hi);
  ctx.stroke();
  ctx.globalAlpha = Math.min(1, (0.75 + 0.25 * pulse + flash) * k);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(a.x, a.y, r1, lo, hi);
  ctx.stroke();
  // cracks as the guard weakens
  if (hp < 0.99) {
    ctx.strokeStyle = '#0a1020';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    const n = Math.ceil((1 - hp) * 5);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = lo + ((i + 0.5) / 5) * (hi - lo) + Math.sin(i * 7.3) * 0.08;
      ctx.moveTo(a.x + Math.cos(t) * (r1 - w), a.y + Math.sin(t) * (r1 - w));
      ctx.lineTo(a.x + Math.cos(t + 0.05) * (r1 + w), a.y + Math.sin(t + 0.05) * (r1 + w));
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
  }
  // shield badge at the front
  if (full) {
    const bx = a.x + Math.cos(f) * (r1 + 13), by = a.y + Math.sin(f) * (r1 + 13);
    const s = 8 + flash * 3;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#081426';
    ctx.strokeStyle = flash > 0 ? GUARD_HIT : col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - s, by - s);
    ctx.lineTo(bx + s, by - s);
    ctx.lineTo(bx + s, by + s * 0.1);
    ctx.quadraticCurveTo(bx + s * 0.8, by + s * 0.9, bx, by + s * 1.35);
    ctx.quadraticCurveTo(bx - s * 0.8, by + s * 0.9, bx - s, by + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by - s * 0.55);
    ctx.lineTo(bx, by + s * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}
