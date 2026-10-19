/**
 * Act II boss 2 — TEMPUS, THE CHRONO ARBITER. Teaches pattern memory + rhythm.
 * ECHO: every attack replays 2s later at the same spot (phase 2: twice).
 * TIME BUBBLE: golden zones that halve your speed (dash out).
 * REWIND: heals 10% — strike the hourglass 3 times during the cast to cancel it and stagger him.
 * Phase 2: two giant clock hands sweep the arena as lasers.
 */
import { TAU, rand, dist, chance } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { sprites } from '../../render/sprites';
import { W, strike, type HitInfo, type HitResult } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { hud } from '../../ui/hud';

const GOLD = '#ffd24d';

export class Tempus extends Boss {
  bubbles: { x: number; y: number; r: number; t: number }[] = [];
  private rewinding = false;
  private rewindHits = 0;
  private handA = 0;
  private hands: { a: number; on: number }[] = [];
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_tempus';
    this.hp = this.maxHp = W.hardMode ? 1800 : 1500;
    this.maxPosture = 280;
    this.r = 32;
    this.color = GOLD;
    this.phase2Color = '#7ff6ff';
    this.title = 'TEMPUS';
    this.subtitle = 'THE CHRONO ARBITER — ทุกท่าจะย้อนกลับมาอีกครั้ง จำตำแหน่งให้ดี';
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'attack', w: 3, max: 260, fn: () => this.verdict() },
      { name: 'orbs', w: 3, fn: () => this.orbs() },
      { name: 'bubble', w: 2, cd: 6, fn: () => this.bubble() },
      { name: 'gavel', w: 2, cd: 3, fn: () => this.gavel() },
      { name: 'rewind', w: 2, cd: 16, fn: () => this.rewind() },
      { name: 'hands', w: 3, phase: 2, cd: 9, fn: () => this.clockHands() },
    ];
  }

  enterPhase2() {
    this.restMul = 0.85;
  }

  /** replay a pattern later where it happened (ghost after-image + same hitboxes) */
  private echo(fn: () => void, x: number, y: number) {
    const times = this.phase === 2 ? [2, 4] : [2];
    for (const t of times) {
      strike({
        team: 'enemy', owner: this, x, y, shape: { k: 'circle', r: 1 }, delay: t, active: 0.001, noHit: true, hideTele: true,
        onStart: () => {
          if (this.dead) return;
          const ox = this.x, oy = this.y;
          this.x = x;
          this.y = y;
          fx.anim('vfx_echo_ghost_trail', x, y, { w: 120, tint: GOLD });
          fx.ghost(x, y, this.facing, this.r, '#ffe9a0', 0.6, 'circle');
          fn();
          this.x = ox;
          this.y = oy;
        },
      });
    }
  }

  idle(dt: number) {
    this.face(this.aP, dt, 4);
    const a = this.aP, d = this.dP;
    this.steer(this.x + Math.cos(a) * (d - 240) + Math.cos(a + 1.57) * 80, this.y + Math.sin(a) * (d - 240) + Math.sin(a + 1.57) * 80, 140, dt, 3);
  }

  update(dt: number) {
    super.update(dt);
    // time bubbles slow every player inside (dash escapes)
    this.bubbles = this.bubbles.filter((b) => (b.t -= dt) > 0);
    for (const p of W.players) {
      if (p.dead || p.state === 'dash' || this.dead) continue;
      if (this.bubbles.some((b) => dist(p.x, p.y, b.x, b.y) < b.r)) {
        p.x -= p.vx * dt * 0.5;
        p.y -= p.vy * dt * 0.5;
      }
    }
    this.handA += dt * 0.6;
    if (this.dead) this.bubbles = [];
  }

  preHit(h: HitInfo): HitResult | null {
    if (this.rewinding && (h.strike?.team === 'player' || h.proj?.team === 'player')) {
      this.rewindHits++;
      fx.text(this.x, this.y - this.r - 34, `${this.rewindHits}/3`, GOLD, 22);
      sfx('clank', 0.6);
      if (this.rewindHits >= 3) {
        this.rewinding = false;
        this.runner.stop();
        fx.text(this.x, this.y - this.r - 54, 'TIME BROKEN!', '#ffffff', 26);
        W.flash(GOLD, 0.4);
        this.addPosture(this.maxPosture);
      }
    }
    return null;
  }

  private *verdict(): Co {
    for (let i = 0; i < 2; i++) {
      yield* this.track(0.12, 10);
      const a = this.aP;
      this.facing = a;
      const d = i ? 0.35 : 0.55;
      const make = () => {
        this.tele(d);
        strike({
          team: 'enemy', owner: this, x: this.x, y: this.y, shape: { k: 'sector', r: 160, arc: 2.0, angle: a }, delay: d, active: 0.1,
          damage: 15 * this.dmgScale, knock: 400, color: ORANGE, tag: 'verdict',
          onStart: (s) => {
            fx.slash(s.x, s.y, a, 150, 2.0, i ? -1 : 1, GOLD, { width: 40 });
            sfx('slashHeavy', 0.6);
          },
        });
      };
      make();
      this.echo(make, this.x, this.y);
      yield d + 0.15;
    }
    yield 0.6;
  }

  private *orbs(): Co {
    this.tele(0.5, GOLD);
    yield 0.5;
    const n = 12, off = rand(0, TAU);
    const fire = () => {
      for (let i = 0; i < n; i++) {
        const par = i % 4 === 0;
        this.bullet(off + (i / n) * TAU, 170, { r: par ? 11 : 9, damage: par ? 12 : 9, color: par ? ORANGE : GOLD, parryable: par, posture: 10, life: 5, tag: 'timeorb' });
      }
      sfx('shootBig', 0.5);
      fx.ring(this.x, this.y, 10, 90, 0.3, GOLD, 4);
    };
    fire();
    this.echo(fire, this.x, this.y);
    yield 0.8;
  }

  private *gavel(): Co {
    const tx = this.p.x, ty = this.p.y;
    const make = () => {
      strike({
        team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 110 }, delay: 0.85, active: 0.08, damage: 20 * this.dmgScale,
        knock: 550, unblockable: true, parryable: false, color: RED, tag: 'gavel',
        onStart: () => {
          fx.ring(tx, ty, 10, 130, 0.4, GOLD, 8, true);
          sfx('slam', 0.7);
          W.shake(0.35);
        },
      });
    };
    this.tele(0.85, RED);
    make();
    // the echo lands where you WERE — keep moving
    strike({
      team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 1 }, delay: 2 - 0.85, active: 0.001, noHit: true, hideTele: true,
      onStart: () => !this.dead && make(),
    });
    yield 1.4;
  }

  private *bubble(): Co {
    this.tele(0.5, GOLD);
    yield 0.5;
    const n = this.phase === 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), rr = i === 0 ? 0 : rand(120, 240);
      const b = { x: this.p.x + Math.cos(a) * rr, y: this.p.y + Math.sin(a) * rr, r: 120, t: 6 };
      this.bubbles.push(b);
      fx.anim('vfx_time_bubble', b.x, b.y, { w: b.r * 2.2, dur: b.t, loop: true, under: true });
      fx.ring(b.x, b.y, 10, b.r, 0.4, GOLD, 4);
    }
    sfx('teleport', 0.6);
    yield 0.4;
  }

  private *rewind(): Co {
    if (this.hp > this.maxHp * 0.9) {
      yield* this.orbs();
      return;
    }
    this.rewinding = true;
    this.rewindHits = 0;
    this.tele(3, GOLD);
    hud.callout('REWIND', GOLD, 1.2, 40);
    sfx('laserCharge');
    fx.anim('vfx_rewind', this.x, this.y, { w: 260, dur: 3, loop: true, follow: this });
    for (let t = 0; t < 3; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      if (!this.rewinding) return;
      if (chance(0.4)) fx.ember(this.x + rand(-60, 60), this.y + rand(-60, 60), 0, -40, GOLD, 0.5, 3);
      yield 0;
    }
    this.rewinding = false;
    const heal = this.maxHp * 0.1;
    this.hp = Math.min(this.maxHp, this.hp + heal);
    fx.text(this.x, this.y - this.r - 30, '+' + Math.round(heal), '#6dff9e', 24);
    W.flash(GOLD, 0.3);
    sfx('heal');
    yield 0.4;
  }

  private *clockHands(): Co {
    this.tele(1.0, RED);
    sfx('laserCharge');
    const a0 = rand(0, TAU), dir = chance(0.5) ? 1 : -1, dur = 4.5;
    this.hands = [{ a: a0, on: 0 }, { a: a0 + Math.PI * 0.75, on: 0 }];
    for (const h of this.hands) {
      strike({
        team: 'enemy', owner: this, x: 0, y: 0, shape: { k: 'line', angle: h.a, len: W.arenaR, w: 30 }, delay: 1.0, active: dur, rehit: 0.4,
        damage: 14 * this.dmgScale, knock: 320, unblockable: true, parryable: false, color: RED, tag: 'hand',
        onStart: () => sfx('laser'),
        onUpdate: (s, dt) => {
          const sh = s.shape as { angle: number };
          if (s.delay <= 0) sh.angle += dir * (h === this.hands[0] ? 0.55 : 0.35) * dt;
          h.a = sh.angle;
          h.on = s.delay <= 0 ? 1 : 0.4;
        },
        onEnd: () => (h.on = 0),
      });
    }
    yield 1.0;
    yield 1.5; // keep fighting while the hands sweep
    this.hands = this.hands.filter((h) => h.on > 0);
  }

  onDeath() {
    this.bubbles = [];
    this.hands = [];
  }

  /** clock hands + the floor-level bubble rims */
  drawFloor(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bubbles) {
      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = Math.min(1, b.t) * 0.5;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,77,0.06)';
      ctx.fill();
    }
    ctx.restore();
    for (const h of this.hands) {
      if (h.on <= 0) continue;
      const L = W.arenaR;
      if (!sprites.draw(ctx, 'boss_tempus_hand', 0, 0, { angle: h.a, w: L, alpha: 0.5 + h.on * 0.5, outline: RED, outlineAlpha: h.on * 0.6 })) {
        ctx.save();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 14;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(h.a) * L, Math.sin(h.a) * L);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    const spr = this.drawSpriteBoss(ctx);
    if (!spr) {
      const r = this.r;
      const pts: [number, number][] = [];
      for (let i = 0; i < 12; i++) pts.push([Math.cos((i / 12) * TAU) * r, Math.sin((i / 12) * TAU) * r]);
      this.glowPoly(ctx, pts, this.rimColor(), '#1a1405', 4);
      ctx.save();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.handA) * r * 0.8, this.y + Math.sin(this.handA) * r * 0.8);
      ctx.stroke();
      ctx.restore();
    }
    if (this.rewinding) {
      // the hourglass weak point
      const pulse = 1 + Math.sin(W.time * 14) * 0.1;
      if (!sprites.draw(ctx, 'boss_tempus_hourglass', this.x, this.y - 6, { w: 40 * pulse, additive: true })) {
        ctx.save();
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 6, 12 * pulse, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

