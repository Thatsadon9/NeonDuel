/** Mini-boss — RIFT SENTINEL. A floating statue knight that guards a Rift Core. Blade (melee) or Pulse (bullet rings) variant. */
import { TAU, rand, chance } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { T } from '../tuning';

export class Sentinel extends Boss {
  constructor(x: number, y: number, public variant: 'blade' | 'pulse') {
    super(x, y);
    this.spriteKey = 'boss_sentinel';
    this.hp = this.maxHp = Math.round(T.bossHp.sentinel * T.diffHp[W.diff]);
    this.maxPosture = Math.round(150 * T.bossPosture);
    this.r = 28;
    this.color = variant === 'blade' ? '#ff4dcf' : '#7fb8ff';
    this.phase2Color = this.color;
    this.hpPhase = false;
    this.title = variant === 'blade' ? 'BLADE SENTINEL' : 'PULSE SENTINEL';
    this.subtitle = 'ผู้เฝ้าแกนรอยแยก — ทำลายมันเพื่อเอา RIFT CORE';
    this.buildMoves();
  }

  buildMoves() {
    this.moves = this.variant === 'blade'
      ? [
          { name: 'attack', w: 3, max: 230, fn: () => this.cleave() },
          { name: 'dash', w: 2, min: 160, cd: 3, fn: () => this.dashCut() },
          { name: 'spin', w: 1, max: 200, cd: 4, fn: () => this.spin() },
        ]
      : [
          { name: 'attack', w: 3, fn: () => this.pulseRing() },
          { name: 'burst', w: 2, cd: 2.5, fn: () => this.burst() },
          { name: 'nova', w: 1, max: 180, cd: 4, fn: () => this.nova() },
        ];
  }

  idle(dt: number) {
    this.face(this.aP, dt, 4);
    const want = this.variant === 'blade' ? 120 : 300;
    const a = this.aP, d = this.dP;
    this.steer(this.x + Math.cos(a) * (d - want), this.y + Math.sin(a) * (d - want), 130, dt, 3);
  }

  protected stateNames(st: string): string[] {
    const n = super.stateNames(st);
    return this.variant === 'pulse' && (st === 'idle' || st === 'move') ? ['boss_sentinel_pulse_idle', ...n] : n;
  }

  private *cleave(): Co {
    for (let i = 0; i < 2; i++) {
      yield* this.track(0.1, 10);
      const a = this.aP;
      this.facing = a;
      const d = i === 0 ? 0.5 : 0.32;
      this.tele(d);
      this.atk({ k: 'sector', r: 140, arc: 2.2, angle: a }, {
        delay: d, active: 0.1, damage: 15, knock: 380, tag: 'scleave',
        onStart: () => {
          this.vx = Math.cos(a) * 380;
          this.vy = Math.sin(a) * 380;
          fx.slash(this.x, this.y, a, 135, 2.2, i ? -1 : 1, this.color, { width: 40, follow: this });
          sfx('slashHeavy', 0.6);
        },
      });
      yield d + 0.15;
    }
    yield 0.7;
  }
  private *dashCut(): Co {
    yield* this.track(0.2, 12);
    const a = this.aP;
    this.facing = a;
    this.tele(0.6);
    this.atk({ k: 'line', angle: a, len: 520, w: 60 }, { delay: 0.6, active: 0.001, noHit: true, follow: true });
    yield 0.6;
    sfx('dash');
    const s = this.atk({ k: 'circle', r: this.r + 14 }, { active: 0.4, damage: 17, knock: 520, tag: 'sdash' });
    for (let t = 0; t < 0.4; t += this.dt) {
      if (s.dead) break;
      this.vx = Math.cos(a) * 1250;
      this.vy = Math.sin(a) * 1250;
      if (chance(0.6)) fx.ghost(this.x, this.y, a, this.r, this.color, 0.2, 'circle');
      yield 0;
    }
    s.dead = true;
    yield 0.8;
  }
  private *spin(): Co {
    this.tele(0.7, RED);
    this.atk({ k: 'circle', r: 165 }, {
      delay: 0.7, active: 0.1, damage: 20, knock: 600, unblockable: true, parryable: false, color: RED, tag: 'sspin',
      onStart: () => {
        fx.slash(this.x, this.y, this.facing, 160, TAU, 1, this.color, { width: 50, life: 0.3, follow: this });
        sfx('slashHeavy');
        W.shake(0.3);
      },
    });
    yield 0.7 + 0.9;
  }
  private *pulseRing(): Co {
    for (let k = 0; k < 2; k++) {
      this.tele(0.45, '#7fb8ff');
      yield 0.45;
      const n = 18, off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const par = i % 6 === 0;
        this.bullet(off + (i / n) * TAU, 210, { r: par ? 10 : 7, damage: par ? 12 : 9, color: par ? ORANGE : '#7fb8ff', parryable: par, posture: 10, life: 4 });
      }
      sfx('shootBig', 0.5);
      fx.ring(this.x, this.y, 10, 80, 0.3, this.color, 4);
      yield 0.5;
    }
    yield 0.5;
  }
  private *burst(): Co {
    this.tele(0.4, '#7fb8ff');
    yield 0.4;
    for (let i = 0; i < 5; i++) {
      this.bullet(this.aP + rand(-0.12, 0.12), 380, { r: 7, damage: 9, color: i === 4 ? ORANGE : '#7fb8ff', parryable: i === 4, posture: 8 });
      sfx('shoot', 0.4);
      yield 0.11;
    }
    yield 0.6;
  }
  private *nova(): Co {
    this.tele(0.8, RED);
    this.atk({ k: 'circle', r: 170 }, {
      delay: 0.8, active: 0.08, damage: 18, knock: 650, unblockable: true, parryable: false, color: RED, tag: 'snova',
      onStart: () => {
        fx.ring(this.x, this.y, 20, 190, 0.4, this.color, 10, true);
        sfx('explosion', 0.6);
        W.shake(0.4);
      },
    });
    yield 0.8 + 0.8;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const r = this.r;
    const pts: [number, number][] = [[r * 1.3, 0], [0, r], [-r, 0], [0, -r]];
    this.glowPoly(ctx, pts, this.color, '#0d0a1a', 4);
    this.drawStun(ctx);
  }
}
