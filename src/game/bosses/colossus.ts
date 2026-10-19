/** Boss 4 — IRON COLOSSUS. Armored front, posture-focused. Bait its charge into pillars; hit the core when it opens. */
import { TAU, angleTo, dist, rand, angleDiff, clamp } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W, strike, type HitInfo } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { T } from '../tuning';
import { sprites } from '../../render/sprites';
import { hud } from '../../ui/hud';

export function placePillars() {
  W.obstacles.length = 0;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    W.obstacles.push({ x: Math.cos(a) * 300, y: Math.sin(a) * 300, r: 36, hp: 120, maxHp: 120, flash: 0 });
  }
}

export class Colossus extends Boss {
  coreT = 0;
  private armL = 0; // arm swing animation
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_colossus';
    this.hp = this.maxHp = Math.round(T.bossHp.colossus * (W.hardMode ? T.hardHp : 1));
    this.maxPosture = Math.round(420 * T.bossPosture);
    this.r = 54;
    this.color = '#8fa8ff';
    this.phase2Color = '#ff7a3c';
    this.kbResist = 0.99;
    this.turnRate = 1.6;
    this.title = 'IRON COLOSSUS';
    this.subtitle = 'ยักษ์จักรกล — เกราะหน้าแข็ง ล่อให้พุ่งชนเสา แล้วโจมตีแกนกลางที่เปิดออก';
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'slam', w: 3, max: 280, fn: () => this.slam() },
      { name: 'sweep', w: 3, max: 240, fn: () => this.sweep() },
      { name: 'barrage', w: 2, cd: 5, fn: () => this.barrage() },
      { name: 'charge', w: 3, min: 230, cd: 5, fn: () => this.charge() },
      { name: 'flak', w: 2, phase: 2, cd: 4, fn: () => this.flak() },
    ];
  }

  enterPhase2() {
    this.restMul = 0.75;
    // rebuild broken pillars
    let n = 0;
    for (const o of W.obstacles) {
      if (o.dead && n < 2) {
        o.dead = false;
        o.hp = o.maxHp;
        fx.ring(o.x, o.y, 80, o.r, 0.5, '#8fa8ff', 5);
        n++;
      }
    }
  }

  damageTakenMul(h: HitInfo) {
    if (this.coreT > 0 || this.staggered > 0) return 1.8;
    const a = angleTo(this.x, this.y, h.sx, h.sy);
    if (Math.abs(angleDiff(this.facing, a)) < 1.0) {
      if (Math.random() < 0.3) fx.text(this.x, this.y - this.r - 20, 'ARMOR', '#8fa8ff', 12);
      return 0.55;
    }
    return 1;
  }
  postureTakenMul(_h: HitInfo) {
    return this.coreT > 0 ? 2.4 : 1;
  }

  update(dt: number) {
    this.coreT = Math.max(0, this.coreT - dt);
    this.armL = Math.max(0, this.armL - dt * 3);
    super.update(dt);
  }

  idle(dt: number) {
    this.face(this.aP, dt, this.turnRate);
    if (this.dP > 160) this.steer(this.p.x, this.p.y, 75, dt, 2);
    else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }
  }

  private openCore(t: number) {
    this.coreT = t;
    hud.callout('CORE EXPOSED', '#ffe14d', 0.8, 28);
    sfx('chargeReady');
  }

  private *slam(): Co {
    yield* this.track(0.2, 2.5);
    const a = this.facing;
    const cx = this.x + Math.cos(a) * 100, cy = this.y + Math.sin(a) * 100;
    const T = this.phase === 2 ? 0.75 : 0.9;
    this.tele(T, RED);
    strike({
      team: 'enemy', owner: this, x: cx, y: cy, shape: { k: 'circle', r: 170 }, delay: T, active: 0.08, damage: 30 * this.dmgScale,
      knock: 700, unblockable: true, parryable: false, color: RED, tag: 'cslam', breaksPillars: true,
      onStart: () => {
        sfx('slam');
        sfx('explosion', 0.6);
        W.shake(0.8);
        fx.ring(cx, cy, 20, 230, 0.5, this.color, 12, true);
        fx.shards(cx, cy, 30, 600, this.color, 1, 9);
        fx.smoke(cx, cy, 14, 'rgba(140,160,255,0.2)', 220, 26, 1);
        const rings = this.phase === 2 ? 2 : 1;
        for (let i = 0; i < rings; i++) {
          strike({
            team: 'enemy', owner: this, x: cx, y: cy, shape: { k: 'ring', r: 40, w: 30 }, delay: i * 0.35, active: 1.1, damage: 16 * this.dmgScale,
            knock: 450, unblockable: true, parryable: false, color: RED, tag: 'cring',
            onUpdate: (s, dt) => {
              (s.shape as { r: number }).r += 480 * dt;
            },
          });
        }
      },
    });
    yield T + 0.15;
    this.openCore(2.2);
    yield 1.6;
  }

  private *sweep(): Co {
    const times = this.phase === 2 ? 2 : 1;
    for (let i = 0; i < times; i++) {
      yield* this.track(0.15, 3);
      const a = this.facing;
      const dir = i % 2 ? -1 : 1;
      const T = i === 0 ? 0.65 : 0.45;
      this.tele(T);
      this.atk({ k: 'sector', r: 215, arc: 3.4, angle: a }, {
        delay: T, active: 0.12, damage: 22, knock: 650, tag: 'csweep', breaksPillars: false,
        onStart: () => {
          this.armL = 1;
          fx.slash(this.x, this.y, a, 210, 3.4, dir, this.phase === 2 ? this.phase2Color : this.color, { width: 70, life: 0.3, follow: this });
          sfx('slashHeavy');
          W.shake(0.45);
        },
      });
      yield T + 0.15;
    }
    yield 0.8;
  }

  private *barrage(): Co {
    this.tele(0.5, ORANGE);
    yield 0.5;
    const n = this.phase === 2 ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const tx = this.p.x + rand(-170, 170) + this.p.vx * 0.5, ty = this.p.y + rand(-170, 170) + this.p.vy * 0.5;
      const sx = this.x, sy = this.y;
      const d = dist(sx, sy, tx, ty);
      const speed = 520;
      const life = d / speed + 0.5;
      // arc via delay: missile goes up first (visual), then flies
      const a = angleTo(sx, sy, tx, ty);
      strike({ team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 70 }, delay: life, active: 0.001, noHit: true, unblockable: true, color: RED, tag: 'mtele' });
      this.bullet(a, speed, {
        kind: 'missile', r: 9, damage: 10, color: ORANGE, life: life - 0.5, delay: 0.5, unblockable: false,
        onUpdate: (b) => {
          if (Math.random() < 0.5) fx.ember(b.x, b.y, -b.vx * 0.1 + rand(-20, 20), -b.vy * 0.1 + rand(-20, 20), '#ffb36b', 0.35, 3);
        },
        onDeath: (b) => {
          strike({
            team: 'enemy', owner: this, x: b.x, y: b.y, shape: { k: 'circle', r: 70 }, active: 0.06, damage: 14 * this.dmgScale, knock: 380,
            unblockable: true, parryable: false, color: RED, tag: 'missile', hideActive: true,
          });
          fx.ring(b.x, b.y, 10, 90, 0.35, ORANGE, 6, true);
          fx.shards(b.x, b.y, 6, 260, ORANGE, 0.5, 5);
          sfx('explosion', 0.35);
          W.shake(0.12);
          // the telegraph at the original target is meaningless once it blew up early
          for (const s of W.strikes) if (s.tag === 'mtele' && Math.abs(s.x - tx) < 1 && Math.abs(s.y - ty) < 1) s.dead = true;
        },
      });
      sfx('shoot', 0.4);
      yield 0.12;
    }
    yield 1.0;
  }

  private *charge(): Co {
    yield* this.track(0.3, 4);
    const a = this.aP;
    this.facing = a;
    this.tele(0.95, RED);
    sfx('roar', 0.6);
    this.atk({ k: 'line', angle: a, len: 1100, w: this.r * 2 }, { delay: 0.95, active: 0.001, noHit: true, unblockable: true, color: RED, follow: true });
    yield 0.95;
    const s = this.atk({ k: 'circle', r: this.r + 10 }, { active: 1.6, damage: 26, knock: 800, unblockable: true, parryable: false, color: RED, tag: 'ccharge', hideActive: true });
    let hitPillar = false;
    for (let t = 0; t < 1.6; t += this.dt) {
      this.vx = Math.cos(a) * 720;
      this.vy = Math.sin(a) * 720;
      if (Math.random() < 0.6) fx.sparks(this.x - Math.cos(a) * this.r, this.y - Math.sin(a) * this.r, a + Math.PI, 0.6, 2, 300, this.color);
      W.shake(0.04);
      for (const o of W.obstacles) {
        if (!o.dead && dist(this.x, this.y, o.x, o.y) < this.r + o.r + 12) {
          W.damagePillar(o, 999);
          hitPillar = true;
        }
      }
      if (hitPillar || Math.hypot(this.x, this.y) > W.arenaR - this.r - 6) break;
      yield 0;
    }
    s.dead = true;
    this.vx = this.vy = 0;
    sfx('slam');
    W.shake(0.6);
    fx.ring(this.x, this.y, 10, 160, 0.4, this.color, 8);
    if (hitPillar) {
      hud.callout('CRASH!', '#ffe14d', 0.8, 40);
      this.addPosture(this.maxPosture * 0.5);
      this.openCore(3.2);
      yield 2.2;
    } else yield 0.8;
  }

  private *flak(): Co {
    for (let k = 0; k < 3; k++) {
      this.tele(0.3, '#c25bff');
      yield 0.3;
      const base = this.aP;
      for (let i = 0; i < 14; i++) this.bullet(base + (i / 13 - 0.5) * 1.6, 300 + (i % 2) * 60, { r: 8, damage: 9, color: '#c25bff', life: 3 });
      sfx('shootBig', 0.6);
      yield 0.3;
    }
    yield 0.6;
  }

  protected drawSpriteBoss(ctx: CanvasRenderingContext2D) {
    if (!sprites.has('boss_colossus_idle')) return false;
    const r = this.r, f = this.facing;
    const c = Math.cos(f), s = Math.sin(f);
    this.drawBody(ctx, false);
    const arm = sprites.first(this.phase === 2 ? 'boss_colossus_arm_p2' : '', 'boss_colossus_arm');
    if (arm) {
      for (const side of [-1, 1]) {
        const swing = this.armL * side * 0.8;
        const P = this.lastPose;
        // arms swing with the stride and punch forward on attacks
        const stride = this.bodyState() === 'move' ? Math.sin((W.time + this.seed) * 7) * side * 8 : 0;
        const ax = r * 0.45 + Math.cos(swing) * r * 0.25 + P.ox * 1.6 + stride, ay = side * r * 1.3 * P.sy + Math.sin(swing) * 24 + P.oy;
        sprites.draw(ctx, arm, this.x + ax * c - ay * s, this.y + ax * s + ay * c, { angle: f + swing + P.rot, flipY: side < 0, flash: this.hitFlash > 0 ? 0.7 : 0, outline: this.rimColor(), outlineAlpha: 0.7 });
      }
    }
    if (this.coreT > 0) sprites.draw(ctx, 'boss_colossus_core', this.x, this.y, { angle: f, additive: true, alpha: 0.7 + Math.sin(W.time * 18) * 0.3 });
    this.drawStun(ctx);
    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const col = this.phase === 2 ? this.phase2Color : this.color;
    const r = this.r;
    const f = this.facing;
    const c = Math.cos(f), s = Math.sin(f);
    const P = (px: number, py: number): [number, number] => [this.x + px * c - py * s, this.y + px * s + py * c];
    ctx.save();
    // arms
    for (const side of [-1, 1]) {
      const swing = this.armL * side * 0.8;
      const ax = r * 0.3 + Math.cos(swing) * r * 0.2, ay = side * r * 1.05 + Math.sin(swing) * 20;
      const [x, y] = P(ax, ay);
      ctx.fillStyle = '#0b1028';
      ctx.strokeStyle = this.hitFlash > 0 ? '#fff' : col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // body (rounded square)
    const pts: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.9]);
    }
    this.glowPoly(ctx, pts, col, '#0b1028', 5);
    // armor plate (front)
    ctx.strokeStyle = col;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r - 6, f - 0.9, f + 0.9);
    ctx.stroke();
    // core
    ctx.globalCompositeOperation = 'lighter';
    const open = this.coreT > 0;
    const pulse = 0.6 + Math.sin(W.time * (open ? 18 : 3)) * 0.4;
    ctx.fillStyle = open ? '#ffe14d' : 'rgba(255,122,60,0.45)';
    ctx.globalAlpha = open ? 0.6 + pulse * 0.4 : 0.6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * (open ? 0.42 : 0.26), 0, TAU);
    ctx.fill();
    if (open) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.6 + pulse * 6, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    this.drawStun(ctx);
    void clamp;
  }
}
