/**
 * ELITE minions (Act II / Endless round 10+): HP ×3, crown + aura, ×4 Resonance (via player.onKill), Echo Shards,
 * and one random trait. See docs/UPDATE_ASCENSION.md §5.
 */
import { TAU, rand } from '../core/math';
import { fx } from '../render/fx';
import { sprites } from '../render/sprites';
import { W, type Actor } from './world';
import type { Enemy } from './enemies';
import { Swarmling } from './enemies2';
import type { GameMode } from './run';

export const ELITE_TRAITS: Record<string, { name: string; color: string }> = {
  shielded: { name: 'SHIELDED', color: '#b98cff' },
  hasted: { name: 'HASTED', color: '#7dfff0' },
  splitting: { name: 'SPLITTING', color: '#7dff4d' },
  juggernaut: { name: 'JUGGERNAUT', color: '#ff4d4d' },
  warded: { name: 'WARDED', color: '#ffe14d' },
};

export function eliteChance(mode: GameMode, round: number) {
  if (mode === 'act2') return 0.12;
  if (mode === 'endless' && round >= 10) return Math.min(0.2, 0.08 + (round - 10) * 0.004);
  return 0;
}

export function makeElite(e: Enemy, trait?: string) {
  if (e instanceof Swarmling) return; // flocks stay fodder
  const ids = Object.keys(ELITE_TRAITS);
  const t = trait ?? ids[Math.floor(Math.random() * ids.length)];
  e.elite = t;
  e.hp = e.maxHp = Math.round(e.maxHp * 3);
  e.r = Math.round(e.r * 1.15);
  switch (t) {
    case 'shielded': e.ward = e.maxHp * 0.5; break;
    case 'hasted': e.speedMul *= 1.4; break;
    case 'juggernaut': e.unstoppable = true; e.kbResist = Math.max(e.kbResist, 0.8); break;
    case 'warded': e.skillImmune = true; break;
    case 'splitting': {
      const base = e.onDeath.bind(e);
      e.onDeath = () => {
        base();
        const Ctor = e.constructor as new (x: number, y: number) => Enemy;
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU);
          const c = new Ctor(e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26);
          c.hp = c.maxHp = Math.round(c.maxHp * W.scale.hp * 0.6);
          c.r = Math.round(c.r * 0.8);
          c.vx = Math.cos(a) * 320;
          c.vy = Math.sin(a) * 320;
          W.enemies.push(c);
        }
        fx.burst(e.x, e.y, 20, 260, '#7dff4d', 0.5, 3);
      };
      break;
    }
  }
}

/** crown, aura and ward bubble over every enemy — drawn by the run after actors */
export function drawEliteMarks(ctx: CanvasRenderingContext2D, list: Actor[]) {
  for (const e of list) {
    if (e.dead) continue;
    if (e.ward > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#b98cff';
      ctx.globalAlpha = 0.35 + Math.min(0.4, e.ward / e.maxHp);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 9, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha *= 0.25;
      ctx.fillStyle = '#b98cff';
      ctx.fill();
      ctx.restore();
    }
    if (!e.elite) continue;
    const col = ELITE_TRAITS[e.elite]?.color ?? '#ffe14d';
    if (!sprites.draw(ctx, 'vfx_elite_aura', e.x, e.y, { w: e.r * 4.2, additive: true, tint: col, alpha: 0.75, t: W.time + e.x * 0.01, loop: true })) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.5 + Math.sin(W.time * 8) * 0.2;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 14, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const cy = e.y - e.r - 22 + Math.sin(W.time * 3 + e.x) * 3;
    if (!sprites.draw(ctx, 'icon_elite_crown', e.x, cy, { w: 30 })) {
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♛', e.x, cy + 5);
    }
  }
}
