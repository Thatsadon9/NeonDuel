/** Run controller: stage sequence, waves, boss intros/deaths, upgrade picks, game over / victory. */
import { TAU, rand, dist } from '../core/math';
import { input } from '../core/input';
import { Runner } from '../core/co';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { audio, sfx } from '../audio/audio';
import { W, strike, drawStrikes, drawProjectiles, drawObstacles, type Actor } from './world';
import { Player } from './player';
import { makeMinion, type MinionKind } from './enemies';
import type { Boss } from './bosses/base';
import { Vanguard } from './bosses/vanguard';
import { HexWeaver } from './bosses/hexweaver';
import { makeTwins } from './bosses/twins';
import { Colossus, placePillars } from './bosses/colossus';
import { Mirror } from './bosses/mirror';
import { style, RANKS } from './style';
import { rollUpgrades } from './upgrades';
import type { WeaponId } from './weapons';
import { hud } from '../ui/hud';
import { menus } from '../ui/menus';

type BossId = 'vanguard' | 'hex' | 'twins' | 'colossus' | 'mirror';
type StageDef =
  | { kind: 'wave'; name: string; sub: string; waves: [MinionKind, number][][] }
  | { kind: 'boss'; boss: BossId };

export const STAGES: StageDef[] = [
  { kind: 'wave', name: 'TRIAL I', sub: 'อุ่นเครื่อง — เรียนรู้การเคลื่อนไหวและคอมโบ', waves: [[['rusher', 3]], [['rusher', 2], ['gunner', 2]]] },
  { kind: 'boss', boss: 'vanguard' },
  { kind: 'wave', name: 'TRIAL II', sub: 'กระสุนสีทอง = Parry สะท้อนกลับได้', waves: [[['gunner', 3], ['rusher', 2]], [['shield', 2], ['rusher', 2], ['gunner', 1]]] },
  { kind: 'boss', boss: 'hex' },
  { kind: 'wave', name: 'TRIAL III', sub: 'ระวังตัวระเบิด — ฆ่าก่อนที่มันจะถึงตัว', waves: [[['bomber', 4], ['gunner', 2]], [['shield', 2], ['bomber', 3], ['rusher', 2]]] },
  { kind: 'boss', boss: 'twins' },
  { kind: 'wave', name: 'TRIAL IV', sub: 'ฝูงชน — ใช้สกิลกวาดล้าง', waves: [[['rusher', 4], ['shield', 2]], [['gunner', 4], ['bomber', 4]], [['shield', 3], ['rusher', 3], ['gunner', 2]]] },
  { kind: 'boss', boss: 'colossus' },
  { kind: 'wave', name: 'TRIAL V', sub: 'ก่อนเผชิญหน้าเงาของตัวเอง', waves: [[['rusher', 4], ['gunner', 3], ['bomber', 2]], [['shield', 3], ['bomber', 4], ['gunner', 3], ['rusher', 3]]] },
  { kind: 'boss', boss: 'mirror' },
];

type Phase = 'title' | 'intro' | 'fight' | 'bossIntro' | 'bossDeath' | 'clear' | 'upgrade' | 'dead' | 'victory';

const SAVE_KEY = 'neonduel.best.v1';
export interface SaveData { bestStage: number; wins: number; bestTime: number; bestRank: number; runs: number }
export function loadSave(): SaveData {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '');
    if (s && typeof s === 'object') return { bestStage: 0, wins: 0, bestTime: 0, bestRank: 0, runs: 0, ...s };
  } catch { /* no save */ }
  return { bestStage: 0, wins: 0, bestTime: 0, bestRank: 0, runs: 0 };
}
function writeSave(s: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

class Run {
  phase: Phase = 'title';
  paused = false;
  t = 0;
  stage = 0;
  sub = 0;
  pending = 0;
  taken: Record<string, number> = {};
  seq = new Runner();
  bosses: Boss[] = [];
  tut = 0;
  tutT = 0;
  private stageStartHp = 0;
  lastBoss: Boss | null = null;

  constructor() {
    W.onKillHooks.push((a) => {
      if (a.isBoss) this.lastBoss = a as Boss;
    });
  }

  get player() {
    return W.player;
  }

  toTitle() {
    this.phase = 'title';
    this.paused = false;
    W.reset();
    W.player = new Player();
    W.player.state = 'locked';
    W.player.x = 0;
    W.player.y = 120;
    W.stats = freshStats();
    cam.focus = null;
    cam.zoomMul = 1.15;
    audio.setMusic('menu');
    menus.showTitle(loadSave(), (wpn, hard) => this.start(wpn, hard));
  }

  start(weapon: WeaponId, hard: boolean, atStage = 0) {
    audio.init();
    W.hardMode = hard;
    W.reset();
    W.stats = freshStats();
    style.reset();
    const p = new Player();
    p.weapons = [weapon];
    W.player = p;
    this.taken = {};
    this.stage = atStage;
    // debug start: give upgrades roughly matching progress
    for (let i = 0; i < atStage; i++) {
      const o = rollUpgrades(p, this.taken, 1, i === 1);
      if (o[0]) {
        o[0].apply(p);
        this.taken[o[0].id] = (this.taken[o[0].id] ?? 0) + 1;
      }
    }
    const save = loadSave();
    save.runs++;
    writeSave(save);
    menus.hide();
    this.beginStage();
  }

  beginStage() {
    const def = STAGES[this.stage];
    W.enemies.length = 0;
    W.strikes.length = 0;
    W.projs.length = 0;
    W.obstacles.length = 0;
    W.arenaR = W.arenaTargetR = 560;
    W.tint = 0;
    fx.clear();
    this.bosses = [];
    this.lastBoss = null;
    this.tut = 0;
    const p = this.player;
    p.resetForStage();
    p.x = 0;
    p.y = 260;
    p.dead = false;
    p.state = 'locked';
    p.facing = p.aim = -Math.PI / 2;
    this.stageStartHp = p.hp;
    this.sub = 0;
    this.pending = 0;
    this.seq.stop();
    cam.x = p.x;
    cam.y = p.y;
    cam.zoomMul = 1;
    W.combatActive = false;
    if (def.kind === 'wave') {
      this.phase = 'intro';
      this.t = 1.7;
      audio.setMusic('combat', 1);
      hud.showBanner(def.name, def.sub, '#7ff6ff', 1.9);
      sfx('uiConfirm');
    } else {
      this.phase = 'bossIntro';
      this.t = 3.0;
      audio.setMusic('boss', 2);
      const bs = this.makeBoss(def.boss);
      this.bosses = bs;
      for (const b of bs) W.enemies.push(b);
      const b0 = bs[0];
      const title = bs.length > 1 ? 'TWIN FANGS' : b0.title;
      const sub = bs.length > 1 ? 'คู่แฝดเขี้ยวดาบและเขี้ยวเงา — ฆ่าตัวหนึ่ง อีกตัวจะคลั่ง' : b0.subtitle;
      const cx = bs.reduce((s, b) => s + b.x, 0) / bs.length, cy = bs.reduce((s, b) => s + b.y, 0) / bs.length;
      cam.focus = { x: cx, y: cy };
      cam.zoomMul = 1.35;
      hud.showBanner(title, sub, bs[0].color, 2.9, true, 'portrait_' + def.boss);
      sfx('roar');
      for (const b of bs) {
        fx.ring(b.x, b.y, 10, 260, 0.9, b.color, 8, true);
        fx.shards(b.x, b.y, 24, 400, b.color, 1, 7);
      }
    }
  }

  private makeBoss(id: BossId): Boss[] {
    switch (id) {
      case 'vanguard': return [new Vanguard(0, -200)];
      case 'hex': return [new HexWeaver(0, -240)];
      case 'twins': return makeTwins();
      case 'colossus': placePillars(); return [new Colossus(0, -150)];
      case 'mirror': return [new Mirror(0, -220)];
    }
  }

  private spawnSubWave() {
    const def = STAGES[this.stage];
    if (def.kind !== 'wave') return;
    const list = def.waves[this.sub];
    const p = this.player;
    for (const [kind, n0] of list) {
      const n = W.hardMode ? n0 + 1 : n0;
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0;
        for (let k = 0; k < 20; k++) {
          const a = rand(0, TAU), r = rand(200, 480);
          x = Math.cos(a) * r;
          y = Math.sin(a) * r;
          if (dist(x, y, p.x, p.y) > 260) break;
        }
        this.pending++;
        const delay = 0.6 + i * 0.12 + rand(0, 0.3);
        const sx = x, sy = y;
        fx.anim('vfx_portal', sx, sy, { w: 100, dur: delay + 0.35, tint: '#c25bff', under: true });
        strike({
          team: 'enemy', x: sx, y: sy, shape: { k: 'circle', r: 34 }, delay, active: 0.001, noHit: true, color: '#c25bff', tag: 'portal',
          onStart: () => {
            const e = makeMinion(kind, sx, sy);
            e.facing = Math.atan2(p.y - sy, p.x - sx);
            W.enemies.push(e);
            this.pending--;
            fx.ring(sx, sy, 50, 5, 0.35, e.color, 4);
            fx.burst(sx, sy, 14, 200, e.color, 0.5, 3);
            sfx('spawn', 0.6);
          },
        });
      }
    }
  }

  /** called every fixed tick with real dt */
  tick(dt: number) {
    if (input.pressed('pause') && this.isPlaying() && this.phase !== 'upgrade') this.togglePause();
    if (input.pressed('debug')) W.debug = !W.debug;
    hud.update(dt);
    if (this.phase === 'title') {
      W.time += dt;
      fx.update(dt);
      cam.update(dt, 0, 0, 0, 0);
      // idle ambiance on title
      if (Math.random() < dt * 3) {
        const a = rand(0, TAU), r = rand(100, 500);
        fx.ember(Math.cos(a) * r, Math.sin(a) * r, 0, -rand(20, 60), '#7ff6ff', 1.5, 2.5);
      }
      return;
    }
    if (this.paused || this.phase === 'upgrade' || this.phase === 'victory') return;

    if (W.debug && input.pressed('skip')) {
      for (const e of W.enemies) if (!e.dead) {
        e.hp = 1;
        e.invuln = 0;
        e.onHit({ damage: 99999, posture: 0, knock: 0, angle: 0, hitstop: 0, unblockable: true, parryable: false, sx: e.x, sy: e.y, kind: 'aoe', tag: 'debug' });
      }
      this.pending = 0;
      if (STAGES[this.stage].kind === 'wave') this.sub = 99;
    }

    const scale = W.tickTime(dt);
    const g = dt * scale;
    W.time += g;
    input.now = W.time;
    const p = this.player;

    // phase timers
    this.t -= dt;
    if (this.phase === 'intro' && this.t <= 0) {
      this.phase = 'fight';
      p.state = 'free';
      W.combatActive = true;
      this.spawnSubWave();
      if (this.stage === 0) this.tutorial(0);
    }
    if (this.phase === 'bossIntro' && this.t <= 0) {
      this.phase = 'fight';
      p.state = 'free';
      W.combatActive = true;
      cam.focus = null;
      cam.zoomMul = 1;
      for (const b of this.bosses) {
        b.active = true;
        b.rest = 0.6;
      }
      const id = (STAGES[this.stage] as { boss: BossId }).boss;
      const hints: Record<BossId, string> = {
        vanguard: 'บอสยกโล่ = กันการโจมตีจากด้านหน้า → PARRY ท่าฟันสีส้ม (คลิกขวาพอดีจังหวะ) หรืออ้อมไปด้านหลัง',
        hex: 'ลูกแก้วสีทองมีวงแหวน = PARRY สะท้อนใส่บอส • เลเซอร์สีแดง = DASH ผ่าน',
        twins: 'โฟกัสทีละตัว — เมื่อตัวหนึ่งตาย อีกตัวจะเข้าสู่โหมดคลั่ง',
        colossus: 'ล่อให้มันพุ่งชนเสา! แกนกลางสีทองเปิด = ดาเมจและ Posture x2',
        mirror: 'ห้ามตีใส่ท่าตั้งรับสีขาว (จะโดนสวนกลับ) — ใช้สกิลหรือท่าชาร์จทำลาย',
      };
      hud.showHint(hints[id], 7);
    }

    // simulation
    p.update(g);
    for (const e of W.enemies) if (!e.dead) e.update(g);
    W.updateStrikes(g);
    W.updateProjectiles(g);
    fx.update(g);
    style.update(this.phase === 'fight' ? g : 0);
    if (this.phase === 'fight') W.stats.time += g;
    W.stats.maxCombo = Math.max(W.stats.maxCombo, style.maxCombo);
    W.stats.bestRank = Math.max(W.stats.bestRank, style.rank);
    W.enemies = W.enemies.filter((e) => !e.dead || e.isBoss);
    this.seq.step(g);

    // camera lead towards mouse
    const m = p.aimPoint();
    cam.update(dt, p.x, p.y, (m.x - p.x) * 0.22, (m.y - p.y) * 0.22);

    if (this.stage === 0 && this.phase === 'fight') this.tutorialTick(g);

    // death
    if (p.dead && this.phase !== 'dead') {
      this.phase = 'dead';
      this.t = 2.2;
      W.slowMo(0.25, 1.6);
      sfx('death');
      fx.shards(p.x, p.y, 30, 500, '#7ff6ff', 1.4, 7);
      fx.anim('player_death', p.x, p.y, { angle: p.facing, additive: false, under: true, hold: 3 });
      fx.ring(p.x, p.y, 10, 300, 0.8, '#ff2d4a', 8);
      cam.focus = { x: p.x, y: p.y };
      cam.zoomMul = 1.4;
      hud.showBanner('DEFEATED', 'ล้มแล้วลุกใหม่ — ทุกการตายคือบทเรียน', '#ff2d4a', 2.2, true);
      audio.setMusic('off');
    }
    if (this.phase === 'dead' && this.t <= 0) {
      this.phase = 'victory'; // freeze sim
      this.finish(false);
      return;
    }

    if (this.phase === 'fight') {
      const def = STAGES[this.stage];
      if (def.kind === 'wave') {
        const alive = W.enemies.some((e) => !e.dead);
        if (!alive && this.pending <= 0) {
          this.sub++;
          if (this.sub < def.waves.length) {
            this.spawnSubWave();
          } else this.clearStage();
        }
      } else if (this.bosses.every((b) => b.dead)) {
        this.phase = 'bossDeath';
        const last = this.lastBoss ?? this.bosses[0];
        this.seq.run(last.deathSequence());
        this.t = 1.9;
        for (const s of W.strikes) if (s.team === 'enemy') s.dead = true;
        for (const b of W.projs) if (b.team === 'enemy') b.dead = true;
      }
    }
    if (this.phase === 'bossDeath' && this.t <= 0) this.clearStage();
    if (this.phase === 'clear' && this.t <= 0) this.afterClear();
  }

  private clearStage() {
    this.phase = 'clear';
    this.t = 1.8;
    W.combatActive = false;
    for (const s of W.strikes) if (s.team === 'enemy') s.dead = true;
    for (const b of W.projs) if (b.team === 'enemy') b.dead = true;
    const last = this.stage === STAGES.length - 1;
    const noDmg = this.player.hp >= this.stageStartHp - 0.5;
    hud.showBanner(last ? 'VICTORY' : 'STAGE CLEAR', noDmg ? 'FLAWLESS — ไม่โดนโจมตีเลย!' : `Style สูงสุด: ${RANKS[W.stats.bestRank]}`, last ? '#ffe14d' : '#6dff9e', 1.8, last);
    sfx('uiConfirm');
    this.player.heal(this.player.maxHp * 0.2);
    this.player.state = 'locked';
    this.player.overdrive = 0;
    W.tint = 0;
    audio.intensity = 1;
    const save = loadSave();
    save.bestStage = Math.max(save.bestStage, this.stage + 1);
    writeSave(save);
  }

  private afterClear() {
    if (this.stage >= STAGES.length - 1) {
      this.phase = 'victory';
      this.finish(true);
      return;
    }
    this.phase = 'upgrade';
    const p = this.player;
    const offers = rollUpgrades(p, this.taken, 3, this.stage === 0 || (this.stage === 4 && p.weapons.length < 3));
    menus.showUpgrades(offers, this.stage + 1, STAGES.length, (u) => {
      u.apply(p);
      this.taken[u.id] = (this.taken[u.id] ?? 0) + 1;
      sfx('uiConfirm');
      menus.hide();
      this.stage++;
      this.beginStage();
    });
  }

  private finish(won: boolean) {
    const save = loadSave();
    if (won) {
      save.wins++;
      if (!save.bestTime || W.stats.time < save.bestTime) save.bestTime = W.stats.time;
    }
    save.bestRank = Math.max(save.bestRank, W.stats.bestRank);
    writeSave(save);
    audio.setMusic(won ? 'menu' : 'off');
    menus.showEnd(won, W.stats, this.stage, STAGES.length, () => this.start(this.player.weapons[0], W.hardMode), () => this.toTitle());
  }

  isPlaying() {
    return this.phase !== 'title' && this.phase !== 'victory';
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      menus.showPause(() => this.togglePause(), () => this.start(this.player.weapons[0], W.hardMode), () => this.toTitle());
    } else {
      menus.hide();
      input.clearAll();
    }
  }

  // ---------------------------------------------------------- tutorial
  private tutorial(step: number) {
    const tips = [
      'WASD เคลื่อนที่ • เมาส์เล็ง • คลิกซ้ายโจมตี (กดต่อเนื่อง = คอมโบ 4 จังหวะ)',
      'SPACE = Dash (อมตะชั่วขณะ) — Dash ฉิวเฉียดการโจมตี = PERFECT DODGE (เวลาช้าลง + ได้ Focus)',
      'คลิกขวาพอดีจังหวะที่การโจมตีสีส้มจะโดน = PARRY • กดค้าง = Block (กิน Stamina)',
      'พื้นที่สีแดง = ป้องกันไม่ได้ ต้อง DASH หนี! • กดคลิกซ้ายค้าง = ท่าชาร์จ',
      'Q / E = สกิลพิเศษ (ใช้ Focus) • Focus เต็ม 100 กด R = OVERDRIVE',
    ];
    if (step >= tips.length) return;
    this.tut = step + 1;
    hud.showHint(tips[step], 7);
    this.tutT = 0;
  }
  private tutorialTick(dt: number) {
    this.tutT += dt;
    if (this.tutT > 7.5) this.tutorial(this.tut);
  }

  // ---------------------------------------------------------- draw
  drawWorld(ctx: CanvasRenderingContext2D) {
    drawObstacles(ctx);
    fx.drawUnder(ctx);
    drawStrikes(ctx);
    const actors: Actor[] = W.enemies.filter((e) => !e.dead);
    if (this.phase !== 'title' && !this.player.dead) actors.push(this.player);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw(ctx);
    drawProjectiles(ctx);
    fx.drawOver(ctx);
    fx.drawTexts(ctx);
  }
  get showHud() {
    return this.phase !== 'title' && this.phase !== 'victory';
  }
}

function freshStats() {
  return { kills: 0, parries: 0, perfects: 0, maxCombo: 0, hitsTaken: 0, time: 0, bestRank: 0, executions: 0, skillUse: {} as Record<string, number> };
}

export const run = new Run();
