/** The player fighter: movement, dash, combo attacks, guard/parry, charge, skills, overdrive. */
import { TAU, angleTo, angleDiff, clamp, damp, dist, rand } from '../core/math';
import { input } from '../core/input';
import { Runner } from '../core/co';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { sfx, audio } from '../audio/audio';
import { Actor, W, strike, shoot, type HitInfo, type HitResult } from './world';
import { WEAPONS, drawWeapon, type AttackDef, type WeaponId, type SkillDef } from './weapons';
import { style } from './style';
import { hud } from '../ui/hud';
import { sprites, AnimState } from '../render/sprites';
import { pose, posed } from '../render/procanim';

export type PState = 'free' | 'attack' | 'dash' | 'charge' | 'skill' | 'hurt' | 'dead' | 'locked';

export function defaultMods() {
  return {
    dmgMul: 1,
    speedMul: 1,
    atkSpeed: 1,
    dashMax: 2,
    dashCd: 0.85,
    parryWindow: 0.17,
    focusGain: 1,
    postureMul: 1,
    execMul: 1,
    chargeSpeed: 1,
    chargeDmg: 1,
    staminaMax: 100,
    staminaRegen: 45,
    crit: 0.08,
    skillCost: 1,
    overdriveTime: 6,
    dashFlame: false,
    parryNova: false,
    thunder: false,
    bloodthirst: false,
    afterimage: false,
    reflectGuard: false,
    momentum: false,
    secondWind: false,
    secondWindUsed: false,
    killHeal: 0,
  };
}
export type Mods = ReturnType<typeof defaultMods>;

const SPEED = 310;

export class Player extends Actor {
  team = 'player' as const;
  aim = 0;
  z = 0;
  state: PState = 'free';
  weapons: WeaponId[] = ['katana'];
  wi = 0;
  mods: Mods = defaultMods();
  // attack
  atk: AttackDef | null = null;
  atkPhase: 'startup' | 'active' | 'recovery' = 'startup';
  atkT = 0;
  atkAngle = 0;
  atkDmgMul = 1;
  comboIdx = 0;
  comboGrace = 0;
  // dash
  dashCharges = 2;
  dashRecharge = 0;
  dashT = 0;
  dashDX = 1;
  dashDY = 0;
  iframe = 0;
  perfectUsed = false;
  postDash = 0;
  ghostT = 0;
  flameT = 0;
  // guard
  parryT = 0;
  lastGuardPress = -9;
  blocking = false;
  guardFlash = 0;
  stamina = 100;
  staminaDelay = 0;
  // resources
  focus = 0;
  hurtT = 0;
  holdT = 0;
  chargeT = 0;
  chargeReady = false;
  skillRunner = new Runner();
  instants: Runner[] = [];
  overdrive = 0;
  bladeStormT = 0;
  riposteT = 0;
  hitCounter = 0;
  ghostHp = 100;
  lowFocusMsgT = 0;
  execTarget: Actor | null = null;
  anim = new AnimState();
  stateClock = new AnimState();

  constructor() {
    super();
    this.r = 16;
    this.color = '#7ff6ff';
    this.name = 'YOU';
  }

  get wpn() {
    return WEAPONS[this.weapons[this.wi]];
  }

  resetForStage() {
    this.state = 'free';
    this.atk = null;
    this.dashCharges = this.mods.dashMax;
    this.stamina = this.mods.staminaMax;
    this.vx = this.vy = 0;
    this.invuln = 0;
    this.iframe = 0;
    this.overdrive = 0;
    this.bladeStormT = 0;
    this.skillRunner.stop();
    this.instants.length = 0;
    this.z = 0;
    this.chargeT = 0;
    this.holdT = 0;
    this.mods.secondWindUsed = false;
  }

  aimPoint() {
    return cam.screenToWorld(input.mouseX, input.mouseY);
  }

  dmg(base: number) {
    return base * this.mods.dmgMul * (this.overdrive > 0 ? 1.25 : 1) * (this.mods.momentum ? 1 + style.rank * 0.05 : 1);
  }

  teleport(x: number, y: number) {
    fx.smoke(this.x, this.y, 8, 'rgba(255,80,160,0.25)', 120, 16, 0.5);
    fx.ghost(this.x, this.y, this.facing, this.r, this.wpn.color, 0.3);
    this.x = x;
    this.y = y;
    W.confine(this);
    fx.smoke(this.x, this.y, 8, 'rgba(255,80,160,0.25)', 120, 16, 0.5);
    fx.ring(this.x, this.y, 5, 50, 0.25, this.wpn.color, 3);
    sfx('teleport', 0.6);
  }

  heal(v: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + v);
    if (this.hp - before >= 1) fx.text(this.x, this.y - 30, '+' + Math.round(this.hp - before), '#6dff9e', 16);
  }

  private canAct() {
    return this.state === 'free' || this.state === 'charge' ||
      (this.state === 'attack' && this.atkPhase === 'recovery') || (this.state === 'dash' && this.dashT < 0.06);
  }

  // ------------------------------------------------------------ update
  update(dt: number) {
    this.tickCommon(dt);
    const m = this.mods;
    this.iframe = Math.max(0, this.iframe - dt);
    this.parryT = Math.max(0, this.parryT - dt);
    this.postDash = Math.max(0, this.postDash - dt);
    this.comboGrace = Math.max(0, this.comboGrace - dt);
    this.riposteT = Math.max(0, this.riposteT - dt);
    this.guardFlash = Math.max(0, this.guardFlash - dt);
    this.lowFocusMsgT = Math.max(0, this.lowFocusMsgT - dt);
    this.ghostHp += (this.hp - this.ghostHp) * damp(this.ghostHp > this.hp ? 2.5 : 20, dt);
    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (Math.random() < 0.7) fx.ember(this.x + rand(-12, 12), this.y + rand(-12, 12), rand(-30, 30), rand(-90, -30), '#7ff6ff', 0.5, 3);
      if (this.overdrive <= 0) {
        W.tint = 0;
        audio.intensity = 2;
      }
    }
    this.bladeStormT = Math.max(0, this.bladeStormT - dt);
    // stamina
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) this.stamina = Math.min(m.staminaMax, this.stamina + m.staminaRegen * dt);
    // dash recharge
    if (this.dashCharges < m.dashMax) {
      this.dashRecharge += dt;
      if (this.dashRecharge >= m.dashCd) {
        this.dashRecharge = 0;
        this.dashCharges++;
      }
    } else this.dashRecharge = 0;

    // aim
    if (this.state !== 'dead' && this.state !== 'locked') {
      const mp = this.aimPoint();
      this.aim = angleTo(this.x, this.y, mp.x, mp.y);
    }
    if (this.state === 'attack') this.facing = this.atkAngle;
    else if (this.state !== 'skill') this.facing = this.aim;

    // instant skills tick regardless of state
    this.instants = this.instants.filter((r) => r.step(dt));

    if (this.state === 'dead' || this.state === 'locked') {
      this.move(dt, 8);
      return;
    }

    let ix = 0, iy = 0;
    if (input.isDown('left')) ix -= 1;
    if (input.isDown('right')) ix += 1;
    if (input.isDown('up')) iy -= 1;
    if (input.isDown('down')) iy += 1;
    const il = Math.hypot(ix, iy);
    if (il > 0) (ix /= il), (iy /= il);

    this.handleWeaponSwap();
    this.handleGuard();
    this.handleDash(ix, iy);
    this.handleSkills();
    this.handleAttack(dt);

    // ---- state behaviour
    const spd = SPEED * m.speedMul * this.wpn.moveMul * (this.overdrive > 0 ? 1.25 : 1);
    switch (this.state) {
      case 'free': {
        const mul = this.blocking ? 0.45 : 1;
        const k = damp(il > 0 ? 18 : 14, dt);
        this.vx += (ix * spd * mul - this.vx) * k;
        this.vy += (iy * spd * mul - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        W.confine(this);
        if (il > 0 && Math.random() < dt * 8) fx.burst(this.x - ix * 10, this.y - iy * 10, 1, 30, 'rgba(127,246,255,0.5)', 0.3, 2);
        break;
      }
      case 'charge': {
        const k = damp(14, dt);
        this.vx += (ix * spd * 0.4 - this.vx) * k;
        this.vy += (iy * spd * 0.4 - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        W.confine(this);
        this.updateCharge(dt);
        break;
      }
      case 'attack':
        this.updateAttack(dt, ix, iy);
        break;
      case 'dash':
        this.updateDash(dt);
        break;
      case 'hurt':
        this.hurtT -= dt;
        this.move(dt, 9);
        if (this.hurtT <= 0) this.state = 'free';
        break;
      case 'skill':
        this.move(dt, 10);
        if (!this.skillRunner.step(dt)) this.state = 'free';
        break;
    }
    // execution prompt target
    this.execTarget = W.nearestEnemy(this.x, this.y, 130, (e) => e.staggered > 0.15);
  }

  private handleWeaponSwap() {
    const keys = ['w1', 'w2', 'w3'] as const;
    for (let i = 0; i < 3; i++) {
      if (input.pressed(keys[i]) && i < this.weapons.length && i !== this.wi) {
        if (this.state === 'free' || this.state === 'dash' || (this.state === 'attack' && this.atkPhase === 'recovery')) {
          this.wi = i;
          this.comboIdx = 0;
          this.comboGrace = 0;
          if (this.state === 'attack') this.state = 'free';
          sfx('clank');
          fx.ring(this.x, this.y, 10, 60, 0.3, this.wpn.color, 3);
          style.add(40, 'swap' + i);
        }
      }
    }
  }

  private handleGuard() {
    if (input.pressed('guard')) {
      const can = this.state === 'free' || this.state === 'charge' || (this.state === 'attack' && this.atkPhase === 'recovery');
      if (can) {
        if (W.time - this.lastGuardPress > 0.32) this.parryT = this.mods.parryWindow;
        else this.parryT = this.mods.parryWindow * 0.35; // spamming shrinks the window
        this.lastGuardPress = W.time;
        this.guardFlash = 0.12;
        if (this.state !== 'free') this.state = 'free';
        this.chargeT = 0;
      }
    }
    this.blocking = input.isDown('guard') && this.state === 'free' && this.stamina > 0;
  }

  private handleDash(ix: number, iy: number) {
    if (!input.buffered('dash', 0.13) || this.dashCharges < 1) return;
    const ok = this.state === 'free' || this.state === 'charge' ||
      (this.state === 'attack' && (this.atkPhase !== 'active')) ||
      (this.state === 'hurt' && this.hurtT < 0.2) ||
      (this.state === 'dash' && this.dashT < 0.05);
    if (!ok) return;
    input.consume('dash');
    this.dashCharges--;
    if (il(ix, iy) < 0.1) {
      ix = Math.cos(this.aim);
      iy = Math.sin(this.aim);
    }
    this.dashDX = ix;
    this.dashDY = iy;
    this.state = 'dash';
    this.dashT = 0.16;
    this.iframe = 0.2;
    this.perfectUsed = false;
    this.chargeT = 0;
    this.atk = null;
    sfx('dash');
    fx.smoke(this.x, this.y, 5, 'rgba(127,246,255,0.18)', 80, 12, 0.4);
    fx.ring(this.x, this.y, 8, 40, 0.2, this.wpn.color, 2);
  }

  private handleSkills() {
    const tryCast = (sk: SkillDef) => {
      const cost = sk.cost * this.mods.skillCost;
      if (this.focus < cost) {
        if (this.lowFocusMsgT <= 0) {
          fx.text(this.x, this.y - 34, 'NEED FOCUS', '#8a93b8', 14);
          sfx('ui', 0.5);
          this.lowFocusMsgT = 0.6;
        }
        return;
      }
      if (!(this.canAct() || this.postDash > 0)) return;
      this.focus -= cost;
      W.stats.skillUse[sk.id] = (W.stats.skillUse[sk.id] ?? 0) + 1;
      style.add(90, sk.id);
      hud.callout(sk.name, this.wpn.color, 0.8, 30);
      this.atk = null;
      this.chargeT = 0;
      if (sk.instant) {
        const r = new Runner();
        r.run(sk.run(this));
        this.instants.push(r);
        if (this.state !== 'free' && this.state !== 'dash') this.state = 'free';
      } else {
        this.state = 'skill';
        this.skillRunner.run(sk.run(this));
      }
    };
    if (input.pressed('skill1')) tryCast(this.wpn.skills[0]);
    if (input.pressed('skill2')) tryCast(this.wpn.skills[1]);
    if (input.pressed('ult')) {
      if (this.focus >= 100 && this.overdrive <= 0 && this.canAct()) this.activateOverdrive();
      else if (this.focus < 100 && this.lowFocusMsgT <= 0) {
        fx.text(this.x, this.y - 34, 'FOCUS 100 REQUIRED', '#8a93b8', 14);
        this.lowFocusMsgT = 0.6;
      }
    }
  }

  activateOverdrive() {
    this.focus = 0;
    this.overdrive = this.mods.overdriveTime;
    W.tint = 1;
    W.stats.skillUse['overdrive'] = (W.stats.skillUse['overdrive'] ?? 0) + 1;
    sfx('ult');
    W.slowMo(0.2, 0.6);
    W.flash('#7ff6ff', 0.5);
    W.shake(0.5);
    cam.punch = 0.12;
    fx.ring(this.x, this.y, 10, 260, 0.6, '#7ff6ff', 10, true);
    fx.ring(this.x, this.y, 10, 420, 0.9, '#ffffff', 3);
    fx.shards(this.x, this.y, 30, 600, '#7ff6ff', 1, 7);
    hud.callout('OVERDRIVE', '#7ff6ff', 1.4, 64);
    audio.intensity = 3;
    style.add(200, 'ult');
    this.heal(this.maxHp * 0.15);
    // shockwave that pushes enemies
    strike({ team: 'player', x: this.x, y: this.y, shape: { k: 'circle', r: 220 }, active: 0.05, damage: this.dmg(20), posture: 20, knock: 700, hitstop: 0.05, tag: 'ult', skill: true, color: '#7ff6ff' });
  }

  private handleAttack(dt: number) {
    // hold → charge
    if (input.isDown('attack')) this.holdT += dt;
    else this.holdT = 0;

    if (this.state === 'free' && this.holdT > 0.28 && !input.buffered('attack', 0.05)) {
      this.state = 'charge';
      this.chargeT = 0;
      this.chargeReady = false;
      sfx('charge', 0.7);
    }
    if (!input.buffered('attack', 0.16)) return;

    // execution on staggered enemy
    const ex = this.execTarget;
    if (ex && (this.state === 'free' || this.postDash > 0 || this.state === 'dash' || (this.state === 'attack' && this.atkPhase === 'recovery'))) {
      input.consume('attack');
      this.execute(ex);
      return;
    }
    if (this.state === 'dash' || (this.state === 'free' && this.postDash > 0)) {
      input.consume('attack');
      this.startAttack(this.wpn.dash);
      return;
    }
    if (this.state === 'free') {
      input.consume('attack');
      const idx = this.comboGrace > 0 ? this.comboIdx : 0;
      this.comboIdx = idx;
      this.startAttack(this.wpn.combo[idx]);
      return;
    }
    if (this.state === 'attack' && this.atk && this.atkPhase === 'recovery') {
      const isCombo = this.wpn.combo.includes(this.atk);
      const cancelAt = this.atk.recovery * (this.atk.cancel ?? 1);
      if (this.atkT >= cancelAt && isCombo && this.comboIdx < this.wpn.combo.length - 1) {
        input.consume('attack');
        this.comboIdx++;
        this.startAttack(this.wpn.combo[this.comboIdx]);
      }
    }
  }

  private startAttack(a: AttackDef) {
    this.state = 'attack';
    this.atk = a;
    this.atkPhase = 'startup';
    this.atkT = 0;
    // aim assist: snap to an enemy close to the aim direction
    let ang = this.aim;
    let lungeMul = 1;
    const reach = (a.circle ? a.circle.off + a.circle.r : a.range) + 90;
    const tgt = W.nearestEnemy(this.x, this.y, reach, (e) => Math.abs(angleDiff(this.aim, angleTo(this.x, this.y, e.x, e.y))) < 0.6);
    if (tgt) {
      ang = angleTo(this.x, this.y, tgt.x, tgt.y);
      const d = dist(this.x, this.y, tgt.x, tgt.y) - tgt.r - this.r;
      if (d < a.range * 0.45) lungeMul = 0.25;
    }
    this.atkAngle = ang;
    this.facing = ang;
    const l = a.lunge * lungeMul;
    this.vx = Math.cos(ang) * l;
    this.vy = Math.sin(ang) * l;
    this.atkDmgMul = 1;
    if (this.riposteT > 0) {
      this.atkDmgMul = 2.2;
      this.riposteT = 0;
      fx.text(this.x, this.y - 40, 'RIPOSTE', '#ffe14d', 20);
    }
  }

  private updateAttack(dt: number, ix: number, iy: number) {
    const a = this.atk!;
    const spd = this.mods.atkSpeed * (this.overdrive > 0 ? 1.3 : 1);
    this.atkT += dt * spd;
    // slight steering during attack
    this.vx += ix * 600 * dt;
    this.vy += iy * 600 * dt;
    this.move(dt, this.atkPhase === 'recovery' ? 14 : 9);
    if (this.atkPhase === 'startup' && this.atkT >= a.startup) {
      this.atkPhase = 'active';
      this.atkT = 0;
      this.spawnAttack(a);
    } else if (this.atkPhase === 'active' && this.atkT >= a.active) {
      this.atkPhase = 'recovery';
      this.atkT = 0;
    } else if (this.atkPhase === 'recovery' && this.atkT >= a.recovery) {
      const isCombo = this.wpn.combo.includes(a);
      this.state = 'free';
      this.atk = null;
      if (isCombo && this.comboIdx < this.wpn.combo.length - 1) {
        this.comboIdx++;
        this.comboGrace = 0.32;
      } else {
        this.comboIdx = 0;
        this.comboGrace = 0;
      }
    }
  }

  private spawnAttack(a: AttackDef) {
    const ang = this.atkAngle;
    const w = this.wpn;
    const dmg = this.dmg(a.dmg) * this.atkDmgMul;
    const base = {
      team: 'player' as const, owner: this as Actor, follow: true, active: a.active + 0.02, damage: dmg,
      posture: a.posture * this.mods.postureMul * (this.atkDmgMul > 1 ? 1.5 : 1), knock: a.knock, hitstop: a.hitstop,
      tag: a.name, crit: this.mods.crit, color: w.color, stunTime: a.stun, backstab: w.id === 'daggers',
      onHit: a.bleed ? (e: Actor) => (e.bleed = Math.min(8, e.bleed + a.bleed!)) : undefined,
    };
    if (a.thrust) {
      strike({ ...base, x: this.x, y: this.y, shape: { k: 'line', angle: ang, len: a.range, w: 46 } });
      if (!fx.anim('vfx_thrust', this.x, this.y, { angle: ang, w: a.range * 1.1, tint: w.color }))
        fx.beam(this.x, this.y, this.x + Math.cos(ang) * a.range * 1.05, this.y + Math.sin(ang) * a.range * 1.05, 10, w.color, 0.16);
      fx.sparks(this.x + Math.cos(ang) * a.range, this.y + Math.sin(ang) * a.range, ang, 0.3, 5, 400, w.core, 0.2);
    } else if (a.circle) {
      const cx = this.x + Math.cos(ang) * a.circle.off, cy = this.y + Math.sin(ang) * a.circle.off;
      strike({ ...base, follow: false, x: cx, y: cy, shape: { k: 'circle', r: a.circle.r } });
      fx.ring(cx, cy, 10, a.circle.r * 1.2, 0.45, w.color, 9, true);
      fx.ring(cx, cy, 10, a.circle.r * 1.8, 0.6, w.core, 3);
      fx.shards(cx, cy, 16, 420, w.color, 0.7, 7);
      fx.smoke(cx, cy, 8, 'rgba(255,180,90,0.22)', 160, 18, 0.7);
      W.shake(a.shake);
    } else {
      strike({ ...base, x: this.x, y: this.y, shape: { k: 'sector', r: a.range, arc: Math.min(TAU, a.arc), angle: ang } });
      if (a.arc >= TAU - 0.01) {
        fx.slash(this.x, this.y, ang, a.range, TAU * 1.05, a.dir, w.color, { width: a.slashW ?? 40, life: 0.28, core: w.core, follow: this });
      } else {
        fx.slash(this.x, this.y, ang, a.range, a.arc, a.dir, w.color, { width: a.slashW ?? a.range * 0.42, life: 0.2, core: w.core, follow: this });
      }
    }
    sfx(a.sfx, a.heavy ? 1 : 0.85);
    if (a.heavy) W.shake(a.shake * 0.5);
    // overdrive: every swing launches a light wave
    if (this.overdrive > 0) {
      shoot({
        team: 'player', x: this.x, y: this.y, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900, r: 22, kind: 'wave',
        damage: this.dmg(10), posture: 6, life: 0.5, color: '#7ff6ff', pierce: 3, tag: 'odwave', knock: 140, skill: true,
      });
    }
  }

  private updateDash(dt: number) {
    const sp = 1120 * (this.overdrive > 0 ? 1.1 : 1);
    this.vx = this.dashDX * sp;
    this.vy = this.dashDY * sp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    W.confine(this);
    this.dashT -= dt;
    this.ghostT -= dt;
    if (this.ghostT <= 0) {
      this.ghostT = 0.018;
      fx.ghost(this.x, this.y, this.facing, this.r, this.wpn.color, 0.22);
    }
    if (Math.random() < 0.8) fx.ember(this.x + rand(-8, 8), this.y + rand(-8, 8), -this.vx * 0.15, -this.vy * 0.15, this.wpn.color, 0.3, 2);
    if (this.mods.dashFlame) {
      this.flameT -= dt;
      if (this.flameT <= 0) {
        this.flameT = 0.035;
        const fxp = this.x, fyp = this.y;
        strike({
          team: 'player', x: fxp, y: fyp, shape: { k: 'circle', r: 26 }, active: 1.4, rehit: 0.3, damage: this.dmg(4), posture: 2,
          knock: 0, hitstop: 0, tag: 'flame', skill: true, hideActive: true, color: '#ff7a3c', stunTime: 0.05,
          onUpdate: (s) => {
            if (Math.random() < 0.25) fx.ember(s.x + rand(-12, 12), s.y + rand(-12, 12), rand(-10, 10), rand(-60, -20), '#ff7a3c', 0.5, 3);
          },
        });
      }
    }
    if (this.dashT <= 0) {
      this.state = 'free';
      this.postDash = 0.16;
      this.vx = this.dashDX * 330;
      this.vy = this.dashDY * 330;
    }
  }

  private updateCharge(dt: number) {
    const w = this.wpn;
    this.chargeT += dt * this.mods.chargeSpeed;
    if (!this.chargeReady && this.chargeT >= w.chargeTime) {
      this.chargeReady = true;
      sfx('chargeReady');
      fx.ring(this.x, this.y, 50, 10, 0.25, w.core, 3);
    }
    if (Math.random() < 0.6) {
      const a = rand(0, TAU), r = rand(40, 70);
      fx.ember(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, -Math.cos(a) * r * 3, -Math.sin(a) * r * 3, w.color, 0.3, 2.5);
    }
    if (!input.isDown('attack')) {
      if (this.chargeReady && this.stamina > 0) {
        this.stamina = Math.max(0, this.stamina - 20);
        this.staminaDelay = 0.6;
        this.state = 'skill';
        this.skillRunner.run(w.charged(this));
        style.add(110, 'charged-' + w.id);
      } else this.state = 'free';
      this.chargeT = 0;
      this.chargeReady = false;
    }
  }

  private execute(e: Actor) {
    W.stats.executions++;
    const a = angleTo(this.x, this.y, e.x, e.y);
    const d = dist(this.x, this.y, e.x, e.y) - e.r - this.r - 10;
    const x0 = this.x, y0 = this.y;
    this.x += Math.cos(a) * Math.max(0, d);
    this.y += Math.sin(a) * Math.max(0, d);
    W.confine(this);
    for (let i = 0; i < 6; i++) fx.ghost(x0 + (this.x - x0) * (i / 6), y0 + (this.y - y0) * (i / 6), a, this.r, '#ffe14d', 0.3);
    this.state = 'skill';
    this.invuln = 0.6;
    this.facing = this.aim = a;
    const self = this;
    this.skillRunner.run((function* () {
      W.slowMo(0.15, 0.6);
      cam.punch = 0.15;
      sfx('charge');
      fx.slash(self.x, self.y, a, 120, 2.8, 1, '#ffe14d', { width: 50, life: 0.3, follow: self });
      yield 0.12;
      fx.slash(self.x, self.y, a, 130, 2.8, -1, '#ffffff', { width: 40, life: 0.3, follow: self });
      yield 0.1;
      const dmg = e.isBoss ? e.maxHp * 0.12 + self.dmg(40) : 9999;
      e.staggered = 0;
      e.posture = 0;
      const h: HitInfo = {
        damage: dmg * self.mods.execMul, posture: 0, knock: 500, angle: a, hitstop: 0.2, unblockable: true, parryable: false,
        sx: self.x, sy: self.y, kind: 'melee', tag: 'execute', crit: true, skill: true, attacker: self, color: '#ffe14d',
      };
      e.invuln = 0;
      e.onHit(h);
      self.onDealHit(e, h, 'hit');
      sfx('execute');
      W.flash('#ffe14d', 0.5);
      W.shake(0.8);
      hud.callout('EXECUTE', '#ffe14d', 1.1, 60);
      fx.shards(e.x, e.y, 30, 700, '#ffe14d', 1.1, 8);
      fx.ring(e.x, e.y, 10, 240, 0.5, '#ffe14d', 10, true);
      fx.anim('vfx_execute', e.x, e.y, { angle: a, w: Math.max(260, e.r * 6) });
      self.focus = Math.min(100, self.focus + 30 * self.mods.focusGain);
      style.add(300, 'execute');
      yield 0.25;
    })());
  }

  // ------------------------------------------------------------ defense
  onHit(h: HitInfo): HitResult {
    if (this.dead || this.state === 'dead' || this.state === 'locked' || W.god) return 'immune';
    if (this.iframe > 0 || this.invuln > 0) {
      if (this.iframe > 0 && !this.perfectUsed) {
        this.perfectDodge();
        return 'dodge';
      }
      return h.proj ? 'dodge' : 'immune';
    }
    const srcA = angleTo(this.x, this.y, h.sx, h.sy);
    const front = Math.abs(angleDiff(this.aim, srcA)) < 1.95;
    if (this.parryT > 0 && h.parryable && !h.unblockable && front) {
      this.doParry(h, srcA);
      return 'parry';
    }
    if (this.blocking && !h.unblockable && front) return this.doBlock(h, srcA);
    // take the hit
    const dmg = h.damage;
    this.hp -= dmg;
    this.hitFlash = 0.15;
    W.stats.hitsTaken++;
    style.hurt();
    this.state = 'hurt';
    this.hurtT = 0.3;
    this.atk = null;
    this.chargeT = 0;
    this.comboGrace = 0;
    this.skillRunner.stop();
    this.z = 0;
    this.invuln = 0.75;
    this.vx = Math.cos(h.angle) * Math.max(250, h.knock);
    this.vy = Math.sin(h.angle) * Math.max(250, h.knock);
    W.hitStop(0.09);
    W.shake(0.5);
    W.aberration = 1;
    W.flash('#ff2d4a', 0.28);
    sfx('hurt');
    fx.sparks(this.x, this.y, h.angle, 1.2, 14, 500, '#ff4d6d', 0.4, 2.5);
    fx.text(this.x, this.y - 28, '-' + Math.round(dmg), '#ff4d6d', 22);
    if (this.hp <= 0) {
      if (this.mods.secondWind && !this.mods.secondWindUsed) {
        this.mods.secondWindUsed = true;
        this.hp = 1;
        this.invuln = 2;
        hud.callout('SECOND WIND', '#6dff9e', 1.2, 48);
        sfx('heal');
        W.slowMo(0.2, 1);
        fx.ring(this.x, this.y, 10, 200, 0.6, '#6dff9e', 8, true);
      } else {
        this.hp = 0;
        this.state = 'dead';
        this.dead = true;
      }
    }
    return 'hit';
  }

  private perfectDodge() {
    this.perfectUsed = true;
    W.stats.perfects++;
    W.slowMo(0.22, 0.55);
    this.iframe = Math.max(this.iframe, 0.25);
    this.focus = Math.min(100, this.focus + 16 * this.mods.focusGain);
    this.dashCharges = Math.min(this.mods.dashMax, this.dashCharges + 1);
    style.add(150, 'perfect');
    sfx('perfect');
    fx.ring(this.x, this.y, 10, 120, 0.4, '#7ff6ff', 4);
    fx.text(this.x, this.y - 36, 'PERFECT', '#7ff6ff', 22);
    hud.callout('PERFECT DODGE', '#7ff6ff', 0.6, 30);
    if (this.mods.afterimage) {
      const x = this.x, y = this.y;
      fx.slash(x, y, this.facing, 130, TAU, 1, '#b98cff', { width: 40, life: 0.35 });
      strike({ team: 'player', x, y, shape: { k: 'circle', r: 130 }, delay: 0.05, active: 0.05, damage: this.dmg(26), posture: 18, knock: 300, hitstop: 0.06, tag: 'afterimage', skill: true, color: '#b98cff', hideTele: true });
    }
  }

  private doParry(h: HitInfo, srcA: number) {
    W.stats.parries++;
    this.parryT = 0;
    this.invuln = Math.max(this.invuln, 0.25);
    const cx = this.x + Math.cos(srcA) * (this.r + 10), cy = this.y + Math.sin(srcA) * (this.r + 10);
    sfx('parry');
    W.hitStop(0.11);
    W.slowMo(0.25, 0.4);
    W.flash('#ffffff', 0.35);
    W.shake(0.35);
    cam.punch = 0.05;
    fx.sparks(cx, cy, srcA, 1.3, 28, 700, '#ffe9a8', 0.45, 2.5);
    fx.sparks(cx, cy, srcA + Math.PI, 0.7, 10, 300, '#ffffff', 0.3, 2);
    fx.ring(cx, cy, 5, 90, 0.35, '#ffe14d', 6);
    fx.ring(this.x, this.y, 10, 160, 0.5, '#ffffff', 2);
    fx.anim('vfx_parry', cx, cy, { angle: srcA });
    hud.callout('PARRY', '#ffe14d', 0.7, 46);
    this.focus = Math.min(100, this.focus + 25 * this.mods.focusGain);
    style.add(180, 'parry');
    this.riposteT = 1.5;
    if (h.proj) W.reflect(h.proj);
    else {
      if (h.strike) h.strike.dead = true;
      h.attacker?.onParried(this);
    }
    if (this.mods.parryNova) {
      fx.ring(this.x, this.y, 10, 170, 0.4, '#ffe14d', 6, true);
      strike({ team: 'player', x: this.x, y: this.y, shape: { k: 'circle', r: 160 }, active: 0.05, damage: this.dmg(18), posture: 14, knock: 450, hitstop: 0.03, tag: 'nova', skill: true, color: '#ffe14d' });
    }
  }

  private doBlock(h: HitInfo, srcA: number): HitResult {
    const chip = h.damage * 0.2;
    this.hp = Math.max(1, this.hp - chip);
    this.stamina -= 10 + h.damage * 0.9;
    this.staminaDelay = 0.8;
    this.vx = Math.cos(h.angle) * h.knock * 0.4;
    this.vy = Math.sin(h.angle) * h.knock * 0.4;
    const cx = this.x + Math.cos(srcA) * (this.r + 8), cy = this.y + Math.sin(srcA) * (this.r + 8);
    fx.sparks(cx, cy, srcA, 0.8, 10, 420, '#9ff7ff', 0.3, 2);
    fx.anim('vfx_block', cx, cy, { angle: srcA, tint: '#9ff7ff' });
    sfx('block');
    W.hitStop(0.035);
    W.shake(0.15);
    this.guardFlash = 0.1;
    if (h.proj && this.mods.reflectGuard) {
      W.reflect(h.proj, 0.6);
      return 'parry';
    }
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.staminaDelay = 1.4;
      this.state = 'hurt';
      this.hurtT = 0.9;
      this.blocking = false;
      sfx('guardBreak');
      fx.text(this.x, this.y - 36, 'GUARD BREAK', '#ff4d6d', 20);
      fx.shards(this.x, this.y, 12, 300, '#7ff6ff', 0.6, 5);
      W.shake(0.4);
    }
    return 'block';
  }

  // ------------------------------------------------------------ offense feedback
  onDealHit(t: Actor, h: HitInfo, res: HitResult) {
    if (res === 'shield') {
      W.hitStop(0.03);
      return;
    }
    const g = clamp(h.damage / 14, 0.5, 2.2);
    this.focus = Math.min(100, this.focus + (h.skill ? 1.2 : 2.8) * g * this.mods.focusGain);
    style.hit(h.tag, h.skill ? 14 : 12);
    W.hitStop(h.hitstop * (h.crit ? 1.4 : 1));
    W.shake(Math.min(0.5, h.hitstop * 3.2 + (h.crit ? 0.08 : 0)));
    if (h.crit) sfx('crit', 0.8);
    else sfx(h.damage > 25 ? 'hitHeavy' : 'hit', 0.75);
    if (h.damage > 30) cam.punch = Math.max(cam.punch, 0.03);
    this.hitCounter++;
    if (this.mods.thunder && this.hitCounter % 4 === 0) {
      let n = 0;
      for (const e of W.enemies) {
        if (e.dead || dist(t.x, t.y, e.x, e.y) > 320 || n >= 3) continue;
        n++;
        fx.bolt(t.x, t.y, e.x, e.y, '#bfe9ff', 2.5, 0.2);
        strike({ team: 'player', x: e.x, y: e.y, shape: { k: 'circle', r: 10 }, active: 0.02, damage: this.dmg(10), posture: 6, knock: 60, hitstop: 0.01, tag: 'thunder', skill: true, hideActive: true, color: '#bfe9ff' });
      }
      sfx('thunder', 0.7);
    }
    if (this.mods.bloodthirst && style.rank >= 3) this.heal(0.8);
  }

  onKill(_a: Actor) {
    this.focus = Math.min(100, this.focus + 8 * this.mods.focusGain);
    style.add(60, 'kill');
    if (this.mods.killHeal > 0) this.heal(this.mods.killHeal);
  }

  // ------------------------------------------------------------ draw
  draw(ctx: CanvasRenderingContext2D) {
    const w = this.wpn;
    const x = this.x, y = this.y - this.z;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 6, this.r * (1 - this.z / 200), this.r * 0.5, 0, 0, TAU);
    ctx.fill();
    const blink = this.invuln > 0 && this.state !== 'skill' && Math.floor(W.time * 24) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    const body = this.hitFlash > 0 ? '#ffffff' : this.overdrive > 0 ? '#bdfcff' : '#7ff6ff';

    // overdrive aura
    if (this.overdrive > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#7ff6ff';
      ctx.globalAlpha = 0.4 + Math.sin(W.time * 20) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, this.r + 10 + Math.sin(W.time * 12) * 3, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = blink ? 0.35 : 1;
    }

    // procedural pose for still sprites
    const pst = this.state === 'dash' ? 'dash' : this.state === 'attack' || this.state === 'skill' ? 'attack' : this.state === 'charge' ? 'charge'
      : this.state === 'hurt' ? 'hurt' : this.blocking || this.parryT > 0 ? 'guard' : Math.hypot(this.vx, this.vy) > 40 ? 'move' : 'idle';
    const a0 = this.atk;
    const phaseDur = a0 ? (this.atkPhase === 'startup' ? a0.startup : this.atkPhase === 'active' ? a0.active : a0.recovery) : 1;
    const bodyName = sprites.first('player_' + pst, 'player_idle');
    const P = pose({
      state: pst, t: this.stateClock.set(pst, W.time), time: W.time, speed: Math.hypot(this.vx, this.vy), hit: this.hitFlash, age: 1,
      dir: a0?.dir ?? 1, phase: this.state === 'attack' ? this.atkPhase : undefined, phaseK: this.state === 'attack' ? this.atkT / Math.max(0.001, phaseDur) : undefined,
      intensity: bodyName && (sprites.get(bodyName)?.frames ?? 1) > 1 ? 0.35 : 1,
    });
    const q = posed(x, y, this.facing, P);

    // weapon
    let wa = this.facing + 1.0;
    if (this.state === 'attack' && this.atk) {
      const a = this.atk;
      const arc = a.arc >= TAU - 0.01 ? TAU : a.arc;
      if (a.thrust) wa = this.atkAngle;
      else if (a.circle) wa = this.atkAngle;
      else if (this.atkPhase === 'startup') wa = this.atkAngle - (arc / 2) * a.dir * 1.15;
      else if (this.atkPhase === 'active') wa = this.atkAngle - (arc / 2) * a.dir + arc * a.dir * clamp(this.atkT / a.active, 0, 1);
      else wa = this.atkAngle + (arc / 2) * a.dir;
    } else if (this.state === 'charge') wa = this.facing + Math.PI * 0.85;
    else if (this.blocking) wa = this.facing + 1.5;
    ctx.globalCompositeOperation = 'lighter';
    drawWeapon(ctx, w.id, bodyName ? q.x : x, bodyName ? q.y : y, wa, this.r, w.color);
    ctx.globalCompositeOperation = 'source-over';

    // body
    const f = this.facing;
    const sprName = bodyName;
    if (sprName) {
      sprites.draw(ctx, sprName, q.x, q.y, { angle: q.angle, sx: P.sx, sy: P.sy, t: this.anim.set(sprName, W.time), flash: this.hitFlash > 0 ? 0.8 : 0, outline: this.overdrive > 0 ? '#ffffff' : '#7ff6ff', outlineAlpha: 0.8 });
    } else {
    ctx.fillStyle = '#071722';
    ctx.strokeStyle = body;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, this.r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // visor / direction
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(f) * (this.r + 7), y + Math.sin(f) * (this.r + 7));
    ctx.lineTo(x + Math.cos(f + 0.55) * (this.r - 3), y + Math.sin(f + 0.55) * (this.r - 3));
    ctx.lineTo(x + Math.cos(f - 0.55) * (this.r - 3), y + Math.sin(f - 0.55) * (this.r - 3));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, this.r * 0.38, 0, TAU);
    ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    // guard / parry visual
    if (this.parryT > 0 || this.guardFlash > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, this.r + 14, f - 1.3, f + 1.3);
      ctx.stroke();
    } else if (this.blocking) {
      ctx.strokeStyle = '#7ff6ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 + 0.5 * (this.stamina / this.mods.staminaMax);
      ctx.beginPath();
      ctx.arc(x, y, this.r + 12, f - 1.2, f + 1.2);
      ctx.stroke();
    }
    // charge
    if (this.state === 'charge') {
      const k = clamp(this.chargeT / w.chargeTime, 0, 1);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = this.chargeReady ? '#ffffff' : w.color;
      ctx.lineWidth = this.chargeReady ? 4 + Math.sin(W.time * 30) * 2 : 3;
      ctx.beginPath();
      ctx.arc(x, y, this.r + 20, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
    }
    // blade storm
    if (this.bladeStormT > 0) {
      ctx.globalAlpha = Math.min(1, this.bladeStormT * 3);
      ctx.strokeStyle = '#7ff6ff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = W.time * 11 + (i * TAU) / 4;
        const bx = x + Math.cos(a) * 78, by = y + Math.sin(a) * 78;
        if (sprites.draw(ctx, 'vfx_storm_blade', bx, by, { angle: a, w: 22, additive: true })) continue;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a + 1.57) * 22, by - Math.sin(a + 1.57) * 22);
        ctx.lineTo(bx + Math.cos(a + 1.57) * 22, by + Math.sin(a + 1.57) * 22);
        ctx.stroke();
        fx.ember(bx, by, 0, 0, '#7ff6ff', 0.15, 3);
      }
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(x, y, 92, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function il(x: number, y: number) {
  return Math.hypot(x, y);
}
