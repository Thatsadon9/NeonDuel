/** Boss 1 — THE VANGUARD. Frontal shield blocks while idle: parry its attacks or flank it. */
import { TAU, angleTo, angleDiff, dist, clamp } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W, strike, type HitInfo, type HitResult } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { T } from '../tuning';
import { sprites } from '../../render/sprites';
import { posed } from '../../render/procanim';

export class Vanguard extends Boss {
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_vanguard';
    this.hp = this.maxHp = Math.round(T.bossHp.vanguard * (W.hardMode ? T.hardHp : 1));
    this.maxPosture = Math.round(250 * T.bossPosture);
    this.r = 30;
    this.color = '#ffb347';
    this.phase2Color = '#ff5a3c';
    this.title = 'THE VANGUARD';
    this.subtitle = 'อัศวินโล่เหล็ก — โล่ด้านหน้ากันทุกการโจมตี จงปัดป้อง (Parry) หรืออ้อมไปด้านหลัง';
    this.turnRate = 3;
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'triple', w: 3, max: 240, fn: () => this.triple() },
      { name: 'charge', w: 2, min: 180, cd: 3.5, fn: () => this.charge() },
      { name: 'slam', w: 2, max: 260, cd: 3, fn: () => this.slam() },
      { name: 'spin', w: 2, max: 200, phase: 2, cd: 4, fn: () => this.spin() },
      { name: 'leap', w: 2, min: 260, phase: 2, cd: 5, fn: () => this.leap() },
    ];
  }

  get guarding() {
    return !this.runner.running && this.reel <= 0 && this.staggered <= 0 && this.active;
  }

  preHit(h: HitInfo): HitResult | null {
    if (!this.guarding || h.skill || h.tag === 'execute') return null;
    const a = angleTo(this.x, this.y, h.sx, h.sy);
    if (Math.abs(angleDiff(this.facing, a)) > 1.25) return null;
    this.addPosture(h.posture * 0.4);
    const cx = this.x + Math.cos(a) * (this.r + 8), cy = this.y + Math.sin(a) * (this.r + 8);
    fx.sparks(cx, cy, a, 0.9, 12, 480, '#ffe0a8', 0.3);
    fx.text(cx, cy - 12, 'GUARD', '#ffd28a', 13);
    sfx('clank', 0.8);
    this.hitFlash = 0.04;
    return 'shield';
  }

  idle(dt: number) {
    this.face(this.aP, dt, this.phase === 2 ? 4 : 3);
    if (this.dP > 150) this.steer(this.p.x, this.p.y, this.phase === 2 ? 140 : 110, dt, 4);
    else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }
  }

  private *swing(delay: number, dir: 1 | -1, dmg = 16): Co {
    yield* this.track(0.12, 10);
    const a = this.aP;
    this.facing = a;
    this.tele(delay);
    this.atk({ k: 'sector', r: 135, arc: 2.2, angle: a }, {
      delay, active: 0.1, damage: dmg, knock: 380, tag: 'vslash',
      onStart: () => {
        this.vx = Math.cos(a) * 420;
        this.vy = Math.sin(a) * 420;
        fx.slash(this.x, this.y, a, 130, 2.2, dir, this.phase === 2 ? this.phase2Color : this.color, { width: 46, core: '#fff2d6', follow: this });
        sfx('slashHeavy', 0.7);
      },
    });
    yield delay + 0.1;
  }

  private *triple(): Co {
    yield* this.swing(0.5, 1);
    yield 0.12;
    yield* this.swing(0.34, -1);
    yield 0.12;
    yield* this.swing(0.34, 1, 18);
    if (this.phase === 2) {
      yield 0.15;
      // unblockable overhead thrust
      const a = this.aP;
      this.facing = a;
      this.tele(0.6, RED);
      this.atk({ k: 'line', angle: a, len: 280, w: 60 }, {
        delay: 0.6, active: 0.12, damage: 24, knock: 600, unblockable: true, parryable: false, color: RED, follow: false, tag: 'vthrust',
        onStart: () => {
          this.vx = Math.cos(a) * 900;
          this.vy = Math.sin(a) * 900;
          sfx('stab');
          W.shake(0.3);
        },
      });
      yield 0.75;
    }
    yield 0.75; // punish window
  }

  private *charge(): Co {
    const times = this.phase === 2 ? 2 : 1;
    for (let i = 0; i < times; i++) {
      yield* this.track(0.2, 12);
      const a = this.aP;
      this.facing = a;
      const len = 900;
      this.tele(0.7);
      sfx('roar', 0.4);
      this.atk({ k: 'line', angle: a, len, w: this.r * 2 + 10 }, { delay: 0.7, active: 0.001, noHit: true, follow: true });
      yield 0.7;
      sfx('dash');
      const s = this.atk({ k: 'circle', r: this.r + 12 }, { active: 0.7, damage: 20, knock: 650, tag: 'vcharge' });
      for (let t = 0; t < 0.7; t += this.dt) {
        if (s.dead) break; // parried
        this.vx = Math.cos(a) * 1000;
        this.vy = Math.sin(a) * 1000;
        if (Math.random() < 0.5) fx.ghost(this.x, this.y, a, this.r, this.color, 0.2, 'circle');
        fx.sparks(this.x - Math.cos(a) * this.r, this.y - Math.sin(a) * this.r, a + Math.PI, 0.5, 1, 300, ORANGE);
        if (Math.hypot(this.x, this.y) > W.arenaR - this.r - 8) {
          W.shake(0.4);
          sfx('slam', 0.6);
          fx.ring(this.x, this.y, 10, 120, 0.4, this.color, 5);
          break;
        }
        yield 0;
      }
      s.dead = true;
      yield 0.35;
    }
    yield 0.6;
  }

  private *slam(): Co {
    yield* this.track(0.15, 10);
    const a = this.aP;
    this.facing = a;
    const cx = this.x + Math.cos(a) * 80, cy = this.y + Math.sin(a) * 80;
    this.tele(0.8, RED);
    strike({
      team: 'enemy', owner: this, x: cx, y: cy, shape: { k: 'circle', r: 150 }, delay: 0.8, active: 0.08, damage: 26 * this.dmgScale,
      knock: 650, unblockable: true, parryable: false, color: RED, tag: 'vslam',
      onStart: () => {
        sfx('slam');
        W.shake(0.6);
        fx.ring(cx, cy, 20, 200, 0.5, this.color, 10, true);
        fx.shards(cx, cy, 20, 450, this.color, 0.8, 7);
        fx.smoke(cx, cy, 10, 'rgba(255,170,80,0.2)', 200, 20, 0.8);
        if (this.phase === 2) {
          strike({
            team: 'enemy', owner: this, x: cx, y: cy, shape: { k: 'ring', r: 60, w: 26 }, active: 1.0, damage: 14 * this.dmgScale,
            knock: 400, unblockable: true, parryable: false, color: RED, tag: 'vring',
            onUpdate: (s, dt) => {
              (s.shape as { r: number }).r += 520 * dt;
            },
          });
        }
      },
    });
    yield 0.9;
    yield 1.0; // big punish window
  }

  private *spin(): Co {
    for (let i = 0; i < 2; i++) {
      this.tele(i === 0 ? 0.55 : 0.35);
      this.atk({ k: 'circle', r: 150 }, {
        delay: i === 0 ? 0.55 : 0.35, active: 0.12, damage: 18, knock: 500, tag: 'vspin',
        onStart: () => {
          fx.slash(this.x, this.y, this.facing, 150, TAU * 1.05, i % 2 ? -1 : 1, this.phase2Color, { width: 50, life: 0.3, follow: this });
          sfx('slashHeavy');
          W.shake(0.25);
          this.vx = Math.cos(this.aP) * 300;
          this.vy = Math.sin(this.aP) * 300;
        },
      });
      yield (i === 0 ? 0.55 : 0.35) + 0.15;
    }
    yield 0.7;
  }

  private *leap(): Co {
    const tx = this.p.x + this.p.vx * 0.3, ty = this.p.y + this.p.vy * 0.3;
    const x0 = this.x, y0 = this.y;
    const T = 0.85;
    this.tele(T, RED);
    strike({
      team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 130 }, delay: T, active: 0.08, damage: 24 * this.dmgScale,
      knock: 700, unblockable: true, parryable: false, color: RED, tag: 'vleap',
      onStart: () => {
        sfx('slam');
        W.shake(0.7);
        fx.ring(tx, ty, 20, 200, 0.5, this.phase2Color, 10, true);
        fx.shards(tx, ty, 24, 500, this.phase2Color, 0.8, 7);
      },
    });
    this.solid = false;
    for (let t = 0; t < T; t += this.dt) {
      const u = clamp(t / T, 0, 1);
      this.x = x0 + (tx - x0) * u;
      this.y = y0 + (ty - y0) * u;
      this.vx = this.vy = 0;
      this.invuln = 0.05;
      if (Math.random() < 0.5) fx.ghost(this.x, this.y, this.facing, this.r, this.phase2Color, 0.2, 'circle');
      yield 0;
    }
    this.solid = true;
    W.confine(this);
    yield 0.9;
  }

  protected drawSpriteBoss(ctx: CanvasRenderingContext2D) {
    if (!this.drawBody(ctx, false)) return false;
    const q = posed(this.x, this.y, this.facing, this.lastPose);
    sprites.draw(ctx, sprites.first(this.phase === 2 ? 'boss_vanguard_shield_p2' : '', 'boss_vanguard_shield') ?? '', q.x, q.y, {
      angle: this.facing + this.lastPose.rot * 0.6, alpha: this.guarding ? 1 : 0.55, flash: this.hitFlash > 0 ? 0.8 : 0, outline: this.guarding ? '#ffe0a8' : this.rimColor(), outlineAlpha: this.guarding ? 0.9 : 0.4,
    });
    this.drawStun(ctx);
    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const col = this.phase === 2 ? this.phase2Color : this.color;
    const r = this.r;
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * TAU) * r, Math.sin((i / 6) * TAU) * r]);
    this.glowPoly(ctx, pts, col, '#1a0f05', 4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const f = this.facing;
    // core
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.3, 0, TAU);
    ctx.fill();
    // shield
    const g = this.guarding;
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : g ? '#ffe0a8' : 'rgba(255,224,168,0.35)';
    ctx.lineWidth = g ? 9 : 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 12, f - 1.15, f + 1.15);
    ctx.stroke();
    // sword
    const sa = f + (this.runner.running ? -0.3 : 1.6);
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(sa) * r * 0.6, this.y + Math.sin(sa) * r * 0.6);
    ctx.lineTo(this.x + Math.cos(sa) * r * 3, this.y + Math.sin(sa) * r * 3);
    ctx.stroke();
    ctx.restore();
    this.drawStun(ctx);
    void dist;
  }
}
