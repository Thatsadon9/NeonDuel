/** Boss 2 — HEX WEAVER. Bullet-hell mage: dash through patterns, parry golden orbs back at her. */
import { TAU, angleTo, dist, rand, chance } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W, strike, type Projectile } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { sprites } from '../../render/sprites';

const PURPLE = '#c25bff';

export class HexWeaver extends Boss {
  private orbit = 1;
  private orbiters: Projectile[] = [];
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_hex';
    this.hp = this.maxHp = W.hardMode ? 950 : 780;
    this.maxPosture = 200;
    this.r = 26;
    this.color = '#d36bff';
    this.phase2Color = '#ff4dcf';
    this.title = 'HEX WEAVER';
    this.subtitle = 'จอมเวทกระสุนพิษ — Dash ทะลุห่ากระสุน แล้ว Parry ลูกแก้วสีทองสะท้อนกลับ';
    this.solid = true;
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'spiral', w: 3, cd: 3, fn: () => this.spiral() },
      { name: 'rings', w: 3, fn: () => this.rings() },
      { name: 'orbs', w: 3, cd: 2.5, fn: () => this.orbs() },
      { name: 'laser', w: 2, cd: 6, fn: () => this.laser() },
      { name: 'blink', w: 6, max: 150, cd: 2.5, fn: () => this.blink() },
      { name: 'meteor', w: 2, phase: 2, cd: 5, fn: () => this.meteor() },
      { name: 'cross', w: 2, phase: 2, cd: 8, fn: () => this.cross() },
    ];
  }

  enterPhase2() {
    this.restMul = 0.75;
    this.summonOrbiters();
  }

  private summonOrbiters() {
    for (const o of this.orbiters) o.dead = true;
    this.orbiters = [];
    for (let i = 0; i < 6; i++) {
      const b = this.bullet(0, 0, { r: 11, damage: 12, color: this.phase2Color, life: 999, noObstacle: true, unblockable: false });
      const idx = i;
      b.onUpdate = (p) => {
        const a = W.time * 2.2 + (idx * TAU) / 6;
        const rr = 85 + Math.sin(W.time * 3) * 15;
        p.x = this.x + Math.cos(a) * rr;
        p.y = this.y + Math.sin(a) * rr;
        p.vx = p.vy = 0.001;
        p.trail.length = 0;
        if (this.dead) p.dead = true;
      };
      this.orbiters.push(b);
    }
  }

  idle(dt: number) {
    const a = this.aP;
    const d = this.dP;
    const want = 330;
    const tx = this.p.x - Math.cos(a) * want + Math.cos(a + Math.PI / 2) * 160 * this.orbit;
    const ty = this.p.y - Math.sin(a) * want + Math.sin(a + Math.PI / 2) * 160 * this.orbit;
    this.steer(tx, ty, d < 200 ? 260 : 170, dt, 3);
    this.face(a, dt, 5);
    if (chance(dt * 0.3)) this.orbit *= -1;
    // respawn orbiters if they were destroyed
    if (this.phase === 2 && this.orbiters.every((o) => o.dead) && chance(dt * 0.15)) this.summonOrbiters();
  }

  private *spiral(): Co {
    this.tele(0.5, PURPLE);
    yield 0.5;
    const arms = this.phase === 2 ? 5 : 3;
    const dur = 2.6;
    let a0 = rand(0, TAU);
    for (let t = 0; t < dur; t += 0.085) {
      a0 += 0.21;
      for (let i = 0; i < arms; i++) {
        this.bullet(a0 + (i * TAU) / arms, 220, { r: 7, damage: 9, color: PURPLE, life: 4 });
        if (this.phase === 2) this.bullet(-a0 * 0.8 + (i * TAU) / arms, 170, { r: 6, damage: 8, color: this.phase2Color, life: 4 });
      }
      if (Math.floor(t / 0.085) % 3 === 0) sfx('shoot', 0.35);
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0.085;
    }
    yield 0.4;
  }

  private *rings(): Co {
    const n = this.phase === 2 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      this.tele(0.3, PURPLE);
      yield 0.3;
      const count = 26;
      const gap = this.aP + rand(-0.6, 0.6);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        const d = Math.abs(((a - gap + Math.PI * 3) % TAU) - Math.PI);
        if (d < 0.38) continue; // safe gap
        this.bullet(a, 250, { r: 8, damage: 10, color: PURPLE, life: 4 });
      }
      sfx('shootBig', 0.6);
      fx.ring(this.x, this.y, 10, 80, 0.3, PURPLE, 4);
      yield 0.35;
    }
    yield 0.3;
  }

  private *orbs(): Co {
    this.tele(0.45, ORANGE);
    yield 0.45;
    const n = this.phase === 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const a = this.aP + (i - (n - 1) / 2) * 0.6;
      this.bullet(a, 230, {
        r: 12, damage: 14, color: ORANGE, parryable: true, homing: 1.7, target: this.p, life: 4.5, posture: 10,
        onUpdate: (b) => {
          if (Math.random() < 0.3) fx.ember(b.x, b.y, rand(-20, 20), rand(-20, 20), b.color, 0.3, 3);
        },
      });
      sfx('shootBig', 0.5);
      yield 0.18;
    }
    yield 0.4;
  }

  private beam(angle: number, sweep: number, delay: number, dur: number) {
    return strike({
      team: 'enemy', owner: this, x: this.x, y: this.y, follow: true, shape: { k: 'line', angle, len: 1300, w: 34 }, delay,
      active: dur, rehit: 0.35, damage: 16 * this.dmgScale, knock: 350, unblockable: true, parryable: false, color: RED, tag: 'laser',
      onStart: () => {
        sfx('laser');
        W.shake(0.3);
      },
      onUpdate: (s, dt) => {
        const sh = s.shape as { angle: number };
        sh.angle += (sweep / dur) * dt;
        const ex = s.x + Math.cos(sh.angle) * 600, ey = s.y + Math.sin(sh.angle) * 600;
        if (Math.random() < 0.5) fx.sparks(ex, ey, sh.angle + Math.PI, 0.6, 1, 300, '#ff8fa0');
        W.shake(0.03);
      },
    });
  }

  private *laser(): Co {
    yield* this.track(0.2);
    const a = this.aP;
    const dir = chance(0.5) ? 1 : -1;
    this.tele(0.9, RED);
    sfx('laserCharge');
    this.beam(a - dir * 0.5, dir * 1.9, 0.9, 1.3);
    for (let t = 0; t < 2.2; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0;
    }
    yield 0.4;
  }

  private *cross(): Co {
    this.tele(1.0, RED);
    sfx('laserCharge');
    const a = rand(0, TAU);
    const dir = chance(0.5) ? 1 : -1;
    for (let i = 0; i < 4; i++) this.beam(a + (i * TAU) / 4, dir * 1.4, 1.0, 2.2);
    for (let t = 0; t < 3.2; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0;
    }
    yield 0.4;
  }

  private *blink(): Co {
    this.tele(0.25, PURPLE);
    yield 0.25;
    // leave a ring of bullets behind
    for (let i = 0; i < 14; i++) this.bullet((i / 14) * TAU, 200, { r: 7, damage: 9, color: PURPLE, life: 3 });
    fx.smoke(this.x, this.y, 10, 'rgba(200,100,255,0.25)', 150, 18, 0.6);
    fx.ring(this.x, this.y, 10, 90, 0.3, PURPLE, 5);
    sfx('teleport');
    let best = { x: 0, y: 0 }, bd = -1;
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU), rr = rand(0, W.arenaR - 80);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      const d = dist(x, y, this.p.x, this.p.y);
      if (d > 300 && d < 520 && d > bd) {
        bd = d;
        best = { x, y };
      }
    }
    if (bd < 0) best = { x: -this.p.x * 0.6, y: -this.p.y * 0.6 };
    this.x = best.x;
    this.y = best.y;
    this.vx = this.vy = 0;
    fx.ring(this.x, this.y, 80, 10, 0.3, PURPLE, 5);
    yield 0.35;
  }

  private *meteor(): Co {
    this.tele(0.5, RED);
    yield 0.3;
    for (let i = 0; i < 7; i++) {
      const tx = this.p.x + rand(-140, 140) + this.p.vx * 0.4, ty = this.p.y + rand(-140, 140) + this.p.vy * 0.4;
      strike({
        team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 75 }, delay: 0.95, active: 0.08, damage: 15 * this.dmgScale,
        knock: 400, unblockable: true, parryable: false, color: RED, tag: 'meteor',
        onStart: () => {
          sfx('explosion', 0.5);
          W.shake(0.2);
          fx.ring(tx, ty, 10, 100, 0.35, this.phase2Color, 6, true);
          fx.shards(tx, ty, 8, 300, this.phase2Color, 0.6, 5);
        },
      });
      yield 0.14;
    }
    yield 0.8;
  }

  onDeath() {
    for (const o of this.orbiters) o.dead = true;
  }

  protected drawSpriteBoss(ctx: CanvasRenderingContext2D) {
    if (!sprites.has('boss_hex_idle')) return false;
    const ring = sprites.first(this.phase === 2 ? 'boss_hex_ring_p2' : '', 'boss_hex_ring');
    if (ring) {
      sprites.draw(ctx, ring, this.x, this.y, { angle: this.age * 0.8, additive: true });
      sprites.draw(ctx, ring, this.x, this.y, { angle: -this.age * 1.2, scale: 0.72, additive: true, alpha: 0.7 });
    }
    this.drawBody(ctx, false);
    this.drawStun(ctx);
    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const col = this.phase === 2 ? this.phase2Color : this.color;
    const r = this.r;
    const bob = Math.sin(this.age * 3) * 4;
    const x = this.x, y = this.y + bob;
    ctx.save();
    // robe triangle
    ctx.fillStyle = '#12051a';
    ctx.strokeStyle = this.hitFlash > 0 ? '#fff' : col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r, y + r * 0.9);
    ctx.lineTo(x - r, y + r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    // rotating rune rings
    for (let k = 0; k < 2; k++) {
      const rr = r + 16 + k * 14;
      const rot = this.age * (k ? -1.2 : 0.8);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = rot + (i * TAU) / 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (rr - 4), y + Math.sin(a) * (rr - 4));
        ctx.lineTo(x + Math.cos(a) * (rr + 4), y + Math.sin(a) * (rr + 4));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // eye gem
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + Math.cos(this.facing) * 5, y - r * 0.15 + Math.sin(this.facing) * 3, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, 9, 0, TAU);
    ctx.fill();
    ctx.restore();
    this.drawStun(ctx);
    void angleTo;
  }
}
