/** Shared game world: entity lists, time control (hit-stop / slow-mo), screen effects, combat resolution. */
import { TAU, angleTo, dist, segDist, angleDiff, clamp, rand, chance } from '../core/math';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { sfx } from '../audio/audio';
import { sprites } from '../render/sprites';
import type { Player } from './player';
import { T } from './tuning';
import { access, teleCol } from '../core/access';

export type Team = 'player' | 'enemy';

export interface HitInfo {
  damage: number;
  posture: number;
  knock: number;
  angle: number; // knockback direction
  hitstop: number;
  unblockable: boolean;
  parryable: boolean;
  sx: number; // source position (for facing checks)
  sy: number;
  kind: 'melee' | 'proj' | 'aoe';
  tag: string;
  crit?: boolean;
  skill?: boolean;
  stunTime?: number;
  strike?: Strike;
  proj?: Projectile;
  attacker?: Actor;
  color?: string;
}
export type HitResult = 'hit' | 'block' | 'parry' | 'dodge' | 'immune' | 'shield';

let nidSeq = 0;
/** duck-typed Player check (world.ts can't import Player at runtime) */
export const isPlayer = (a: unknown): a is Player => !!a && (a as { isPlayer?: boolean }).isPlayer === true;

// ---------------------------------------------------------------- Actor
export abstract class Actor {
  x = 0; y = 0; vx = 0; vy = 0; r = 18;
  hp = 100; maxHp = 100;
  team: Team = 'enemy';
  dead = false;
  facing = 0;
  hitFlash = 0;
  stun = 0;
  invuln = 0;
  kbResist = 0;
  isBoss = false;
  name = '';
  color = '#ff5050';
  posture = 0;
  maxPosture = 0;
  staggered = 0;
  postureRegenDelay = 0;
  bleed = 0;
  bleedTick = 0;
  solid = true;
  /** time since spawn */
  age = 0;
  /** damage-absorbing barrier (Acolyte link, Shielded elite) — posture damage chips it twice as fast */
  ward = 0;
  /** never flinches (Brute, Juggernaut elite) */
  unstoppable = false;
  /** immune to skill damage (Warded elite) */
  skillImmune = false;
  /** elite trait id, if this minion is an Elite */
  elite = '';
  /** network id (online replication) */
  nid = ++nidSeq;
  /** who hit this actor last (kill credit) */
  lastHitBy: Actor | null = null;

  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;

  /** override to intercept (e.g. shields). return a result to stop normal damage. */
  preHit(_h: HitInfo): HitResult | null {
    return null;
  }
  damageTakenMul(_h: HitInfo) {
    return 1;
  }
  postureTakenMul(_h: HitInfo) {
    return 1;
  }
  onPostureBreak() {}
  /** visual-only death hook (sprite death animation) */
  onKilledVisual() {}
  /** called when the player parries one of this actor's attacks */
  onParried(_by: Actor) {
    if (this.maxPosture > 0) this.addPosture(this.maxPosture * 0.22);
    else this.stun = Math.max(this.stun, 1.1);
  }
  addPosture(v: number) {
    if (this.maxPosture <= 0 || this.staggered > 0 || this.dead) return;
    this.posture += v;
    this.postureRegenDelay = 1.6;
    if (this.posture >= this.maxPosture) {
      this.posture = this.maxPosture;
      this.staggered = 2.6;
      this.onPostureBreak();
      W.onStagger(this);
    }
  }
  onDeath() {}

  onHit(h: HitInfo): HitResult {
    if (this.dead) return 'immune';
    if (this.invuln > 0) return 'immune';
    const pre = this.preHit(h);
    if (pre) return pre;
    const p = isPlayer(h.attacker) ? h.attacker : W.player;
    if (h.attacker) this.lastHitBy = h.attacker;
    if (this.skillImmune && h.skill && h.tag !== 'execute') {
      fx.text(this.x, this.y - this.r - 10, 'WARDED', '#b98cff', 14);
      sfx('clank', 0.4);
      return 'immune';
    }
    let dmg = h.damage * this.damageTakenMul(h);
    if (W.cheats.oneHit && this.team === 'enemy' && isPlayer(h.attacker ?? h.strike?.by ?? h.proj?.by)) dmg = this.hp + this.ward + 1;
    if (this.team === 'enemy' && W.hasAffix('armored')) dmg *= 0.8;
    if (this.staggered > 0) dmg *= 1.5 * p.mods.execMul;
    if (h.strike?.backstab && Math.abs(angleDiff(this.facing, angleTo(this.x, this.y, h.sx, h.sy))) > 1.9) {
      dmg *= 1.6;
      fx.text(this.x, this.y - this.r - 34, 'BACKSTAB', '#ff4d8a', 16);
    }
    if (this.ward > 0) {
      const absorbed = Math.min(this.ward, dmg + h.posture);
      this.ward -= absorbed;
      dmg = Math.max(0, dmg - absorbed);
      fx.sparks(this.x, this.y, h.angle + Math.PI, 0.8, 6, 300, '#b98cff', 0.25);
      if (this.ward <= 0) {
        fx.text(this.x, this.y - this.r - 30, 'WARD BREAK', '#b98cff', 15);
        fx.ring(this.x, this.y, this.r, this.r * 3, 0.35, '#b98cff', 5);
        sfx('guardBreak', 0.5);
      }
    }
    this.hp -= dmg;
    if (W.eclipseT > 0 && this.team === 'enemy') (this as any).eclipseDmg = ((this as any).eclipseDmg ?? 0) + dmg;
    this.hitFlash = 0.12;
    this.addPosture(h.posture * this.postureTakenMul(h));
    const kb = h.knock * (1 - this.kbResist);
    this.vx += Math.cos(h.angle) * kb;
    this.vy += Math.sin(h.angle) * kb;
    if (!this.isBoss && !this.unstoppable) this.stun = Math.max(this.stun, (h.stunTime ?? 0.22) * (1 - this.kbResist * 0.7));
    // feedback
    fx.damage(this.x, this.y - this.r - 8, dmg, !!h.crit, this.nid ?? 0);
    fx.sparks(this.x, this.y, h.angle, 0.9, h.crit ? 16 : 9, 520, h.color ?? '#9ff7ff', 0.3, 2.2);
    fx.burst(this.x, this.y, 4, 160, this.color, 0.35, 3);
    fx.anim(h.crit ? 'vfx_hit_crit' : 'vfx_hit', this.x - Math.cos(h.angle) * this.r * 0.5, this.y - Math.sin(h.angle) * this.r * 0.5, { angle: h.angle, tint: h.color });
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.onDeath();
      W.onKill(this);
    }
    return 'hit';
  }

  tickCommon(dt: number) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.staggered > 0) {
      this.staggered -= dt;
      if (this.staggered <= 0) {
        this.staggered = 0;
        this.posture = this.maxPosture * 0.2;
      }
    } else if (this.maxPosture > 0) {
      this.postureRegenDelay -= dt;
      if (this.postureRegenDelay <= 0) this.posture = Math.max(0, this.posture - this.maxPosture * 0.09 * dt);
    }
    if (this.bleed > 0) {
      this.bleedTick -= dt;
      if (this.bleedTick <= 0) {
        this.bleedTick = 0.5;
        const d = 2 + this.bleed * 1.2;
        this.hp -= d;
        fx.text(this.x, this.y - this.r, String(Math.round(d)), '#ff4d8a', 13);
        fx.burst(this.x, this.y, 3, 80, '#ff2e6d', 0.4, 2);
        this.bleed = Math.max(0, this.bleed - 0.5);
        if (this.hp <= 0 && !this.dead) {
          this.hp = 0;
          this.dead = true;
          this.onDeath();
          W.onKill(this);
        }
      }
    }
  }

  /** integrate velocity with friction, keep inside arena and out of obstacles */
  move(dt: number, friction = 10) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const k = Math.exp(-friction * dt);
    this.vx *= k;
    this.vy *= k;
    W.confine(this);
  }
}

// ---------------------------------------------------------------- Strikes (hitboxes / AoE / telegraphs)
export type Shape =
  | { k: 'sector'; r: number; arc: number; angle: number }
  | { k: 'circle'; r: number }
  | { k: 'ring'; r: number; w: number }
  | { k: 'line'; angle: number; len: number; w: number };

export interface Strike {
  team: Team;
  owner?: Actor;
  x: number;
  y: number;
  shape: Shape;
  follow?: boolean;
  delay: number; // telegraph time remaining
  tele: number; // total telegraph time (for drawing)
  active: number; // active time remaining
  damage: number;
  posture: number;
  knock: number;
  hitstop: number;
  unblockable: boolean;
  parryable: boolean;
  tag: string;
  color: string;
  hits: Set<Actor>;
  rehit?: number;
  hitTimes?: Map<Actor, number>;
  started?: boolean;
  dead?: boolean;
  skill?: boolean;
  crit?: number; // crit chance
  stunTime?: number;
  hideTele?: boolean;
  hideActive?: boolean;
  breaksPillars?: boolean;
  noHit?: boolean; // telegraph only
  /** online clients: radius the parry timing ring closes onto (0 = no ring) */
  ring?: number;
  backstab?: boolean;
  /** the player credited for this hitbox (defaults to whoever was acting when it was created) */
  by?: Actor;
  onStart?: (s: Strike) => void;
  onUpdate?: (s: Strike, dt: number) => void;
  onHit?: (target: Actor, s: Strike, res: HitResult) => void;
  onEnd?: (s: Strike) => void;
}

export function strike(o: Partial<Strike> & Pick<Strike, 'team' | 'x' | 'y' | 'shape'>): Strike {
  const s: Strike = {
    delay: 0, tele: o.delay ?? 0, active: 0.08, damage: 10, posture: 10, knock: 200, hitstop: 0.05,
    unblockable: false, parryable: true, tag: 'atk', color: o.team === 'player' ? '#7ff6ff' : '#ff9a3c',
    hits: new Set(), ...o,
  };
  if (s.team === 'player' && !s.by) s.by = isPlayer(s.owner) ? s.owner : W.actor ?? undefined;
  s.tele = s.delay;
  W.strikes.push(s);
  return s;
}

// ---------------------------------------------------------------- Projectiles
export interface Projectile {
  x: number; y: number; vx: number; vy: number; r: number;
  team: Team;
  damage: number;
  posture: number;
  life: number;
  color: string;
  parryable: boolean;
  unblockable: boolean;
  knock: number;
  owner?: Actor;
  homing?: number;
  target?: Actor;
  accel?: number;
  maxSpeed?: number;
  pierce?: number;
  hitSet?: Set<Actor>;
  reflected?: boolean;
  kind: 'orb' | 'knife' | 'bolt' | 'wave' | 'mine' | 'missile' | 'arrow' | 'hook';
  trail: number[];
  dead?: boolean;
  tag?: string;
  skill?: boolean;
  delay?: number; // dormant time before moving
  spin?: number;
  onUpdate?: (p: Projectile, dt: number) => void;
  onHit?: (p: Projectile, target: Actor) => void;
  onDeath?: (p: Projectile) => void;
  noObstacle?: boolean;
  by?: Actor;
  harmless?: boolean; // never collides with actors (mines, orbit visuals)
}

export function shoot(o: Partial<Projectile> & Pick<Projectile, 'x' | 'y' | 'vx' | 'vy' | 'team'>): Projectile {
  const p: Projectile = {
    r: 7, damage: 10, posture: 6, life: 5, color: o.team === 'player' ? '#7ff6ff' : '#c25bff',
    parryable: false, unblockable: false, knock: 120, kind: 'orb', trail: [], ...o,
  };
  if (p.team === 'player' && !p.by) p.by = isPlayer(p.owner) ? p.owner : W.actor ?? undefined;
  W.projs.push(p);
  return p;
}

export interface Obstacle {
  x: number; y: number; r: number; hp: number; maxHp: number; flash: number; dead?: boolean;
}

// ---------------------------------------------------------------- World
export interface RunStats {
  kills: number; parries: number; perfects: number; maxCombo: number; hitsTaken: number;
  time: number; bestRank: number; executions: number; skillUse: Record<string, number>;
}

export const W = {
  time: 0,
  hitstop: 0,
  slowScale: 1,
  slowTime: 0,
  arenaR: 560,
  arenaTargetR: 560,
  /** the local / primary player (camera, HUD) */
  player: null as unknown as Player,
  /** every fighter in the match (co-op or PVP) */
  players: [] as Player[],
  /** player currently being updated — new player hitboxes are credited to them */
  actor: null as Player | null,
  /** PVP: players' attacks hit players of other squads */
  pvp: false,
  /** PVP damage scale (player → player) */
  pvpDmg: 0.45,
  /** PVP scoreboard (read by the HUD) */
  duel: { round: 0, wins: [] as number[] },
  enemies: [] as Actor[],
  strikes: [] as Strike[],
  projs: [] as Projectile[],
  obstacles: [] as Obstacle[],
  flashA: 0,
  flashColor: '#ffffff',
  aberration: 0,
  tint: 0, // overdrive tint
  /** anime-style impact frame (inverted monochrome + speed lines), seconds left */
  impactT: 0,
  impactMax: 0,
  impactX: 0,
  impactY: 0,
  /** cinematic letterbox bars 0..1 (eased towards the target) */
  letterbox: 0,
  letterboxTarget: 0,
  /** screen crack (boss phase change): seconds left + the crack lines in screen fractions */
  crackT: 0,
  cracks: [] as number[][],
  debug: false,
  god: false,
  /** admin / debug cheats (src/ui/admin.ts) */
  cheats: { oneHit: false, infFocus: false, infDash: false, freeze: false, timeScale: 1 },
  /** set when any cheat touched this run — no leaderboard, records or Echo Shards */
  cheated: false,
  /** times the players cast skills (bosses answer spam with SUPER ARMOR) */
  /** enemy damage multiplier for the current stage (Act II hits harder) */
  actDmg: 1,
  get noRewards(): boolean {
    return this.god || this.cheated;
  },
  /** YAMI ultimate: enemies, their attacks and bullets are frozen while > 0 */
  eclipseT: 0,
  /** who cast the ECLIPSE (gets the burst credit) */
  eclipseBy: null as Player | null,
  hardMode: false,
  /** difficulty: 0 NORMAL · 1 HARD · 2 NIGHTMARE */
  diff: 0,
  stats: null as unknown as RunStats,
  onKillHooks: [] as ((a: Actor) => void)[],
  combatActive: false,
  /** endless-mode scaling + affixes for the current round (all 1 / empty in the campaign) */
  scale: { round: 0, hp: 1, dmg: 1, speed: 1, affixes: [] as string[] },
  hasAffix(id: string) {
    return this.scale.affixes.includes(id);
  },

  reset() {
    this.impactT = 0;
    this.letterbox = this.letterboxTarget = 0;
    this.crackT = 0;
    this.enemies.length = 0;
    this.strikes.length = 0;
    this.projs.length = 0;
    this.obstacles.length = 0;
    this.hitstop = 0;
    this.slowScale = 1;
    this.slowTime = 0;
    this.arenaR = this.arenaTargetR = 560;
    fx.clear();
  },

  // ---- time control
  hitStop(t: number) {
    this.hitstop = Math.max(this.hitstop, t);
  },
  slowMo(scale: number, dur: number) {
    if (this.slowTime > 0 && this.slowScale < scale) {
      this.slowTime = Math.max(this.slowTime, dur);
      return;
    }
    this.slowScale = scale;
    this.slowTime = dur;
  },
  /** returns the game-time scale for this real tick */
  tickTime(realDt: number) {
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      return 0;
    }
    if (this.slowTime > 0) {
      this.slowTime -= realDt;
      // ease back to normal in the last 0.15s
      const k = this.slowTime < 0.15 ? 1 - (1 - this.slowScale) * (this.slowTime / 0.15) : this.slowScale;
      return k;
    }
    return 1;
  },
  flash(color: string, a: number) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a * access.flash);
  },
  shake(t: number) {
    cam.addTrauma(t);
  },
  /** freeze-frame accent: a few frames of inverted monochrome with speed lines around (x, y) */
  impact(x: number, y: number, dur = 0.08) {
    if (access.flash < 0.5 || document.documentElement.classList.contains('reduce-motion')) return;
    this.impactT = this.impactMax = dur;
    this.impactX = x;
    this.impactY = y;
  },
  /** cinematic bars in (1) / out (0) */
  bars(on: number) {
    this.letterboxTarget = on;
  },
  /** the screen cracks like glass around (x, y) */
  crack(x: number, y: number) {
    if (document.documentElement.classList.contains('reduce-motion')) return;
    const s = cam.worldToScreen(x, y);
    const cx = s.x / Math.max(1, innerWidth), cy = s.y / Math.max(1, innerHeight);
    this.cracks = [];
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, px = cx, py = cy;
      const line = [px, py];
      for (let k = 0; k < 6; k++) {
        a += (Math.random() - 0.5) * 0.7;
        const d = 0.03 + Math.random() * 0.07;
        px += Math.cos(a) * d;
        py += Math.sin(a) * d * 1.6;
        line.push(px, py);
      }
      this.cracks.push(line);
    }
    this.crackT = 1.1;
  },

  // ---- spatial
  confine(a: Actor) {
    const d = Math.hypot(a.x, a.y);
    const lim = this.arenaR - a.r;
    if (d > lim) {
      a.x = (a.x / d) * lim;
      a.y = (a.y / d) * lim;
      const nx = a.x / d, ny = a.y / d;
      const vn = a.vx * nx + a.vy * ny;
      if (vn > 0) {
        a.vx -= vn * nx;
        a.vy -= vn * ny;
      }
    }
    for (const o of this.obstacles) {
      if (o.dead) continue;
      const dx = a.x - o.x, dy = a.y - o.y;
      const dd = Math.hypot(dx, dy);
      const m = o.r + a.r;
      if (dd < m && dd > 0.001) {
        a.x = o.x + (dx / dd) * m;
        a.y = o.y + (dy / dd) * m;
      }
    }
  },

  alivePlayers(): Player[] {
    return this.players.filter((p) => !p.dead);
  },
  /** enemy AI target: nearest living player (falls back to the primary player) */
  targetFor(a: Actor): Player {
    let best: Player | null = null, bd = Infinity;
    for (const p of this.players) {
      if (p.dead) continue;
      const d = dist(a.x, a.y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best ?? this.player;
  },
  /** the player credited for a hit by this source */
  creditOf(src: Actor | undefined | null): Player {
    return isPlayer(src) ? src : this.player;
  },
  /** PVP opponents of a player */
  foesOf(p: Actor | undefined): Player[] {
    if (!this.pvp || !isPlayer(p)) return [];
    return this.players.filter((q) => q !== p && !q.dead && q.squad !== p.squad);
  },

  nearestEnemy(x: number, y: number, maxD = Infinity, filter?: (a: Actor) => boolean) {
    let best: Actor | null = null;
    let bd = maxD;
    for (const e of this.enemies) {
      if (e.dead || (filter && !filter(e))) continue;
      const d = dist(x, y, e.x, e.y) - e.r;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  },

  // ---- events
  onKill(a: Actor) {
    a.onKilledVisual();
    if (a.team === 'enemy') {
      this.stats.kills++;
      for (const h of this.onKillHooks) h(a);
      this.creditOf(a.lastHitBy).onKill(a);
      if (!a.isBoss && this.hasAffix('volatile')) {
        // affix: minions burst a moment after dying — dash away
        strike({
          team: 'enemy', x: a.x, y: a.y, shape: { k: 'circle', r: 78 }, delay: 0.7, active: 0.06, damage: 10 * this.scale.dmg, knock: 380,
          unblockable: true, parryable: false, color: '#ff2d4a', tag: 'volatile',
          onStart: (s) => {
            fx.ring(s.x, s.y, 10, 95, 0.35, '#ff2d4a', 6, true);
            sfx('explosion', 0.4);
          },
        });
      }
      if (!a.isBoss) {
        fx.ink(a.x, a.y, a.r, a.color);
        fx.shards(a.x, a.y, 8, 380, a.color, 0.9, 6);
        fx.ring(a.x, a.y, a.r, a.r * 4, 0.4, a.color, 5);
        fx.anim('vfx_explosion', a.x, a.y, { w: a.r * 6, tint: a.color });
        sfx('explosion', 0.5);
        this.hitStop(0.05);
        this.shake(0.2);
      }
    }
  },
  onStagger(a: Actor) {
    sfx('stagger');
    fx.ring(a.x, a.y, a.r, a.r * 5, 0.6, '#ffe14d', 8);
    fx.shards(a.x, a.y, 20, 420, '#ffe14d', 1, 6);
    fx.text(a.x, a.y - a.r - 30, 'STAGGER', '#ffe14d', 26);
    this.hitStop(0.12);
    this.slowMo(0.35, 0.3);
    this.shake(0.5);
    this.flash('#ffe14d', 0.25);
  },

  // ---- update
  updateStrikes(dt: number) {
    for (const s of this.strikes) {
      if (s.dead) continue;
      if (this.eclipseT > 0 && s.team === 'enemy') continue; // frozen in time
      if (s.follow && s.owner) {
        s.x = s.owner.x;
        s.y = s.owner.y;
      }
      if (s.follow && s.owner && s.owner.dead) {
        s.dead = true;
        continue;
      }
      if (s.delay > 0) {
        s.delay -= dt;
        if (s.delay > 0) continue;
      }
      // callbacks may spawn more hitboxes: credit them to this strike's player
      this.actor = isPlayer(s.by) ? s.by : null;
      if (!s.started) {
        s.started = true;
        s.onStart?.(s);
      }
      s.onUpdate?.(s, dt);
      this.actor = null;
      if (s.dead) continue;
      // collisions
      if (s.noHit) {
        /* visual only */
      } else if (s.team === 'player') {
        for (const e of this.enemies) if (!e.dead) this.tryStrike(s, e);
        for (const q of this.foesOf(s.by)) this.tryStrike(s, q);
      } else {
        for (const q of this.players) if (!q.dead) this.tryStrike(s, q);
        if (s.breaksPillars) for (const o of this.obstacles) if (!o.dead && shapeHits(s, o.x, o.y, o.r)) this.damagePillar(o, 999);
      }
      s.active -= dt;
      if (s.active <= 0) {
        s.dead = true;
        s.onEnd?.(s);
      }
    }
    this.strikes = this.strikes.filter((s) => !s.dead);
  },

  tryStrike(s: Strike, t: Actor) {
    if (s.rehit) {
      s.hitTimes ??= new Map();
      const last = s.hitTimes.get(t) ?? -99;
      if (this.time - last < s.rehit) return;
      if (!shapeHits(s, t.x, t.y, t.r)) return;
      s.hitTimes.set(t, this.time);
    } else {
      if (s.hits.has(t)) return;
      if (!shapeHits(s, t.x, t.y, t.r)) return;
      s.hits.add(t);
    }
    const ox = s.owner ? s.owner.x : s.x, oy = s.owner ? s.owner.y : s.y;
    const ang = s.shape.k === 'line' || s.shape.k === 'sector' ? (s.shape as any).angle : angleTo(ox, oy, t.x, t.y);
    const kbAng = s.shape.k === 'sector' || s.shape.k === 'circle' || s.shape.k === 'ring' ? angleTo(ox, oy, t.x, t.y) : ang;
    const crit = s.crit ? chance(s.crit) : false;
    const h: HitInfo = {
      damage: s.damage * (crit ? 1.8 : 1) * rand(0.92, 1.08),
      posture: s.posture,
      knock: s.knock,
      angle: kbAng,
      hitstop: s.hitstop,
      unblockable: s.unblockable,
      parryable: s.parryable,
      sx: ox,
      sy: oy,
      kind: s.shape.k === 'sector' ? 'melee' : 'aoe',
      tag: s.tag,
      crit,
      skill: s.skill,
      stunTime: s.stunTime,
      strike: s,
      attacker: s.owner ?? s.by,
      color: s.color,
    };
    if (s.team === 'player' && isPlayer(t)) h.damage *= this.pvpDmg;
    // a defending player's reactions (parry nova, counters) are credited to them
    this.actor = isPlayer(t) ? t : null;
    const res = t.onHit(h);
    this.actor = isPlayer(s.by) ? s.by : null;
    if (s.team === 'player' && (res === 'hit' || res === 'shield')) this.creditOf(s.by).onDealHit(t, h, res);
    this.actor = null;
    s.onHit?.(t, s, res);
  },

  damagePillar(o: Obstacle, d: number) {
    o.hp -= d;
    o.flash = 0.15;
    if (o.hp <= 0 && !o.dead) {
      o.dead = true;
      fx.shards(o.x, o.y, 30, 420, '#8fa8ff', 1.2, 9);
      fx.ring(o.x, o.y, o.r, o.r * 3, 0.5, '#8fa8ff', 6);
      sfx('explosion', 0.7);
      this.shake(0.4);
    }
  },

  updateProjectiles(dt: number) {
    for (const b of this.projs) {
      if (b.dead) continue;
      if (this.eclipseT > 0 && b.team === 'enemy') continue; // frozen in time
      if (b.delay && b.delay > 0) {
        b.delay -= dt;
        b.onUpdate?.(b, dt);
        continue;
      }
      b.life -= dt;
      if (b.homing && b.target && !b.target.dead) {
        const a = Math.atan2(b.vy, b.vx);
        const want = angleTo(b.x, b.y, b.target.x, b.target.y);
        const na = a + clamp(angleDiff(a, want), -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
      }
      if (b.accel) {
        const sp = Math.hypot(b.vx, b.vy);
        const ns = Math.min(b.maxSpeed ?? 1200, sp + b.accel * dt);
        if (sp > 0) {
          b.vx *= ns / sp;
          b.vy *= ns / sp;
        }
      }
      b.onUpdate?.(b, dt);
      b.trail.push(b.x, b.y);
      if (b.trail.length > 16) b.trail.splice(0, 2);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || Math.hypot(b.x, b.y) > this.arenaR + 40) {
        this.killProj(b);
        continue;
      }
      if (!b.noObstacle) {
        for (const o of this.obstacles) {
          if (!o.dead && dist(b.x, b.y, o.x, o.y) < o.r + b.r) {
            o.flash = 0.08;
            if (b.kind === 'missile') this.damagePillar(o, 25);
            fx.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), 0.8, 5, 260, b.color);
            this.killProj(b);
            break;
          }
        }
        if (b.dead) continue;
      }
      if (b.harmless) continue;
      if (b.team === 'enemy') {
        for (const q of this.players) {
          if (!q.dead && dist(b.x, b.y, q.x, q.y) < b.r + q.r * 0.8) {
            this.projHit(b, q);
            if (b.dead || b.team !== 'enemy') break;
          }
        }
      } else {
        for (const e of [...this.enemies, ...this.foesOf(b.by)]) {
          if (e.dead || (b.hitSet && b.hitSet.has(e))) continue;
          if (dist(b.x, b.y, e.x, e.y) < b.r + (isPlayer(e) ? e.r * 0.8 : e.r)) {
            this.projHit(b, e);
            if (b.dead) break;
          }
        }
      }
    }
    this.projs = this.projs.filter((b) => !b.dead);
  },

  projHit(b: Projectile, t: Actor) {
    const h: HitInfo = {
      damage: b.damage * rand(0.92, 1.08), posture: b.posture, knock: b.knock, angle: Math.atan2(b.vy, b.vx),
      hitstop: b.reflected ? 0.08 : 0.03, unblockable: b.unblockable, parryable: b.parryable,
      sx: b.x - b.vx * 0.05, sy: b.y - b.vy * 0.05, kind: 'proj', tag: b.tag ?? 'proj', proj: b, skill: b.skill,
      attacker: b.owner ?? b.by, color: b.color,
    };
    if (b.team === 'player' && isPlayer(t)) h.damage *= this.pvpDmg;
    const team0 = b.team;
    this.actor = isPlayer(t) ? t : null;
    const res = t.onHit(h);
    this.actor = null;
    if (res === 'parry') return; // reflected, projectile lives on
    if (res === 'dodge') return;
    this.actor = isPlayer(b.by) ? b.by : null;
    if (team0 === 'player' && (res === 'hit' || res === 'shield')) this.creditOf(b.by).onDealHit(t, h, res);
    this.actor = null;
    b.onHit?.(b, t);
    if (b.pierce && b.pierce > 0) {
      b.pierce--;
      (b.hitSet ??= new Set()).add(t);
      return;
    }
    this.killProj(b);
  },

  killProj(b: Projectile) {
    if (b.dead) return;
    b.dead = true;
    b.onDeath?.(b);
    fx.burst(b.x, b.y, 5, 120, b.color, 0.3, 3);
  },

  /** reflect an enemy projectile back at its owner */
  reflect(b: Projectile, power = 1, byP?: Player) {
    const by: Player = byP ?? this.actor ?? this.player;
    const foe = b.team === 'player' ? b.by : null; // PVP: a player's own projectile parried back at them
    b.team = 'player';
    b.by = by;
    b.reflected = true;
    const sp = Math.max(700, Math.hypot(b.vx, b.vy) * 1.6);
    let a = Math.atan2(-b.vy, -b.vx);
    const tgt = foe && !foe.dead ? foe : b.owner && !b.owner.dead && b.owner !== by ? b.owner : this.nearestEnemy(b.x, b.y);
    if (tgt) a = angleTo(b.x, b.y, tgt.x, tgt.y);
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
    b.damage = Math.max(14, b.damage * 2.5) * power * by.mods.dmgMul;
    b.posture = 30;
    b.color = '#7ff6ff';
    b.life = 3;
    b.homing = 0;
    b.trail.length = 0;
    b.kind = b.kind === 'mine' ? 'orb' : b.kind;
  },
};

// ---------------------------------------------------------------- shape tests
export function shapeHits(s: Strike, tx: number, ty: number, tr: number): boolean {
  const sh = s.shape;
  const d = dist(s.x, s.y, tx, ty);
  switch (sh.k) {
    case 'circle':
      return d <= sh.r + tr;
    case 'ring':
      return Math.abs(d - sh.r) <= sh.w / 2 + tr;
    case 'sector': {
      if (d > sh.r + tr) return false;
      if (d < tr + 8) return true;
      const a = angleTo(s.x, s.y, tx, ty);
      const slack = Math.atan2(tr, d);
      return Math.abs(angleDiff(sh.angle, a)) <= sh.arc / 2 + slack;
    }
    case 'line': {
      const x2 = s.x + Math.cos(sh.angle) * sh.len, y2 = s.y + Math.sin(sh.angle) * sh.len;
      return segDist(tx, ty, s.x, s.y, x2, y2) <= sh.w / 2 + tr;
    }
  }
}

/** draw telegraphs and active hazard shapes */
/** seconds before a parryable hit lands that its timing ring appears */
const PARRY_RING = 0.55;

export function drawStrikes(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const s of W.strikes) {
    const tele = s.delay > 0;
    if (tele ? s.hideTele : s.hideActive ?? s.team === 'player') continue;
    if (!tele && s.shape.k === 'sector') continue;
    const prog = tele && s.tele > 0 ? 1 - s.delay / s.tele : 1;
    const col = teleCol(s.unblockable ? '#ff2d4a' : s.color);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    const sh = s.shape;
    const pathFull = () => {
      ctx.beginPath();
      if (sh.k === 'circle') ctx.arc(s.x, s.y, sh.r, 0, TAU);
      else if (sh.k === 'ring') {
        ctx.arc(s.x, s.y, sh.r + sh.w / 2, 0, TAU);
        ctx.arc(s.x, s.y, Math.max(0, sh.r - sh.w / 2), 0, TAU, true);
      } else if (sh.k === 'sector') {
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, sh.r, sh.angle - sh.arc / 2, sh.angle + sh.arc / 2);
        ctx.closePath();
      } else {
        const c = Math.cos(sh.angle), si = Math.sin(sh.angle);
        const nx = -si * sh.w / 2, ny = c * sh.w / 2;
        ctx.moveTo(s.x + nx, s.y + ny);
        ctx.lineTo(s.x + c * sh.len + nx, s.y + si * sh.len + ny);
        ctx.lineTo(s.x + c * sh.len - nx, s.y + si * sh.len - ny);
        ctx.lineTo(s.x - nx, s.y - ny);
        ctx.closePath();
      }
    };
    if (tele) {
      const blink = s.delay < 0.18 ? (Math.floor(W.time * 30) % 2 ? 0.9 : 0.4) : 1;
      pathFull();
      ctx.globalAlpha = 0.1 * blink;
      ctx.fill('evenodd');
      ctx.globalAlpha = 0.7 * blink;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      // fill progress
      ctx.globalAlpha = 0.28 * blink;
      ctx.beginPath();
      if (sh.k === 'circle') ctx.arc(s.x, s.y, sh.r * prog, 0, TAU);
      else if (sh.k === 'sector') {
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, sh.r * prog, sh.angle - sh.arc / 2, sh.angle + sh.arc / 2);
        ctx.closePath();
      } else if (sh.k === 'line') {
        const c = Math.cos(sh.angle), si = Math.sin(sh.angle);
        const w = (sh.w / 2) * prog;
        ctx.moveTo(s.x - si * w, s.y + c * w);
        ctx.lineTo(s.x + c * sh.len - si * w, s.y + si * sh.len + c * w);
        ctx.lineTo(s.x + c * sh.len + si * w, s.y + si * sh.len - c * w);
        ctx.lineTo(s.x + si * w, s.y - c * w);
        ctx.closePath();
      } else {
        ctx.arc(s.x, s.y, sh.r + sh.w / 2, 0, TAU);
        ctx.arc(s.x, s.y, Math.max(0, sh.r + sh.w / 2 - sh.w * prog), 0, TAU, true);
      }
      ctx.fill('evenodd');
      // PARRY TIMING RING: closes in and touches down exactly when the hit lands
      const ringR = s.ring ?? (s.owner && s.parryable ? s.owner.r + 6 : 0);
      if (s.team === 'enemy' && ringR > 0 && !s.unblockable && sh.k !== 'ring' && s.delay <= PARRY_RING) {
        const k = s.delay / PARRY_RING;
        const r0 = sh.k === 'circle' ? sh.r : ringR;
        ctx.globalAlpha = 0.35 + 0.65 * (1 - k);
        ctx.strokeStyle = s.delay < 0.05 ? '#ffffff' : '#ffe14d';
        ctx.lineWidth = 2 + 3 * (1 - k);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r0 + k * 90, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r0, 0, TAU);
        ctx.stroke();
      }
    } else {
      pathFull();
      ctx.globalAlpha = 0.55;
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (sh.k === 'line') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(2, sh.w * 0.25);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(sh.angle) * sh.len, s.y + Math.sin(sh.angle) * sh.len);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawProjectiles(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of W.projs) {
    const t = b.trail;
    if (t.length >= 4) {
      for (let i = 2; i < t.length; i += 2) {
        ctx.globalAlpha = (i / t.length) * 0.6;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.r * 1.3 * (i / t.length);
        ctx.beginPath();
        ctx.moveTo(t[i - 2], t[i - 1]);
        ctx.lineTo(t[i], t[i + 1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const ang = Math.atan2(b.vy, b.vx);
    if (drawProjSprite(ctx, b, ang)) continue;
    if (b.kind === 'knife') {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(ang) * 12, b.y - Math.sin(ang) * 12);
      ctx.lineTo(b.x + Math.cos(ang) * 10, b.y + Math.sin(ang) * 10);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (b.kind === 'wave') {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(b.x - Math.cos(ang) * b.r, b.y - Math.sin(ang) * b.r, b.r * 1.6, ang - 1, ang + 1);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (b.kind === 'mine') {
      const armed = !b.delay || b.delay <= 0;
      const pulse = 0.5 + 0.5 * Math.sin(W.time * (armed ? 18 : 6));
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4 + pulse * 3, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.6, 0, TAU);
      ctx.fill();
    } else if (b.kind === 'missile') {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(ang) * 14, b.y + Math.sin(ang) * 14);
      ctx.lineTo(b.x + Math.cos(ang + 2.5) * 8, b.y + Math.sin(ang + 2.5) * 8);
      ctx.lineTo(b.x + Math.cos(ang - 2.5) * 8, b.y + Math.sin(ang - 2.5) * 8);
      ctx.fill();
    } else {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
      ctx.fill();
      if (b.parryable && b.team === 'enemy') {
        ctx.strokeStyle = '#ffd24d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 4 + Math.sin(W.time * 20) * 1.5, 0, TAU);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** tag-specific projectile art (Act II bosses) */
const TAG_SPRITE: Record<string, [string, number, boolean]> = {
  firewave: ['proj_fire_wave', 3.4, true], spore: ['proj_spore', 3, false], timeorb: ['proj_time_orb', 3, true], lightning: ['proj_lightning_orb', 3, true],
};
function drawProjSprite(ctx: CanvasRenderingContext2D, b: Projectile, ang: number) {
  const ts = b.tag ? TAG_SPRITE[b.tag] : undefined;
  if (ts && !(b.parryable && b.team === 'enemy') && sprites.draw(ctx, ts[0], b.x, b.y, { angle: ang, w: b.r * ts[1], additive: ts[2] })) return true;
  switch (b.kind) {
    case 'arrow':
      if ((b as any).charged && sprites.draw(ctx, 'proj_arrow_charged', b.x, b.y, { angle: ang, w: 60, tint: b.color, additive: true })) return true;
      return sprites.draw(ctx, 'proj_arrow', b.x, b.y, { angle: ang, w: 30, tint: b.color });
    case 'hook': {
      // chain back to the thrower
      const from = (b as any).from as { x: number; y: number } | undefined;
      if (from) {
        const d = Math.hypot(b.x - from.x, b.y - from.y);
        const n = Math.floor(d / 11);
        let drew = false;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          drew = sprites.draw(ctx, 'proj_chain_link', from.x + (b.x - from.x) * t, from.y + (b.y - from.y) * t, { angle: ang, w: 11, tint: b.color }) || drew;
        }
        if (!drew) {
          ctx.save();
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      return sprites.draw(ctx, 'proj_hook', b.x, b.y, { angle: ang, w: 24 });
    }
    case 'knife': return sprites.draw(ctx, 'proj_knife', b.x, b.y, { angle: ang, w: 26, tint: b.color });
    case 'missile': return sprites.draw(ctx, 'proj_missile', b.x, b.y, { angle: ang, w: 24 });
    case 'wave': return sprites.draw(ctx, 'proj_wave', b.x, b.y, { angle: ang, w: b.r * 3.2, tint: b.color, additive: true });
    case 'mine': {
      const armed = !b.delay || b.delay <= 0;
      return sprites.draw(ctx, sprites.first(armed ? 'proj_mine_armed' : 'proj_mine', 'proj_mine') ?? '', b.x, b.y, { w: b.r * 3, t: W.time });
    }
    default:
      if (b.parryable && b.team === 'enemy' && sprites.has('proj_orb_parry')) return sprites.draw(ctx, 'proj_orb_parry', b.x, b.y, { angle: W.time * 4, w: b.r * 3.2, additive: true });
      return sprites.draw(ctx, 'proj_orb', b.x, b.y, { angle: ang, w: b.r * 2.8, tint: b.color, additive: true });
  }
}

export function drawObstacles(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const o of W.obstacles) {
    if (o.dead) continue;
    const pn = sprites.first(o.hp < o.maxHp * 0.5 ? 'pillar_cracked' : 'pillar', 'pillar');
    if (pn) {
      sprites.draw(ctx, pn, o.x, o.y, { w: o.r * 2.2, flash: o.flash > 0 ? 0.7 : 0 });
      o.flash = Math.max(0, o.flash - 1 / 60);
      continue;
    }
    ctx.fillStyle = '#0c1230';
    ctx.strokeStyle = o.flash > 0 ? '#ffffff' : '#6f86ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      ctx.lineTo(o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * 0.5, 0, TAU);
    ctx.stroke();
    // hp cracks
    const dmg = 1 - o.hp / o.maxHp;
    if (dmg > 0.05) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff9a3c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * 0.75, -Math.PI / 2, -Math.PI / 2 + TAU * dmg);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    o.flash = Math.max(0, o.flash - 1 / 60);
  }
  ctx.restore();
}
