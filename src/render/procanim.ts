/**
 * Procedural animation for still sprites: breathing, stride bob, wind-up tremble, attack snap, dash stretch,
 * hit squash, stagger wobble and spawn pop. Applied as a transform on top of the sprite, so a single
 * still image per state already feels alive. Real multi-frame sheets get a milder version.
 */
import { clamp, easeOutBack } from '../core/math';

export interface Pose {
  sx: number; // scale along facing (forward)
  sy: number; // scale across facing
  rot: number; // extra rotation (radians)
  ox: number; // offset along facing (world units)
  oy: number; // offset across facing
}

export interface PoseInput {
  state: string; // idle | move | windup | attack | dash | guard | charge | hurt | stagger | death
  t: number; // seconds since this state started
  time: number; // global clock + per-entity seed (desyncs crowds)
  speed: number; // current speed (units/s)
  hit: number; // hit flash 0..~0.15
  age: number; // seconds since spawn
  dir?: number; // swing direction ±1
  phase?: 'startup' | 'active' | 'recovery'; // attack phase when known
  phaseK?: number; // 0..1 progress inside that phase
  tele?: number; // remaining telegraph seconds (wind-up intensity)
  heavy?: boolean; // big/slow body: calmer, weightier motion
  intensity?: number; // 0..1 overall strength
}

const IDENT: Pose = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0 };

export function pose(i: PoseInput): Pose {
  const k = i.intensity ?? 1;
  if (k <= 0) return IDENT;
  const w = i.heavy ? 0.55 : 1; // heavy bodies move slower
  const p: Pose = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0 };
  const T = i.time;
  switch (i.state) {
    case 'idle': {
      const b = Math.sin(T * 2.4 * w);
      p.sy = 1 + 0.03 * b;
      p.sx = 1 - 0.018 * b;
      p.rot = 0.035 * Math.sin(T * 1.1 * w + 1);
      break;
    }
    case 'move': {
      const f = clamp(i.speed / 260, 0.4, 1.3);
      const s = T * 13 * w * f;
      p.sx = 1 + 0.05 * Math.abs(Math.sin(s));
      p.sy = 1 - 0.03 * Math.abs(Math.sin(s));
      p.rot = 0.075 * Math.sin(s) * w;
      p.oy = 1.6 * Math.sin(s) * w;
      p.ox = 1.5;
      break;
    }
    case 'windup': {
      // coil back and tremble harder as the telegraph runs out
      const urgency = i.tele !== undefined ? clamp(1 - i.tele / 0.6, 0, 1) : clamp(i.t / 0.4, 0, 1);
      p.sx = 0.9 - 0.05 * urgency;
      p.sy = 1.05 + 0.04 * urgency;
      p.ox = -3 * (0.4 + urgency) * w;
      p.rot = (0.02 + 0.05 * urgency) * Math.sin(T * 46);
      break;
    }
    case 'attack': {
      const d = i.dir ?? 1;
      if (i.phase === 'startup') {
        const u = i.phaseK ?? 0;
        p.rot = -d * 0.28 * u;
        p.sx = 1 - 0.08 * u;
        p.ox = -2 * u;
      } else if (i.phase === 'active') {
        const u = i.phaseK ?? 0;
        p.rot = d * (-0.28 + 0.5 * u);
        p.sx = 1.16;
        p.sy = 0.9;
        p.ox = 4;
      } else if (i.phase === 'recovery') {
        const u = clamp(i.phaseK ?? 1, 0, 1);
        p.rot = d * 0.22 * (1 - u);
        p.sx = 1 + 0.1 * (1 - u);
        p.sy = 1 - 0.06 * (1 - u);
        p.ox = 4 * (1 - u);
      } else {
        // unknown phase (enemies): a quick lunge snap that settles
        const u = clamp(i.t / 0.28, 0, 1);
        const snap = Math.sin(Math.min(1, u * 1.6) * Math.PI);
        p.sx = 1 + 0.18 * snap;
        p.sy = 1 - 0.1 * snap;
        p.ox = 5 * snap * w;
        p.rot = 0.12 * snap * Math.sin(T * 3);
      }
      break;
    }
    case 'dash':
      p.sx = 1.32;
      p.sy = 0.78;
      p.ox = 3;
      break;
    case 'guard':
      p.sx = 0.92;
      p.sy = 1.04;
      p.ox = -1.5;
      p.rot = 0.02 * Math.sin(T * 9);
      break;
    case 'charge': {
      const u = clamp(i.t / 0.7, 0, 1);
      p.sx = 0.9 - 0.04 * u;
      p.sy = 1.04 + 0.04 * Math.sin(T * 20) * u;
      p.rot = 0.04 * u * Math.sin(T * 38);
      p.ox = -2;
      break;
    }
    case 'hurt':
      p.sx = 0.86;
      p.sy = 1.1;
      p.ox = -4;
      p.rot = 0.1 * Math.sin(T * 30);
      break;
    case 'stagger': {
      p.rot = 0.18 * Math.sin(T * 4.5);
      p.oy = 3 * Math.sin(T * 2.2);
      p.sy = 1 + 0.05 * Math.sin(T * 9);
      p.sx = 0.95;
      break;
    }
  }
  // hit squash (any state) — a quick punch that recovers
  if (i.hit > 0) {
    const h = clamp(i.hit / 0.15, 0, 1);
    p.sx *= 1 - 0.14 * h;
    p.sy *= 1 + 0.12 * h;
    p.ox -= 3 * h;
  }
  // spawn pop
  if (i.age < 0.35) {
    const s = easeOutBack(clamp(i.age / 0.35, 0, 1));
    p.sx *= s;
    p.sy *= s;
  }
  if (k < 1) {
    p.sx = 1 + (p.sx - 1) * k;
    p.sy = 1 + (p.sy - 1) * k;
    p.rot *= k;
    p.ox *= k;
    p.oy *= k;
  }
  return p;
}

/** offset a draw position by a pose, given the facing angle */
export function posed(x: number, y: number, facing: number, p: Pose) {
  const c = Math.cos(facing), s = Math.sin(facing);
  return { x: x + c * p.ox - s * p.oy, y: y + s * p.ox + c * p.oy, angle: facing + p.rot };
}
