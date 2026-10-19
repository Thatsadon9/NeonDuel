/**
 * Act II final boss — THE HOLLOW KING (3 phases).
 *  I   Duel: heavy parryable greatsword strings + CROWN BEAM.
 *  II  Echoes of the Fallen: shadows of bosses you have beaten replay their signature move while the king fights on.
 *  III Collapse: the arena shatters into 5 floating islands (dash across, falling costs 15% HP). The king becomes
 *      two giant hands + a crown core; the crown only opens (vulnerable) after the hands slam.
 */
import { TAU, rand, dist, chance, angleTo, clamp } from '../../core/math';
import type { Co } from '../../core/co';
import { fx } from '../../render/fx';
import { cam } from '../../render/camera';
import { sfx, audio } from '../../audio/audio';
import { sprites } from '../../render/sprites';
import { W, strike, type HitInfo, type HitResult } from '../world';
import { Enemy, RED, ORANGE } from '../enemies';
import { Boss } from './base';
import { T } from '../tuning';
import { hazard, skyStrike } from './hazards';
import { hud } from '../../ui/hud';
import { codex } from '../codex';

const PALE = '#e8e8ff';
const GOLD = '#ffe14d';
const VOID = '#9d5bff';

const ISLANDS = [{ x: 0, y: 0, r: 150 }, ...[0, 1, 2, 3].map((k) => {
  const a = Math.PI / 4 + (k * Math.PI) / 2;
  return { x: Math.cos(a) * 340, y: Math.sin(a) * 340, r: 120 };
})];

/** a shadow of a fallen boss: invulnerable, performs one signature move, then fades */
class EchoGhost extends Enemy {
  private life = 0;
  constructor(x: number, y: number, public key: string, private sig: (g: EchoGhost) => Co) {
    super(x, y);
    this.r = 28;
    this.color = VOID;
    this.solid = false;
    this.unstoppable = true;
    this.name = 'Echo';
    this.spriteKey = 'boss_' + key;
    this.runner.run(this.sig(this));
  }
  preHit(): HitResult {
    return 'immune';
  }
  think(dt: number) {
    this.life += dt;
    this.face(this.aP, dt, 5);
    if (!this.runner.step(dt)) {
      this.dead = true;
      fx.smoke(this.x, this.y, 10, 'rgba(157,91,255,0.3)', 120, 20, 0.6);
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life * 3, 0, 1) * 0.55;
    this.drawTele(ctx);
    if (!this.drawBody(ctx, false)) {
      ctx.strokeStyle = VOID;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  rimColor() {
    return VOID;
  }
}

export class HollowKing extends Boss {
  stage: 1 | 2 | 3 = 1;
  private echoT = 3;
  private crownOpen = 0;
  private hands = [{ x: -200, y: -120, tx: -200, ty: -120, slam: 0 }, { x: 200, y: -120, tx: 200, ty: -120, slam: 0 }];
  private beamA: number | null = null;
  private fallCd = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.spriteKey = 'boss_hollow';
    this.hp = this.maxHp = Math.round(T.bossHp.hollow * (W.hardMode ? T.hardHp : 1));
    this.maxPosture = Math.round(380 * T.bossPosture);
    this.r = 34;
    this.color = PALE;
    this.phase2Color = GOLD;
    this.hpPhase = false;
    this.title = 'THE HOLLOW KING';
    this.subtitle = 'ราชาผู้ว่างเปล่า — ต้นกำเนิดของรอยแยกทั้งหมด';
    this.buildMoves();
  }

  buildMoves() {
    this.moves = [
      { name: 'attack', w: 3, max: 260, fn: () => this.greatsword() },
      { name: 'beam', w: 2, cd: 6, fn: () => this.crownBeam() },
      { name: 'wave', w: 2, min: 180, cd: 3, fn: () => this.swordWave() },
      { name: 'leap', w: 1, min: 260, cd: 6, fn: () => this.leap() },
    ];
  }

  think(dt: number) {
    if (this.active && !this.transitioning && !this.runner.running && this.staggered <= 0) {
      if (this.stage === 1 && this.hp <= this.maxHp * 0.66) {
        this.stage = 2;
        this.runner.run(this.phaseTransition());
      } else if (this.stage === 2 && this.hp <= this.maxHp * 0.33) {
        this.stage = 3;
        this.runner.run(this.collapse());
      }
    }
    super.think(dt);
    if (!this.active || this.dead) return;
    if (this.stage === 2 && this.staggered <= 0) {
      this.echoT -= dt;
      if (this.echoT <= 0) {
        this.echoT = rand(4.5, 6);
        this.summonEcho();
      }
    }
    if (this.stage === 3) this.crownOpen = Math.max(0, this.crownOpen - dt);
  }

  enterPhase2() {
    this.restMul = 1.15; // the echoes carry the pressure
    hud.callout('ECHOES OF THE FALLEN', VOID, 1.6, 40);
  }

  update(dt: number) {
    super.update(dt);
    // hands drift towards their targets
    for (const h of this.hands) {
      const k = 1 - Math.exp(-6 * dt);
      h.x += (h.tx - h.x) * k;
      h.y += (h.ty - h.y) * k;
      h.slam = Math.max(0, h.slam - dt);
    }
    if (this.stage === 3 && !this.dead) this.checkFall(dt);
  }

  // ---------------------------------------------------------------- phase III: islands
  private onIsland(x: number, y: number, pad = 0) {
    return ISLANDS.some((i) => dist(x, y, i.x, i.y) < i.r + pad);
  }
  private fallCds = new Map<unknown, number>();
  private checkFall(dt: number) {
    for (const p of W.players) this.checkFallOne(p, dt);
  }
  private checkFallOne(p: (typeof W.players)[number], dt: number) {
    const cd = (this.fallCds.get(p) ?? 0) - dt;
    this.fallCds.set(p, cd);
    if (p.dead || p.iframe > 0 || p.state === 'dash' || cd > 0) return;
    if (this.onIsland(p.x, p.y, 4)) return;
    this.fallCds.set(p, 1);
    let best = ISLANDS[0], bd = Infinity;
    for (const i of ISLANDS) {
      const d = dist(p.x, p.y, i.x, i.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    fx.ring(p.x, p.y, 30, 4, 0.4, VOID, 5);
    hud.callout('FELL!', VOID, 0.8, 34);
    p.onHit({ damage: T.hollowFall, posture: 0, knock: 0, angle: 0, hitstop: 0.05, unblockable: true, parryable: false, sx: p.x, sy: p.y, kind: 'aoe', tag: 'fall' });
    const a = angleTo(best.x, best.y, this.x, this.y) + Math.PI;
    p.x = best.x + Math.cos(a) * best.r * 0.5;
    p.y = best.y + Math.sin(a) * best.r * 0.5;
    p.vx = p.vy = 0;
    p.invuln = Math.max(p.invuln, 1);
    fx.ring(p.x, p.y, 4, 60, 0.4, '#7ff6ff', 5);
  }

  private *collapse(): Co {
    this.transitioning = true;
    this.lastMove = 'phase';
    this.invuln = 3;
    for (const s of W.strikes) if (s.owner === this) s.dead = true;
    hud.callout('COLLAPSE', GOLD, 1.6, 58);
    sfx('roar');
    W.slowMo(0.35, 1.2);
    cam.focus = { x: 0, y: 0 };
    cam.zoomMul = 0.9;
    for (let t = 0; t < 1.4; t += this.dt) {
      W.shake(0.03);
      if (chance(0.5)) fx.shards(rand(-400, 400), rand(-400, 400), 3, 200, '#3a3550', 0.8, 9);
      this.steer(0, 0, 400, this.dt, 6);
      yield 0;
    }
    this.x = 0;
    this.y = 0;
    this.vx = this.vy = 0;
    this.kbResist = 1;
    this.solid = true; // the crown core blocks the centre island
    // make sure the player ends up on solid ground
    for (const [i, q] of W.players.entries()) {
      if (this.onIsland(q.x, q.y)) continue;
      q.x = ISLANDS[1 + (i % 4)].x;
      q.y = ISLANDS[1 + (i % 4)].y;
    }
    W.flash(GOLD, 0.6);
    W.shake(1);
    sfx('explosion');
    audio.intensity = 3;
    cam.focus = null;
    cam.zoomMul = 1;
    this.phase = 2;
    this.speed *= 1.1;
    this.moves = [
      { name: 'slam', w: 4, fn: () => this.handSlam() },
      { name: 'rain', w: 2, cd: 5, fn: () => this.crownRain() },
      { name: 'beam', w: 2, cd: 7, fn: () => this.crownBeam() },
    ];
    this.transitioning = false;
    this.rest = 0.8;
  }

  damageTakenMul(h: HitInfo) {
    if (this.stage !== 3 || this.staggered > 0 || h.tag === 'execute') return 1;
    return this.crownOpen > 0 ? 1.3 : 0.25;
  }
  postureTakenMul() {
    return this.stage === 3 && this.crownOpen <= 0 ? 0.2 : 1;
  }

  idle(dt: number) {
    if (this.stage === 3) {
      this.vx = this.vy = 0;
      this.x += (0 - this.x) * 0.1;
      this.y += (0 - this.y) * 0.1;
      this.face(this.aP, dt, 3);
      // hands hover beside the crown
      this.hands[0].tx = -170;
      this.hands[0].ty = -90 + Math.sin(W.time * 1.5) * 20;
      this.hands[1].tx = 170;
      this.hands[1].ty = -90 + Math.cos(W.time * 1.5) * 20;
      return;
    }
    this.face(this.aP, dt, 3.5);
    const a = this.aP, d = this.dP;
    this.steer(this.x + Math.cos(a) * (d - 170), this.y + Math.sin(a) * (d - 170), 135, dt, 3);
  }

  // ---------------------------------------------------------------- phase I/II moves
  private *greatsword(): Co {
    const n = this.stage >= 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      yield* this.track(0.1, 9);
      const a = this.aP;
      this.facing = a;
      const d = i === 0 ? 0.55 : 0.36;
      const last = i === n - 1;
      this.tele(d, last && this.stage >= 2 ? RED : ORANGE);
      this.atk({ k: 'sector', r: last ? 180 : 150, arc: last ? 2.8 : 2.1, angle: a }, {
        delay: d, active: 0.1, damage: last ? 20 : 15, knock: last ? 560 : 380, tag: 'hking',
        unblockable: last && this.stage >= 2, parryable: !(last && this.stage >= 2), color: last && this.stage >= 2 ? RED : ORANGE,
        onStart: () => {
          this.vx = Math.cos(a) * 460;
          this.vy = Math.sin(a) * 460;
          fx.slash(this.x, this.y, a, last ? 175 : 145, last ? 2.8 : 2.1, i % 2 ? -1 : 1, i === n - 1 ? GOLD : PALE, { width: last ? 60 : 44, core: '#ffffff', follow: this });
          sfx('slashHeavy', 0.7);
          if (last) W.shake(0.35);
        },
      });
      yield d + 0.12;
    }
    yield 0.75;
  }
  private *crownBeam(): Co {
    yield* this.track(0.2, 8);
    const dir = chance(0.5) ? 1 : -1;
    const a = this.aP - dir * 0.6;
    this.tele(0.9, RED);
    sfx('laserCharge');
    this.beamA = a;
    strike({
      team: 'enemy', owner: this, x: this.x, y: this.y, follow: true, shape: { k: 'line', angle: a, len: 1300, w: 36 }, delay: 0.9, active: 1.5, rehit: 0.35,
      damage: 16 * this.dmgScale, knock: 360, unblockable: true, parryable: false, color: RED, tag: 'crownbeam',
      onStart: () => sfx('laser'),
      onUpdate: (s, dt) => {
        const sh = s.shape as { angle: number };
        if (s.delay <= 0) sh.angle += dir * (1.2 / 1.5) * dt;
        this.beamA = sh.angle;
        this.facing = sh.angle;
      },
      onEnd: () => (this.beamA = null),
    });
    for (let t = 0; t < 2.4; t += this.dt) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      yield 0;
    }
    this.beamA = null;
    yield 0.4;
  }
  private *swordWave(): Co {
    yield* this.track(0.2, 10);
    this.tele(0.5);
    yield 0.5;
    const n = this.stage >= 2 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = this.aP + (i - (n - 1) / 2) * 0.35;
      this.bullet(a, 420, { r: 18, damage: 14, color: ORANGE, parryable: true, posture: 30, kind: 'wave', life: 2, noObstacle: true });
    }
    fx.slash(this.x, this.y, this.aP, 120, 1.6, 1, GOLD, { width: 40 });
    sfx('slashHeavy', 0.6);
    yield 0.7;
  }
  private *leap(): Co {
    const tx = this.p.x, ty = this.p.y, x0 = this.x, y0 = this.y, T = 0.9;
    this.tele(T, RED);
    strike({
      team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r: 140 }, delay: T, active: 0.08, damage: 22 * this.dmgScale, knock: 650,
      unblockable: true, parryable: false, color: RED, tag: 'hleap',
      onStart: () => {
        sfx('slam');
        W.shake(0.6);
        fx.ring(tx, ty, 20, 170, 0.45, GOLD, 9, true);
      },
    });
    this.solid = false;
    for (let t = 0; t < T; t += this.dt) {
      const u = clamp(t / T, 0, 1);
      this.x = x0 + (tx - x0) * u;
      this.y = y0 + (ty - y0) * u;
      this.vx = this.vy = 0;
      this.invuln = 0.05;
      yield 0;
    }
    this.solid = true;
    W.confine(this);
    yield 0.9;
  }

  // ---------------------------------------------------------------- phase II echoes
  private summonEcho() {
    const beaten = codex.data.bossesBeaten.filter((b) => b !== 'hollow');
    const pool = beaten.length >= 2 ? beaten : ['vanguard', 'hex', 'colossus', 'mirror'];
    const id = pool[Math.floor(Math.random() * pool.length)];
    const a = rand(0, TAU);
    const x = Math.cos(a) * 300, y = Math.sin(a) * 300;
    const key = id === 'twins' ? 'kael' : id === 'voltaris' ? 'voltaris_head' : id;
    const g = new EchoGhost(x, y, key, (gh) => this.echoMove(id, gh));
    W.enemies.push(g);
    fx.anim('vfx_portal', x, y, { w: 120, dur: 0.6, tint: VOID, under: true });
    fx.text(x, y - 50, 'ECHO · ' + id.toUpperCase(), VOID, 15);
    sfx('teleport', 0.6);
  }
  private *echoMove(id: string, g: EchoGhost): Co {
    const P = () => this.p;
    yield 0.4;
    switch (id) {
      case 'vanguard':
      case 'twins':
      case 'mirror': {
        // charge across the arena
        const a = angleTo(g.x, g.y, P().x, P().y);
        g.tele(0.8, RED);
        g.atk({ k: 'line', angle: a, len: 700, w: 60 }, { delay: 0.8, active: 0.001, noHit: true, follow: true, unblockable: true, color: RED });
        yield 0.8;
        const s = g.atk({ k: 'circle', r: 40 }, { active: 0.55, damage: 16, knock: 500, unblockable: true, parryable: false, color: RED, tag: 'echo' });
        for (let t = 0; t < 0.55; t += g.dt) {
          g.x += Math.cos(a) * 1250 * g.dt;
          g.y += Math.sin(a) * 1250 * g.dt;
          if (chance(0.5)) fx.ghost(g.x, g.y, a, g.r, VOID, 0.2, 'circle');
          yield 0;
        }
        s.dead = true;
        break;
      }
      case 'hex':
      case 'tempus': {
        g.tele(0.5, VOID);
        yield 0.5;
        let a0 = rand(0, TAU);
        for (let t = 0; t < 1.6; t += 0.1) {
          a0 += 0.25;
          for (let i = 0; i < 3; i++) g.bullet(a0 + (i * TAU) / 3, 200, { r: 7, damage: 9, color: VOID, life: 3.5 });
          yield 0.1;
        }
        break;
      }
      case 'colossus':
      case 'kagutsuchi': {
        const tx = P().x, ty = P().y;
        g.tele(0.9, RED);
        strike({
          team: 'enemy', owner: g, x: tx, y: ty, shape: { k: 'ring', r: 40, w: 30 }, delay: 0.9, active: 1.0, damage: 14 * g.dmgScale, knock: 420,
          unblockable: true, parryable: false, color: RED, tag: 'echoring',
          onStart: () => {
            sfx('slam', 0.6);
            fx.ring(tx, ty, 10, 120, 0.4, VOID, 8, true);
          },
          onUpdate: (s, dt) => {
            if (s.delay <= 0) (s.shape as { r: number }).r += 480 * dt;
          },
        });
        yield 1.6;
        break;
      }
      case 'nyxara':
        for (let i = 0; i < 3; i++) {
          const a = rand(0, TAU), rr = rand(60, 200);
          hazard(g, P().x + Math.cos(a) * rr, P().y + Math.sin(a) * rr, 70, 4, 6, '#7dff4d', 'vfx_poison_ground', 'poison');
          yield 0.3;
        }
        break;
      default:
        for (let i = 0; i < 4; i++) {
          skyStrike(g, P().x + rand(-80, 80), P().y + rand(-80, 80), 75, 0.8, 12);
          yield 0.35;
        }
    }
    yield 0.6;
  }

  // ---------------------------------------------------------------- phase III moves
  private *handSlam(): Co {
    const order = chance(0.5) ? [0, 1] : [1, 0];
    for (const hi of order) {
      const h = this.hands[hi];
      const p = this.p;
      // slam the island the player stands on
      let isl = ISLANDS[0], bd = Infinity;
      for (const i of ISLANDS) {
        const d = dist(p.x, p.y, i.x, i.y);
        if (d < bd) {
          bd = d;
          isl = i;
        }
      }
      const tx = isl === ISLANDS[0] ? p.x : isl.x, ty = isl === ISLANDS[0] ? p.y : isl.y;
      const r = isl === ISLANDS[0] ? 110 : isl.r + 10;
      h.tx = tx;
      h.ty = ty - 40;
      this.tele(1.0, RED);
      strike({
        team: 'enemy', owner: this, x: tx, y: ty, shape: { k: 'circle', r }, delay: 1.0, active: 0.08, damage: 26 * this.dmgScale, knock: 500,
        unblockable: true, parryable: false, color: RED, tag: 'handslam',
        onStart: () => {
          h.ty = ty;
          h.slam = 0.4;
          sfx('slam');
          W.shake(0.7);
          fx.ring(tx, ty, 20, r + 30, 0.45, PALE, 10, true);
          fx.shards(tx, ty, 20, 420, PALE, 0.8, 7);
        },
      });
      yield 1.25;
    }
    // the crown opens: punish window
    this.crownOpen = 3.2;
    hud.callout('THE CROWN OPENS', GOLD, 1, 34);
    sfx('guardBreak');
    yield 3.2;
  }
  private *crownRain(): Co {
    this.tele(0.6, VOID);
    yield 0.6;
    for (let k = 0; k < 3; k++) {
      const n = 20, off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const par = i % 5 === 0;
        this.bullet(off + (i / n) * TAU, 200, { r: par ? 11 : 8, damage: par ? 12 : 9, color: par ? ORANGE : VOID, parryable: par, posture: 20, life: 4 });
      }
      sfx('shootBig', 0.5);
      yield 0.5;
    }
    yield 0.4;
  }

  *deathSequence(): Co {
    hud.callout('THE CROWN SHATTERS', GOLD, 2.2, 56);
    fx.anim('vfx_execute', this.x, this.y, { w: 420 });
    W.flash(GOLD, 0.8);
    yield 0.25;
    yield* super.deathSequence();
  }

  onDeath() {
    for (const e of W.enemies) if (e instanceof EchoGhost) e.dead = true;
  }

  drawFloor(ctx: CanvasRenderingContext2D) {
    if (this.stage !== 3) return;
    // the void between the islands
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, W.arenaR + 40, 0, TAU);
    for (const i of ISLANDS) {
      ctx.moveTo(i.x + i.r, i.y);
      ctx.arc(i.x, i.y, i.r, 0, TAU, true);
    }
    ctx.fillStyle = 'rgba(3,2,10,0.94)';
    ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    for (const i of ISLANDS) {
      if (sprites.draw(ctx, 'hollow_island', i.x, i.y, { w: i.r * 2.3, alpha: 0.9 })) continue;
      ctx.strokeStyle = PALE;
      ctx.globalAlpha = 0.5 + Math.sin(W.time * 2 + i.x) * 0.15;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(i.x, i.y, i.r, 0, TAU);
      ctx.stroke();
    }
    // starfield in the void
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#b9b0ff';
    for (let k = 0; k < 40; k++) {
      const a = k * 2.399, rr = 60 + ((k * 97) % 520);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (this.onIsland(x, y)) continue;
      const tw = 0.5 + 0.5 * Math.sin(W.time * 2 + k);
      ctx.fillRect(x, y, 2 * tw + 1, 2 * tw + 1);
    }
    ctx.restore();
  }

  protected stateNames(st: string): string[] {
    return super.stateNames(st);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.stage === 3) {
      this.drawShadow(ctx);
      this.drawTele(ctx, this.r + 20);
      for (const [i, h] of this.hands.entries()) {
        if (!sprites.draw(ctx, 'boss_hollow_hand', h.x, h.y, { w: 150 * (1 + h.slam * 0.4), flipY: i === 1, angle: Math.PI / 2, outline: this.crownOpen > 0 ? GOLD : PALE, outlineAlpha: 0.7, flash: this.hitFlash > 0 ? 0.4 : 0 })) {
          ctx.save();
          ctx.strokeStyle = PALE;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(h.x, h.y, 50, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      const open = this.crownOpen > 0;
      const pulse = 1 + Math.sin(W.time * (open ? 10 : 3)) * 0.06;
      if (!sprites.draw(ctx, open ? 'boss_hollow_crown_open' : 'boss_hollow_crown', this.x, this.y, { w: 110 * pulse, flash: this.hitFlash > 0 ? 0.7 : 0, outline: open ? GOLD : PALE, outlineAlpha: 0.9 })) {
        ctx.save();
        ctx.fillStyle = open ? GOLD : '#2a2840';
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 36 * pulse, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      this.drawStun(ctx);
      return;
    }
    this.drawBossCommon(ctx);
    const spr = this.drawSpriteBoss(ctx);
    if (!spr) {
      const r = this.r;
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * TAU) * r, Math.sin((i / 6) * TAU) * r]);
      this.glowPoly(ctx, pts, this.rimColor(), '#0e0d1a', 4);
    }
    // the floating crown
    const cy = this.y - this.r - 26 + Math.sin(W.time * 2) * 4;
    if (!sprites.draw(ctx, 'boss_hollow_crown', this.x, cy, { w: 54, outline: GOLD, outlineAlpha: 0.6 })) {
      ctx.save();
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♛', this.x, cy + 8);
      ctx.restore();
    }
    if (this.beamA !== null) fx.sparks(this.x, cy, this.beamA, 0.3, 1, 200, GOLD);
  }
}
