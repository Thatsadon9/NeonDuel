/** Boss 5 — MIRROR SOVEREIGN. Your shadow: dashes, parries, combos — and in phase 2 copies your favourite skill. */
import { TAU, angleTo, angleDiff, dist, rand, chance, clamp } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W, strike, type HitInfo, type HitResult } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { sprites } from '../../render/sprites';
import { hud } from '../../ui/hud';

export class Mirror extends Boss {
  private strafe = 1;
  private dodgeCd = 0;
  private stanceT = 0;
  private countered = false;
  private stormT = 0;
  private echo = 'storm';
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_mirror';
    this.hp = this.maxHp = W.hardMode ? 1350 : 1100;
    this.maxPosture = 300;
    this.r = 18;
    this.color = '#ff5af1';
    this.phase2Color = '#ffffff';
    this.kbResist = 0.85;
    this.title = 'MIRROR SOVEREIGN';
    this.subtitle = 'เงาสะท้อนของเจ้า — ใช้ทุกอย่างที่เจ้าใช้ อย่าโจมตีใส่ท่าตั้งรับสีขาว';
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'combo', w: 4, max: 210, fn: () => this.combo() },
      { name: 'thrust', w: 3, min: 200, fn: () => this.thrust() },
      { name: 'stance', w: 2, max: 260, cd: 6, fn: () => this.stance() },
      { name: 'phantom', w: 2, cd: 6, fn: () => this.phantom() },
      { name: 'echo', w: 3, phase: 2, cd: 6, fn: () => this.echoSkill() },
      { name: 'clones', w: 2, phase: 2, cd: 7, fn: () => this.clones() },
    ];
  }

  enterPhase2() {
    this.restMul = 0.6;
    W.arenaTargetR = 420;
    hud.callout('THE ARENA CLOSES', '#ff5af1', 1.2, 30);
    // pick the player's most-used skill to mirror
    const use = W.stats.skillUse;
    let best = 'storm', bn = -1;
    for (const [k, v] of Object.entries(use)) if (v > bn && k !== 'overdrive') (best = k), (bn = v);
    const map: Record<string, string> = { storm: 'storm', phantom: 'phantom', fan: 'fan', mark: 'fan', leap: 'leap', well: 'leap' };
    this.echo = map[best] ?? 'storm';
  }

  preHit(h: HitInfo): HitResult | null {
    if (this.stanceT > 0 && !h.skill && h.kind !== 'proj' && h.tag !== 'execute') {
      // heavy hits break the stance
      if (h.posture >= 22) {
        this.stanceT = 0;
        this.addPosture(this.maxPosture * 0.25);
        fx.text(this.x, this.y - 40, 'STANCE BROKEN', '#ffe14d', 18);
        sfx('guardBreak');
        return null;
      }
      if (!this.countered) {
        this.countered = true;
        this.stanceT = 0;
        sfx('parry');
        W.flash('#ff5af1', 0.3);
        W.hitStop(0.1);
        fx.text(this.x, this.y - 40, 'COUNTER', '#ff5af1', 22);
        this.runner.run(this.counter());
      }
      return 'shield';
    }
    return null;
  }

  update(dt: number) {
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.stanceT = Math.max(0, this.stanceT - dt);
    if (this.stormT > 0) this.stormT -= dt;
    // shrink arena towards target
    if (W.arenaR > W.arenaTargetR) W.arenaR = Math.max(W.arenaTargetR, W.arenaR - 60 * dt);
    super.update(dt);
  }

  idle(dt: number) {
    const a = this.aP, d = this.dP;
    const want = 150;
    const tx = this.x + Math.cos(a) * (d - want) + Math.cos(a + Math.PI / 2) * 160 * this.strafe;
    const ty = this.y + Math.sin(a) * (d - want) + Math.sin(a + Math.PI / 2) * 160 * this.strafe;
    this.steer(tx, ty, 300, dt, 6);
    this.face(a, dt, 10);
    if (chance(dt * 0.8)) this.strafe *= -1;
    // react to player attacks with a sidestep dash
    const p = this.p;
    if (this.dodgeCd <= 0 && p.state === 'attack' && p.atkPhase === 'startup' && d < 170 && chance(this.phase === 2 ? 0.5 : 0.35)) {
      this.dodgeCd = 1.3;
      this.sidestep();
    } else if (p.state === 'attack' && this.dodgeCd <= 0) this.dodgeCd = 0.4;
  }

  private sidestep() {
    const a = this.aP + (chance(0.5) ? 1 : -1) * Math.PI / 2 + rand(-0.3, 0.3);
    const x0 = this.x, y0 = this.y;
    this.x += Math.cos(a) * 150;
    this.y += Math.sin(a) * 150;
    W.confine(this);
    for (let i = 0; i < 6; i++) fx.ghost(x0 + (this.x - x0) * (i / 6), y0 + (this.y - y0) * (i / 6), this.facing, this.r, this.color, 0.25);
    this.invuln = 0.15;
    sfx('dash', 0.7);
  }

  private *combo(): Co {
    const n = this.phase === 2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      yield* this.track(0.06, 16);
      const a = this.aP;
      const last = this.phase === 2 && i === n - 1;
      const delay = i === 0 ? 0.34 : 0.22;
      if (last) {
        this.tele(0.5, RED);
        this.atk({ k: 'line', angle: a, len: 240, w: 50 }, {
          delay: 0.5, active: 0.1, damage: 20, knock: 500, unblockable: true, parryable: false, color: RED, tag: 'mthrust', follow: false,
          onStart: () => {
            this.vx = Math.cos(a) * 900;
            this.vy = Math.sin(a) * 900;
            sfx('stab');
          },
        });
        yield 0.6;
        break;
      }
      this.tele(delay);
      this.atk({ k: 'sector', r: 108, arc: 2.2, angle: a }, {
        delay, active: 0.08, damage: 13, knock: 280, tag: 'mslash',
        onStart: () => {
          this.vx = Math.cos(a) * 360;
          this.vy = Math.sin(a) * 360;
          fx.slash(this.x, this.y, a, 105, 2.2, i % 2 ? -1 : 1, this.color, { width: 38, follow: this });
          sfx('slash', 0.75);
        },
      });
      yield delay + 0.08;
    }
    yield 0.55;
  }

  private *thrust(): Co {
    yield* this.track(0.1, 14);
    const a = this.aP;
    const len = Math.min(520, this.dP + 120);
    this.tele(0.42);
    this.atk({ k: 'line', angle: a, len, w: 44 }, {
      delay: 0.42, active: 0.08, damage: 16, knock: 380, tag: 'mdash', follow: false,
      onStart: (s) => {
        const x0 = this.x, y0 = this.y;
        this.x += Math.cos(a) * (len - 20);
        this.y += Math.sin(a) * (len - 20);
        W.confine(this);
        s.x = x0;
        s.y = y0;
        for (let k = 0; k < 8; k++) fx.ghost(x0 + (this.x - x0) * (k / 8), y0 + (this.y - y0) * (k / 8), a, this.r, this.color, 0.3);
        fx.beam(x0, y0, this.x, this.y, 6, this.color, 0.25);
        sfx('dash');
      },
    });
    yield 0.6;
    yield 0.4;
  }

  private *stance(): Co {
    this.stanceT = 1.5;
    this.countered = false;
    sfx('chargeReady');
    fx.ring(this.x, this.y, 50, 15, 0.3, '#ffffff', 3);
    for (let t = 0; t < 1.5 && this.stanceT > 0; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      this.face(this.aP, this.dt, 8);
      yield 0;
    }
    if (!this.countered) yield 0.3;
  }

  private *counter(): Co {
    const behind = this.p.facing + Math.PI;
    fx.ghost(this.x, this.y, this.facing, this.r, this.color, 0.3);
    this.x = this.p.x + Math.cos(behind) * 70;
    this.y = this.p.y + Math.sin(behind) * 70;
    W.confine(this);
    sfx('teleport');
    const a = this.aP;
    this.facing = a;
    this.tele(0.26);
    this.atk({ k: 'sector', r: 115, arc: 2.4, angle: a }, {
      delay: 0.26, active: 0.08, damage: 22, knock: 500, tag: 'mcounter',
      onStart: () => {
        fx.slash(this.x, this.y, a, 110, 2.4, 1, '#ffffff', { width: 40, follow: this });
        sfx('slashHeavy');
      },
    });
    yield 0.5;
    yield 0.5;
    this.rest = 0.5;
  }

  private *phantom(): Co {
    this.tele(0.5, RED);
    sfx('skill');
    const pts: { x: number; y: number }[] = [{ x: this.x, y: this.y }];
    let cx = this.x, cy = this.y;
    for (let i = 0; i < 3; i++) {
      const tx = this.p.x + rand(-60, 60), ty = this.p.y + rand(-60, 60);
      const a = angleTo(cx, cy, tx, ty);
      const len = clamp(dist(cx, cy, tx, ty) + 160, 200, 600);
      let ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
      const d = Math.hypot(ex, ey);
      if (d > W.arenaR - 30) (ex *= (W.arenaR - 30) / d), (ey *= (W.arenaR - 30) / d);
      pts.push({ x: ex, y: ey });
      const sx = cx, sy = cy;
      strike({
        team: 'enemy', owner: this, x: sx, y: sy, shape: { k: 'line', angle: angleTo(sx, sy, ex, ey), len: dist(sx, sy, ex, ey), w: 40 },
        delay: 0.85 + i * 0.16, active: 0.08, damage: 16 * this.dmgScale, knock: 350, unblockable: true, parryable: false, color: RED, tag: 'mphantom',
        onStart: () => {
          fx.beam(sx, sy, ex, ey, 10, this.color, 0.35);
          fx.sparks((sx + ex) / 2, (sy + ey) / 2, angleTo(sx, sy, ex, ey) + Math.PI / 2, 1, 8, 400, '#ffffff');
          sfx('slashHeavy', 0.7);
          W.shake(0.2);
        },
      });
      cx = ex;
      cy = ey;
    }
    // she blinks along the path as each line fires
    for (let i = 1; i < pts.length; i++) {
      yield i === 1 ? 0.85 : 0.16;
      const p0 = pts[i - 1], p1 = pts[i];
      for (let k = 0; k < 6; k++) fx.ghost(p0.x + (p1.x - p0.x) * (k / 6), p0.y + (p1.y - p0.y) * (k / 6), this.facing, this.r, this.color, 0.3);
      this.x = p1.x;
      this.y = p1.y;
    }
    yield 0.6;
  }

  private *echoSkill(): Co {
    hud.callout('ECHO: ' + this.echo.toUpperCase(), '#ff5af1', 0.9, 26);
    if (this.echo === 'fan') {
      for (let v = 0; v < 3; v++) {
        this.tele(0.3);
        yield 0.3;
        for (let i = 0; i < 11; i++) {
          const mid = i === 5;
          this.bullet(this.aP + (i / 10 - 0.5) * 1.3, 520, { kind: 'knife', r: 8, damage: 10, color: mid ? ORANGE : this.color, parryable: mid, life: 2 });
        }
        sfx('slash');
        yield 0.2;
      }
    } else if (this.echo === 'leap') {
      for (let k = 0; k < 2; k++) {
        const tx = this.p.x, ty = this.p.y;
        this.tele(0.75, RED);
        strike({
          team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 150 }, delay: 0.75, active: 0.08, damage: 22 * this.dmgScale,
          knock: 650, unblockable: true, parryable: false, color: RED, tag: 'mleap',
          onStart: () => {
            this.x = tx;
            this.y = ty;
            sfx('slam');
            W.shake(0.6);
            fx.ring(tx, ty, 20, 200, 0.5, this.color, 10, true);
            fx.shards(tx, ty, 20, 500, this.color, 0.8, 7);
          },
        });
        yield 1.0;
      }
    } else if (this.echo === 'phantom') {
      yield* this.phantom();
    } else {
      // blade storm: orbiting unblockable ring around her while she chases
      this.stormT = 3;
      sfx('skill');
      this.atk({ k: 'circle', r: 95 }, { active: 3, rehit: 0.3, damage: 9, knock: 250, unblockable: true, parryable: false, color: RED, tag: 'mstorm', hideActive: true });
      for (let t = 0; t < 3; t += this.dt) {
        this.steer(this.p.x, this.p.y, 210, this.dt, 4);
        yield 0;
      }
    }
    yield 0.5;
  }

  private *clones(): Co {
    sfx('teleport');
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      const cx = this.p.x + Math.cos(a) * 260, cy = this.p.y + Math.sin(a) * 260;
      const ang = angleTo(cx, cy, this.p.x, this.p.y);
      fx.ghost(cx, cy, ang, this.r, '#ffffff', 1.0);
      strike({
        team: 'enemy', owner: this, x: cx, y: cy, shape: { k: 'line', angle: ang, len: 520, w: 40 }, delay: 0.75 + i * 0.25, active: 0.08,
        damage: 14 * this.dmgScale, knock: 350, unblockable: false, parryable: true, color: ORANGE, tag: 'mclone',
        onStart: () => {
          fx.beam(cx, cy, cx + Math.cos(ang) * 520, cy + Math.sin(ang) * 520, 8, '#ffffff', 0.3);
          sfx('slash');
        },
      });
      yield 0.1;
    }
    yield 1.3;
  }

  private drawAuras(ctx: CanvasRenderingContext2D) {
    const r = this.r;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // stance
    if (this.stanceT > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 + Math.sin(W.time * 25) * 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 16, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    if (this.stormT > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = W.time * 11 + (i * TAU) / 4;
        const bx = this.x + Math.cos(a) * 80, by = this.y + Math.sin(a) * 80;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a + 1.57) * 20, by - Math.sin(a + 1.57) * 20);
        ctx.lineTo(bx + Math.cos(a + 1.57) * 20, by + Math.sin(a + 1.57) * 20);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 95, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  protected drawSpriteBoss(ctx: CanvasRenderingContext2D) {
    if (!this.drawBody(ctx, false)) return false;
    this.drawAuras(ctx);
    this.drawStun(ctx);
    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const col = this.phase === 2 ? '#ffd6fb' : this.color;
    const r = this.r, f = this.facing;
    ctx.save();
    // crown spikes
    ctx.strokeStyle = this.hitFlash > 0 ? '#fff' : col;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = f + Math.PI + (i - 2) * 0.35;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      ctx.lineTo(this.x + Math.cos(a) * (r + 12), this.y + Math.sin(a) * (r + 12));
      ctx.stroke();
    }
    ctx.fillStyle = '#1a0518';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(f) * (r + 7), this.y + Math.sin(f) * (r + 7));
    ctx.lineTo(this.x + Math.cos(f + 0.55) * (r - 3), this.y + Math.sin(f + 0.55) * (r - 3));
    ctx.lineTo(this.x + Math.cos(f - 0.55) * (r - 3), this.y + Math.sin(f - 0.55) * (r - 3));
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    // katana
    const wa = f + 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(wa) * r * 0.6, this.y + Math.sin(wa) * r * 0.6);
    ctx.lineTo(this.x + Math.cos(wa) * r * 3.8, this.y + Math.sin(wa) * r * 3.8);
    ctx.stroke();
    ctx.restore();
    this.drawAuras(ctx);
    this.drawStun(ctx);
    void angleDiff;
  }
}
