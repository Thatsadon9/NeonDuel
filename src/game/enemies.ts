/** Enemy base class (shared AI helpers) and the four minion types. */
import { TAU, angleTo, angleDiff, dist, rand, rotateTowards, chance } from '../core/math';
import { Runner, type Co } from '../core/co';
import { fx } from '../render/fx';
import { sfx } from '../audio/audio';
import { sprites, AnimState } from '../render/sprites';
import { pose, posed, type Pose } from '../render/procanim';
import type { Player } from './player';
import { T } from './tuning';
import { teleCol } from '../core/access';
import { Actor, W, strike, shoot, type HitInfo, type HitResult, type Strike, type Shape } from './world';

export const ORANGE = '#ff9a3c'; // parryable / blockable
export const RED = '#ff2d4a'; // unblockable → dash!

export abstract class Enemy extends Actor {
  dt = 1 / 60;
  runner = new Runner();
  teleT = 0;
  teleColor = ORANGE;
  turnRate = 6;
  dmgScale = 1;
  /** endless scaling: minions think and move faster (bosses use Boss.speed instead) */
  speedMul = 1;
  /** sprite base name, e.g. "enemy_rusher" → enemy_rusher_idle.png … */
  spriteKey = '';
  anim = new AnimState();
  stateClock = new AnimState();
  /** per-entity phase so crowds don't breathe/bob in sync */
  seed = Math.random() * 100;
  /** pose used for the last body draw — attached parts (shields, arms) follow it */
  lastPose: Pose = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0 };

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.dmgScale = T.diffDmg[W.diff] * W.scale.dmg * W.actDmg;
    this.speedMul = W.scale.speed * (W.hasAffix('swift') ? 1.2 : 1);
  }
  private tgt: Player | null = null;
  private tgtT = 0;
  /** current target: the nearest living player, re-evaluated every ~1s (sticky so AI doesn't jitter) */
  get p(): Player {
    if (!this.tgt || this.tgt.dead || W.time > this.tgtT || !W.players.includes(this.tgt)) {
      this.tgt = W.targetFor(this);
      this.tgtT = W.time + 0.8 + Math.random() * 0.6;
    }
    return this.tgt!;
  }
  get dP() {
    return dist(this.x, this.y, this.p.x, this.p.y);
  }
  get aP() {
    return angleTo(this.x, this.y, this.p.x, this.p.y);
  }
  face(a: number, dt: number, rate = this.turnRate) {
    this.facing = rotateTowards(this.facing, a, rate * dt);
  }
  steer(tx: number, ty: number, speed: number, dt: number, rate = 6) {
    const a = angleTo(this.x, this.y, tx, ty);
    const d = dist(this.x, this.y, tx, ty);
    const s = Math.min(speed, d * 4);
    const k = 1 - Math.exp(-rate * dt);
    this.vx += (Math.cos(a) * s - this.vx) * k;
    this.vy += (Math.sin(a) * s - this.vy) * k;
  }
  separate(dt: number) {
    for (const o of W.enemies) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      const m = this.r + o.r + 6;
      if (d < m && d > 0.01) {
        const push = (m - d) * 8;
        this.vx += (dx / d) * push * dt * 60;
        this.vy += (dy / d) * push * dt * 60;
      }
    }
    // push players out of solid bodies (unless dashing)
    for (const p of W.players) {
    if (!p.dead && p.iframe <= 0 && this.solid) {
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      const m = this.r + p.r;
      if (d < m && d > 0.01) {
        p.x = this.x + (dx / d) * m;
        p.y = this.y + (dy / d) * m;
      }
    }
    }
  }
  /** set when this enemy telegraphs an unblockable (red) attack — bosses open up after those */
  usedRed = false;
  tele(t: number, color = ORANGE) {
    this.teleT = t;
    this.teleColor = color;
    if (color === RED) this.usedRed = true;
  }
  /** which attack pool this enemy is using right now (team attacks: only a few strike at once) */
  atkKind: 'melee' | 'ranged' | 'swarm' | '' = '';
  /**
   * TEAM ATTACKS: start an attack only if the pool has room — otherwise keep circling.
   * Returns false when it has to wait (callers then retry shortly).
   */
  attack(co: Co, kind: 'melee' | 'ranged' | 'swarm' = 'melee'): boolean {
    const extra = Math.max(0, W.players.length - 1);
    const lim = (kind === 'melee' ? T.team.melee : kind === 'ranged' ? T.team.ranged : T.team.swarm) + extra + (W.diff >= 2 ? 1 : 0);
    let busy = 0;
    for (const e of W.enemies) if (e !== this && !e.dead && e instanceof Enemy && !e.isBoss && e.atkKind === kind && e.runner.running) busy++;
    if (busy >= lim && !this.elite) return false;
    this.atkKind = kind;
    this.runner.run(co);
    return true;
  }
  /** spawn an attack hitbox owned by this enemy with a visible telegraph */
  atk(shape: Shape, o: Partial<Strike> = {}): Strike {
    return strike({
      team: 'enemy', owner: this, x: this.x, y: this.y, shape, follow: true,
      damage: 12 * this.dmgScale, posture: 0, knock: 300, hitstop: 0.06, active: 0.1, color: ORANGE, ...o,
      ...(o.damage !== undefined ? { damage: o.damage * this.dmgScale } : {}),
    });
  }
  bullet(a: number, speed: number, o: Partial<Parameters<typeof shoot>[0]> = {}) {
    return shoot({
      team: 'enemy', owner: this, x: this.x + Math.cos(a) * (this.r + 4), y: this.y + Math.sin(a) * (this.r + 4),
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage: 10 * this.dmgScale, ...o,
      ...(o.damage !== undefined ? { damage: o.damage * this.dmgScale } : {}),
    });
  }

  update(dt: number) {
    this.dt = dt;
    this.tickCommon(dt);
    this.teleT = Math.max(0, this.teleT - dt);
    if (this.dead) return;
    const sm = this.isBoss ? 1 : this.speedMul;
    this.think(dt * sm);
    this.separate(dt);
    this.move(dt * sm, 7);
  }
  abstract think(dt: number): void;

  protected bodyState(): string {
    if (this.teleT > 0) return 'windup';
    if (this.hitFlash > 0 || this.stun > 0.3) return 'hurt';
    if (this.runner.running) return 'attack';
    return Math.hypot(this.vx, this.vy) > 25 ? 'move' : 'idle';
  }
  protected stateNames(st: string): string[] {
    const k = this.spriteKey;
    return [`${k}_${st}`, `${k}_idle`];
  }
  /** draw the sprite body if art exists; returns false to fall back to procedural drawing */
  protected drawBody(ctx: CanvasRenderingContext2D, shadow = true): boolean {
    const k = this.spriteKey;
    if (!k || !sprites.has(k + '_idle')) return false;
    const st = this.bodyState();
    const name = sprites.first(...this.stateNames(st))!;
    const t = this.anim.set(name, W.time);
    const stateT = this.stateClock.set(st, W.time);
    if (shadow) this.drawShadow(ctx);
    const P = pose({
      state: st, t: stateT, time: W.time + this.seed, speed: Math.hypot(this.vx, this.vy), hit: this.hitFlash, age: this.age,
      tele: this.teleT > 0 ? this.teleT : undefined, heavy: this.r >= 40, intensity: (sprites.get(name)?.frames ?? 1) > 1 ? 0.35 : 1,
    });
    this.lastPose = P;
    const q = posed(this.x, this.y, this.facing, P);
    sprites.draw(ctx, name, q.x, q.y, { angle: q.angle, sx: P.sx, sy: P.sy, t, flash: this.hitFlash > 0 ? 0.75 : 0, outline: this.rimColor(), outlineAlpha: this.isBoss ? 0.85 : 0.75 });
    return true;
  }
  /** neon rim colour around the sprite */
  rimColor() {
    return this.color;
  }
  onKilledVisual() {
    const k = this.spriteKey;
    const n = k && sprites.first(...this.stateNames('death').filter((x) => x.endsWith('death') || x.endsWith('death_p2')));
    if (n) fx.anim(n, this.x, this.y, { angle: this.facing, additive: false, under: true, hold: this.isBoss ? 4 : 0.8 });
  }

  /** shared neon body outline */
  protected glowPoly(ctx: CanvasRenderingContext2D, pts: [number, number][], stroke: string, fill = '#120814', lw = 3) {
    ctx.beginPath();
    for (const [px, py] of pts) {
      const c = Math.cos(this.facing), s = Math.sin(this.facing);
      ctx.lineTo(this.x + px * c - py * s, this.y + px * s + py * c);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  protected drawTele(ctx: CanvasRenderingContext2D, r = this.r + 10) {
    if (this.teleT <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const on = Math.floor(W.time * 24) % 2 === 0;
    ctx.globalAlpha = on ? 0.95 : 0.5;
    ctx.strokeStyle = teleCol(this.teleColor);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = teleCol(this.teleColor);
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.restore();
  }
  protected drawShadow(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.4, this.r * 1.05, this.r * 0.55, 0, 0, TAU);
    ctx.fill();
  }
  protected drawStun(ctx: CanvasRenderingContext2D) {
    if (this.stun <= 0.3 && this.staggered <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 3; i++) {
      const a = W.time * 6 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(a) * this.r * 0.9, this.y - this.r - 8 + Math.sin(a) * 4, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Rusher
export class Rusher extends Enemy {
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_rusher';
    this.hp = this.maxHp = T.minionHp.rusher;
    this.r = 15;
    this.color = '#ff4d6d';
    this.name = 'Rusher';
  }
  private cd = rand(0.8, 1.6);
  private strafe = chance(0.5) ? 1 : -1;
  think(dt: number) {
    if (this.stun > 0) {
      if (this.runner.running) this.runner.stop();
      return;
    }
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    const d = this.dP;
    const a = this.aP;
    const want = 190;
    const tx = this.x + Math.cos(a) * (d - want) + Math.cos(a + Math.PI / 2) * 120 * this.strafe;
    const ty = this.y + Math.sin(a) * (d - want) + Math.sin(a + Math.PI / 2) * 120 * this.strafe;
    this.steer(tx, ty, 170, dt);
    this.cd -= dt;
    if (this.cd <= 0 && d < 380 && !this.attack(this.charge())) this.cd = 0.35;
  }
  private *charge(): Co {
    const a = this.aP;
    this.facing = a;
    this.tele(0.5);
    this.atk({ k: 'line', angle: a, len: 260, w: 34 }, { delay: 0.5, active: 0.001, noHit: true, follow: true });
    for (let t = 0; t < 0.5; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0;
    }
    sfx('dash', 0.5);
    this.atk({ k: 'circle', r: this.r + 6 }, { active: 0.26, damage: 12, knock: 380, tag: 'rush' });
    for (let t = 0; t < 0.26; t += this.dt) {
      this.vx = Math.cos(a) * 900;
      this.vy = Math.sin(a) * 900;
      if (Math.random() < 0.6) fx.ghost(this.x, this.y, a, this.r, this.color, 0.15, 'circle');
      yield 0;
    }
    yield 0.65;
    this.cd = rand(1.2, 2.2);
    this.strafe *= -1;
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    if (this.drawBody(ctx)) return this.drawStun(ctx);
    this.drawShadow(ctx);
    this.glowPoly(ctx, [[this.r * 1.4, 0], [-this.r, this.r], [-this.r * 0.5, 0], [-this.r, -this.r]], this.color);
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Gunner
export class Gunner extends Enemy {
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_gunner';
    this.hp = this.maxHp = T.minionHp.gunner;
    this.r = 14;
    this.color = '#ffd24d';
    this.name = 'Gunner';
  }
  private cd = rand(1, 2);
  private strafe = chance(0.5) ? 1 : -1;
  think(dt: number) {
    if (this.stun > 0) {
      if (this.runner.running) this.runner.stop();
      return;
    }
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    const d = this.dP, a = this.aP;
    const want = 330;
    const tx = this.x + Math.cos(a) * (d - want) + Math.cos(a + Math.PI / 2) * 100 * this.strafe;
    const ty = this.y + Math.sin(a) * (d - want) + Math.sin(a + Math.PI / 2) * 100 * this.strafe;
    this.steer(tx, ty, 150, dt);
    if (chance(dt * 0.4)) this.strafe *= -1;
    this.cd -= dt;
    if (this.cd <= 0 && !this.attack(this.fire(), 'ranged')) this.cd = 0.4;
  }
  private *fire(): Co {
    this.tele(0.4, '#c25bff');
    yield 0.4;
    for (let i = 0; i < 3; i++) {
      const last = i === 2;
      this.bullet(this.aP + rand(-0.06, 0.06), last ? 380 : 430, {
        r: 7, damage: 9, color: last ? ORANGE : '#c25bff', parryable: last, posture: 8,
      });
      sfx('shoot', 0.5);
      yield 0.14;
    }
    this.cd = rand(1.8, 2.6);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    if (this.drawBody(ctx)) return this.drawStun(ctx);
    this.drawShadow(ctx);
    const r = this.r;
    this.glowPoly(ctx, [[r * 1.2, 0], [0, r], [-r * 1.1, 0], [0, -r]], this.color);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(this.facing) * r * 1.9, this.y + Math.sin(this.facing) * r * 1.9);
    ctx.stroke();
    ctx.restore();
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Shield
export class Shielder extends Enemy {
  shieldHp = 100;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_bulwark';
    this.hp = this.maxHp = T.minionHp.bulwark;
    this.r = 20;
    this.color = '#5aa0ff';
    this.kbResist = 0.6;
    this.turnRate = 2.4;
    this.name = 'Bulwark';
  }
  private cd = 1;
  preHit(h: HitInfo): HitResult | null {
    if (this.shieldHp <= 0 || this.stun > 0.3) return null;
    if (h.tag === 'execute') return null;
    const a = angleTo(this.x, this.y, h.sx, h.sy);
    if (Math.abs(angleDiff(this.facing, a)) < 1.15) {
      const heavy = h.damage > 22 || h.posture > 20;
      this.shieldHp -= h.damage * (heavy ? 1.8 : 0.7);
      const cx = this.x + Math.cos(a) * this.r, cy = this.y + Math.sin(a) * this.r;
      fx.sparks(cx, cy, a, 0.9, 10, 450, '#bfe0ff', 0.3);
      sfx('clank', 0.7);
      this.vx += Math.cos(h.angle) * h.knock * 0.3;
      this.vy += Math.sin(h.angle) * h.knock * 0.3;
      this.hitFlash = 0.05;
      if (this.shieldHp <= 0) {
        fx.shards(cx, cy, 16, 400, '#5aa0ff', 0.8, 7);
        fx.text(this.x, this.y - 40, 'SHIELD BREAK', '#5aa0ff', 18);
        sfx('guardBreak', 0.8);
        this.stun = 1.2;
      } else fx.text(cx, cy - 10, 'BLOCKED', '#8fb8ff', 13);
      return 'shield';
    }
    return null;
  }
  think(dt: number) {
    if (this.stun > 0) {
      if (this.runner.running) this.runner.stop();
      return;
    }
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    this.steer(this.p.x, this.p.y, 95, dt, 3);
    this.cd -= dt;
    if (this.cd <= 0 && this.dP < 110 && !this.attack(this.bash())) this.cd = 0.35;
  }
  private *bash(): Co {
    const a = this.facing;
    this.tele(0.55);
    this.atk({ k: 'sector', r: 110, arc: 2.0, angle: a }, { delay: 0.55, active: 0.1, damage: 15, knock: 420, tag: 'bash', follow: true });
    yield 0.55;
    this.vx += Math.cos(a) * 300;
    this.vy += Math.sin(a) * 300;
    fx.slash(this.x, this.y, a, 100, 2.0, 1, '#5aa0ff', { width: 30 });
    sfx('slashHeavy', 0.6);
    yield 0.7;
    this.cd = rand(1.2, 1.8);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    const r = this.r;
    const spr = this.drawBody(ctx);
    if (!spr) {
      this.drawShadow(ctx);
      this.glowPoly(ctx, [[r, -r], [r, r], [-r, r], [-r, -r]], this.color);
    }
    if (this.shieldHp > 0 && spr && sprites.draw(ctx, 'enemy_bulwark_shield', posed(this.x, this.y, this.facing, this.lastPose).x, posed(this.x, this.y, this.facing, this.lastPose).y, { angle: this.facing + this.lastPose.rot * 0.6, flash: this.hitFlash > 0 ? 0.8 : 0 })) {
      /* shield sprite drawn */
    } else if (this.shieldHp > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.hitFlash > 0 ? '#fff' : '#9fc6ff';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.5 + 0.5 * (this.shieldHp / 100);
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 10, this.facing - 1.1, this.facing + 1.1);
      ctx.stroke();
      ctx.restore();
    }
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Bomber
export class Bomber extends Enemy {
  private fuse = -1;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_bomber';
    this.hp = this.maxHp = T.minionHp.bomber;
    this.r = 13;
    this.color = '#c25bff';
    this.name = 'Bomber';
  }
  think(dt: number) {
    if (this.fuse >= 0) {
      this.fuse -= dt;
      this.vx *= 0.85;
      this.vy *= 0.85;
      if (this.fuse <= 0) this.explode(true);
      return;
    }
    if (this.stun > 0) return;
    this.face(this.aP, dt, 10);
    this.steer(this.p.x, this.p.y, 245, dt, 4);
    if (this.dP < 80) {
      this.fuse = 0.75;
      this.tele(0.75, RED);
      this.atk({ k: 'circle', r: 115 }, { delay: 0.75, active: 0.001, noHit: true, unblockable: true, color: RED, follow: true });
      sfx('charge', 0.6);
    }
  }
  private explode(live: boolean) {
    if (live) {
      strike({ team: 'enemy', x: this.x, y: this.y, shape: { k: 'circle', r: 115 }, active: 0.06, damage: 18 * this.dmgScale, knock: 500, unblockable: true, parryable: false, color: RED, tag: 'boom', hitstop: 0.05 });
      this.hp = 0;
      this.dead = true;
      W.onKill(this);
    }
    sfx('explosion', 0.8);
    fx.anim('vfx_explosion', this.x, this.y, { w: 260, tint: '#c25bff' });
    fx.ring(this.x, this.y, 10, 130, 0.4, '#c25bff', 8, true);
    fx.shards(this.x, this.y, 20, 450, '#c25bff', 0.7, 6);
    W.shake(0.35);
  }
  protected bodyState() {
    return this.fuse >= 0 ? 'windup' : super.bodyState();
  }
  onDeath() {
    // killed before detonating: small harmless pop
    if (this.fuse < 0 || this.fuse > 0) {
      fx.ring(this.x, this.y, 5, 60, 0.3, '#c25bff', 4);
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx, this.fuse >= 0 ? this.r + 6 + (0.75 - this.fuse) * 20 : this.r + 8);
    if (this.drawBody(ctx)) return;
    this.drawShadow(ctx);
    const pulse = 1 + Math.sin(this.age * (this.fuse >= 0 ? 40 : 8)) * 0.12;
    ctx.fillStyle = '#140818';
    ctx.strokeStyle = this.hitFlash > 0 ? '#fff' : this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * pulse, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.fuse >= 0 ? RED : this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.45 * pulse, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
