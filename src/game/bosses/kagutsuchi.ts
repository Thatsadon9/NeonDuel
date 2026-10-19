/**
 * Act II boss 4 — KAGUTSUCHI, THE ASHEN WARLORD. A true duel that tests everything from Act I.
 * Two stances, switching whenever his posture passes 50%:
 *  - IAI (blue): lightning-fast parryable cuts — rhythm.
 *  - INFERNO (red): flaming odachi, unblockable AoE that leaves burning ground — dash.
 * Phase 2: faster switches, cross-stance combos, SHRINE BURNS (a ring of fire tightens the arena).
 * PERFECT DUEL: parry him 5 times in a row without getting hit.
 */
import { TAU, rand, chance } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { sfx } from '../../audio/audio';
import { W, strike } from '../world';
import { RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { T } from '../tuning';
import { hazard } from './hazards';
import { hud } from '../../ui/hud';

const FIRE = '#ff5a1f';
const IAI = '#7fd8ff';

export class Kagutsuchi extends Boss {
  stance: 'iai' | 'inferno' = 'iai';
  private switched = false;
  private stanceT = 0;
  private streak = 0;
  private lastHp = 0;
  private burnT = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_kagutsuchi';
    this.hp = this.maxHp = Math.round(T.bossHp.kagutsuchi * (W.hardMode ? T.hardHp : 1));
    this.maxPosture = Math.round(320 * T.bossPosture);
    this.r = 30;
    this.color = FIRE;
    this.phase2Color = '#ffe14d';
    this.turnRate = 4;
    this.title = 'KAGUTSUCHI';
    this.subtitle = 'THE ASHEN WARLORD — ขุนศึกเถ้าถ่าน · IAI = Parry · INFERNO = Dash';
    this.buildMoves();
  }

  buildMoves() {
    const iai = () => this.stance === 'iai';
    const inf = () => this.stance === 'inferno';
    this.moves = [
      { name: 'attack', w: 3, max: 260, fn: () => (iai() ? this.iaiTriple() : this.infernoCleave()) },
      { name: 'draw', w: 2, min: 150, cd: 2.5, fn: () => (iai() ? this.quickdraw() : this.fireWave()) },
      { name: 'cross', w: 2, max: 220, cd: 3, fn: () => (iai() ? this.crossCut() : this.infernoSpin()) },
      { name: 'eruption', w: 1, cd: 6, fn: () => (inf() ? this.eruption() : this.quickdraw()) },
      { name: 'shrine', w: 2, phase: 2, cd: 18, fn: () => this.shrineBurns() },
    ];
  }

  enterPhase2() {
    this.restMul = 0.8;
  }

  private setStance(s: 'iai' | 'inferno') {
    if (this.stance === s) return;
    this.stance = s;
    this.stanceT = 0;
    this.color = s === 'iai' ? IAI : FIRE;
    hud.callout(s === 'iai' ? 'IAI STANCE' : 'INFERNO STANCE', s === 'iai' ? IAI : FIRE, 1, 36);
    fx.ring(this.x, this.y, 10, 160, 0.4, this.color, 8, true);
    fx.burst(this.x, this.y, 20, 300, this.color, 0.6, 3);
    sfx('charge', 0.7);
  }

  onParried(by: Parameters<Boss['onParried']>[0]) {
    super.onParried(by);
    this.streak++;
    if (this.streak >= 5) {
      this.streak = 0;
      hud.callout('PERFECT DUEL', '#ffffff', 1.6, 52);
      W.slowMo(0.25, 1.2);
      W.flash('#ffffff', 0.5);
      this.addPosture(this.maxPosture * 0.5);
    } else if (this.streak >= 3) fx.text(this.x, this.y - this.r - 40, `DUEL ${this.streak}/5`, '#ffffff', 18);
  }

  idle(dt: number) {
    this.face(this.aP, dt, 4);
    const want = this.stance === 'iai' ? 150 : 200;
    const a = this.aP, d = this.dP;
    this.steer(this.x + Math.cos(a) * (d - want), this.y + Math.sin(a) * (d - want), this.stance === 'iai' ? 190 : 130, dt, 4);
  }

  update(dt: number) {
    super.update(dt);
    if (this.dead || !this.active) return;
    // getting hit breaks the duel streak
    const p = this.p;
    if (this.lastHp && p.hp < this.lastHp - 0.5) this.streak = 0;
    this.lastHp = p.hp;
    // stance switches at 50% posture (and on a timer so both stances show up)
    this.stanceT += dt;
    if (!this.switched && this.posture >= this.maxPosture * 0.5) {
      this.switched = true;
      this.setStance(this.stance === 'iai' ? 'inferno' : 'iai');
    }
    if (this.posture < this.maxPosture * 0.2) this.switched = false;
    if (this.stanceT > (this.phase === 2 ? 8 : 13) && !this.runner.running) this.setStance(this.stance === 'iai' ? 'inferno' : 'iai');
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (chance(dt * 30)) {
        const a = rand(0, TAU);
        fx.ember(Math.cos(a) * W.arenaR, Math.sin(a) * W.arenaR, -Math.cos(a) * 40, -Math.sin(a) * 40 - 30, FIRE, 0.8, 3);
      }
      if (this.burnT <= 0) W.arenaTargetR = 560;
    }
  }

  onDeath() {
    W.arenaTargetR = 560;
  }

  // ---------------- IAI (parryable)
  private *iaiTriple(): Co {
    const n = this.phase === 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      yield* this.track(0.08, 14);
      const a = this.aP;
      this.facing = a;
      const d = i === 0 ? 0.42 : 0.26;
      this.tele(d);
      this.atk({ k: 'sector', r: 140, arc: 1.9, angle: a }, {
        delay: d, active: 0.08, damage: 13, knock: 320, tag: 'iai',
        onStart: () => {
          this.vx = Math.cos(a) * 520;
          this.vy = Math.sin(a) * 520;
          fx.slash(this.x, this.y, a, 135, 1.9, i % 2 ? -1 : 1, IAI, { width: 32, core: '#ffffff', follow: this });
          sfx('slash', 0.7);
        },
      });
      yield d + 0.08;
    }
    // phase 2: flows straight into an inferno finisher
    if (this.phase === 2 && chance(0.5)) {
      this.setStance('inferno');
      yield* this.infernoCleave();
      return;
    }
    yield 0.65;
  }
  private *quickdraw(): Co {
    yield* this.track(0.25, 12);
    const a = this.aP;
    this.facing = a;
    this.tele(0.55);
    this.atk({ k: 'line', angle: a, len: 460, w: 46 }, {
      delay: 0.55, active: 0.1, damage: 17, knock: 420, tag: 'quickdraw',
      onStart: () => {
        sfx('stab');
        for (let t = 0; t < 1; t += 0.2) fx.ghost(this.x + Math.cos(a) * 400 * t, this.y + Math.sin(a) * 400 * t, a, this.r, IAI, 0.3, 'circle');
        this.x += Math.cos(a) * 380;
        this.y += Math.sin(a) * 380;
        W.confine(this);
        fx.beam(this.x - Math.cos(a) * 400, this.y - Math.sin(a) * 400, this.x, this.y, 10, IAI, 0.25);
      },
    });
    yield 0.55 + 0.75;
  }
  private *crossCut(): Co {
    yield* this.track(0.12, 10);
    const a = this.aP;
    this.facing = a;
    this.tele(0.5);
    for (const off of [-0.6, 0.6]) {
      this.atk({ k: 'line', angle: a + off, len: 240, w: 40 }, { delay: 0.5, active: 0.08, damage: 14, knock: 360, tag: 'cross' });
    }
    yield 0.5;
    fx.slash(this.x, this.y, a, 220, 1.2, 1, IAI, { width: 30 });
    sfx('slashHeavy', 0.6);
    yield 0.7;
  }

  // ---------------- INFERNO (unblockable)
  private *infernoCleave(): Co {
    yield* this.track(0.15, 8);
    const a = this.aP;
    this.facing = a;
    const cx = this.x + Math.cos(a) * 110, cy = this.y + Math.sin(a) * 110;
    this.tele(0.8, RED);
    strike({
      team: 'enemy', owner: this, x: cx, y: cy, shape: { k: 'circle', r: 130 }, delay: 0.8, active: 0.08, damage: 22 * this.dmgScale,
      knock: 600, unblockable: true, parryable: false, color: RED, tag: 'inferno',
      onStart: () => {
        fx.slash(this.x, this.y, a, 170, 2.6, 1, FIRE, { width: 60, core: '#ffe14d' });
        fx.ring(cx, cy, 20, 150, 0.4, FIRE, 9, true);
        sfx('slam');
        W.shake(0.5);
        hazard(this, cx, cy, 100, 4, 6, FIRE, 'vfx_fire_ground', 'fire');
      },
    });
    yield 0.8 + 0.9;
  }
  private *fireWave(): Co {
    yield* this.track(0.2, 8);
    this.tele(0.6, RED);
    yield 0.6;
    const n = this.phase === 2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = this.aP + (i - (n - 1) / 2) * 0.32;
      this.bullet(a, 330, { r: 20, damage: 16, color: FIRE, unblockable: true, kind: 'wave', life: 2.4, tag: 'firewave', noObstacle: true });
    }
    sfx('shootBig', 0.7);
    yield 0.8;
  }
  private *infernoSpin(): Co {
    this.tele(0.75, RED);
    strike({
      team: 'enemy', owner: this, x: this.x, y: this.y, follow: true, shape: { k: 'circle', r: 175 }, delay: 0.75, active: 0.1, damage: 20 * this.dmgScale,
      knock: 650, unblockable: true, parryable: false, color: RED, tag: 'infspin',
      onStart: () => {
        fx.slash(this.x, this.y, this.facing, 170, TAU, 1, FIRE, { width: 60, life: 0.32, follow: this });
        sfx('slashHeavy');
        W.shake(0.4);
      },
    });
    yield 0.75 + 0.8;
  }
  private *eruption(): Co {
    this.tele(0.6, RED);
    yield 0.6;
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU), rr = rand(0, 120);
      const x = this.p.x + Math.cos(a) * rr, y = this.p.y + Math.sin(a) * rr;
      strike({
        team: 'enemy', owner: this, x, y, shape: { k: 'circle', r: 80 }, delay: 0.9, active: 0.08, damage: 16 * this.dmgScale, knock: 450,
        unblockable: true, parryable: false, color: RED, tag: 'eruption',
        onStart: () => {
          fx.anim('vfx_eruption', x, y, { w: 180 });
          fx.ring(x, y, 10, 90, 0.3, FIRE, 6, true);
          sfx('explosion', 0.4);
          hazard(this, x, y, 60, 2.5, 5, FIRE, 'vfx_fire_ground', 'fire');
        },
      });
      yield 0.18;
    }
    yield 1.0;
  }

  /** ring of fire closes in */
  private *shrineBurns(): Co {
    hud.callout('SHRINE BURNS', FIRE, 1.4, 44);
    sfx('roar');
    W.flash(FIRE, 0.3);
    this.burnT = 10;
    W.arenaTargetR = 360;
    this.setStance('inferno');
    yield 0.8;
  }

  /** burning rim while the shrine burns */
  drawFloor(ctx: CanvasRenderingContext2D) {
    if (this.burnT <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = FIRE;
    ctx.globalAlpha = 0.5 + Math.sin(W.time * 12) * 0.2;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(0, 0, W.arenaR + 6, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  protected stateNames(st: string): string[] {
    const n = super.stateNames(st);
    const k = this.spriteKey;
    return st === 'idle' || st === 'move' ? [`${k}_idle_${this.stance}`, ...n] : n;
  }
  rimColor() {
    return this.stance === 'iai' ? IAI : this.phase === 2 ? this.phase2Color : FIRE;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawBossCommon(ctx);
    if (this.drawSpriteBoss(ctx)) return;
    const r = this.r;
    const pts: [number, number][] = [];
    for (let i = 0; i < 8; i++) pts.push([Math.cos((i / 8) * TAU) * r, Math.sin((i / 8) * TAU) * r]);
    this.glowPoly(ctx, pts, this.rimColor(), '#1a0a05', 4);
    ctx.save();
    ctx.strokeStyle = this.rimColor();
    ctx.lineWidth = 5;
    const sa = this.facing + 0.4;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(sa) * r * 3.2, this.y + Math.sin(sa) * r * 3.2);
    ctx.stroke();
    ctx.restore();
    this.drawStun(ctx);
  }
}
void ORANGE;
