/** Boss 3 — TWIN FANGS. Kael (blade) + Vex (knives & mines). Kill one and the other enrages. */
import { TAU, angleTo, dist, rand, chance } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W, strike } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { T } from '../tuning';

abstract class Twin extends Boss {
  partner: Twin | null = null;
  hpPhase = false;
  enrage() {
    if (this.dead || this.phase === 2) return;
    this.runner.run(this.phaseTransition());
  }
  onDeath() {
    this.partner?.enrage();
  }
}

export class Kael extends Twin {
  private strafe = 1;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_kael';
    this.hp = this.maxHp = Math.round(T.bossHp.kael * T.diffHp[W.diff]);
    this.maxPosture = Math.round(160 * T.bossPosture);
    this.r = 22;
    this.color = '#ff3c6e';
    this.phase2Color = '#ff1f3d';
    this.title = 'KAEL';
    this.subtitle = 'เขี้ยวดาบ';
    this.buildMoves();
  }
  buildMoves() {
    this.moves = [
      { name: 'dash', w: 4, fn: () => this.dashSlash() },
      { name: 'whirl', w: 2, max: 170, cd: 3, fn: () => this.whirl() },
      { name: 'combo', w: 3, max: 190, fn: () => this.combo() },
    ];
  }
  enterPhase2() {
    this.restMul = 0.6;
  }
  idle(dt: number) {
    const a = this.aP, d = this.dP;
    const want = 210;
    const tx = this.x + Math.cos(a) * (d - want) + Math.cos(a + Math.PI / 2) * 140 * this.strafe;
    const ty = this.y + Math.sin(a) * (d - want) + Math.sin(a + Math.PI / 2) * 140 * this.strafe;
    this.steer(tx, ty, 230, dt, 5);
    this.face(a, dt, 8);
    if (chance(dt * 0.6)) this.strafe *= -1;
  }
  private *dashSlash(): Co {
    const n = this.phase === 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      yield* this.track(0.12, 14);
      const a = this.aP;
      const len = Math.min(560, this.dP + 140);
      const delay = i === 0 ? 0.48 : 0.34;
      this.tele(delay);
      this.atk({ k: 'line', angle: a, len, w: 48 }, {
        delay, active: 0.08, damage: 15, knock: 350, tag: 'kdash', follow: false,
        onStart: (s) => {
          const x0 = this.x, y0 = this.y;
          this.x += Math.cos(a) * (len - 20);
          this.y += Math.sin(a) * (len - 20);
          W.confine(this);
          s.x = x0;
          s.y = y0;
          for (let k = 0; k < 8; k++) fx.ghost(x0 + (this.x - x0) * (k / 8), y0 + (this.y - y0) * (k / 8), a, this.r, this.color, 0.3, 'circle');
          fx.beam(x0, y0, this.x, this.y, 8, this.color, 0.25);
          sfx('slash');
        },
      });
      yield delay + 0.12;
    }
    yield 0.7;
  }
  private *whirl(): Co {
    this.tele(0.6, RED);
    this.atk({ k: 'circle', r: 145 }, {
      delay: 0.6, active: 0.7, rehit: 0.25, damage: 11, knock: 300, unblockable: true, parryable: false, color: RED, tag: 'whirl',
      onStart: () => sfx('slashHeavy'),
      onUpdate: () => {
        if (Math.random() < 0.6) fx.slash(this.x, this.y, rand(0, TAU), 140, 2.5, chance(0.5) ? 1 : -1, this.color, { width: 30, life: 0.15, follow: this });
        this.steer(this.p.x, this.p.y, 120, this.dt);
      },
    });
    yield 1.3;
    yield 0.6;
  }
  private *combo(): Co {
    const n = this.phase === 2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      yield* this.track(0.08, 14);
      const a = this.aP;
      const delay = i === 0 ? 0.36 : 0.24;
      this.tele(delay);
      this.atk({ k: 'sector', r: 110, arc: 2.1, angle: a }, {
        delay, active: 0.08, damage: 12, knock: 260, tag: 'kcombo',
        onStart: () => {
          this.vx = Math.cos(a) * 380;
          this.vy = Math.sin(a) * 380;
          fx.slash(this.x, this.y, a, 105, 2.1, i % 2 ? -1 : 1, this.color, { width: 34, follow: this });
          sfx('slash', 0.7);
        },
      });
      yield delay + 0.08;
    }
    yield 0.6;
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const col = this.phase === 2 ? this.phase2Color : this.color;
    const r = this.r;
    this.glowPoly(ctx, [[r * 1.4, 0], [r * 0.2, r * 0.9], [-r, r * 0.7], [-r * 0.6, 0], [-r, -r * 0.7], [r * 0.2, -r * 0.9]], col, '#1a0509', 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    const sa = this.facing + 1.3;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(sa) * r * 0.5, this.y + Math.sin(sa) * r * 0.5);
    ctx.lineTo(this.x + Math.cos(sa - 0.5) * r * 2.6, this.y + Math.sin(sa - 0.5) * r * 2.6);
    ctx.stroke();
    ctx.restore();
    this.drawStun(ctx);
  }
}

export class Vex extends Twin {
  private orbit = -1;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_vex';
    this.hp = this.maxHp = Math.round(T.bossHp.vex * T.diffHp[W.diff]);
    this.maxPosture = Math.round(140 * T.bossPosture);
    this.r = 20;
    this.color = '#9d7bff';
    this.phase2Color = '#b34dff';
    this.title = 'VEX';
    this.subtitle = 'เขี้ยวเงา';
    this.buildMoves();
  }
  buildMoves() {
    this.moves = [
      { name: 'fan', w: 4, fn: () => this.fan() },
      { name: 'mines', w: 2, cd: 5, fn: () => this.mines() },
      { name: 'ambush', w: 2, cd: 4, fn: () => this.ambush() },
      { name: 'lines', w: 2, phase: 2, cd: 5, fn: () => this.lines() },
    ];
  }
  enterPhase2() {
    this.restMul = 0.6;
  }
  idle(dt: number) {
    const a = this.aP;
    const want = 360;
    const tx = this.p.x - Math.cos(a) * want + Math.cos(a + Math.PI / 2) * 150 * this.orbit;
    const ty = this.p.y - Math.sin(a) * want + Math.sin(a + Math.PI / 2) * 150 * this.orbit;
    this.steer(tx, ty, this.dP < 200 ? 280 : 190, dt, 4);
    this.face(a, dt, 6);
    if (chance(dt * 0.35)) this.orbit *= -1;
  }
  private *fan(): Co {
    const volleys = this.phase === 2 ? 3 : 1;
    for (let v = 0; v < volleys; v++) {
      this.tele(0.4, ORANGE);
      yield 0.4;
      const n = 7;
      const base = this.aP;
      for (let i = 0; i < n; i++) {
        const mid = i === (n >> 1);
        const a = base + (i / (n - 1) - 0.5) * 1.1;
        this.bullet(a, mid ? 520 : 440, { kind: 'knife', r: 8, damage: 11, color: mid ? ORANGE : this.color, parryable: mid, life: 2.5, posture: 12 });
      }
      sfx('slash', 0.6);
      yield 0.25;
    }
    yield 0.5;
  }
  private *mines(): Co {
    this.tele(0.4, RED);
    yield 0.4;
    const n = this.phase === 2 ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.3, 0.3);
      const rr = rand(90, 190);
      const tx = this.p.x + Math.cos(a) * rr, ty = this.p.y + Math.sin(a) * rr;
      const b = this.bullet(angleTo(this.x, this.y, tx, ty), 0, {
        kind: 'mine', r: 10, damage: 0, color: RED, life: 7, noObstacle: true, delay: 0.9, harmless: true,
      });
      // fly to the spot, then arm
      const sx = this.x, sy = this.y;
      let t = 0;
      b.onUpdate = (m, dt) => {
        t += dt;
        if (t < 0.4) {
          const u = t / 0.4;
          m.x = sx + (tx - sx) * u;
          m.y = sy + (ty - sy) * u;
          return;
        }
        if ((!m.delay || m.delay <= 0) && dist(m.x, m.y, this.p.x, this.p.y) < 75) m.life = 0;
      };
      b.onDeath = (m) => {
        strike({ team: 'enemy', owner: this, x: m.x, y: m.y, shape: { k: 'circle', r: 85 }, delay: 0.25, active: 0.06, damage: 14 * this.dmgScale, knock: 400, unblockable: true, parryable: false, color: RED, tag: 'mine',
          onStart: () => {
            sfx('explosion', 0.5);
            fx.ring(m.x, m.y, 10, 100, 0.35, RED, 6, true);
            fx.shards(m.x, m.y, 8, 300, this.color, 0.5, 5);
            W.shake(0.2);
          },
        });
      };
      b.vx = b.vy = 0.001;
      sfx('shoot', 0.4);
      yield 0.08;
    }
    yield 0.5;
  }
  private *ambush(): Co {
    this.tele(0.3, this.color);
    yield 0.3;
    fx.smoke(this.x, this.y, 12, 'rgba(150,110,255,0.3)', 150, 18, 0.6);
    sfx('teleport');
    const behind = this.p.facing + Math.PI + rand(-0.5, 0.5);
    this.x = this.p.x + Math.cos(behind) * 95;
    this.y = this.p.y + Math.sin(behind) * 95;
    W.confine(this);
    this.facing = this.aP;
    fx.smoke(this.x, this.y, 12, 'rgba(150,110,255,0.3)', 150, 18, 0.6);
    const a = this.aP;
    this.tele(0.42);
    this.atk({ k: 'sector', r: 120, arc: 2.0, angle: a }, {
      delay: 0.42, active: 0.08, damage: 16, knock: 380, tag: 'vexstab',
      onStart: () => {
        fx.slash(this.x, this.y, a, 115, 2.0, 1, this.color, { width: 34, follow: this });
        sfx('slash');
        this.vx = Math.cos(a) * 300;
        this.vy = Math.sin(a) * 300;
      },
    });
    yield 0.5;
    yield 0.6;
  }
  private *lines(): Co {
    this.tele(0.6, RED);
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      const ox = this.p.x + rand(-60, 60), oy = this.p.y + rand(-60, 60);
      const x0 = ox - Math.cos(a) * 700, y0 = oy - Math.sin(a) * 700;
      strike({ team: 'enemy', owner: this, x: x0, y: y0, shape: { k: 'line', angle: a, len: 1400, w: 36 }, delay: 0.8 + i * 0.18, active: 0.08,
        damage: 15 * this.dmgScale, knock: 300, unblockable: true, parryable: false, color: RED, tag: 'vexline',
        onStart: () => {
          fx.beam(x0, y0, x0 + Math.cos(a) * 1400, y0 + Math.sin(a) * 1400, 12, this.color, 0.3);
          sfx('slash');
          W.shake(0.2);
        },
      });
    }
    yield 1.6;
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const col = this.phase === 2 ? this.phase2Color : this.color;
    const r = this.r;
    this.glowPoly(ctx, [[r * 1.2, 0], [0, r], [-r * 0.8, r * 0.4], [-r * 0.8, -r * 0.4], [0, -r]], col, '#0d0719', 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = this.age * 3 + (i * TAU) / 3;
      const kx = this.x + Math.cos(a) * (r + 14), ky = this.y + Math.sin(a) * (r + 14);
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx + Math.cos(a + 1.6) * 10, ky + Math.sin(a + 1.6) * 10);
      ctx.stroke();
    }
    ctx.restore();
    this.drawStun(ctx);
  }
}

export function makeTwins(): [Kael, Vex] {
  const k = new Kael(-180, -200);
  const v = new Vex(180, -220);
  k.partner = v;
  v.partner = k;
  return [k, v];
}
