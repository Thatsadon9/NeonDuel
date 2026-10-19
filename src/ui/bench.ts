/**
 * BALANCE BENCH (Debug Mode): a simple bot fights every boss with a chosen weapon / tier and reports
 * time-to-kill, damage taken and skills used. The bot walks in, attacks, and casts skills as soon as it can —
 * it never parries or dodges on purpose, so real players with good timing will be faster and safer.
 */
import { W } from '../game/world';
import { run, type BossId } from '../game/run';
import { input } from '../core/input';
import { MergedControls } from '../core/controls';
import type { WeaponId } from '../game/weapons';
import type { PathId, Tier } from '../game/ascension';
import { TIER_REQ } from '../game/ascension';

const STEP = 1 / 60;
/** campaign stage index of each boss */
const BOSS_STAGE: [BossId, number][] = [
  ['vanguard', 1], ['hex', 3], ['twins', 5], ['colossus', 7], ['mirror', 9],
  ['nyxara', 11], ['tempus', 13], ['voltaris', 15], ['kagutsuchi', 17], ['hollow', 19],
];
export interface BenchRow { boss: BossId; killed: boolean; secs: number; taken: number; casts: number; perfects: number }

type Inp = { held: Map<string, number>; down(a: string): void; up(a: string): void };

export async function runBench(o: { weapon: WeaponId; tier: Tier; path: PathId; maxSecs?: number; onRow?: (r: BenchRow) => void }): Promise<BenchRow[]> {
  const I = input as unknown as Inp;
  const rows: BenchRow[] = [];
  const keep = { god: W.god, cheats: { ...W.cheats } };
  W.god = false;
  Object.assign(W.cheats, { oneHit: false, infFocus: false, infDash: false, freeze: false, timeScale: 1 });
  const rel = () => {
    for (const a of ['up', 'down', 'left', 'right', 'attack', 'skill1', 'skill2', 'ult', 'dash']) while (I.held.has(a)) I.up(a);
  };
  for (const [boss, stage] of BOSS_STAGE) {
    run.start(o.weapon, false, stage, stage >= 10 ? 'act2' : 'campaign', { slots: [{ ctl: new MergedControls(), weapon: o.weapon }] });
    W.cheated = true;
    const p = W.player;
    p.prog[o.weapon] = { res: TIER_REQ[o.tier], tier: o.tier, path: o.tier >= 3 ? o.path : null };
    p.maxHp = p.hp = p.ghostHp = 1e5; // measure damage taken instead of dying
    const t0 = W.stats.time, perf0 = W.stats.perfects;
    const used = () => Object.values(W.stats.skillUse).reduce((a, b) => a + b, 0);
    const casts0 = used();
    const max = (o.maxSecs ?? 240) * 60;
    for (let f = 0; f < max; f++) {
      const ph = run.phase;
      if (ph === 'bossDeath' || ph === 'clear' || ph === 'upgrade' || ph === 'victory') break;
      const e = W.nearestEnemy(p.x, p.y, Infinity);
      p.aimPoint = () => (e ? { x: e.x, y: e.y } : { x: p.x, y: p.y - 100 });
      rel();
      if (e && ph === 'fight') {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > e.r + 60) {
          if (dx > 20) I.down('right');
          if (dx < -20) I.down('left');
          if (dy > 20) I.down('down');
          if (dy < -20) I.down('up');
        }
        if (d < e.r + 110 && f % 8 === 0) I.down('attack');
        // Hollow King phase III: dash across the void between islands instead of walking off the edge
        if ((e as unknown as { stage?: number }).stage === 3 && d > 150 && p.dashCharges >= 1 && f % 20 === 0) I.down('dash');
        if (f % 6 === 0) {
          const fo = p.focus;
          if (p.skillR() && fo >= 100 && p.cdR <= 0) I.down('ult');
          else if (p.skillE() && fo >= p.costOf('e') && p.cdE <= 0) I.down('skill2');
          else if (p.skillQ() && fo >= p.costOf('q') && p.cdQ <= 0) I.down('skill1');
        }
      }
      run.tick(STEP);
      input.endFrame();
      if (f % 600 === 0) await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
    }
    rel();
    const b = W.enemies.find((x) => x.isBoss);
    const row: BenchRow = { boss, killed: !!b && W.enemies.filter((x) => x.isBoss).every((x) => x.dead), secs: Math.round((W.stats.time - t0) * 10) / 10, taken: Math.round(1e5 - p.hp), casts: used() - casts0, perfects: W.stats.perfects - perf0 };
    rows.push(row);
    o.onRow?.(row);
  }
  W.god = keep.god;
  Object.assign(W.cheats, keep.cheats);
  run.toTitle();
  return rows;
}
