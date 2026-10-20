/** Boss base: weighted move scheduler, two phases, posture/stagger, parry reel, intro & death hooks. */
import { TAU, dist, rand, angleTo } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { cam } from '../../render/camera';
import { sfx, audio } from '../../audio/audio';
import { W, strike, type Actor, type HitInfo } from '../world';
import { T } from '../tuning';
import { Enemy, RED } from '../enemies';
import { hud } from '../../ui/hud';
import { sprites } from '../../render/sprites';

export interface Move {
  name: string;
  w: number; // weight
  min?: number; // distance range to player
  max?: number;
  cd?: number; // per-move cooldown
  phase?: 1 | 2; // only usable from this phase
  fn: () => Co;
  last?: number;
}

export abstract class Boss extends Enemy {
  isBoss = true;
  phase: 1 | 2 = 1;
  title = 'BOSS';
  subtitle = '';
  speed = 1; // global speed multiplier (phase 2, hard mode)
  rest = 0.8;
  restMul = 1;
  moves: Move[] = [];
  reel = 0; // parry stagger
  transitioning = false;
  active = false; // false during intro
  phase2Color = '#ff2d4a';
  lastMove = '';
  /** if false this boss never transitions to phase 2 by hp (e.g. twins use partner death) */
  hpPhase = true;

  constructor(x: number, y: number) {
    super(x, y);
    this.kbResist = 0.92;
    this.speed = T.diffSpeed[W.diff];
    this.speed *= this.speedMul; // endless scaling (capped when computed)
  }

  abstract idle(dt: number): void;
  abstract buildMoves(): void;

  onParried(_by: Actor) {
    this.addPosture(this.maxPosture * 0.2);
    if (this.staggered > 0) return;
    this.runner.stop();
    this.reel = 0.75;
    this.rest = 0.5;
    this.vx = Math.cos(this.aP + Math.PI) * 200;
    this.vy = Math.sin(this.aP + Math.PI) * 200;
    // cancel this boss' pending telegraphs
    for (const s of W.strikes) if (s.owner === this && s.team === 'enemy') s.dead = true;
  }
  onPostureBreak() {
    this.runner.stop();
    for (const s of W.strikes) if (s.owner === this && s.team === 'enemy') s.dead = true;
    this.teleT = 0;
  }

  postureTakenMul(_h: HitInfo) {
    return this.openT > 0 ? T.punish.posture : 1;
  }
  damageTakenMul(_h: HitInfo) {
    return this.openT > 0 ? T.punish.damage : 1;
  }

  think(dt: number) {
    const sdt = dt * this.speed;
    this.dt = sdt;
    if (!this.active) return;
    if (this.staggered > 0) {
      this.vx *= 0.9;
      this.vy *= 0.9;
      return;
    }
    if (this.reel > 0) {
      this.reel -= dt;
      return;
    }
    if (this.openT > 0 && !this.runner.running) {
      this.openT -= dt;
      this.vx *= 0.85;
      this.vy *= 0.85;
      if (this.openT <= 0) this.rest = Math.min(this.rest, 0.25);
      return;
    }
    if (this.hpPhase && this.phase === 1 && this.hp <= this.maxHp * (W.diff >= 2 ? T.nightmare.phase2At : 0.5) && !this.transitioning && !this.runner.running) {
      this.runner.run(this.phaseTransition());
    }
    if (this.runner.step(sdt)) return;
    this.idle(sdt);
    this.rest -= sdt;
    if (this.rest <= 0 && !this.p.dead) {
      const m = this.pickMove();
      if (m) {
        m.last = W.time;
        this.lastMove = m.name;
        this.runner.run(this.wrap(m.fn()));
      } else this.rest = 0.2;
    }
  }

  private *wrap(g: Co): Co {
    this.usedRed = false;
    yield* g;
    this.rest = rand(0.45, 0.9) * this.restMul * (this.phase === 2 ? 0.7 : 1) * (W.hasAffix('frenzied') ? 0.55 : 1);
    // PUNISH WINDOW: after a big (red / unblockable) move the boss is winded and exposed
    // HARD / NIGHTMARE: bosses string moves together into combos
    if (!this.usedRed && Math.random() < T.diffChain[W.diff]) this.rest = 0.05;
    if (this.usedRed && this.staggered <= 0) {
      this.openT = T.punish.dur * (W.diff >= 2 ? 0.6 : W.diff >= 1 ? 0.8 : 1);
      fx.text(this.x, this.y - this.r - 34, 'OPEN!', '#ffe14d', 20);
    }
  }
  /** seconds left in the current punish window */
  openT = 0;

  protected pickMove(): Move | null {
    const d = this.dP;
    const ok = this.moves.filter((m) =>
      (m.phase === undefined || m.phase <= this.phase) &&
      (m.min === undefined || d >= m.min) && (m.max === undefined || d <= m.max) &&
      (m.cd === undefined || m.last === undefined || W.time - m.last >= m.cd));
    if (!ok.length) return null;
    // avoid repeating the same move twice in a row when possible
    const pool = ok.length > 1 ? ok.filter((m) => m.name !== this.lastMove) : ok;
    let total = 0;
    for (const m of pool) total += m.w;
    let r = Math.random() * total;
    for (const m of pool) {
      r -= m.w;
      if (r <= 0) return m;
    }
    return pool[pool.length - 1];
  }

  /** overridable phase-2 setup */
  enterPhase2() {}

  *phaseTransition(): Co {
    this.transitioning = true;
    this.lastMove = 'phase';
    this.invuln = 1.6;
    for (const s of W.strikes) if (s.owner === this) s.dead = true;
    this.tele(1.2, RED);
    sfx('roar');
    W.slowMo(0.35, 0.8);
    cam.focus = { x: this.x, y: this.y };
    cam.zoomMul = 1.25;
    hud.callout('PHASE II', this.phase2Color, 1.4, 56);
    for (let t = 0; t < 1.0; t += this.dt) {
      if (Math.random() < 0.8) {
        const a = rand(0, TAU);
        fx.ember(this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90, -Math.cos(a) * 200, -Math.sin(a) * 200, this.phase2Color, 0.4, 3);
      }
      W.shake(0.02);
      yield 0;
    }
    this.phase = 2;
    this.speed *= 1.18;
    this.enterPhase2();
    audio.intensity = 3;
    cam.focus = null;
    cam.zoomMul = 1;
    W.flash(this.phase2Color, 0.4);
    W.shake(0.7);
    sfx('explosion');
    fx.ring(this.x, this.y, 20, 420, 0.7, this.phase2Color, 10, true);
    fx.shards(this.x, this.y, 30, 600, this.phase2Color, 1.2, 8);
    // shockwave pushes player away (unblockable but harmless-ish)
    strike({
      team: 'enemy', owner: this, x: this.x, y: this.y, shape: { k: 'circle', r: 260 }, active: 0.05, damage: 6 * this.dmgScale,
      knock: 900, unblockable: true, parryable: false, color: RED, tag: 'roar', hideActive: true,
    });
    this.transitioning = false;
    this.rest = 0.6;
  }

  /** cinematic death; called by run controller */
  *deathSequence(): Co {
    sfx('death');
    W.slowMo(0.2, 2.0);
    cam.focus = { x: this.x, y: this.y };
    cam.zoomMul = 1.4;
    for (let i = 0; i < 6; i++) {
      fx.shards(this.x + rand(-30, 30), this.y + rand(-30, 30), 12, 500, i % 2 ? '#ffffff' : this.color, 1.4, 8);
      fx.ring(this.x, this.y, 10, 120 + i * 50, 0.6, this.color, 6);
      sfx('explosion', 0.6);
      W.shake(0.4);
      yield 0.1;
    }
    W.flash('#ffffff', 0.8);
    fx.ring(this.x, this.y, 10, 700, 1.2, '#ffffff', 12);
    fx.shards(this.x, this.y, 60, 900, this.color, 2, 10);
    fx.burst(this.x, this.y, 80, 700, '#ffffff', 1.5, 4);
    W.shake(1);
    cam.focus = null;
    cam.zoomMul = 1;
  }

  // ------------- common move helpers
  protected *walkTo(x: number, y: number, speed: number, maxT: number): Co {
    for (let t = 0; t < maxT; t += this.dt) {
      this.steer(x, y, speed, this.dt, 8);
      this.face(angleTo(this.x, this.y, x, y), this.dt);
      if (dist(this.x, this.y, x, y) < 20) break;
      yield 0;
    }
  }
  protected *track(t: number, rate = 8): Co {
    for (let u = 0; u < t; u += this.dt) {
      this.face(this.aP, this.dt, rate);
      this.vx *= 0.85;
      this.vy *= 0.85;
      yield 0;
    }
  }

  rimColor() {
    return this.phase === 2 ? this.phase2Color : this.color;
  }
  protected bodyState(): string {
    if (this.staggered > 0 || this.reel > 0) return 'stagger';
    return super.bodyState();
  }
  /** candidates: <key>_<move>_windup, <key>_<move>, <key>_<state>, <key>_idle — each preferring a _p2 variant in phase 2 */
  protected stateNames(st: string): string[] {
    const k = this.spriteKey, m = this.lastMove;
    const c: string[] = [];
    if (st === 'windup' && m) c.push(`${k}_${m}_windup`);
    if (st === 'attack' && m) c.push(`${k}_${m}`);
    c.push(`${k}_${st}`, `${k}_idle`);
    return this.phase === 2 ? c.flatMap((n) => [n + '_p2', n]) : c;
  }
  /** sprite path for the whole boss; override to add separate parts. returns false → procedural art */
  protected drawSpriteBoss(ctx: CanvasRenderingContext2D): boolean {
    if (!this.drawBody(ctx, false)) return false;
    this.drawStun(ctx);
    return true;
  }
  drawBossCommon(ctx: CanvasRenderingContext2D) {
    this.drawShadow(ctx);
    if (this.openT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ffe14d';
      ctx.globalAlpha = 0.5 + Math.sin(W.time * 18) * 0.25;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 12, -W.time * 3, -W.time * 3 + TAU);
      ctx.stroke();
      ctx.restore();
    }
    this.drawTele(ctx, this.r + 14);
    if (this.staggered > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ffe14d';
      ctx.globalAlpha = 0.6 + Math.sin(W.time * 16) * 0.3;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 22, W.time * 2, W.time * 2 + TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}
