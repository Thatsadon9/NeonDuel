/** Run controller: stage sequence, waves, boss intros/deaths, upgrade picks, game over / victory. */
import { TAU, rand, dist } from '../core/math';
import { input } from '../core/input';
import { Runner } from '../core/co';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { audio, sfx } from '../audio/audio';
import { W, strike, drawStrikes, drawProjectiles, drawObstacles, type Actor } from './world';
import { Player } from './player';
import { makeMinion, MINION_KEY, type MinionKind } from './minions';
import type { Boss } from './bosses/base';
import { Vanguard } from './bosses/vanguard';
import { HexWeaver } from './bosses/hexweaver';
import { makeTwins } from './bosses/twins';
import { Colossus, placePillars } from './bosses/colossus';
import { Mirror } from './bosses/mirror';
import { Nyxara } from './bosses/nyxara';
import { Tempus } from './bosses/tempus';
import { makeVoltaris } from './bosses/voltaris';
import { Kagutsuchi } from './bosses/kagutsuchi';
import { HollowKing } from './bosses/hollow';
import { Sentinel } from './bosses/sentinel';
import { makeElite, eliteChance, drawEliteMarks } from './elites';
import { resetPathWorld, updatePathWorld, drawPathWorld } from './paths';
import { canAscend, CORE_REQ, formName, formColor, formKey, newProg, TIER_REQ, type Tier } from './ascension';
import { codex } from './codex';
import { sprites } from '../render/sprites';
import { style, RANKS } from './style';
import { rollUpgrades } from './upgrades';
import { WEAPONS, type WeaponId } from './weapons';
import { hud } from '../ui/hud';
import { menus, setMenuHard } from '../ui/menus';
import { snapshot } from '../net/leaderboard';
import { AFFIXES } from './affixes';

export type BossId = 'vanguard' | 'hex' | 'twins' | 'colossus' | 'mirror' | 'nyxara' | 'tempus' | 'voltaris' | 'kagutsuchi' | 'hollow';
export type Theme = '' | 'blight' | 'clock' | 'storm' | 'shrine' | 'hollow';
type StageDef =
  | { kind: 'wave'; name: string; sub: string; waves: [MinionKind, number][][]; sentinel?: boolean; theme?: Theme }
  | { kind: 'boss'; boss: BossId; duo?: BossId; theme?: Theme };
/** campaign = Act I (stages 0–9) · act2 = Act II (stages 10–19) · endless */
export type GameMode = 'campaign' | 'act2' | 'endless';
const BOSS_THEME: Partial<Record<BossId, Theme>> = { nyxara: 'blight', tempus: 'clock', voltaris: 'storm', kagutsuchi: 'shrine', hollow: 'hollow' };
const THEMES: Theme[] = ['', 'blight', 'clock', 'storm', 'shrine'];

// ---------------------------------------------------------------- endless mode
/** difficulty curve per round (round 1 = campaign difficulty) */
export function endlessScale(round: number) {
  const r = Math.max(0, round - 1);
  return {
    hp: 1 + 0.085 * r + 0.0025 * r * r,
    dmg: Math.min(2.5, 1 + 0.04 * r),
    speed: Math.min(1.3, 1 + 0.01 * r), // capped so telegraphs stay readable
  };
}
// kind, cost, first round (see docs/UPDATE_ASCENSION.md §5)
const MINION_POOL: [MinionKind, number, number][] = [
  ['rusher', 2, 1], ['gunner', 2, 1], ['shield', 3, 3], ['bomber', 2, 4],
  ['swarmling', 2, 6], ['wraith', 3, 8], ['lancer', 3, 9], ['acolyte', 3, 12], ['sentry', 4, 14], ['broodmother', 5, 16], ['brute', 6, 20], ['mirror_shard', 2, 24],
];
const SOLO_BOSSES: BossId[] = ['vanguard', 'hex', 'twins', 'colossus', 'mirror', 'nyxara', 'tempus', 'voltaris', 'kagutsuchi'];
const DUO_BOSSES: BossId[] = ['vanguard', 'hex', 'colossus', 'mirror', 'nyxara', 'tempus', 'kagutsuchi'];
/** first round each Act II boss may appear in the endless pool */
const BOSS_FROM: Partial<Record<BossId, number>> = { nyxara: 10, tempus: 15, kagutsuchi: 20, voltaris: 25 };
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function endlessDef(round: number, lastBoss: BossId | null): StageDef {
  if (round % 25 === 0) return { kind: 'boss', boss: 'hollow' }; // THRONE ROUND
  if (round % 5 === 0) {
    const ok = (b: BossId) => round >= (BOSS_FROM[b] ?? 0);
    if (round % 10 === 0) {
      const a = pickOne(DUO_BOSSES.filter(ok));
      const b = pickOne(DUO_BOSSES.filter((x) => x !== a && ok(x)));
      return { kind: 'boss', boss: a, duo: b };
    }
    return { kind: 'boss', boss: pickOne(SOLO_BOSSES.filter((x) => x !== lastBoss && ok(x))) };
  }
  const unlocked = MINION_POOL.filter(([, , from]) => round >= from);
  const subs = Math.min(4, 2 + Math.floor((round - 1) / 6));
  const waves: [MinionKind, number][][] = [];
  for (let i = 0; i < subs; i++) {
    let budget = Math.min(30, 5 + round * 1.4 + i * 2);
    const counts = new Map<MinionKind, number>();
    let total = 0;
    while (budget >= 2 && total < 14) {
      const [kind, cost] = pickOne(unlocked);
      if (cost > budget) break;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      budget -= cost;
      total++;
    }
    // swarmlings come as a flock
    waves.push([...counts.entries()].map(([k, n]) => [k, k === 'swarmling' ? n * 3 : n] as [MinionKind, number]));
  }
  return { kind: 'wave', name: `ROUND ${round}`, sub: '', waves, sentinel: round % 10 === 7 };
}
function rollAffixes(round: number) {
  const n = round < 6 ? 0 : round < 16 ? 1 : round < 30 ? 2 : 3;
  const ids = Object.keys(AFFIXES).sort(() => Math.random() - 0.5);
  return ids.slice(0, n);
}

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
  // ---------------- ACT II — the Rift opens
  { kind: 'wave', name: 'TRIAL VI', sub: 'ฝูงริ้นเยอะ — ใช้ท่ากวาดและสกิล AoE', theme: 'blight', waves: [[['swarmling', 8], ['rusher', 2]], [['swarmling', 6], ['broodmother', 1], ['gunner', 2]]] },
  { kind: 'boss', boss: 'nyxara' },
  { kind: 'wave', name: 'TRIAL VII', sub: 'ภูตลอยโผล่ข้างหลัง • หอกยาว Parry แล้วมึน — ผู้เฝ้ารอยแยกรออยู่', theme: 'clock', sentinel: true, waves: [[['wraith', 3], ['lancer', 2]], [['lancer', 2], ['wraith', 2], ['gunner', 2]]] },
  { kind: 'boss', boss: 'tempus' },
  { kind: 'wave', name: 'TRIAL VIII', sub: 'ฆ่านักบวชก่อน — มันให้โล่เพื่อน • ป้อมเลเซอร์กวาดช้า', theme: 'storm', waves: [[['acolyte', 2], ['shield', 2], ['rusher', 3]], [['sentry', 2], ['acolyte', 1], ['lancer', 2], ['swarmling', 6]]] },
  { kind: 'boss', boss: 'voltaris' },
  { kind: 'wave', name: 'TRIAL IX', sub: 'ยักษ์คลั่งขัดจังหวะไม่ได้ • เศษกระจกสะท้อนกระสุน', theme: 'shrine', sentinel: true, waves: [[['brute', 1], ['swarmling', 6], ['mirror_shard', 2]], [['brute', 1], ['wraith', 2], ['acolyte', 1], ['mirror_shard', 2]]] },
  { kind: 'boss', boss: 'kagutsuchi' },
  { kind: 'wave', name: 'TRIAL X', sub: 'ก่อนบัลลังก์แห่งความว่างเปล่า', theme: 'hollow', waves: [[['lancer', 2], ['sentry', 1], ['wraith', 2], ['bomber', 3]], [['brute', 1], ['broodmother', 1], ['acolyte', 2], ['gunner', 3]], [['mirror_shard', 3], ['shield', 2], ['rusher', 4], ['swarmling', 6]]] },
  { kind: 'boss', boss: 'hollow' },
];
const ACT2 = 10;

type Phase = 'title' | 'intro' | 'fight' | 'bossIntro' | 'bossDeath' | 'clear' | 'upgrade' | 'dead' | 'victory';
/** Act I campaign pacing for practice starts (?stage=N): tier reached by each stage */
const PRACTICE_TIER: Tier[] = [0, 1, 2, 2, 3, 3, 3, 4, 4, 4];

const SAVE_KEY = 'neonduel.best.v1';
export interface SaveData { bestStage: number; wins: number; bestTime: number; bestRank: number; runs: number; bestRound: number }
export function loadSave(): SaveData {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '');
    if (s && typeof s === 'object') return { bestStage: 0, wins: 0, bestTime: 0, bestRank: 0, runs: 0, bestRound: 0, ...s };
  } catch { /* no save */ }
  return { bestStage: 0, wins: 0, bestTime: 0, bestRank: 0, runs: 0, bestRound: 0 };
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
  ranked = true;
  mode: GameMode = 'campaign';
  /** endless: current round (1-based); campaign: 0 */
  round = 0;
  def: StageDef = STAGES[0];
  private lastBossId: BossId | null = null;
  /** Echo Shards earned this run (banked into the codex at the end) */
  shards = 0;
  theme: Theme = '';
  private sentinelDone = false;
  private eclipseWas = 0;

  constructor() {
    W.onKillHooks.push((a) => {
      if (a instanceof Sentinel) {
        this.giveCores(1, a.x, a.y);
        this.shards += 15;
        return;
      }
      if (a.isBoss) this.lastBoss = a as Boss;
      if ((a as { elite?: unknown }).elite) {
        this.shards += 3;
        fx.anim('pickup_echo_shard', a.x, a.y, { w: 40, dur: 0.9 });
      }
    });
  }

  /** first stage index / stage count of the current act */
  get actStart() {
    return this.mode === 'act2' ? ACT2 : 0;
  }
  get actLen() {
    return this.mode === 'act2' ? STAGES.length - ACT2 : ACT2;
  }

  giveCores(n: number, x: number, y: number) {
    const p = this.player;
    p.cores += n;
    fx.anim('pickup_rift_core', x, y, { w: 70, dur: 1.2 });
    fx.ring(x, y, 10, 120, 0.5, '#ff4dcf', 6, true);
    hud.callout(`RIFT CORE +${n}`, '#ff4dcf', 1.4, 34);
    sfx('chargeReady');
    p.addRes(0.001); // re-check "ascension ready" (cores may have been the missing piece)
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
    menus.showTitle(loadSave(), (wpn, hard, mode) => this.start(wpn, hard, 0, mode));
  }

  start(weapon: WeaponId, hard: boolean, atStage = 0, mode: GameMode = 'campaign') {
    audio.init();
    if (!codex.hasWeapon(weapon)) weapon = 'katana';
    if (mode === 'act2' && atStage < ACT2) atStage = ACT2;
    // practice runs (jumped to a later stage / round) never reach the leaderboard
    this.ranked = atStage === (mode === 'act2' ? ACT2 : 0);
    this.shards = 0;
    this.mode = mode;
    this.round = mode === 'endless' ? atStage + 1 : 0;
    this.lastBossId = null;
    W.scale = { round: 0, hp: 1, dmg: 1, speed: 1, affixes: [] };
    W.hardMode = hard;
    W.reset();
    W.stats = freshStats();
    style.reset();
    const p = new Player();
    p.weapons = [weapon];
    p.prog = { [weapon]: newProg() };
    W.player = p;
    this.taken = {};
    this.stage = mode === 'endless' ? 0 : atStage;
    // Act II: skip the early climb — start Awakened (T2) with 2 rare cards
    const skip = mode === 'act2' ? ACT2 : 0;
    if (mode === 'act2') {
      p.prog[weapon] = { res: TIER_REQ[2], tier: 2, path: null };
      for (let i = 0; i < 2; i++) {
        const o = rollUpgrades(p, this.taken, 1, false, { minRarity: 'rare' });
        if (o[0]) {
          o[0].apply(p);
          this.taken[o[0].id] = (this.taken[o[0].id] ?? 0) + 1;
        }
      }
    }
    // debug start: give upgrades / tiers roughly matching progress
    for (let i = skip; i < atStage; i++) {
      const o = rollUpgrades(p, this.taken, 1, i === 1, { endless: mode === 'endless' });
      if (o[0]) {
        o[0].apply(p);
        this.taken[o[0].id] = (this.taken[o[0].id] ?? 0) + 1;
      }
    }
    if (atStage > skip) {
      const t: Tier = mode === 'endless' ? (atStage >= 19 ? 4 : atStage >= 9 ? 3 : atStage >= 4 ? 2 : atStage >= 1 ? 1 : 0) : mode === 'act2' ? (atStage >= 15 ? 4 : 3) : PRACTICE_TIER[Math.min(9, atStage)];
      for (const id of p.weapons) p.prog[id] = { res: TIER_REQ[t], tier: t, path: t >= 3 ? 'a' : null };
    }
    const save = loadSave();
    save.runs++;
    writeSave(save);
    menus.hide();
    this.beginStage();
  }

  beginStage() {
    let def: StageDef;
    if (this.mode === 'endless') {
      def = endlessDef(this.round, this.lastBossId);
      if (def.kind === 'boss') this.lastBossId = def.boss;
      W.scale = { round: this.round, ...endlessScale(this.round), affixes: rollAffixes(this.round) };
    } else {
      def = STAGES[this.stage];
      W.scale = { round: 0, hp: 1, dmg: 1, speed: 1, affixes: [] };
    }
    this.def = def;
    resetPathWorld();
    W.eclipseT = 0;
    this.sentinelDone = false;
    if (def.kind === 'boss' && BOSS_THEME[def.boss] && !def.duo) this.theme = BOSS_THEME[def.boss]!;
    else if (def.theme !== undefined) this.theme = def.theme;
    else if (this.mode === 'endless') this.theme = this.round >= 10 ? THEMES[Math.floor((this.round - 1) / 10) % THEMES.length] : '';
    else this.theme = '';
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
    const affixText = W.scale.affixes.map((a) => AFFIXES[a].name).join(' · ');
    if (def.kind === 'wave') {
      this.phase = 'intro';
      this.t = 1.7;
      audio.setMusic('combat', 1);
      const sub = this.mode === 'endless' ? (affixText ? `${affixText} — ${W.scale.affixes.map((a) => AFFIXES[a].desc).join(' · ')}` : 'ENDLESS — อยู่รอดให้นานที่สุด') : def.sub;
      hud.showBanner(def.name, sub, W.scale.affixes.length ? AFFIXES[W.scale.affixes[0]].color : '#7ff6ff', 2.1);
      sfx('uiConfirm');
    } else {
      this.phase = 'bossIntro';
      this.t = 3.0;
      audio.setMusic('boss', 2);
      let bs: Boss[];
      if (def.duo) {
        // GAUNTLET: two bosses at once, each a bit lighter
        bs = [...this.makeBoss(def.boss, -230), ...this.makeBoss(def.duo, 230)];
        for (const b of bs) {
          b.hp = b.maxHp = Math.round(b.maxHp * 0.7);
        }
      } else bs = this.makeBoss(def.boss);
      for (const b of bs) {
        b.hp = b.maxHp = Math.round(b.maxHp * W.scale.hp);
        b.maxPosture = Math.round(b.maxPosture * Math.sqrt(W.scale.hp));
      }
      this.bosses = bs;
      for (const b of bs) W.enemies.push(b);
      codex.meet(def.boss);
      if (def.duo) codex.meet(def.duo);
      const b0 = bs[0];
      const twins = def.boss === 'twins' && !def.duo;
      const title = def.duo ? `${b0.title} × ${bs[bs.length - 1].title}` : twins ? 'TWIN FANGS' : b0.title;
      let sub = def.duo ? 'GAUNTLET — สองบอสพร้อมกัน' : twins ? 'คู่แฝดเขี้ยวดาบและเขี้ยวเงา — ฆ่าตัวหนึ่ง อีกตัวจะคลั่ง' : b0.subtitle;
      if (this.mode === 'endless') sub = `ROUND ${this.round} · ${sub}${affixText ? ' · ' + affixText : ''}`;
      const cx = bs.reduce((s, b) => s + b.x, 0) / bs.length, cy = bs.reduce((s, b) => s + b.y, 0) / bs.length;
      cam.focus = { x: cx, y: cy };
      cam.zoomMul = 1.35;
      hud.showBanner(title, sub, bs[0].color, 2.9, true, def.duo ? undefined : 'portrait_' + def.boss);
      sfx('roar');
      for (const b of bs) {
        fx.ring(b.x, b.y, 10, 260, 0.9, b.color, 8, true);
        fx.shards(b.x, b.y, 24, 400, b.color, 1, 7);
      }
    }
  }

  private makeBoss(id: BossId, x = 0): Boss[] {
    switch (id) {
      case 'vanguard': return [new Vanguard(x, -200)];
      case 'hex': return [new HexWeaver(x, -240)];
      case 'twins': return makeTwins();
      case 'colossus': placePillars(); return [new Colossus(x, -150)];
      case 'mirror': return [new Mirror(x, -220)];
      case 'nyxara': return [new Nyxara(x, -180)];
      case 'tempus': return [new Tempus(x, -200)];
      case 'voltaris': return makeVoltaris();
      case 'kagutsuchi': return [new Kagutsuchi(x, -200)];
      case 'hollow': return [new HollowKing(x, -200)];
    }
  }

  /** Rift Sentinel mini-boss: appears mid-wave, drops a Rift Core */
  private spawnSentinel() {
    this.sentinelDone = true;
    const s = new Sentinel(0, -200, Math.random() < 0.5 ? 'blade' : 'pulse');
    s.hp = s.maxHp = Math.round(s.maxHp * W.scale.hp);
    this.pending++;
    fx.anim('vfx_portal', s.x, s.y, { w: 200, dur: 1.4, tint: '#ff4dcf', under: true });
    hud.showBanner(s.title, s.subtitle, s.color, 1.8, false, 'portrait_sentinel');
    codex.meet('sentinel');
    sfx('roar', 0.7);
    this.seq.run((function* (self: Run) {
      yield 1.2;
      W.enemies.push(s);
      self.bosses.push(s);
      s.active = true;
      s.rest = 0.8;
      self.pending--;
      fx.ring(s.x, s.y, 20, 240, 0.6, s.color, 8, true);
      W.shake(0.4);
    })(this));
  }

  private spawnSubWave() {
    const def = this.def;
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
            e.hp = e.maxHp = Math.round(e.maxHp * W.scale.hp);
            codex.meet(MINION_KEY[kind]);
            if (Math.random() < eliteChance(this.mode, this.round)) makeElite(e);
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
      if (this.def.kind === 'wave') this.sub = 99;
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
      if (this.stage === 0 && this.mode === 'campaign') this.tutorial(0);
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
      const id = (this.def as { boss: BossId }).boss;
      const hints: Record<BossId, string> = {
        vanguard: 'บอสยกโล่ = กันการโจมตีจากด้านหน้า → PARRY ท่าฟันสีส้ม (คลิกขวาพอดีจังหวะ) หรืออ้อมไปด้านหลัง',
        hex: 'ลูกแก้วสีทองมีวงแหวน = PARRY สะท้อนใส่บอส • เลเซอร์สีแดง = DASH ผ่าน',
        twins: 'โฟกัสทีละตัว — เมื่อตัวหนึ่งตาย อีกตัวจะเข้าสู่โหมดคลั่ง',
        colossus: 'ล่อให้มันพุ่งชนเสา! แกนกลางสีทองเปิด = ดาเมจและ Posture x2',
        mirror: 'ห้ามตีใส่ท่าตั้งรับสีขาว (จะโดนสวนกลับ) — ใช้สกิลหรือท่าชาร์จทำลาย',
        nyxara: 'ทำลายฝักสปอร์ก่อนมันสุก! ตีฝักที่สุกแล้ว = มันลอยไปชนบอส (Posture ×3)',
        tempus: 'ทุกท่าจะเล่นซ้ำที่เดิมอีก 2 วินาที (ร่างผี) • ตอนร่าย REWIND ตีนาฬิกาทราย 3 ครั้งเพื่อยกเลิก',
        voltaris: 'ทำลาย Posture ปล้องเรืองแสง 3 ปล้อง → หัวงูตกพื้นมึน • ห้ามยืนใกล้เสาล่อฟ้าที่เรืองแสง',
        kagutsuchi: 'IAI (ฟ้า) = Parry ให้ได้ • INFERNO (แดง) = Dash หนีไฟ • Parry 5 ครั้งติด = PERFECT DUEL',
        hollow: 'เฟส 3 สนามแตกเป็นเกาะ — Dash ข้ามเกาะ ตกเหวเสีย HP 15%',
      };
      hud.showHint(hints[id], 7);
    }

    // simulation
    p.update(g);
    if (W.eclipseT > 0) {
      // ECLIPSE: enemies are frozen; when time resumes, 60% of the damage dealt bursts again
      W.eclipseT -= g;
      this.eclipseWas = 1;
      for (const e of W.enemies) if (!e.dead) e.tickCommon(0);
    } else {
      if (this.eclipseWas) this.eclipseBurst();
      for (const e of W.enemies) if (!e.dead) e.update(g);
    }
    updatePathWorld(p, g);
    // arena radius eases towards its target (coil / shrine burns / mirror)
    if (W.arenaR !== W.arenaTargetR) W.arenaR += Math.sign(W.arenaTargetR - W.arenaR) * Math.min(Math.abs(W.arenaTargetR - W.arenaR), 90 * g);
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

    if (this.stage === 0 && this.mode === 'campaign' && this.phase === 'fight') this.tutorialTick(g);

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
      const def = this.def;
      if (def.kind === 'wave') {
        const alive = W.enemies.some((e) => !e.dead);
        // the Rift Sentinel crashes in after the first sub-wave
        if (def.sentinel && !this.sentinelDone && this.sub >= 1 && this.pending <= 0) this.spawnSentinel();
        else if (!alive && this.pending <= 0) {
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
    const endless = this.mode === 'endless';
    const last = !endless && this.stage === this.actStart + this.actLen - 1;
    const bossStage = this.def.kind === 'boss';
    this.shards += bossStage ? 25 : 7;
    if (bossStage) {
      const d = this.def as { boss: BossId; duo?: BossId };
      for (const id of [d.boss, d.duo]) if (id && !W.god && codex.beatBoss(id)) this.shards += 100;
      const n = d.boss === 'hollow' && endless ? 3 : d.duo ? 2 : 1;
      this.giveCores(n, this.player.x, this.player.y - 40);
    }
    const noDmg = this.player.hp >= this.stageStartHp - 0.5;
    const title = endless ? `ROUND ${this.round} CLEAR` : last ? 'VICTORY' : 'STAGE CLEAR';
    hud.showBanner(title, noDmg ? 'FLAWLESS — ไม่โดนโจมตีเลย!' : `Style สูงสุด: ${RANKS[W.stats.bestRank]}`, last ? '#ffe14d' : '#6dff9e', 1.8, last);
    sfx('uiConfirm');
    // endless: smaller heal after waves, bigger after bosses
    this.player.heal(this.player.maxHp * (endless ? (this.def.kind === 'boss' ? 0.35 : 0.15) : 0.2));
    this.player.state = 'locked';
    this.player.overdrive = 0;
    W.tint = 0;
    audio.intensity = 1;
    const save = loadSave();
    if (endless) {
      if (this.ranked && !W.god) save.bestRound = Math.max(save.bestRound, this.round);
    } else if (this.mode === 'campaign') save.bestStage = Math.max(save.bestStage, this.stage + 1);
    writeSave(save);
  }

  /** play every pending ascension (weapon in hand first), then continue */
  private ascendQueue(done: () => void) {
    const p = this.player;
    const curId = p.weapons[p.wi];
    const order = [curId, ...p.weapons.filter((w) => w !== curId)];
    for (const id of order) {
      const pr = p.prog[id];
      if (!pr || !canAscend(pr, p.cores)) continue;
      const next = (pr.tier + 1) as Tier;
      const go = (path: 'a' | 'b' | null) => {
        p.cores -= CORE_REQ[next];
        pr.tier = next;
        if (path) pr.path = path;
        const fk = formKey(pr);
        const img = next === 4 ? sprites.url(`art_mythic_${id}_${pr.path}`) : next === 3 ? sprites.url(`art_path_${id}_${pr.path}`) : sprites.url(`weapon_${id}_${fk}`) ?? sprites.url(`icon_weapon_${id}_${fk}`);
        fx.anim('vfx_ascend_burst', p.x, p.y, { w: 260, dur: 1.2 });
        fx.anim('vfx_ascend_shatter', p.x, p.y, { w: 200, dur: 0.9 });
        menus.showAscension({ weapon: id, tier: next, form: formName(id, pr), color: formColor(id, pr, WEAPONS[id].color), img, path: pr.path }, () => this.ascendQueue(done));
      };
      this.phase = 'upgrade';
      if (next === 3) menus.showPathChoice(id, go);
      else go(null);
      return;
    }
    done();
  }

  private afterClear() {
    this.ascendQueue(() => this.afterClearCards());
  }

  private afterClearCards() {
    if (this.mode === 'endless') {
      this.phase = 'upgrade';
      const p = this.player;
      const boss = this.def.kind === 'boss';
      const offers = rollUpgrades(p, this.taken, 3, this.round === 1 || (this.round % 7 === 0 && p.weapons.length < 3), { endless: true, minRarity: boss ? 'rare' : undefined });
      menus.showUpgrades(offers, this.round, 0, (u) => {
        u.apply(p);
        this.taken[u.id] = (this.taken[u.id] ?? 0) + 1;
        sfx('uiConfirm');
        menus.hide();
        this.round++;
        this.beginStage();
      });
      return;
    }
    const rel = this.stage - this.actStart;
    if (rel >= this.actLen - 1) {
      this.phase = 'victory';
      this.finish(true);
      return;
    }
    this.phase = 'upgrade';
    const p = this.player;
    const offers = rollUpgrades(p, this.taken, 3, rel === 0 || (rel === 4 && p.weapons.length < 3), { minRarity: this.def.kind === 'boss' && this.mode === 'act2' ? 'rare' : undefined });
    menus.showUpgrades(offers, rel + 1, this.actLen, (u) => {
      u.apply(p);
      this.taken[u.id] = (this.taken[u.id] ?? 0) + 1;
      sfx('uiConfirm');
      menus.hide();
      this.stage++;
      this.beginStage();
    });
  }

  private eclipseBurst() {
    this.eclipseWas = 0;
    W.eclipseT = 0;
    const p = this.player;
    W.flash('#9d5bff', 0.5);
    W.shake(0.6);
    sfx('explosion');
    for (const e of W.enemies) {
      const d = (e as { eclipseDmg?: number }).eclipseDmg ?? 0;
      (e as { eclipseDmg?: number }).eclipseDmg = 0;
      if (e.dead || d <= 0) continue;
      fx.anim('vfx_moon_severance', e.x, e.y, { w: e.r * 5, dur: 0.6 });
      e.onHit({ damage: d * 0.6 * p.mythic, posture: 30, knock: 0, angle: 0, hitstop: 0, unblockable: true, parryable: false, sx: p.x, sy: p.y, kind: 'aoe', tag: 'eclipse', skill: true, color: '#9d5bff' });
    }
  }

  private finish(won: boolean) {
    const save = loadSave();
    if (won && this.mode === 'campaign') codex.clearAct1();
    // bank Echo Shards (practice runs earn half; god mode none)
    const earned = W.god ? 0 : Math.round(this.shards * (this.ranked ? 1 : 0.5) * (won ? 1.25 : 1));
    if (earned) codex.addShards(earned);
    if (earned) hud.callout(`+${earned} ECHO SHARDS`, '#b98cff', 2, 30);
    if (won) {
      save.wins++;
      if (!save.bestTime || W.stats.time < save.bestTime) save.bestTime = W.stats.time;
    }
    save.bestRank = Math.max(save.bestRank, W.stats.bestRank);
    writeSave(save);
    audio.setMusic(won ? 'menu' : 'off');
    const eligible = this.ranked && !W.god;
    setMenuHard(W.hardMode, this.mode);
    const mode = this.mode;
    menus.showEnd(won, W.stats, this.stage - this.actStart, this.actLen, () => this.start(this.player.weapons[0], W.hardMode, 0, mode), () => this.toTitle(),
      eligible ? { weapon: this.player.weapons[0], hard: W.hardMode, shot: snapshot(), mode, round: this.round } : undefined,
      mode === 'endless' ? { round: this.round, best: loadSave().bestRound } : undefined, earned);
  }

  isPlaying() {
    return this.phase !== 'title' && this.phase !== 'victory';
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      menus.showPause(() => this.togglePause(), () => this.start(this.player.weapons[0], W.hardMode, 0, this.mode), () => this.toTitle());
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
      'อาวุธเริ่มที่ร่าง WORN (T0) — สู้เพื่อสะสม RESONANCE (แถบใต้ช่องอาวุธ) แล้วเลื่อนขั้นตอนจบด่าน',
      'T2 ปลดสกิล Q / E (ใช้ Focus) • Focus เต็ม 100 กด R = OVERDRIVE • T4 ปลด Ultimate ประจำสาย',
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
    // boss floor layers (islands, rods, bubbles, fire rims)
    for (const e of W.enemies) if (e.isBoss && !e.dead) (e as { drawFloor?: (c: CanvasRenderingContext2D) => void }).drawFloor?.(ctx);
    drawObstacles(ctx);
    fx.drawUnder(ctx);
    drawStrikes(ctx);
    drawPathWorld(ctx);
    const actors: Actor[] = W.enemies.filter((e) => !e.dead);
    if (this.phase !== 'title' && !this.player.dead) actors.push(this.player);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw(ctx);
    drawEliteMarks(ctx, W.enemies);
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
