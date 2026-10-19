/** ASCENSION minions: Swarmling, Wraith, Lancer, Acolyte, Sentry, Broodmother, Brute, Mirror Shard. */
import { TAU, angleTo, angleDiff, dist, rand, chance } from '../core/math';
import { drawFrontGuard, guardHit } from '../render/guard';
import type { Co } from '../core/co';
import { fx } from '../render/fx';
import { sfx } from '../audio/audio';
import { W, type Actor, type HitInfo, type HitResult } from './world';
import { Enemy, ORANGE, RED } from './enemies';
import { T } from './tuning';

/** shared minion think prologue: stunned minions drop their move */
function stunned(e: Enemy) {
  if (e.stun > 0 && !e.unstoppable) {
    if (e.runner.running) e.runner.stop();
    return true;
  }
  return false;
}
function fallbackBody(e: Enemy, ctx: CanvasRenderingContext2D, sides: number, k = 1) {
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) pts.push([Math.cos((i / sides) * TAU) * e.r * k, Math.sin((i / sides) * TAU) * e.r]);
  (e as unknown as { glowPoly: (c: CanvasRenderingContext2D, p: [number, number][], s: string) => void }).glowPoly(ctx, pts, e.color);
}

// ---------------------------------------------------------------- Swarmling — flock, one-hit
export class Swarmling extends Enemy {
  private cd = rand(0.4, 1.4);
  private orbit = rand(0, TAU);
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_swarmling';
    this.hp = this.maxHp = T.minionHp.swarmling;
    this.r = 9;
    this.color = '#ff7a3c';
    this.name = 'Swarmling';
    this.turnRate = 10;
  }
  think(dt: number) {
    if (stunned(this)) return;
    if (this.runner.step(dt)) return;
    this.orbit += dt * 1.4;
    const tx = this.p.x + Math.cos(this.orbit) * 70, ty = this.p.y + Math.sin(this.orbit) * 70;
    this.steer(tx, ty, 255, dt, 5);
    this.face(this.aP, dt);
    this.cd -= dt;
    if (this.cd <= 0 && this.dP < 120 && !this.attack(this.bite(), 'swarm')) this.cd = 0.3;
  }
  private *bite(): Co {
    const a = this.aP;
    this.facing = a;
    this.tele(0.32);
    yield 0.32;
    this.vx = Math.cos(a) * 520;
    this.vy = Math.sin(a) * 520;
    this.atk({ k: 'circle', r: this.r + 8 }, { active: 0.16, damage: 5, knock: 160, tag: 'bite' });
    yield 0.5;
    this.cd = rand(1.0, 1.8);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx, this.r + 6);
    if (this.drawBody(ctx)) return;
    this.drawShadow(ctx);
    fallbackBody(this, ctx, 3, 1.3);
  }
}

// ---------------------------------------------------------------- Wraith — phases out, strikes from behind
export class Wraith extends Enemy {
  private faded = 0;
  private cd = rand(1, 2);
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_wraith';
    this.hp = this.maxHp = T.minionHp.wraith;
    this.r = 14;
    this.color = '#9fe8ff';
    this.name = 'Wraith';
  }
  think(dt: number) {
    this.faded = Math.max(0, this.faded - dt);
    if (stunned(this)) return;
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    this.steer(this.p.x, this.p.y, 90, dt, 3);
    this.cd -= dt;
    if (this.cd <= 0 && !this.attack(this.ambush())) this.cd = 0.5;
  }
  private *ambush(): Co {
    // fade out (invulnerable) and drift behind the player
    sfx('dash', 0.3);
    fx.ring(this.x, this.y, this.r, this.r * 3, 0.3, this.color, 3);
    this.solid = false;
    for (let t = 0; t < 1.1; t += this.dt) {
      this.faded = 0.2;
      this.invuln = 0.1;
      const behind = this.p.facing + Math.PI;
      this.steer(this.p.x + Math.cos(behind) * 70, this.p.y + Math.sin(behind) * 70, 520, this.dt, 6);
      yield 0;
    }
    this.solid = true;
    fx.ring(this.x, this.y, 4, 50, 0.3, this.color, 4);
    const a = this.aP;
    this.facing = a;
    this.tele(0.45);
    this.atk({ k: 'sector', r: 90, arc: 1.9, angle: a }, {
      delay: 0.45, active: 0.1, damage: 12, knock: 300, tag: 'wraith', follow: true,
      onStart: () => {
        fx.slash(this.x, this.y, a, 85, 1.9, 1, this.color, { width: 26 });
        sfx('slash', 0.5);
      },
    });
    yield 0.45 + 0.1;
    yield 1.1; // visible & vulnerable
    this.cd = rand(1.5, 2.5);
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.faded > 0 ? 0.18 : 1;
    this.drawTele(ctx);
    if (!this.drawBody(ctx, this.faded <= 0)) {
      fallbackBody(this, ctx, 5);
    }
    ctx.restore();
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Lancer — long parryable charge, frontal guard
export class Lancer extends Enemy {
  private cd = rand(1.4, 2.4);
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_lancer';
    this.hp = this.maxHp = T.minionHp.lancer;
    this.r = 18;
    this.color = '#ffd24d';
    this.name = 'Lancer';
    this.turnRate = 3;
    this.kbResist = 0.4;
  }
  preHit(h: HitInfo): HitResult | null {
    if (this.runner.running || this.stun > 0.3 || h.skill || h.tag === 'execute') return null;
    const a = angleTo(this.x, this.y, h.sx, h.sy);
    if (Math.abs(angleDiff(this.facing, a)) > 0.9) return null;
    fx.sparks(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, a, 0.8, 8, 380, '#ffe9a0', 0.25);
    guardHit(this);
    sfx('clank', 0.5);
    this.hitFlash = 0.04;
    return 'shield';
  }
  onParried() {
    // a parried lance leaves the lancer reeling for 2s
    this.runner.stop();
    this.stun = 2;
    fx.text(this.x, this.y - 30, 'BROKEN', '#ffe14d', 16);
    for (const s of W.strikes) if (s.owner === this) s.dead = true;
  }
  think(dt: number) {
    if (stunned(this)) return;
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    const d = this.dP;
    if (d > 300) this.steer(this.p.x, this.p.y, 120, dt, 3);
    else if (d < 200) this.steer(this.x - (this.p.x - this.x), this.y - (this.p.y - this.y), 90, dt, 3);
    else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }
    this.cd -= dt;
    if (this.cd <= 0 && d < 460 && !this.attack(this.lunge())) this.cd = 0.4;
  }
  private *lunge(): Co {
    yield* this.trackP(0.25);
    const a = this.facing;
    this.tele(0.8);
    this.atk({ k: 'line', angle: a, len: 430, w: 40 }, { delay: 0.8, active: 0.001, noHit: true, follow: true });
    yield 0.8;
    sfx('stab', 0.7);
    const s = this.atk({ k: 'line', angle: a, len: 70, w: 40 }, { active: 0.32, damage: 16, knock: 520, tag: 'lance', follow: true });
    for (let t = 0; t < 0.32; t += this.dt) {
      if (s.dead) break;
      this.vx = Math.cos(a) * 1150;
      this.vy = Math.sin(a) * 1150;
      if (Math.random() < 0.6) fx.ghost(this.x, this.y, a, this.r, this.color, 0.15, 'circle');
      yield 0;
    }
    s.dead = true;
    yield 0.9;
    this.cd = rand(2, 3);
  }
  private *trackP(t: number): Co {
    for (let u = 0; u < t; u += this.dt) {
      this.face(this.aP, this.dt, 10);
      this.vx *= 0.85;
      this.vy *= 0.85;
      yield 0;
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    if (!this.drawBody(ctx)) {
      this.drawShadow(ctx);
      fallbackBody(this, ctx, 4, 1.4);
    }
    if (!this.runner.running && this.stun <= 0.3) drawFrontGuard(ctx, this, { arc: 0.9 });
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Acolyte — links allies with wards / heals
export class Acolyte extends Enemy {
  private cd = rand(1.2, 2);
  link: Actor | null = null;
  private linkT = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_acolyte';
    this.hp = this.maxHp = T.minionHp.acolyte;
    this.r = 15;
    this.color = '#b98cff';
    this.name = 'Acolyte';
  }
  think(dt: number) {
    if (this.link && (this.link.dead || this.dead)) this.link = null;
    this.linkT -= dt;
    if (this.link && this.linkT > 0) {
      // keep feeding the link while it lasts
      this.link.ward = Math.min(this.link.maxHp * 0.6, this.link.ward + 14 * dt);
      if (this.link.hp < this.link.maxHp) this.link.hp = Math.min(this.link.maxHp, this.link.hp + 3 * dt);
    } else this.link = null;
    if (stunned(this)) return;
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    const d = this.dP, a = this.aP;
    this.steer(this.x - Math.cos(a) * (300 - d), this.y - Math.sin(a) * (300 - d), 120, dt, 3);
    this.cd -= dt;
    if (this.cd <= 0 && !this.attack(this.link === null && chance(0.7) ? this.bless() : this.bolt(), 'ranged')) this.cd = 0.4;
  }
  private *bless(): Co {
    let best: Actor | null = null, bd = 520;
    for (const e of W.enemies) {
      if (e.dead || e === this || e instanceof Acolyte || e.isBoss) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) {
      yield* this.bolt();
      return;
    }
    this.tele(0.5, '#b98cff');
    yield 0.5;
    this.link = best;
    this.linkT = 5;
    best.ward = Math.max(best.ward, best.maxHp * 0.35);
    fx.ring(best.x, best.y, best.r, best.r * 2.5, 0.4, this.color, 4);
    sfx('skill', 0.4);
    this.cd = rand(2.5, 3.5);
  }
  private *bolt(): Co {
    this.tele(0.45, '#c25bff');
    yield 0.45;
    this.bullet(this.aP, 320, { r: 9, damage: 10, color: ORANGE, parryable: true, posture: 8 });
    sfx('shoot', 0.5);
    this.cd = rand(1.8, 2.6);
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.link) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 0.5 + Math.sin(W.time * 12) * 0.25;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -W.time * 60;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.link.x, this.link.y);
      ctx.stroke();
      ctx.restore();
    }
    this.drawTele(ctx);
    if (this.drawBody(ctx)) return this.drawStun(ctx);
    this.drawShadow(ctx);
    fallbackBody(this, ctx, 6);
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Sentry — stationary turret, slow laser sweep
export class Sentry extends Enemy {
  private cd = rand(1, 2);
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_sentry';
    this.hp = this.maxHp = T.minionHp.sentry;
    this.r = 20;
    this.color = '#ff2d4a';
    this.name = 'Sentry';
    this.kbResist = 1;
    this.unstoppable = true;
    this.turnRate = 1.6;
  }
  think(dt: number) {
    this.vx = this.vy = 0;
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    this.cd -= dt;
    if (this.cd <= 0 && !this.attack(this.sweep(), 'ranged')) this.cd = 0.5;
  }
  private *sweep(): Co {
    const dir = chance(0.5) ? 1 : -1;
    const a0 = this.aP - dir * 0.7;
    this.facing = a0;
    this.tele(1.0, RED);
    this.atk({ k: 'line', angle: a0, len: 620, w: 22 }, { delay: 1.0, active: 0.001, noHit: true, unblockable: true, color: RED });
    yield 1.0;
    sfx('laser', 0.6);
    const s = this.atk({ k: 'line', angle: a0, len: 620, w: 22 }, {
      active: 1.7, damage: 12, knock: 260, unblockable: true, parryable: false, color: RED, tag: 'sentry', rehit: 0.5,
      onUpdate: (st, dt) => {
        const sh = st.shape as { angle: number };
        sh.angle += dir * 0.85 * dt;
        this.facing = sh.angle;
      },
    });
    yield 1.7;
    s.dead = true;
    this.cd = rand(1.6, 2.4);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    if (this.drawBody(ctx)) return;
    this.drawShadow(ctx);
    fallbackBody(this, ctx, 8);
  }
}

// ---------------------------------------------------------------- Broodmother — flees, lays swarmling eggs
export class Broodmother extends Enemy {
  private egg = 2.5;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_broodmother';
    this.hp = this.maxHp = T.minionHp.broodmother;
    this.r = 24;
    this.color = '#7dff4d';
    this.name = 'Broodmother';
    this.kbResist = 0.5;
  }
  think(dt: number) {
    if (stunned(this)) return;
    if (this.runner.step(dt)) return;
    const a = this.aP;
    // run away from the player, sliding along the wall
    const tx = this.x - Math.cos(a) * 200 + Math.cos(a + Math.PI / 2) * 120, ty = this.y - Math.sin(a) * 200 + Math.sin(a + Math.PI / 2) * 120;
    this.steer(tx, ty, this.dP < 260 ? 150 : 70, dt, 3);
    this.face(Math.atan2(this.vy, this.vx), dt, 4);
    this.egg -= dt;
    if (this.egg <= 0) this.runner.run(this.lay());
  }
  private *lay(): Co {
    this.egg = 4;
    const swarm = W.enemies.filter((e) => !e.dead && e instanceof Swarmling).length;
    if (swarm >= 12) return;
    this.tele(0.6, '#7dff4d');
    yield 0.6;
    sfx('spawn', 0.6);
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      const e = new Swarmling(this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 30);
      e.hp = e.maxHp = Math.round(e.maxHp * W.scale.hp);
      e.vx = Math.cos(a) * 300;
      e.vy = Math.sin(a) * 300;
      W.enemies.push(e);
    }
    fx.burst(this.x, this.y, 16, 220, this.color, 0.5, 3);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    if (this.drawBody(ctx)) return this.drawStun(ctx);
    this.drawShadow(ctx);
    fallbackBody(this, ctx, 7);
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Brute — unstoppable, armoured front, red slams
export class Brute extends Enemy {
  private cd = rand(1, 1.6);
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_brute';
    this.hp = this.maxHp = T.minionHp.brute;
    this.r = 30;
    this.maxPosture = 160;
    this.color = '#ff4d4d';
    this.name = 'Brute';
    this.kbResist = 0.85;
    this.unstoppable = true;
    this.turnRate = 2.2;
  }
  damageTakenMul(h: HitInfo) {
    if (this.staggered > 0) return 1;
    const a = angleTo(this.x, this.y, h.sx, h.sy);
    if (Math.abs(angleDiff(this.facing, a)) < 1.0) {
      guardHit(this, false);
      return 0.5;
    }
    return 1.25;
  }
  onPostureBreak() {
    this.runner.stop();
    for (const s of W.strikes) if (s.owner === this) s.dead = true;
    fx.text(this.x, this.y - 44, 'BREAK!', '#ffe14d', 22);
  }
  think(dt: number) {
    if (this.staggered > 0) {
      this.vx *= 0.9;
      this.vy *= 0.9;
      return;
    }
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt);
    this.steer(this.p.x, this.p.y, 85, dt, 2);
    this.cd -= dt;
    if (this.cd <= 0 && this.dP < 220 && !this.attack(chance(0.55) ? this.slam() : this.swipe())) this.cd = 0.35;
  }
  private *slam(): Co {
    const a = this.aP;
    this.facing = a;
    const cx = this.x + Math.cos(a) * 70, cy = this.y + Math.sin(a) * 70;
    this.tele(0.9, RED);
    this.atk({ k: 'circle', r: 140 }, {
      x: cx, y: cy, follow: false, delay: 0.9, active: 0.08, damage: 22, knock: 600, unblockable: true, parryable: false, color: RED, tag: 'bslam',
      onStart: () => {
        sfx('slam');
        W.shake(0.5);
        fx.ring(cx, cy, 20, 170, 0.45, this.color, 9, true);
        fx.shards(cx, cy, 18, 400, this.color, 0.7, 6);
      },
    });
    yield 0.9 + 1.0;
    this.cd = rand(1.4, 2.2);
  }
  private *swipe(): Co {
    const a = this.aP;
    this.facing = a;
    this.tele(0.6);
    this.atk({ k: 'sector', r: 150, arc: 2.4, angle: a }, {
      delay: 0.6, active: 0.1, damage: 18, knock: 520, tag: 'bswipe',
      onStart: () => {
        fx.slash(this.x, this.y, a, 140, 2.4, 1, this.color, { width: 44 });
        sfx('slashHeavy', 0.7);
      },
    });
    yield 0.6 + 0.8;
    this.cd = rand(1.2, 1.8);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx, this.r + 12);
    if (!this.drawBody(ctx)) {
      this.drawShadow(ctx);
      fallbackBody(this, ctx, 6);
    }
    if (this.staggered <= 0) drawFrontGuard(ctx, this, { arc: 1.0, full: false, reach: 18 });
    this.drawStun(ctx);
  }
}

// ---------------------------------------------------------------- Mirror Shard — reflects player projectiles
export class MirrorShard extends Enemy {
  private cd = rand(0.8, 1.6);
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'enemy_mirror_shard';
    this.hp = this.maxHp = T.minionHp.mirror_shard;
    this.r = 13;
    this.color = '#ffffff';
    this.name = 'Mirror Shard';
  }
  preHit(h: HitInfo): HitResult | null {
    const b = h.proj;
    if (!b || b.team !== 'player' || h.skill) return null;
    // bounce the projectile back at the player
    b.team = 'enemy';
    b.vx = -b.vx;
    b.vy = -b.vy;
    b.damage = Math.min(14, b.damage * 0.6) * this.dmgScale;
    b.color = '#ffffff';
    b.parryable = true;
    b.owner = this;
    b.hitSet = undefined;
    fx.ring(this.x, this.y, this.r, this.r * 2.6, 0.25, '#ffffff', 3);
    fx.text(this.x, this.y - this.r - 10, 'REFLECT', '#ffffff', 13);
    sfx('parry', 0.4);
    return 'parry';
  }
  think(dt: number) {
    if (stunned(this)) return;
    if (this.runner.step(dt)) return;
    this.face(this.aP, dt, 8);
    this.steer(this.p.x, this.p.y, 175, dt, 4);
    this.cd -= dt;
    if (this.cd <= 0 && this.dP < 90 && !this.attack(this.stab())) this.cd = 0.3;
  }
  private *stab(): Co {
    const a = this.aP;
    this.facing = a;
    this.tele(0.4);
    this.atk({ k: 'sector', r: 70, arc: 1.4, angle: a }, { delay: 0.4, active: 0.1, damage: 10, knock: 260, tag: 'shard', onStart: () => sfx('stab', 0.4) });
    yield 0.5 + 0.6;
    this.cd = rand(0.9, 1.5);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawTele(ctx);
    if (this.drawBody(ctx)) return this.drawStun(ctx);
    this.drawShadow(ctx);
    fallbackBody(this, ctx, 4, 0.6);
    this.drawStun(ctx);
  }
}
