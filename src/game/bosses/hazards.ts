/** Shared helpers for the Act II bosses: lingering ground hazards and telegraphed sky strikes. */
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { sprites } from '../../render/sprites';
import { W, strike, type Actor, type Strike } from '../world';
import { RED } from '../enemies';

/** lingering damage zone (poison / fire ground). Unblockable, ticks every 0.6s. */
export function hazard(owner: Actor | undefined, x: number, y: number, r: number, dur: number, dmg: number, color: string, vfx: string, tag = 'hazard'): Strike {
  const art = sprites.has(vfx);
  if (art) fx.anim(vfx, x, y, { w: r * 2.3, dur: dur + 0.6, loop: true, under: true, additive: true });
  return strike({
    team: 'enemy', owner, x, y, shape: { k: 'circle', r }, delay: 0.6, active: dur, rehit: 0.6, damage: dmg * W.scale.dmg * (W.hardMode ? 1.25 : 1),
    knock: 60, hitstop: 0, unblockable: true, parryable: false, color, tag, hideActive: art, stunTime: 0,
  });
}

/** red warning circle, then a lightning / meteor strike */
export function skyStrike(owner: Actor | undefined, x: number, y: number, r: number, delay: number, dmg: number, color = RED, vfx = 'vfx_lightning_strike'): Strike {
  return strike({
    team: 'enemy', owner, x, y, shape: { k: 'circle', r }, delay, active: 0.08, damage: dmg * W.scale.dmg * (W.hardMode ? 1.25 : 1),
    knock: 420, unblockable: true, parryable: false, color, tag: 'sky',
    onStart: () => {
      if (!fx.anim(vfx, x, y - r * 0.6, { w: r * 2.4 })) fx.bolt(x, y - 400, x, y, '#bfe9ff', 5, 0.25);
      fx.ring(x, y, 10, r * 1.2, 0.35, color, 6, true);
      sfx('thunder', 0.5);
      W.shake(0.2);
    },
  });
}
