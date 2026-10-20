/**
 * Act II boss 1 — NYXARA, THE BLIGHT QUEEN. Teaches target priority + space control.
 * Phase 1: rooted in the centre, sweeping tendrils; spore pods sprout and burst into creeping poison.
 * Phase 2: uproots, vine-dashes, calls broodlings, BLOOM detonates every pod at once (hide close to her).
 * Weak point: hitting a ripe pod launches it into Nyxara (posture ×3).
 */
import { TAU, rand, dist, chance, angleTo } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { sprites } from '../../render/sprites';
import { W, shoot, strike, type HitInfo, type HitResult, type Strike } from '../world';
import { Enemy, RED, ORANGE } from '../enemies';
import { Swarmling } from '../enemies2';
import { Boss } from './base';
import { T } from '../tuning';
import { hazard } from './hazards';

const GREEN = '#7dff4d';

/** a spore pod: ripens in 6s then bursts into a poison patch; hit it when ripe to fling it at the queen */
export class SporePod extends Enemy {
  ripeAt = 3;
  burstAt = 6;
  constructor(x: number, y: number, public queen: Nyxara) {
    super(x, y);
    this.hp = this.maxHp = 26;
    this.r = 16;
    this.color = GREEN;
    this.kbResist = 1;
    this.unstoppable = true;
    this.name = 'Spore Pod';
  }
  get ripe() {
    return this.age >= this.ripeAt;
  }
  preHit(h: HitInfo): HitResult | null {
    if (!this.ripe || h.kind === 'aoe' || this.queen.dead) return null;
    // fling the ripe pod back into the queen
    this.dead = true;
    const q = this.queen;
    const a = angleTo(this.x, this.y, q.x, q.y);
    shoot({
      team: 'player', x: this.x, y: this.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 16, damage: 45, posture: q.maxPosture * 0.3,
      color: GREEN, kind: 'orb', homing: 9, target: q, life: 3, tag: 'pod', noObstacle: true,
      onHit: () => {
        fx.anim('vfx_plague_burst', q.x, q.y, { w: 220 });
        fx.text(q.x, q.y - q.r - 30, 'SPORE RETURN!', GREEN, 20);
        W.shake(0.4);
      },
    });
    fx.ring(this.x, this.y, 10, 60, 0.3, GREEN, 5);
    sfx('parry', 0.6);
    return 'shield';
  }
  think(dt: number) {
    this.vx = this.vy = 0;
    if (this.age >= this.burstAt) this.burst();
    void dt;
  }
  burst() {
    if (this.dead) return;
    this.dead = true;
    hazard(this.queen, this.x, this.y, 90, 7, 7, GREEN, 'vfx_poison_ground', 'poison');
    fx.anim('vfx_plague_burst', this.x, this.y, { w: 200 });
    fx.shards(this.x, this.y, 14, 300, GREEN, 0.7, 5);
    sfx('explosion', 0.5);
  }
  draw(ctx: CanvasRenderingContext2D) {
    const ripe = this.ripe;
    const pulse = 1 + Math.sin(this.age * (ripe ? 14 : 5)) * 0.08;
    if (!sprites.draw(ctx, ripe ? 'boss_nyxara_pod_ripe' : 'boss_nyxara_pod', this.x, this.y, { w: this.r * 2.8 * pulse, flash: this.hitFlash > 0 ? 0.7 : 0, outline: ripe ? '#ffe14d' : GREEN, outlineAlpha: 0.7 })) {
      ctx.save();
      ctx.fillStyle = '#0d1a08';
      ctx.strokeStyle = ripe ? '#ffe14d' : GREEN;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * pulse, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // ripening timer
    ctx.save();
    ctx.strokeStyle = ripe ? RED : GREEN;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, this.age / this.burstAt));
    ctx.stroke();
    ctx.restore();
  }
}

export class Nyxara extends Boss {
  rooted = true;
  pods: SporePod[] = [];
  /** tendril visuals — each one lives exactly as long as its strike (parried / interrupted → gone) */
  private tendrils: { a: number; len: number; s?: Strike }[] = [];
  private podT = 3;
  constructor(x: number, y: number) {
    super(0, -60);
    void x;
    void y;
    this.spriteKey = 'boss_nyxara';
    this.hp = this.maxHp = Math.round(T.bossHp.nyxara * T.diffHp[W.diff]);
    this.maxPosture = Math.round(300 * T.bossPosture);
    this.r = 40;
    this.color = GREEN;
    this.phase2Color = '#d4ff3d';
    this.kbResist = 1;
    this.title = 'NYXARA';
    this.subtitle = 'THE BLIGHT QUEEN — ราชินีพรรณพิษ · ทำลายฝักสปอร์ก่อนมันระเบิด';
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'attack', w: 3, fn: () => this.tendrilSweep() },
      { name: 'spit', w: 2, cd: 2.5, fn: () => this.spit() },
      { name: 'lash', w: 2, max: 260, cd: 3, fn: () => this.lash() },
      { name: 'vine', w: 3, phase: 2, min: 160, cd: 3, fn: () => this.vineDash() },
      { name: 'brood', w: 1, phase: 2, cd: 10, fn: () => this.brood() },
      { name: 'bloom', w: 2, phase: 2, cd: 12, fn: () => this.bloom() },
    ];
  }

  enterPhase2() {
    this.rooted = false;
    this.kbResist = 0.9;
    this.restMul = 0.85;
    fx.shards(this.x, this.y, 30, 500, '#5a3a1a', 1.2, 8);
    sfx('slam');
  }

  idle(dt: number) {
    this.face(this.aP, dt, 3);
    if (this.rooted) {
      this.vx = this.vy = 0;
    } else {
      const a = this.aP, d = this.dP;
      this.steer(this.x + Math.cos(a) * (d - 220), this.y + Math.sin(a) * (d - 220), 170, dt, 3);
    }
  }

  think(dt: number) {
    super.think(dt);
    if (!this.active || this.dead) return;
    // pods keep sprouting regardless of the move in progress
    this.pods = this.pods.filter((p) => !p.dead);
    this.podT -= dt;
    if (this.podT <= 0 && this.pods.length < (this.phase === 2 ? 5 : 3)) {
      this.podT = this.phase === 2 ? 3.2 : 4.2;
      this.sprout();
    }
  }

  private sprout() {
    for (let k = 0; k < 10; k++) {
      const a = rand(0, TAU), rr = rand(200, W.arenaR - 70);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (dist(x, y, this.p.x, this.p.y) < 120) continue;
      if (this.pods.some((p) => dist(p.x, p.y, x, y) < 110)) continue;
      const pod = new SporePod(x, y, this);
      this.pods.push(pod);
      W.enemies.push(pod);
      fx.burst(x, y, 10, 160, GREEN, 0.4, 3);
      sfx('spawn', 0.4);
      return;
    }
  }

  /** drop vines whose strike is over (never clear live ones: on HARD+ the move timer runs ahead of the strikes) */
  private pruneTendrils() {
    this.tendrils = this.tendrils.filter((t) => t.s && !t.s.dead);
  }

  onDeath() {
    for (const p of this.pods) p.dead = true;
    this.tendrils = [];
  }

  private *tendrilSweep(): Co {
    const n = this.phase === 2 ? 5 : 4;
    const dir = chance(0.5) ? 1 : -1;
    const a0 = rand(0, TAU);
    const sweep = 1.3 * dir;
    this.tele(0.8);
    const len = 420;
    this.pruneTendrils();
    for (let i = 0; i < n; i++) {
      const t: { a: number; len: number; s?: Strike } = { a: a0 + (i * TAU) / n, len };
      this.tendrils.push(t);
      t.s = this.atk({ k: 'line', angle: t.a, len, w: 34 }, {
        delay: 0.8, active: 1.1, damage: 14, knock: 380, tag: 'tendril', posture: 0,
        onUpdate: (s, dt) => {
          const sh = s.shape as { angle: number };
          if (s.delay <= 0) sh.angle += (sweep / 1.1) * dt;
          t.a = sh.angle;
        },
      });
    }
    sfx('charge', 0.5);
    yield 0.8;
    sfx('slashHeavy', 0.7);
    yield 1.15;
    this.pruneTendrils();
    yield 0.5;
  }

  private *lash(): Co {
    yield* this.track(0.15, 8);
    const a = this.aP;
    this.facing = a;
    this.tele(0.55);
    const t: { a: number; len: number; s?: Strike } = { a, len: 300 };
    this.pruneTendrils();
    this.tendrils.push(t);
    t.s = this.atk({ k: 'sector', r: 300, arc: 0.9, angle: a }, {
      delay: 0.55, active: 0.12, damage: 16, knock: 480, tag: 'lash',
      onStart: () => {
        fx.slash(this.x, this.y, a, 280, 0.9, 1, GREEN, { width: 40 });
        sfx('slashHeavy', 0.6);
      },
    });
    yield 0.75;
    this.pruneTendrils();
    yield 0.5;
  }

  private *spit(): Co {
    this.tele(0.45, GREEN);
    yield 0.45;
    const n = this.phase === 2 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = this.aP + (i - (n - 1) / 2) * 0.22;
      const par = i === Math.floor(n / 2);
      this.bullet(a, par ? 260 : 300, {
        r: par ? 12 : 9, damage: par ? 12 : 9, color: par ? ORANGE : GREEN, parryable: par, posture: 12, life: 3.5, tag: 'spore',
        onDeath: (b) => {
          if (!b.reflected && chance(0.35)) hazard(this, b.x, b.y, 55, 3, 5, GREEN, 'vfx_poison_ground', 'poison');
        },
      });
    }
    sfx('shootBig', 0.5);
    yield 0.7;
  }

  private *vineDash(): Co {
    yield* this.track(0.2, 10);
    const a = this.aP;
    this.facing = a;
    this.tele(0.65);
    this.atk({ k: 'line', angle: a, len: 600, w: this.r * 2 }, { delay: 0.65, active: 0.001, noHit: true, follow: true });
    yield 0.65;
    sfx('dash');
    const s = this.atk({ k: 'circle', r: this.r + 10 }, { active: 0.5, damage: 18, knock: 600, tag: 'vine' });
    for (let t = 0; t < 0.5; t += this.dt) {
      if (s.dead) break;
      this.vx = Math.cos(a) * 1150;
      this.vy = Math.sin(a) * 1150;
      if (chance(0.5)) fx.ghost(this.x, this.y, a, this.r, this.phase2Color, 0.2, 'circle');
      if (chance(0.15)) hazard(this, this.x, this.y, 45, 2.5, 5, GREEN, 'vfx_poison_ground', 'poison');
      yield 0;
    }
    s.dead = true;
    yield 0.7;
  }

  private *brood(): Co {
    this.tele(0.6, GREEN);
    yield 0.6;
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      const e = new Swarmling(this.x + Math.cos(a) * 50, this.y + Math.sin(a) * 50);
      e.hp = e.maxHp = Math.round(e.maxHp * W.scale.hp);
      e.color = this.phase2Color;
      W.enemies.push(e);
    }
    sfx('spawn');
    yield 0.4;
  }

  /** every pod detonates; only the ring hugging Nyxara is safe */
  private *bloom(): Co {
    for (let i = 0; i < 2; i++) this.sprout();
    this.tele(1.5, RED);
    sfx('roar', 0.6);
    const safe = 150, R = W.arenaR;
    strike({
      team: 'enemy', owner: this, x: this.x, y: this.y, follow: true, shape: { k: 'ring', r: (safe + R + 300) / 2, w: R + 300 - safe }, delay: 1.5, active: 0.1,
      damage: 24 * this.dmgScale, knock: 500, unblockable: true, parryable: false, color: RED, tag: 'bloom',
      onStart: () => {
        for (const p of this.pods) p.burst();
        W.flash(GREEN, 0.4);
        W.shake(0.8);
        sfx('explosion');
      },
    });
    for (let t = 0; t < 1.5; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0;
    }
    yield 1.0;
  }

  protected stateNames(st: string): string[] {
    const n = super.stateNames(st);
    return this.rooted && (st === 'idle' || st === 'move') ? ['boss_nyxara_rooted', ...n] : n;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // tendrils under the body
    for (const t of this.tendrils) {
      const s = t.s;
      if (!s || s.dead) continue;
      // telegraph: a thinner vine creeping out · active: full length and solid
      const k = s.delay > 0 && s.tele > 0 ? 1 - s.delay / s.tele : 1;
      const len = t.len * (s.delay > 0 ? 0.4 + 0.5 * k : 1);
      const alpha = s.delay > 0 ? 0.45 + 0.35 * k : 1;
      const ex = this.x + Math.cos(t.a) * len, ey = this.y + Math.sin(t.a) * len;
      ctx.save();
      ctx.globalAlpha = alpha;
      const drawn = sprites.draw(ctx, 'boss_nyxara_tendril', (this.x + ex) / 2, (this.y + ey) / 2, { angle: t.a, w: len, outline: this.rimColor(), outlineAlpha: 0.6 });
      ctx.restore();
      if (!drawn) {
        ctx.save();
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 10;
        ctx.globalAlpha = 0.8 * alpha;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const r = this.r;
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) pts.push([Math.cos((i / 10) * TAU) * r * (i % 2 ? 0.7 : 1), Math.sin((i / 10) * TAU) * r * (i % 2 ? 0.7 : 1)]);
    this.glowPoly(ctx, pts, this.rimColor(), '#0d1a08', 4);
    this.drawStun(ctx);
  }
}
