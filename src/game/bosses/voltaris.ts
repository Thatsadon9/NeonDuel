/**
 * Act II boss 3 — VOLTARIS, THE STORM SERPENT. Teaches positioning + moving targets.
 * Head + 8 body segments + tail swim around the spire. Three glowing segments are weak points:
 * break the posture of all three and the head crashes down, staggered.
 * Moves: DIVE across the arena (red line), LIGHTNING BREATH fan, ROD STRIKE (stay away from glowing rods).
 * Phase 2: storm (random lightning), coil (arena tightens for a while).
 */
import { TAU, rand, dist, chance, angleTo, angleDiff } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { sprites } from '../../render/sprites';
import { W, strike, type HitInfo, type HitResult } from '../world';
import { Enemy, RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { skyStrike } from './hazards';
import { hud } from '../../ui/hud';

const BLUE = '#5ad8ff';
const SEGS = 9; // 8 body + tail
const WEAK = [2, 4, 6];
const SPACING = 42;

export class VoltSeg extends Enemy {
  segPosture = 0;
  broken = false;
  constructor(public head: Voltaris, public idx: number) {
    super(head.x, head.y);
    this.r = idx === SEGS - 1 ? 20 : 26 - idx;
    this.hp = this.maxHp = 1e9;
    this.color = BLUE;
    this.solid = false;
    this.kbResist = 1;
    this.unstoppable = true;
    this.name = 'Voltaris';
  }
  get weak() {
    return WEAK.includes(this.idx) && !this.broken;
  }
  preHit(h: HitInfo): HitResult | null {
    if (this.head.dead) return 'immune';
    if (!this.weak) {
      fx.sparks(this.x, this.y, h.angle + Math.PI, 0.8, 5, 300, '#bfe9ff', 0.2);
      return 'shield';
    }
    const res = this.head.onHit({ ...h, damage: h.damage * 0.75, posture: h.posture * 0.25, knock: 0, sx: this.x, sy: this.y });
    this.hitFlash = 0.1;
    this.segPosture += h.posture * 1.4 + h.damage * 0.4;
    if (this.segPosture >= 110) {
      this.broken = true;
      fx.text(this.x, this.y - 36, 'SEGMENT BREAK', '#ffe14d', 18);
      fx.shards(this.x, this.y, 18, 400, BLUE, 0.8, 6);
      sfx('guardBreak', 0.8);
      W.shake(0.3);
      this.head.segmentBroken();
    }
    return res === 'immune' ? 'immune' : 'hit';
  }
  think() {
    this.vx = this.vy = 0;
  }
  update(dt: number) {
    this.tickCommon(dt);
    this.hp = this.maxHp;
    if (this.head.dead) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const tail = this.idx === SEGS - 1;
    const name = tail ? 'boss_voltaris_tail' : this.weak ? 'boss_voltaris_body_weak' : 'boss_voltaris_body';
    const pulse = this.weak ? 1 + Math.sin(W.time * 10 + this.idx) * 0.05 : 1;
    const alpha = this.broken ? 0.6 : 1;
    if (!sprites.draw(ctx, name, this.x, this.y, { angle: this.facing, w: this.r * 2.6 * pulse, alpha, flash: this.hitFlash > 0 ? 0.7 : 0, outline: this.weak ? '#ffe14d' : this.head.rimColor(), outlineAlpha: this.weak ? 0.9 : 0.5 })) {
      ctx.save();
      ctx.fillStyle = '#06121a';
      ctx.strokeStyle = this.weak ? '#ffe14d' : BLUE;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * pulse, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (this.weak) {
      // posture pip ring
      ctx.save();
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, this.segPosture / 110));
      ctx.stroke();
      ctx.restore();
    }
  }
}

export class Voltaris extends Boss {
  segs: VoltSeg[] = [];
  private trail: { x: number; y: number }[] = [];
  private spawned = false;
  private orbitA = 0;
  private orbitDir = 1;
  private rods: { a: number; glow: number }[] = [];
  private stormT = 1.5;
  private coilT = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_voltaris_head';
    this.hp = this.maxHp = W.hardMode ? 2000 : 1700;
    this.maxPosture = 300;
    this.r = 36;
    this.color = BLUE;
    this.phase2Color = '#ffffff';
    this.kbResist = 1;
    this.solid = false;
    this.title = 'VOLTARIS';
    this.subtitle = 'THE STORM SERPENT — งูพายุ · ทำลายปล้องเรืองแสง 3 ปล้องให้หัวตกพื้น';
    for (let i = 0; i < 6; i++) this.rods.push({ a: (i / 6) * TAU + 0.3, glow: 0 });
    this.orbitA = Math.atan2(y, x);
    for (let i = 0; i < SEGS; i++) this.segs.push(new VoltSeg(this, i));
    for (let i = 0; i < SEGS * SPACING; i += 4) this.trail.push({ x, y: y - i });
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'attack', w: 3, cd: 2.5, fn: () => this.dive() },
      { name: 'breath', w: 3, fn: () => this.breath() },
      { name: 'rods', w: 2, cd: 6, fn: () => this.rodStrike() },
      { name: 'coil', w: 2, phase: 2, cd: 14, fn: () => this.coil() },
    ];
  }
  enterPhase2() {
    this.restMul = 0.8;
  }

  /** the body is part of us — never push away from our own segments (only keep the player out of the head) */
  separate() {}

  segmentBroken() {
    if (this.segs.filter((s) => WEAK.includes(s.idx) && s.broken).length >= WEAK.length) {
      fx.text(this.x, this.y - 60, 'THE SERPENT FALLS!', '#ffe14d', 26);
      W.slowMo(0.4, 0.6);
      this.addPosture(this.maxPosture);
    }
  }
  onPostureBreak() {
    super.onPostureBreak();
    sfx('slam');
    W.shake(0.6);
    fx.ring(this.x, this.y, 20, 200, 0.5, BLUE, 8, true);
  }

  idle(dt: number) {
    // swim around the spire
    const R = this.coilT > 0 ? W.arenaR - 60 : 330;
    this.orbitA += this.orbitDir * dt * (this.phase === 2 ? 0.75 : 0.55);
    const tx = Math.cos(this.orbitA) * R, ty = Math.sin(this.orbitA) * R;
    this.steer(tx, ty, 300, dt, 4);
    this.face(Math.atan2(this.vy, this.vx), dt, 5);
    if (chance(dt * 0.08)) this.orbitDir *= -1;
  }

  update(dt: number) {
    if (!this.spawned) {
      this.spawned = true;
      for (const s of this.segs) W.enemies.push(s);
    }
    super.update(dt);
    // stagger ended → segments regrow
    if (this.staggered <= 0 && this.segs.some((s) => s.broken) && this.segs.filter((s) => s.broken).length >= WEAK.length) {
      for (const s of this.segs) {
        s.broken = false;
        s.segPosture = 0;
      }
    }
    // body follows the head's path
    const last = this.trail[0];
    if (!last || dist(last.x, last.y, this.x, this.y) > 4) this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 400) this.trail.length = 400;
    let acc = 0, ti = 0;
    for (const s of this.segs) {
      const want = (s.idx + 1) * SPACING;
      while (ti < this.trail.length - 1 && acc < want) {
        acc += dist(this.trail[ti].x, this.trail[ti].y, this.trail[ti + 1].x, this.trail[ti + 1].y);
        ti++;
      }
      const pt = this.trail[Math.min(ti, this.trail.length - 1)];
      const prev = this.trail[Math.max(0, ti - 1)];
      s.x = pt.x;
      s.y = pt.y;
      s.facing = angleTo(pt.x, pt.y, prev.x, prev.y);
    }
    for (const r of this.rods) r.glow = Math.max(0, r.glow - dt);
    if (this.coilT > 0) {
      this.coilT -= dt;
      if (this.coilT <= 0) W.arenaTargetR = 560;
    }
    // phase 2 storm
    if (this.phase === 2 && this.active && !this.dead && this.staggered <= 0) {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = rand(0.6, 1.0);
        const a = rand(0, TAU), rr = rand(0, 160);
        skyStrike(this, this.p.x + Math.cos(a) * rr, this.p.y + Math.sin(a) * rr, 70, 0.8, 12);
      }
    }
  }

  onDeath() {
    W.arenaTargetR = 560;
    for (const s of this.segs) s.dead = true;
  }

  private *dive(): Co {
    const p = this.p;
    const a = angleTo(this.x, this.y, p.x, p.y);
    this.facing = a;
    const len = dist(this.x, this.y, p.x, p.y) + 520;
    this.tele(0.9, RED);
    this.atk({ k: 'line', angle: a, len, w: this.r * 2 + 10 }, { delay: 0.9, active: 0.001, noHit: true, follow: false, unblockable: true, color: RED });
    for (let t = 0; t < 0.9; t += this.dt) {
      this.vx *= 0.85;
      this.vy *= 0.85;
      yield 0;
    }
    sfx('thunder', 0.7);
    const s = this.atk({ k: 'circle', r: this.r + 8 }, { active: len / 1400, damage: 20, knock: 650, unblockable: true, parryable: false, color: RED, tag: 'dive' });
    for (let t = 0; t < len / 1400; t += this.dt) {
      this.vx = Math.cos(a) * 1400;
      this.vy = Math.sin(a) * 1400;
      if (chance(0.5)) fx.bolt(this.x, this.y, this.x + rand(-60, 60), this.y + rand(-60, 60), '#bfe9ff', 2, 0.12);
      yield 0;
    }
    s.dead = true;
    this.orbitA = Math.atan2(this.y, this.x);
    yield 0.6;
  }

  private *breath(): Co {
    for (let t = 0; t < 0.4; t += this.dt) {
      this.face(this.aP, this.dt, 8);
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0;
    }
    this.tele(0.5, ORANGE);
    sfx('laserCharge', 0.6);
    yield 0.5;
    const n = this.phase === 2 ? 18 : 13;
    const dir = chance(0.5) ? 1 : -1;
    const a0 = this.aP - dir * 0.7;
    for (let i = 0; i < n; i++) {
      const a = a0 + dir * (1.4 * i) / n;
      this.facing = a;
      const par = i % 5 === 2;
      this.bullet(a, 360, { r: par ? 11 : 9, damage: par ? 12 : 10, color: par ? ORANGE : BLUE, parryable: par, posture: 10, life: 3, tag: 'lightning' });
      if (i % 2 === 0) sfx('shoot', 0.35);
      this.vx *= 0.7;
      this.vy *= 0.7;
      yield 0.07;
    }
    yield 0.5;
  }

  private *rodStrike(): Co {
    const n = this.phase === 2 ? 4 : 3;
    const picks = [...this.rods].sort(() => Math.random() - 0.5).slice(0, n);
    for (const r of picks) r.glow = 1.3;
    sfx('charge', 0.6);
    for (const r of picks) {
      const R = W.arenaR - 40;
      skyStrike(this, Math.cos(r.a) * R, Math.sin(r.a) * R, 150, 1.3, 22);
    }
    yield 1.6;
  }

  private *coil(): Co {
    this.coilT = 7;
    W.arenaTargetR = 400;
    hud.callout('COIL', BLUE, 1, 40);
    sfx('roar', 0.7);
    yield 0.6;
  }

  /** lightning rods around the rim */
  drawFloor(ctx: CanvasRenderingContext2D) {
    const R = W.arenaR - 40;
    for (const r of this.rods) {
      const x = Math.cos(r.a) * R, y = Math.sin(r.a) * R;
      if (sprites.draw(ctx, 'prop_lightning_rod', x, y, { w: 46, outline: r.glow > 0 ? '#ffffff' : BLUE, outlineAlpha: 0.6 + r.glow * 0.4 })) continue;
      ctx.save();
      ctx.fillStyle = '#0a1420';
      ctx.strokeStyle = r.glow > 0 ? '#ffffff' : BLUE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (r.glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + Math.sin(W.time * 30) * 0.3;
        ctx.fillStyle = BLUE;
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const r = this.r;
    this.glowPoly(ctx, [[r * 1.4, 0], [0, r], [-r, r * 0.6], [-r, -r * 0.6], [0, -r]], this.rimColor(), '#06121a', 4);
    this.drawStun(ctx);
    void angleDiff;
  }
}

export function makeVoltaris(): Boss[] {
  return [new Voltaris(0, -330)];
}

void strike;
