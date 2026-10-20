/** Run controller: stage sequence, waves, boss intros/deaths, upgrade picks, game over / victory. */
import { inkReveal } from '../ui/transition';
import { TAU, rand, dist } from '../core/math';
import { input } from '../core/input';
import { Runner } from '../core/co';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { audio, sfx } from '../audio/audio';
import { W, strike, drawStrikes, drawProjectiles, drawObstacles, type Actor } from './world';
import { Player } from './player';
import { MergedControls, PadControls, type Controls } from '../core/controls';
import { touch } from '../core/touch';
import { T } from './tuning';
import { tel } from './telemetry';
import { seedRandom, restoreRandom, recordBest, bestOf, AFFIX_MODS, type Challenge } from './challenge';
import { showMap, showRest, showShop, type NodeKind, type ShopItem } from '../ui/mapui';
import type { Upgrade } from './upgrades';
import type { PathId } from './ascension';
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
import { menus, setMenuHard, closeness } from '../ui/menus';
import { snapshot } from '../net/leaderboard';
import { AFFIXES } from './affixes';

export type BossId = 'vanguard' | 'hex' | 'twins' | 'colossus' | 'mirror' | 'nyxara' | 'tempus' | 'voltaris' | 'kagutsuchi' | 'hollow';
export type Theme = '' | 'blight' | 'clock' | 'storm' | 'shrine' | 'hollow';
type StageDef =
  | { kind: 'wave'; name: string; sub: string; waves: [MinionKind, number][][]; sentinel?: boolean; theme?: Theme }
  | { kind: 'boss'; boss: BossId; duo?: BossId; theme?: Theme };
/** campaign = Act I (stages 0–9) · act2 = Act II (stages 10–19) · endless · duel = PVP rounds */
export type GameMode = 'campaign' | 'act2' | 'endless' | 'duel';

/** one fighter in a match */
export interface SlotCfg {
  ctl: Controls;
  weapon: WeaponId;
  tag?: string;
  /** PVP side */
  squad?: number;
  /** PVP loadout path */
  path?: PathId;
}
export interface MatchCfg {
  slots: SlotCfg[];
  /** PVP: rounds needed to win the match */
  winsNeeded?: number;
  online?: boolean;
  /** daily / weekly challenge (seeded content + modifiers) */
  challenge?: Challenge;
}
export interface AscInfo { weapon: WeaponId; tier: number; form: string; color: string; img: string | null; path?: PathId | null }
/** who makes a between-stage choice: local menus, or (online) the remote player's own screen */
export interface Chooser {
  upgrade(p: Player, offers: Upgrade[], done: number, total: number): Promise<Upgrade>;
  path(p: Player, weapon: WeaponId): Promise<PathId>;
  ascend(p: Player, info: AscInfo): Promise<void>;
}
const multi = () => W.players.length > 1;
const localChooser: Chooser = {
  upgrade: (p, offers, done, total) => new Promise((res) => {
    if (multi()) menus.who = { tag: p.tag, color: p.color2 };
    menus.showUpgrades(offers, done, total, res);
  }),
  path: (p, weapon) => new Promise((res) => {
    if (multi()) menus.who = { tag: p.tag, color: p.color2 };
    menus.showPathChoice(weapon, res);
  }),
  ascend: (p, info) => new Promise((res) => {
    if (multi()) menus.who = { tag: p.tag, color: p.color2 };
    menus.showAscension(info, res);
  }),
};
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
  /** match setup (players, PVP rules) */
  cfg: MatchCfg = { slots: [] };
  /** per-player upgrade stacks */
  private takenBy = new Map<Player, Record<string, number>>();
  /** PVP: round number and wins per squad */
  duelRound = 0;
  wins: number[] = [];
  private duelT = 0;
  /** online host: chooser for remote players (set by the net module) */
  remoteChooser: Chooser | null = null;
  /** branching map: the node type chosen for the upcoming stage */
  nodeKind: string | undefined = undefined;
  /** online host hooks */
  onPhase: ((phase: Phase) => void) | null = null;

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
        const q = W.creditOf(a.lastHitBy);
        fx.beam(a.x, a.y, q.x, q.y, 2.5, '#b98cff', 0.3);
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
    for (const p of W.players) {
      p.cores += n;
      p.addRes(0.001); // re-check "ascension ready" (cores may have been the missing piece)
    }
    fx.anim('pickup_rift_core', x, y, { w: 70, dur: 1.2 });
    fx.ring(x, y, 10, 120, 0.5, '#ff4dcf', 6, true);
    // the core streaks into each fighter
    for (const p of W.players) {
      if (p.dead) continue;
      fx.beam(x, y, p.x, p.y, 4, '#ff4dcf', 0.35);
      fx.ring(p.x, p.y, 60, 8, 0.4, '#ff4dcf', 4, true);
    }
    hud.callout(`RIFT CORE +${n}`, '#ff4dcf', 1.4, 34);
    sfx('chargeReady');
  }
  chooserFor(p: Player): Chooser {
    return p.ctl.kind === 'net' && this.remoteChooser ? this.remoteChooser : localChooser;
  }
  /** local (non-network) players, for camera framing / pause */
  get localPlayers() {
    return W.players.filter((p) => p.ctl.kind !== 'net');
  }

  get player() {
    return W.player;
  }

  toTitle() {
    inkReveal('#b98cff');
    tel.endRun('quit');
    restoreRandom();
    this.challenge = null;
    this.phase = 'title';
    this.paused = false;
    W.reset();
    W.pvp = false;
    W.player = new Player();
    W.players = [W.player];
    W.player.state = 'locked';
    W.player.x = 0;
    W.player.y = 120;
    W.stats = freshStats();
    cam.focus = null;
    cam.zoomMul = 1.15;
    audio.setMusic('menu');
    menus.showTitle(loadSave(), (wpn, hard, mode) => this.start(wpn, hard, 0, mode));
  }

  /** hard: difficulty 0 NORMAL · 1 HARD · 2 NIGHTMARE (booleans still work: true = HARD) */
  start(weapon: WeaponId, hard: boolean | number, atStage = 0, mode: GameMode = 'campaign', cfg?: MatchCfg) {
    audio.init();
    if (!cfg && !codex.hasWeapon(weapon)) weapon = 'katana';
    this.cfg = cfg ?? { slots: [{ ctl: new MergedControls(), weapon }] };
    if (mode === 'act2' && atStage < ACT2) atStage = ACT2;
    // practice runs (jumped to a later stage / round) and multiplayer never reach the leaderboard
    this.ranked = atStage === (mode === 'act2' ? ACT2 : 0) && this.cfg.slots.length === 1 && mode !== 'duel';
    const c = W.cheats;
    W.cheated = c.oneHit || c.infFocus || c.infDash || c.freeze || c.timeScale !== 1;
    this.shards = 0;
    this.mode = mode;
    this.round = mode === 'endless' ? atStage + 1 : 0;
    this.lastBossId = null;
    W.scale = { round: 0, hp: 1, dmg: 1, speed: 1, affixes: [] };
    W.diff = Math.max(0, Math.min(2, Number(hard)));
    W.hardMode = W.diff >= 1;
    W.reset();
    W.stats = freshStats();
    style.reset();
    W.pvp = mode === 'duel';
    W.players = this.cfg.slots.map((sl, i) => {
      const q = new Player();
      q.pid = i;
      q.ctl = sl.ctl;
      q.tag = sl.tag ?? 'P' + (i + 1);
      q.squad = mode === 'duel' ? sl.squad ?? i : 0;
      q.weapons = [sl.weapon];
      q.prog = { [sl.weapon]: newProg() };
      if (q.ctl instanceof PadControls) q.ctl.autoAim = (from) => this.autoAimFor(q, from);
      if (q.ctl instanceof MergedControls) {
        q.ctl.pad.autoAim = (from) => this.autoAimFor(q, from);
        q.ctl.tc.autoAim = (from) => this.autoAimFor(q, from);
      }
      if (q.ctl === touch) touch.autoAim = (from) => this.autoAimFor(q, from);
      return q;
    });
    W.player = W.players.find((q) => q.ctl.kind !== 'net') ?? W.players[0];
    this.challenge = this.cfg.challenge ?? null;
    if (this.challenge) {
      const m = this.challenge.mods;
      for (const q of W.players) {
        if (m.includes('glass')) q.maxHp = q.hp = 60;
        if (m.includes('focus_drought')) q.mods.focusGain *= 0.6;
        if (m.includes('heavy_feet')) q.mods.dashStam *= 1.8;
        if (m.includes('glass_cannon')) q.mods.dmgMul *= 1.5;
        if (m.includes('no_heal')) q.mods.flaskMax = q.flasks = 0;
      }
    } else restoreRandom();
    tel.startRun(mode, this.cfg.slots.map((s) => s.weapon).join('+'), W.players.length);
    const p = W.player;
    this.takenBy = new Map(W.players.map((q) => [q, {} as Record<string, number>]));
    this.taken = this.takenBy.get(p)!;
    if (mode === 'duel') {
      this.duelRound = 0;
      this.wins = W.players.map(() => 0);
      for (const [i, q] of W.players.entries()) {
        // PVP: everyone fights with a full mythic kit, so the duel is about skill — not grinding
        q.prog[q.weapons[0]] = { res: TIER_REQ[4], tier: 4, path: this.cfg.slots[i].path ?? 'a' };
        q.maxHp = q.hp = 160;
      }
      menus.hide();
      this.beginStage();
      return;
    }
    this.stage = mode === 'endless' ? 0 : atStage;
    // Act II: skip the early climb — start Awakened (T2) with 2 rare cards
    const skip = mode === 'act2' ? ACT2 : 0;
    for (const q of W.players) {
      const tk = this.takenBy.get(q)!;
      const give = (o: Upgrade[]) => {
        if (!o[0]) return;
        o[0].apply(q);
        tk[o[0].id] = (tk[o[0].id] ?? 0) + 1;
      };
      if (mode === 'act2') {
        q.prog[q.weapons[0]] = { res: TIER_REQ[2], tier: 2, path: null };
        for (let i = 0; i < 2; i++) give(rollUpgrades(q, tk, 1, false, { minRarity: 'rare' }));
      }
      // debug start: give upgrades / tiers roughly matching progress
      for (let i = skip; i < atStage; i++) give(rollUpgrades(q, tk, 1, i === 1, { endless: mode === 'endless' }));
      if (atStage > skip) {
        const t: Tier = mode === 'endless' ? (atStage >= 19 ? 4 : atStage >= 9 ? 3 : atStage >= 4 ? 2 : atStage >= 1 ? 1 : 0) : mode === 'act2' ? (atStage >= 15 ? 4 : 3) : PRACTICE_TIER[Math.min(9, atStage)];
        for (const id of q.weapons) q.prog[id] = { res: TIER_REQ[t], tier: t, path: t >= 3 ? 'a' : null };
      }
    }
    const save = loadSave();
    save.runs++;
    writeSave(save);
    menus.hide();
    this.beginStage();
  }
  /** active daily / weekly challenge */
  challenge: Challenge | null = null;
  /** challenge content is re-seeded per stage / card roll so it never depends on how a fight went */
  private reseed(...parts: (string | number)[]) {
    if (this.challenge) seedRandom(this.challenge.seed, ...parts);
  }

  beginStage() {
    inkReveal(this.mode === 'act2' ? '#ff4dcf' : '#7ff6ff');
    if (this.mode === 'duel') return this.beginDuelRound();
    this.reseed('stage', this.mode === 'endless' ? this.round : this.stage);
    let def: StageDef;
    if (this.mode === 'endless') {
      def = endlessDef(this.round, this.lastBossId);
      if (def.kind === 'boss') this.lastBossId = def.boss;
      W.scale = { round: this.round, ...endlessScale(this.round), affixes: rollAffixes(this.round) };
    } else {
      def = STAGES[this.stage];
      W.scale = { round: 0, hp: 1, dmg: 1, speed: 1, affixes: [] };
    }
    if (this.challenge) {
      for (const a of this.challenge.mods) if (AFFIX_MODS.includes(a) && !W.scale.affixes.includes(a)) W.scale.affixes.push(a);
    }
    this.def = def;
    tel.stageStart(def.kind === 'boss' ? def.boss + (def.duo ? '+' + def.duo : '') : this.mode === 'endless' ? `round ${this.round}` : def.name, def.kind, this.nodeKind);
    W.actDmg = (this.mode === 'act2' || (this.mode === 'campaign' && this.stage >= 10) ? T.act2Dmg : 1) * (this.challenge?.mods.includes('glass_cannon') ? 1.5 : 1);
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
    this.placePlayers();
    this.stageStartHp = W.players.reduce((s, q) => s + q.hp, 0);
    this.sub = 0;
    this.pending = 0;
    this.seq.stop();
    cam.snap(p.x, p.y);
    cam.zoomMul = 1;
    cam.focus = null; // a death / boss-intro focus must never carry into a new stage (Retry)
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
      const party = this.partyScale();
      for (const b of bs) {
        b.hp = b.maxHp = Math.round(b.maxHp * W.scale.hp * party.bossHp * (this.challenge?.mods.includes('iron_boss') ? 1.3 : 1));
        b.maxPosture = Math.round(b.maxPosture * Math.sqrt(W.scale.hp) * party.posture);
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
      W.bars(1);
      sfx('roar');
      for (const b of bs) {
        fx.ring(b.x, b.y, 10, 260, 0.9, b.color, 8, true);
        fx.shards(b.x, b.y, 24, 400, b.color, 1, 7);
      }
    }
  }

  // ---------------------------------------------------------- admin / debug tools
  /** kill everything on the field and skip the remaining sub-waves */
  debugKillAll() {
    W.cheated = true;
    for (const e of W.enemies) if (!e.dead) {
      e.hp = 1;
      e.invuln = 0;
      e.ward = 0;
      e.skillImmune = false;
      e.onHit({ damage: 99999, posture: 0, knock: 0, angle: 0, hitstop: 0, unblockable: true, parryable: false, sx: e.x, sy: e.y, kind: 'aoe', tag: 'debug', attacker: this.player });
    }
    this.pending = 0;
    if (this.def.kind === 'wave') this.sub = 99;
  }
  debugSpawnBoss(id: BossId) {
    if (this.phase === 'title' || this.mode === 'duel') return;
    W.cheated = true;
    for (const b of this.makeBoss(id, rand(-220, 220))) {
      b.active = true;
      b.rest = 1;
      W.enemies.push(b);
      this.bosses.push(b);
      fx.ring(b.x, b.y, 10, 240, 0.6, b.color, 8, true);
    }
    codex.meet(id);
  }
  debugSpawnMinion(kind: MinionKind, n = 1, elite = false) {
    if (this.phase === 'title' || this.mode === 'duel') return;
    W.cheated = true;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = rand(220, 420);
      const e = makeMinion(kind, Math.cos(a) * r, Math.sin(a) * r);
      if (elite) makeElite(e);
      W.enemies.push(e);
      fx.ring(e.x, e.y, 40, 4, 0.35, e.color, 4);
    }
  }

  /** co-op scaling: bosses get tankier, waves bigger, per extra player */
  partyScale() {
    const n = Math.max(0, W.players.length - 1);
    return { bossHp: 1 + T.coopBossHp * n, posture: 1 + 0.4 * n, count: 1 + 0.5 * n, minionHp: 1 + 0.2 * n };
  }
  /** spread the party along the bottom of the arena (fallen players get back up with half HP) */
  private placePlayers() {
    const n = W.players.length;
    for (const [i, q] of W.players.entries()) {
      if (q.dead) {
        q.dead = false;
        q.hp = Math.max(q.hp, q.maxHp * 0.5);
      }
      q.resetForStage();
      q.reviveT = 0;
      q.x = (i - (n - 1) / 2) * 90;
      q.y = 260;
      q.vx = q.vy = 0;
      q.state = 'locked';
      q.facing = q.aim = -Math.PI / 2;
    }
  }
  /** pad auto-aim: nearest enemy (or PVP foe) in front-ish range */
  private autoAimFor(q: Player, from: { x: number; y: number }) {
    let best: Actor | null = null, bd = 520;
    for (const e of [...W.enemies, ...W.foesOf(q)]) {
      if (e.dead) continue;
      const d = dist(from.x, from.y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  // ---------------------------------------------------------- PVP duel
  private beginDuelRound() {
    this.duelRound++;
    tel.stageStart(`DUEL R${this.duelRound}`, 'duel');
    W.duel = { round: this.duelRound, wins: this.wins };
    this.def = { kind: 'wave', name: 'DUEL', sub: '', waves: [] };
    resetPathWorld();
    W.eclipseT = 0;
    W.enemies.length = 0;
    W.strikes.length = 0;
    W.projs.length = 0;
    W.obstacles.length = 0;
    W.arenaR = W.arenaTargetR = 520;
    W.tint = 0;
    fx.clear();
    this.bosses = [];
    this.seq.stop();
    this.theme = (['', 'shrine', 'clock', 'storm', 'blight'] as Theme[])[(this.duelRound - 1) % 5];
    const n = W.players.length;
    for (const [i, q] of W.players.entries()) {
      q.dead = false;
      q.resetForStage();
      q.hp = q.maxHp;
      q.ghostHp = q.maxHp;
      q.focus = 50;
      q.invuln = 0;
      const a = Math.PI / 2 + (i / n) * TAU;
      q.x = Math.cos(a) * 300;
      q.y = Math.sin(a) * 300;
      q.vx = q.vy = 0;
      q.state = 'locked';
      q.facing = q.aim = a + Math.PI;
    }
    this.duelT = 0;
    this.phase = 'intro';
    this.t = 2.0;
    cam.zoomMul = 0.9;
    cam.focus = null;
    W.combatActive = false;
    audio.setMusic('boss', 2);
    const score = this.squads().map((sq) => this.wins[sq]).join(' — ');
    const need = this.cfg.winsNeeded ?? 2;
    hud.showBanner(`ROUND ${this.duelRound}`, `${score} · ชนะ ${need} ยกก่อนชนะแมตช์`, '#ff4d8a', 1.9, true);
    sfx('roar', 0.6);
  }
  /** distinct PVP squads in the match */
  squads() {
    return [...new Set(W.players.map((q) => q.squad))].sort((a, b) => a - b);
  }
  private squadName(sq: number) {
    const members = W.players.filter((q) => q.squad === sq);
    return members.map((q) => q.tag).join(' + ');
  }
  private squadColor(sq: number) {
    return W.players.find((q) => q.squad === sq)?.color2 ?? '#ffffff';
  }
  private tickDuel(g: number) {
    if (this.phase !== 'fight') return;
    this.duelT += g;
    // sudden death: the ring closes after 45s
    if (this.duelT > 45 && W.arenaTargetR > 240) {
      if (W.arenaTargetR === 520) hud.callout('SUDDEN DEATH', '#ff2d4a', 1.4, 48);
      W.arenaTargetR = 240;
    }
    const alive = new Set(W.players.filter((q) => !q.dead).map((q) => q.squad));
    if (alive.size > 1) return;
    const winner = [...alive][0];
    this.phase = 'clear';
    this.t = 2.6;
    W.combatActive = false;
    W.slowMo(0.25, 1.4);
    for (const s of W.strikes) s.dead = true;
    for (const b of W.projs) b.dead = true;
    if (winner === undefined) {
      hud.showBanner('DRAW', 'ล้มพร้อมกัน — ยกนี้ไม่นับ', '#ffffff', 2.4, true);
    } else {
      this.wins[winner]++;
      hud.showBanner(`${this.squadName(winner)} WINS ROUND ${this.duelRound}`, this.squads().map((sq) => `${this.squadName(sq)} ${this.wins[sq]}`).join(' · '), this.squadColor(winner), 2.4, true);
    }
    sfx('uiConfirm');
  }
  private afterDuelRound() {
    const need = this.cfg.winsNeeded ?? 2;
    const champ = this.squads().find((sq) => this.wins[sq] >= need);
    if (champ === undefined) return this.beginStage();
    tel.endRun('win');
    this.phase = 'victory';
    audio.setMusic('menu');
    W.arenaTargetR = 520;
    this.onEnd?.(`${this.squadName(champ)} WINS`, this.squads().map((sq) => `${this.squadName(sq)} ${this.wins[sq]}`).join(' · '), this.squadColor(champ));
    menus.showDuelEnd({
      winner: this.squadName(champ), color: this.squadColor(champ),
      table: this.squads().map((sq) => ({ name: this.squadName(sq), wins: this.wins[sq], color: this.squadColor(sq) })),
      stats: W.stats,
    }, () => this.start(W.players[0].weapons[0], W.diff, 0, 'duel', this.cfg), () => this.leave());
  }
  /** back to the title (online host: back to the room lobby instead) */
  leave() {
    if (this.onLeave?.()) return;
    this.toTitle();
  }
  /** return true to skip going to the title */
  onLeave: (() => boolean) | null = null;
  /** online host: called after every fixed tick (snapshots) */
  afterTick: (() => void) | null = null;
  /** online host: match result for clients */
  onEnd: ((title: string, sub: string, color: string) => void) | null = null;

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
    s.hp = s.maxHp = Math.round(s.maxHp * W.scale.hp * this.partyScale().bossHp);
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
    const party = this.partyScale();
    for (const [kind, n0] of list) {
      const n = Math.round((W.diff >= 1 ? n0 + 1 : n0) * party.count);
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0;
        for (let k = 0; k < 20; k++) {
          const a = rand(0, TAU), r = rand(200, 480);
          x = Math.cos(a) * r;
          y = Math.sin(a) * r;
          if (W.players.every((q) => dist(x, y, q.x, q.y) > 260)) break;
        }
        this.pending++;
        const delay = 0.6 + i * 0.12 + rand(0, 0.3);
        const sx = x, sy = y;
        fx.anim('vfx_portal', sx, sy, { w: 100, dur: delay + 0.35, tint: '#c25bff', under: true });
        strike({
          team: 'enemy', x: sx, y: sy, shape: { k: 'circle', r: 34 }, delay, active: 0.001, noHit: true, color: '#c25bff', tag: 'portal',
          onStart: () => {
            const e = makeMinion(kind, sx, sy);
            e.hp = e.maxHp = Math.round(e.maxHp * W.scale.hp * party.minionHp * T.diffMinionHp[W.diff]);
            codex.meet(MINION_KEY[kind]);
            if (Math.random() < Math.max(eliteChance(this.mode, this.round), W.diff >= 2 ? T.nightmare.elites : 0, this.nodeKind === 'elite' ? 0.45 : 0) + (this.challenge?.mods.includes('elite_storm') ? 0.3 : 0)) makeElite(e);
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
    for (const q of W.players) q.ctl.update(W.time);
    const pausePressed = input.pressed('pause') || this.localPlayers.some((q) => q.ctl.pressed('pause'));
    if (pausePressed && this.isPlaying() && this.phase !== 'upgrade') this.togglePause();
    this.tickInner(dt);
    for (const q of W.players) q.ctl.endFrame();
    this.afterTick?.();
  }
  private tickInner(dt: number) {
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

    if (W.debug && input.pressed('skip')) this.debugKillAll();

    const scale = W.tickTime(dt);
    const g = dt * scale * W.cheats.timeScale;
    W.time += g;
    input.now = W.time;
    const p = this.player;
    const freeAll = () => {
      for (const q of W.players) if (!q.dead) q.state = 'free';
    };

    // phase timers
    this.t -= dt;
    if (this.phase === 'intro' && this.t <= 0) {
      this.phase = 'fight';
      W.bars(0);
      freeAll();
      W.combatActive = true;
      if (this.mode === 'duel') {
        hud.callout('FIGHT!', '#ff4d8a', 0.9, 72);
        sfx('ult');
      } else this.spawnSubWave();
      if (this.stage === 0 && this.mode === 'campaign' && !multi()) this.tutorial(0);
    }
    if (this.phase === 'bossIntro' && this.t <= 0) {
      this.phase = 'fight';
      freeAll();
      W.combatActive = true;
      cam.focus = null;
      cam.zoomMul = 1;
      for (const b of this.bosses) {
        b.active = true;
        b.rest = 0.6;
      }
      const id = (this.def as { boss: BossId }).boss;
      const hints: Record<BossId, string> = {
        vanguard: 'บอสยกโล่ = กันการโจมตีจากด้านหน้า → PARRY ท่าฟันสีส้ม (คลิกขวาตอนวงสีเหลืองหดมาแตะตัวบอส) หรืออ้อมไปด้านหลัง',
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

    for (const q of W.players) {
      if (q.dead && !(q as { downNoted?: boolean }).downNoted) {
        (q as { downNoted?: boolean }).downNoted = true;
        if (multi() && this.mode !== 'duel') {
          hud.callout(`${q.tag} DOWN — ยืนข้างเพื่อชุบชีวิต`, q.color2, 1.6, 30);
          fx.ring(q.x, q.y, 10, 160, 0.5, '#ff2d4a', 6);
          sfx('death', 0.6);
        } else if (this.mode === 'duel') {
          fx.shards(q.x, q.y, 30, 500, q.color2, 1.4, 7);
          fx.ring(q.x, q.y, 10, 260, 0.7, q.color2, 8, true);
          sfx('death');
        }
      } else if (!q.dead) (q as { downNoted?: boolean }).downNoted = false;
    }
    // simulation — each player's new hitboxes are credited to them
    for (const q of W.players) {
      W.actor = q;
      q.update(g);
      // online: a remote player owns its own movement while free / charging / dashing (no input lag for them)
      const pos = (q.ctl as { pos?: [number, number, number, number] | null }).pos;
      if (pos && !q.dead && (q.state === 'free' || q.state === 'charge' || q.state === 'dash')) {
        q.x = pos[0];
        q.y = pos[1];
        q.vx = pos[2];
        q.vy = pos[3];
        W.confine(q);
      } else if (pos) (q.ctl as { pos?: unknown }).pos = null; // host owns the body (hit, attack, skill) until the client reports again
    }
    W.actor = null;
    if (multi() && this.mode !== 'duel') this.tickRevive(g);
    if (this.mode === 'duel') this.tickDuel(g);
    if (W.eclipseT > 0) {
      // ECLIPSE: enemies are frozen; when time resumes, 60% of the damage dealt bursts again
      W.eclipseT -= g;
      this.eclipseWas = 1;
      // bosses only freeze for the first 0.8s
      for (const e of W.enemies) if (!e.dead) {
        if (e.isBoss && W.eclipseT < 0.6) e.update(g);
        else e.tickCommon(0);
      }
    } else {
      if (this.eclipseWas) this.eclipseBurst();
      if (W.cheats.freeze) for (const e of W.enemies) e.tickCommon(0);
      else for (const e of W.enemies) if (!e.dead) e.update(g);
    }
    if (W.cheats.infFocus || W.cheats.infDash) for (const q of W.players) {
      if (W.cheats.infFocus) q.focus = 100;
      if (W.cheats.infDash) q.dashCharges = q.mods.dashMax;
    }
    updatePathWorld(W.players, g);
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

    this.updateCamera(dt);

    if (this.stage === 0 && this.mode === 'campaign' && this.phase === 'fight' && !multi()) this.tutorialTick(g);
    if (this.mode === 'duel') {
      if (this.phase === 'clear' && this.t <= 0) {
        this.phase = 'upgrade'; // frozen until the next round starts
        this.afterDuelRound();
      }
      return;
    }

    // death — the run ends when the whole party is down
    if (W.players.every((q) => q.dead) && this.phase !== 'dead') {
      this.phase = 'dead';
      this.t = 2.2;
      W.slowMo(0.25, 1.6);
      sfx('death');
      fx.shards(p.x, p.y, 30, 500, '#7ff6ff', 1.4, 7);
      fx.anim('player_death', p.x, p.y, { angle: p.facing, additive: false, under: true, hold: 3 });
      fx.ring(p.x, p.y, 10, 300, 0.8, '#ff2d4a', 8);
      cam.focus = { x: p.x, y: p.y };
      cam.zoomMul = 1.4;
      const bs = this.bosses.filter((b) => !b.dead);
      const left = bs.length ? this.bosses.reduce((a, b) => a + Math.max(0, b.dead ? 0 : b.hp), 0) / this.bosses.reduce((a, b) => a + b.maxHp, 0) : -1;
      hud.showBanner('DEFEATED', left >= 0 ? `${bs[0].title} เหลือ HP ${Math.max(1, Math.round(left * 100))}% — ${closeness(left)}` : 'ล้มแล้วลุกใหม่ — ทุกการตายคือบทเรียน', '#ff2d4a', 2.2, true);
      audio.setMusic('off');
    }
    if (this.phase === 'dead' && this.t <= 0) {
      tel.endRun('dead');
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

  /** follow the local player; with several local players frame them all */
  private updateCamera(dt: number) {
    const locals = this.localPlayers.filter((q) => !q.dead);
    const list = locals.length ? locals : this.localPlayers;
    const p = this.player;
    if (list.length <= 1) {
      const q = list[0] ?? p;
      const m = q.aimPoint();
      const lead = q.ctl.kind === 'pad' ? 0.12 : 0.22;
      cam.update(dt, q.x, q.y, (m.x - q.x) * lead, (m.y - q.y) * lead);
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of list) {
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
    const spread = Math.max(x1 - x0, (y1 - y0) * 1.6);
    if (!cam.focus) cam.zoomMul = Math.max(0.62, Math.min(1, 1 - (spread - 260) / 1300));
    cam.update(dt, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0);
  }

  /** co-op: stand next to a downed teammate to pick them back up */
  private tickRevive(g: number) {
    for (const q of W.players) {
      if (!q.dead) continue;
      const helper = W.players.find((o) => !o.dead && o !== q && dist(o.x, o.y, q.x, q.y) < 75);
      q.reviveT = helper ? q.reviveT + g : Math.max(0, q.reviveT - g * 0.5);
      if (helper && Math.random() < g * 20) fx.ember(q.x + rand(-20, 20), q.y + rand(-20, 20), 0, -60, '#6dff9e', 0.5, 3);
      if (q.reviveT >= 1.6) {
        q.reviveT = 0;
        q.dead = false;
        q.state = 'free';
        q.hp = q.maxHp * 0.35;
        q.ghostHp = q.hp;
        q.invuln = 1.5;
        fx.ring(q.x, q.y, 10, 140, 0.5, '#6dff9e', 6, true);
        fx.text(q.x, q.y - 40, 'REVIVED', '#6dff9e', 20);
        hud.callout(`${q.tag} REVIVED`, q.color2, 1, 30);
        sfx('heal');
      }
    }
  }

  private clearStage() {
    tel.stageEnd(true);
    this.phase = 'clear';
    this.t = 1.8;
    W.combatActive = false;
    for (const s of W.strikes) if (s.team === 'enemy') s.dead = true;
    for (const b of W.projs) if (b.team === 'enemy') b.dead = true;
    const endless = this.mode === 'endless';
    const last = !endless && this.stage === this.actStart + this.actLen - 1;
    const bossStage = this.def.kind === 'boss';
    this.shards += bossStage ? 25 : this.nodeKind === 'elite' ? 22 : 7;
    if (bossStage) {
      const d = this.def as { boss: BossId; duo?: BossId };
      for (const id of [d.boss, d.duo]) if (id && !W.noRewards && codex.beatBoss(id)) this.shards += 100;
      const n = d.boss === 'hollow' && endless ? 3 : d.duo ? 2 : 1;
      this.giveCores(n, this.player.x, this.player.y - 40);
    }
    const noDmg = W.players.reduce((s, q) => s + q.hp, 0) >= this.stageStartHp - 0.5;
    const title = endless ? `ROUND ${this.round} CLEAR` : last ? 'VICTORY' : 'STAGE CLEAR';
    hud.showBanner(title, noDmg ? 'FLAWLESS — ไม่โดนโจมตีเลย!' : `Style สูงสุด: ${RANKS[W.stats.bestRank]}`, last ? '#ffe14d' : '#6dff9e', 1.8, last);
    sfx('uiConfirm');
    // endless: smaller heal after waves, bigger after bosses
    for (const q of W.players) {
      if (q.dead) continue;
      if (!this.challenge?.mods.includes('no_heal')) q.heal(q.maxHp * (endless ? (this.def.kind === 'boss' ? T.heal.endlessBoss : T.heal.endlessWave) : this.def.kind === 'boss' ? T.heal.bossClear : T.heal.stageClear));
      q.flasks = q.mods.flaskMax;
      q.state = 'locked';
      q.overdrive = 0;
    }
    W.tint = 0;
    audio.intensity = 1;
    const save = loadSave();
    if (this.challenge) { /* challenges keep their own bests */ } else if (endless) {
      if (this.ranked && !W.noRewards) save.bestRound = Math.max(save.bestRound, this.round);
    } else if (this.mode === 'campaign' && !W.noRewards) save.bestStage = Math.max(save.bestStage, this.stage + 1);
    writeSave(save);
  }

  /** play every pending ascension of one player (weapon in hand first) */
  private async ascendAll(p: Player) {
    for (;;) {
      const curId = p.weapons[p.wi];
      const order = [curId, ...p.weapons.filter((w) => w !== curId)];
      const id = order.find((w) => p.prog[w] && canAscend(p.prog[w], p.cores));
      if (!id) return;
      const pr = p.prog[id];
      const next = (pr.tier + 1) as Tier;
      const ch = this.chooserFor(p);
      const path = next === 3 ? await ch.path(p, id) : null;
      p.cores -= CORE_REQ[next];
      pr.tier = next;
      if (path) pr.path = path;
      const fk = formKey(pr);
      const img = next === 4 ? sprites.url(`art_mythic_${id}_${pr.path}`) : next === 3 ? sprites.url(`art_path_${id}_${pr.path}`) : sprites.url(`weapon_${id}_${fk}`) ?? sprites.url(`icon_weapon_${id}_${fk}`);
      fx.anim('vfx_ascend_burst', p.x, p.y, { w: 260, dur: 1.2 });
      fx.anim('vfx_ascend_shatter', p.x, p.y, { w: 200, dur: 0.9 });
      if (p === this.player) tel.ascend(`${id} T${next}${pr.path ? pr.path : ''} @${this.mode === 'endless' ? 'r' + this.round : 's' + (this.stage + 1)}`);
      await ch.ascend(p, { weapon: id, tier: next, form: formName(id, pr), color: formColor(id, pr, WEAPONS[id].color), img, path: pr.path });
    }
  }

  private async afterClear() {
    this.phase = 'upgrade';
    // the run is over after the act's last stage — straight to victory
    const lastStage = this.mode !== 'endless' && this.stage - this.actStart >= this.actLen - 1;
    if (lastStage) {
      this.phase = 'victory';
      this.finish(true);
      return;
    }
    const endless = this.mode === 'endless';
    const rel = this.stage - this.actStart;
    const boss = this.def.kind === 'boss';
    // every player ascends and picks a card (online: remote players choose on their own screens, in parallel)
    this.reseed('cards', endless ? this.round : this.stage);
    const turn = async (q: Player) => {
      await this.ascendAll(q);
      const tk = this.takenBy.get(q)!;
      const offers = endless
        ? rollUpgrades(q, tk, 3, this.round === 1 || (this.round % 7 === 0 && q.weapons.length < 3), { endless: true, minRarity: boss ? 'rare' : undefined })
        : rollUpgrades(q, tk, 3, rel === 0 || (rel === 4 && q.weapons.length < 3), { minRarity: this.nodeKind === 'elite' ? 'epic' : boss && this.mode === 'act2' ? 'rare' : undefined });
      if (!offers.length) return;
      const u = await this.chooserFor(q).upgrade(q, offers, endless ? this.round : rel + 1, endless ? 0 : this.actLen);
      u.apply(q);
      tk[u.id] = (tk[u.id] ?? 0) + 1;
      // the card's power flows into the fighter
      const uc = ({ common: '#8fb8ff', rare: '#6dff9e', epic: '#c49bff', legendary: '#ffe14d' } as Record<string, string>)[u.rarity] ?? '#7ff6ff';
      fx.ring(q.x, q.y, 140, 10, 0.45, uc, 6, true);
      fx.ring(q.x, q.y, 10, 120, 0.5, '#ffffff', 3);
      fx.burst(q.x, q.y, 24, 260, uc, 0.6, 3);
      if (q === this.player) tel.card(u.id);
      sfx('uiConfirm');
    };
    const remote = W.players.filter((q) => q.ctl.kind === 'net' && this.remoteChooser);
    const local = W.players.filter((q) => !remote.includes(q));
    const remoteDone = Promise.all(remote.map(turn));
    for (const q of local) await turn(q);
    if (remote.length) menus.showWaiting('รอผู้เล่นคนอื่นเลือกพลัง…');
    await remoteDone;
    menus.hide();
    if (endless) {
      this.round++;
      this.nodeKind = undefined;
      return this.beginStage();
    }
    // BRANCHING MAP: before each wave stage choose the path (boss stages are fixed)
    this.nodeKind = undefined;
    if (STAGES[this.stage + 1]?.kind === 'wave') {
      const node = await this.pickNode();
      if (node === 'rest' || node === 'shop') {
        if (node === 'rest') await this.restNode();
        else await this.shopNode();
        menus.hide();
        this.stage += 2; // the fight is skipped — straight to the boss
        return this.beginStage();
      }
      this.nodeKind = node;
      menus.hide(); // BATTLE / ELITE: close the route screen before the fight starts
    }
    this.stage++;
    this.beginStage();
  }

  private pickNode(): Promise<NodeKind> {
    const others = (['elite', 'rest', 'shop'] as NodeKind[]).sort(() => Math.random() - 0.5).slice(0, 2);
    const nodes: NodeKind[] = ['battle', ...others];
    return new Promise((res) => showMap(nodes, this.stage - this.actStart + 1, this.actLen, this.shards, res));
  }
  private restNode(): Promise<void> {
    return new Promise((res) => showRest((c) => {
      for (const q of W.players) {
        if (c === 'heal') q.heal(q.maxHp * 0.4);
        else q.addRes(200);
        q.flasks = q.mods.flaskMax;
      }
      hud.callout(c === 'heal' ? 'RESTED' : 'TRAINED', '#6dff9e', 1, 30);
      res();
    }));
  }
  private shopNode(): Promise<void> {
    const p = this.player;
    const items: ShopItem[] = [
      { id: 'heal', name: 'MEND', desc: 'ทุกคนฟื้น HP 35%', price: 25, icon: '✚' },
      { id: 'res', name: 'WHETSTONE', desc: 'อาวุธในมือ +250 Resonance', price: 30, icon: '⚒' },
      { id: 'card', name: 'RARE CARD', desc: 'การ์ดสุ่มระดับ RARE ขึ้นไป', price: 45, icon: '✦' },
      { id: 'hp', name: 'IRON SKIN', desc: 'HP สูงสุด +15', price: 40, icon: '⬢' },
      { id: 'flask', name: 'SPARE FLASK', desc: 'ขวดยา +1 ขวด (ทุกคน · ตลอดรอบนี้)', price: 35, icon: '⚗' },
      { id: 'core', name: 'RIFT CORE', desc: 'แกนรอยแยก +1 (ใช้เลื่อน T3/T4)', price: 80, icon: '✧' },
    ];
    return new Promise((res) => showShop(items, () => this.shards, (it) => {
      if (this.shards < it.price) return false;
      this.shards -= it.price;
      if (it.id === 'heal') for (const q of W.players) q.heal(q.maxHp * 0.35);
      else if (it.id === 'res') p.addRes(250);
      else if (it.id === 'flask') for (const q of W.players) {
        q.mods.flaskMax++;
        q.flasks++;
      }
      else if (it.id === 'hp') for (const q of W.players) {
        q.maxHp += 15;
        q.hp += 15;
      } else if (it.id === 'core') this.giveCores(1, p.x, p.y);
      else if (it.id === 'card') {
        const tk = this.takenBy.get(p)!;
        const u = rollUpgrades(p, tk, 1, false, { minRarity: 'rare' })[0];
        if (u) {
          u.apply(p);
          tk[u.id] = (tk[u.id] ?? 0) + 1;
          tel.card(u.id);
          it.desc = `ได้: ${u.name}`;
        }
      }
      tel.card('shop:' + it.id);
      return true;
    }, () => res()));
  }

  private eclipseBurst() {
    this.eclipseWas = 0;
    W.eclipseT = 0;
    const p = W.eclipseBy ?? this.player;
    W.actor = p;
    W.flash('#9d5bff', 0.5);
    W.shake(0.6);
    sfx('explosion');
    for (const e of W.enemies) {
      const d = (e as { eclipseDmg?: number }).eclipseDmg ?? 0;
      (e as { eclipseDmg?: number }).eclipseDmg = 0;
      if (e.dead || d <= 0) continue;
      fx.anim('vfx_moon_severance', e.x, e.y, { w: e.r * 5, dur: 0.6 });
      e.onHit({ damage: d * 0.35 * p.mythic, posture: 30, knock: 0, angle: 0, hitstop: 0, unblockable: true, parryable: false, sx: p.x, sy: p.y, kind: 'aoe', tag: 'eclipse', skill: true, color: '#9d5bff', attacker: p });
    }
    W.actor = null;
  }

  private finish(won: boolean) {
    if (won) tel.endRun('win');
    const ch = this.challenge;
    restoreRandom();
    if (ch && !W.noRewards) recordBest(ch.key, ch.kind === 'daily' ? Math.max(0, this.round - 1) : won ? 11 : this.stage);
    this.onEnd?.(won ? 'VICTORY' : 'DEFEATED', won ? 'ทีมพิชิตด่านสุดท้ายได้!' : `ไปถึงด่าน ${this.stage - this.actStart + 1}/${this.actLen}`, won ? '#ffe14d' : '#ff2d4a');
    const save = loadSave();
    if (won && this.mode === 'campaign' && !W.noRewards) codex.clearAct1();
    // bank Echo Shards (practice runs earn half; god mode none)
    const earned = W.noRewards ? 0 : Math.round(this.shards * (this.ranked ? 1 : 0.5) * (won ? 1.25 : 1));
    if (earned) codex.addShards(earned);
    if (earned) hud.callout(`+${earned} ECHO SHARDS`, '#b98cff', 2, 30);
    if (won) {
      save.wins++;
      if (!save.bestTime || W.stats.time < save.bestTime) save.bestTime = W.stats.time;
    }
    save.bestRank = Math.max(save.bestRank, W.stats.bestRank);
    writeSave(save);
    audio.setMusic(won ? 'menu' : 'off');
    const eligible = this.ranked && !W.noRewards;
    setMenuHard(W.hardMode, this.mode);
    const mode = this.mode;
    const cfg = this.cfg.slots.length > 1 || ch ? this.cfg : undefined;
    menus.showEnd(won, W.stats, this.stage - this.actStart, this.actLen, () => this.start(this.player.weapons[0], W.diff, 0, mode, cfg), () => this.leave(),
      eligible ? { weapon: this.player.weapons[0], hard: W.hardMode, shot: snapshot(), mode: ch ? ch.kind : mode, round: this.round, seed: ch?.key } : undefined,
      mode === 'endless' ? { round: this.round, best: ch ? bestOf(ch.key) : loadSave().bestRound } : undefined, earned,
      won ? [] : this.bosses.map((b) => ({
        title: b.title, hp: b.dead ? 0 : b.hp, maxHp: b.maxHp,
        phase: (b as { stage?: number }).stage === 3 ? 'III' : b.phase === 2 ? 'II' : '',
        color: b.phase === 2 ? b.phase2Color : '#ff4d6d', split: b.hpPhase && b.phase === 1 ? 0.5 : null,
      })));
  }

  isPlaying() {
    return this.phase !== 'title' && this.phase !== 'victory';
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      const cfg = this.cfg.slots.length > 1 ? this.cfg : undefined;
      menus.showPause(() => this.togglePause(), () => this.start(this.player.weapons[0], W.diff, 0, this.mode, cfg), () => this.leave());
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
      'คลิกขวาตอนวงสีเหลืองหดมาแตะขอบ = PARRY (ยิ่งเป๊ะยิ่ง PERFECT) • กดค้าง = Block (กิน Stamina)',
      'พื้นที่สีแดง = ป้องกันไม่ได้ ต้อง DASH หนี! • กดคลิกซ้ายค้าง = ท่าชาร์จ',
      'อาวุธเริ่มที่ร่าง WORN (T0) — สู้เพื่อสะสม RESONANCE (แถบใต้ช่องอาวุธ) แล้วเลื่อนขั้นตอนจบด่าน',
      'T2 ปลดสกิล Q / E (ใช้ Focus) • Focus เต็ม 100 กด R = OVERDRIVE • T4 ปลด Ultimate ประจำสาย',
    ];
    const touchTips = [
      'จอยซ้าย = เดิน • แตะ ATK = โจมตี (แตะต่อเนื่อง = คอมโบ) • ปล่อยว่าง = เล็งศัตรูใกล้สุดอัตโนมัติ',
      'DASH = พุ่งหลบ (อมตะชั่วขณะ) — Dash ฉิวเฉียดการโจมตี = PERFECT DODGE',
      'แตะ GUARD ตอนวงสีเหลืองหดมาแตะขอบ = PARRY • กดค้าง = Block',
      'พื้นที่สีแดง = ต้อง DASH หนี! • ลาก ATK = เล็งเอง · กด ATK ค้าง = ท่าชาร์จ (T1 ขึ้นไป)',
      'อาวุธเริ่มที่ร่าง WORN (T0) — สู้เพื่อสะสม RESONANCE แล้วเลื่อนขั้นตอนจบด่าน',
      'T2 ปลดปุ่ม Q / E (ใช้ Focus) • Focus เต็ม 100 กด R = OVERDRIVE • ⇄ = สลับอาวุธ',
    ];
    const list = this.player.ctl.kind === 'touch' ? touchTips : tips;
    if (step >= list.length) return;
    this.tut = step + 1;
    hud.showHint(list[step], 7);
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
    if (this.phase !== 'title') for (const q of W.players) if (!q.dead) actors.push(q);
    // downed teammates (co-op) lie on the floor with a revive ring
    if (multi() && this.mode !== 'duel') for (const q of W.players) if (q.dead) drawDowned(ctx, q);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw(ctx);
    drawEliteMarks(ctx, W.enemies);
    if (multi()) for (const q of W.players) if (!q.dead) drawTag(ctx, q);
    drawProjectiles(ctx);
    fx.drawOver(ctx);
    fx.drawTexts(ctx);
  }
  get showHud() {
    return this.phase !== 'title' && this.phase !== 'victory';
  }
}

/** "P2" tag + coloured ring under each fighter in multiplayer */
export function drawTag(ctx: CanvasRenderingContext2D, q: Player) {
  ctx.save();
  ctx.strokeStyle = q.color2;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(q.x, q.y + 8, q.r + 8, (q.r + 8) * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = '800 13px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = q.color2;
  ctx.fillText(q.tag, q.x, q.y - q.r - 30);
  ctx.restore();
}
export function drawDowned(ctx: CanvasRenderingContext2D, q: Player) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  sprites.draw(ctx, sprites.first('player_death', 'player_hurt', 'player_idle') ?? '', q.x, q.y, { angle: q.facing, outline: q.color2, outlineAlpha: 0.6, t: 99 });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(q.x, q.y, 30, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#6dff9e';
  ctx.beginPath();
  ctx.arc(q.x, q.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, q.reviveT / 1.6));
  ctx.stroke();
  ctx.font = '800 12px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = q.color2;
  ctx.fillText(q.tag + ' DOWN', q.x, q.y - 42);
  ctx.restore();
}

function freshStats() {
  return { kills: 0, parries: 0, perfects: 0, maxCombo: 0, hitsTaken: 0, time: 0, bestRank: 0, executions: 0, skillUse: {} as Record<string, number> };
}

export const run = new Run();
