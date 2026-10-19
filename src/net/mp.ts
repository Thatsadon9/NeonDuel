/**
 * ONLINE MULTIPLAYER (host-authoritative).
 *
 * One player HOSTS: their browser runs the whole simulation (src/game/*) exactly like local play, with remote
 * players driven by RemoteControls fed from the network. ~30 times a second the host sends every client a
 * snapshot: what to draw (entity draw-lists recorded through a fake canvas), hitbox telegraphs, projectiles,
 * HUD state, and the effect/sound events since the last snapshot. Clients only send their inputs and their
 * between-stage choices; they never simulate, so co-op and PVP stay in sync by construction.
 *
 * Transport: WebSocket rooms on our own server (server/mp.mjs, path /mp).
 */
import { sfx, audio, type MusicMode, type Sfx } from '../audio/audio';
import { menus } from '../ui/menus';
import { padnav } from '../ui/padnav';
import { hud } from '../ui/hud';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { sprites, type DrawOpts } from '../render/sprites';
import { input } from '../core/input';
import { MergedControls, RemoteControls, InputPacker, type NetInput, type Vec } from '../core/controls';
import { W, drawStrikes, drawProjectiles, drawObstacles, isPlayer, type Actor, type Strike, type Projectile } from '../game/world';
import { Player, PLAYER_COLORS } from '../game/player';
import { WEAPONS, type WeaponId } from '../game/weapons';
import { FAMILIES, type PathId } from '../game/ascension';
import { UPGRADES } from '../game/upgrades';
import { codex } from '../game/codex';
import { style } from '../game/style';
import { drawPathWorld } from '../game/paths';
import { drawEliteMarks } from '../game/elites';
import { run, drawTag, drawDowned, type GameMode, type MatchCfg, type Chooser, type Theme } from '../game/run';
import { session, type ClientLoop } from './session';
import { MODE_LABEL, MODE_DESC, weaponsFor, cycle, type LobbyHandlers, type LobbyMode } from '../ui/lobby';

// ====================================================================== socket
type Msg = Record<string, unknown> & { k: string };
type RoomEvent =
  | { t: 'room'; code: string; you: string; host: boolean; hostId: string }
  | { t: 'msg'; from: string; d: Msg }
  | { t: 'peer-join'; id: string; name: string }
  | { t: 'peer-leave'; id: string }
  | { t: 'closed'; reason: string }
  | { t: 'error'; msg: string };

class Room {
  ws: WebSocket | null = null;
  you = '';
  hostId = '';
  code = '';
  isHost = false;
  handler: (e: RoomEvent) => void = () => {};
  connect(): Promise<void> {
    return new Promise((res, rej) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/mp`);
      this.ws = ws;
      ws.onopen = () => res();
      ws.onerror = () => rej(new Error('connect failed'));
      ws.onclose = () => this.handler({ t: 'closed', reason: 'disconnected' });
      ws.onmessage = (ev) => {
        let m: RoomEvent;
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (m.t === 'room') {
          this.you = m.you;
          this.hostId = m.hostId;
          this.code = m.code;
          this.isHost = m.host;
        }
        this.handler(m);
      };
    });
  }
  raw(o: object) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o));
  }
  to(to: string, d: Msg) {
    this.raw({ t: 'to', to, d });
  }
  close() {
    if (!this.ws) return;
    this.ws.onclose = null;
    this.raw({ t: 'leave' });
    this.ws.close();
    this.ws = null;
  }
}

// ====================================================================== draw-list recording
/** a canvas command: ['m', method, ...args] · ['p', prop, value] · ['s', sprite, x, y, opts] */
type Cmd = (string | number | boolean | null | object)[];
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const cleanArg = (v: unknown) => (typeof v === 'number' ? r3(v) : typeof v === 'string' || typeof v === 'boolean' || v === null ? v : undefined);

/** a fake 2D context that records what an entity draws */
function recorder() {
  const cmds: Cmd[] = [];
  const dummy = { addColorStop() {} };
  const target: Record<string, unknown> = {
    __rec: (name: string, x: number, y: number, o: DrawOpts) => {
      const oo: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) if (v !== undefined) oo[k] = typeof v === 'number' ? r3(v) : v;
      cmds.push(['s', name, r1(x), r1(y), oo]);
    },
  };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return { width: 1, height: 1 };
      if (prop === 'measureText') return (s: string) => ({ width: s.length * 8 });
      if (prop.startsWith('create')) return () => dummy;
      if (prop === 'getTransform') return () => new DOMMatrix();
      return (...args: unknown[]) => {
        cmds.push(['m', prop, ...args.map(cleanArg).map((a) => (a === undefined ? null : a))]);
      };
    },
    set(_t, prop: string, value) {
      if (typeof value === 'string' || typeof value === 'number') cmds.push(['p', prop, typeof value === 'number' ? r3(value) : value]);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, cmds };
}
/** replay a recorded draw-list, shifted by (dx, dy) */
function replay(ctx: CanvasRenderingContext2D, cmds: Cmd[], dx = 0, dy = 0) {
  ctx.save();
  if (dx || dy) ctx.translate(dx, dy);
  const c = ctx as unknown as Record<string, unknown>;
  for (const cm of cmds) {
    try {
      if (cm[0] === 'm') (c[cm[1] as string] as (...a: unknown[]) => void).apply(ctx, cm.slice(2));
      else if (cm[0] === 'p') c[cm[1] as string] = cm[2];
      else if (cm[0] === 's') sprites.draw(ctx, cm[1] as string, cm[2] as number, cm[3] as number, cm[4] as DrawOpts);
    } catch {
      /* a malformed command must never kill the frame */
    }
  }
  ctx.restore();
}

// ====================================================================== snapshot types
const P_FIELDS = ['x', 'y', 'vx', 'vy', 'hp', 'maxHp', 'ghostHp', 'stamina', 'focus', 'dashCharges', 'dashRecharge', 'weapons', 'wi', 'prog', 'cores',
  'overdrive', 'state', 'dead', 'reviveT', 'tag', 'pid', 'squad', 'facing', 'aim', 'chargeT', 'quiver', 'r'] as const;
interface ActorSnap { n: number; x: number; y: number; vx: number; vy: number; c: Cmd[]; m?: EnemyMeta }
interface EnemyMeta { r: number; col: string; boss: boolean; dead: boolean; hp: number; mhp: number; po: number; mpo: number; stg: number; title: string; ph: number; hpPh: boolean; p2: string; st?: number }
interface Snap {
  k: 's';
  t: number;
  ph: string;
  paused: boolean;
  ar: number;
  at: number;
  th: Theme;
  ti: number;
  pl: Record<string, unknown>[];
  ex: (number | null)[]; // execTarget nid per player
  a: ActorSnap[];
  fl: Cmd[];
  ov: Cmd[];
  st: unknown[];
  pr: unknown[];
  sty: number[];
  sc: typeof W.scale;
  du: typeof W.duel;
  pvp: boolean;
  ev: unknown[][];
}

// ====================================================================== effect / sound / HUD events
const FX_METHODS = ['sparks', 'burst', 'shards', 'smoke', 'ember', 'anim', 'slash', 'ring', 'ghost', 'beam', 'text', 'bolt'] as const;
type Hooked = { orig: Map<string, (...a: unknown[]) => unknown> };
let recording = false;

/** serialise arguments: actors referenced in options (follow) become {nid} */
function ser(v: unknown): unknown {
  if (typeof v === 'number') return r1(v);
  if (v && typeof v === 'object') {
    if ((v as Actor).nid !== undefined && 'hp' in (v as object)) return { nid: (v as Actor).nid };
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined) continue;
      o[k] = k === 'follow' && x && typeof x === 'object' ? ((x as Actor).nid !== undefined ? { nid: (x as Actor).nid } : { x: r1((x as Vec).x), y: r1((x as Vec).y) }) : typeof x === 'number' ? r3(x) : x;
    }
    return o;
  }
  return v;
}

function installHooks(push: (e: unknown[]) => void): Hooked {
  const h: Hooked = { orig: new Map() };
  const f = fx as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const m of FX_METHODS) {
    const o = f[m].bind(fx);
    h.orig.set('fx.' + m, f[m]);
    f[m] = (...args: unknown[]) => {
      if (recording) return false; // effects spawned while recording draw-lists are host-only noise
      push(['f', m, ...args.map(ser)]);
      return o(...args);
    };
  }
  const hd = hud as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const m of ['callout', 'showBanner', 'showHint']) {
    const o = hd[m].bind(hud);
    h.orig.set('hud.' + m, hd[m]);
    hd[m] = (...args: unknown[]) => {
      push(['h', m, ...args]);
      return o(...args);
    };
  }
  const w = W as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const m of ['flash', 'shake']) {
    const o = w[m].bind(W);
    h.orig.set('W.' + m, w[m]);
    w[m] = (...args: unknown[]) => {
      push(['w', m, ...args.map(ser)]);
      return o(...args);
    };
  }
  audio.hook = (kind, a, b) => push(['a', kind, a, r3(b)]);
  return h;
}
function uninstallHooks(h: Hooked) {
  for (const [key, fn] of h.orig) {
    const [obj, m] = key.split('.');
    const target = (obj === 'fx' ? fx : obj === 'hud' ? hud : W) as unknown as Record<string, unknown>;
    target[m] = fn;
  }
  audio.hook = null;
}

// ====================================================================== shared session state
interface Seat { id: string; name: string; weapon: WeaponId; path: PathId; ready: boolean }
interface LobbyState { seats: Seat[]; mode: LobbyMode; hard: boolean; bestOf: number; teams: boolean; act2: boolean }

const NAME_KEY = 'neonduel.mpname';
const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || 'PLAYER';
  } catch {
    return 'PLAYER';
  }
};
const saveName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch { /* ignore */ }
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let room: Room | null = null;
let host: HostSession | null = null;
let client: ClientSession | null = null;
let handlers: LobbyHandlers;

function shutdown(toTitle = true, msg = '') {
  host?.dispose();
  client?.dispose();
  host = null;
  client = null;
  room?.close();
  room = null;
  padnav.suspended = false;
  run.remoteChooser = null;
  run.onLeave = null;
  run.afterTick = null;
  run.onEnd = null;
  if (toTitle) {
    run.toTitle();
    if (msg) hud.callout(msg, '#ff4d6d', 3, 26);
  }
}

// ====================================================================== entry: online menu
export function showOnline(h: LobbyHandlers) {
  handlers = h;
  const name = loadName();
  menus.set(`
    <div class="panel mp-online">
      <div class="up-title">ONLINE</div>
      <div class="up-sub">ผู้สร้างห้อง (HOST) จะรันเกมจริง — ควรเป็นเครื่องที่เน็ตดีที่สุด · สูงสุด 4 คน</div>
      <label class="mp-field">ชื่อของคุณ <input id="mpname" maxlength="14" value="${esc(name)}" autocomplete="off"></label>
      <div class="mp-choices">
        <div class="card mp-choice" id="mp-create" style="--c:#7ff6ff"><b>CREATE ROOM</b><span>สร้างห้องแล้วส่งรหัส 4 ตัวให้เพื่อน</span></div>
        <div class="card mp-choice" id="mp-joinbox" style="--c:#ff4d8a"><b>JOIN ROOM</b>
          <input id="mpcode" maxlength="4" placeholder="รหัสห้อง" autocomplete="off" style="text-transform:uppercase">
          <button id="mp-join">JOIN</button></div>
      </div>
      <div class="lb-status" id="mpstatus"></div>
      <button id="back">BACK</button>
    </div>`);
  const $ = <T extends HTMLElement>(id: string) => menus.root.querySelector('#' + id) as T;
  const status = (t: string) => ($('mpstatus').textContent = t);
  const getName = () => {
    const n = ($('mpname') as HTMLInputElement).value.trim().slice(0, 14) || 'PLAYER';
    saveName(n);
    return n;
  };
  const go = async (join: string | null) => {
    status('กำลังเชื่อมต่อ…');
    room = new Room();
    try {
      await room.connect();
    } catch {
      status('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ต้องเปิดเกมผ่าน server ของเรา (npm run dev / npm start)');
      room = null;
      return;
    }
    const nm = getName();
    room.handler = (e) => {
      if (e.t === 'error') {
        status(e.msg);
        room?.close();
        room = null;
      } else if (e.t === 'room') {
        if (e.host) host = new HostSession(room!, nm);
        else client = new ClientSession(room!, nm);
      } else if (e.t === 'closed') {
        shutdown(true, e.reason === 'host-left' ? 'HOST ออกจากห้อง' : 'การเชื่อมต่อหลุด');
      } else {
        host?.onEvent(e);
        client?.onEvent(e);
      }
    };
    if (join) room.raw({ t: 'join', code: join, name: nm });
    else room.raw({ t: 'create', name: nm });
  };
  $('mp-create').addEventListener('click', () => go(null));
  $('mp-join').addEventListener('click', (e) => {
    e.stopPropagation();
    const c = ($('mpcode') as HTMLInputElement).value.trim().toUpperCase();
    if (c.length !== 4) return status('ใส่รหัสห้อง 4 ตัว');
    go(c);
  });
  $('mpcode').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).code === 'Enter') $('mp-join').click();
  });
  $('back').addEventListener('click', () => h.back());
  menus.onKey((e) => {
    if (e.code === 'Escape' && !(e.target instanceof HTMLInputElement)) h.back();
  });
}

/** lobby screen (shared by host and clients) */
function renderLobby(st: LobbyState, me: string, isHost: boolean, code: string, on: {
  seat: (s: Partial<Seat>) => void; mode?: (m: LobbyMode) => void; opt?: (o: Partial<LobbyState>) => void; start?: () => void; leave: () => void;
}) {
  const mine = st.seats.find((s) => s.id === me);
  const need = st.mode === 'duel' ? 2 : 1;
  const canStart = st.seats.length >= need && st.seats.every((s) => s.ready);
  const seatHtml = (i: number) => {
    const s = st.seats[i];
    const col = PLAYER_COLORS[i];
    if (!s) return `<div class="seat empty" style="--c:${col}"><div class="seat-tag">P${i + 1}</div><div class="seat-join">ว่าง — แชร์รหัส <b>${code}</b></div></div>`;
    const w = WEAPONS[s.weapon], pi = FAMILIES[s.weapon][s.path];
    const art = sprites.url('art_weapon_' + s.weapon) ?? sprites.url(`icon_weapon_${s.weapon}_t2`);
    const self = s.id === me;
    const team = st.mode === 'duel' && st.teams && st.seats.length === 4 ? `<div class="seat-team">TEAM ${i % 2 ? 'B' : 'A'}</div>` : '';
    return `<div class="seat ${s.ready ? 'ready' : ''} ${self ? 'self' : ''}" style="--c:${col};--w:${w.color}">
      <div class="seat-tag">P${i + 1} <small>${esc(s.name)}${s.id === st.seats[0].id ? ' · HOST' : ''}${self ? ' · YOU' : ''}</small></div>
      ${team}
      <div class="seat-weapon">
        ${self ? '<button class="arrow" data-a="left">◀</button>' : '<span></span>'}
        <div>${art ? `<img src="${art}" alt="">` : ''}<b>${w.name}</b><small>${w.thai}</small></div>
        ${self ? '<button class="arrow" data-a="right">▶</button>' : '<span></span>'}
      </div>
      ${self ? `<button class="seat-path" data-a="path" style="--p:${pi.color}">สาย ${pi.name}${st.mode === 'duel' ? ' · T4 ' + pi.mythic : ''}</button>
        <button class="seat-ready" data-a="ready">${s.ready ? '✓ READY' : 'READY?'}</button>`
        : `<div class="seat-path" style="--p:${pi.color}">สาย ${pi.name}</div><div class="seat-ready">${s.ready ? '✓ READY' : '…'}</div>`}
    </div>`;
  };
  menus.set(`
    <div class="lobby">
      <div class="up-title">ROOM <span class="room-code">${code}</span></div>
      <div class="row">
        ${(Object.keys(MODE_LABEL) as LobbyMode[]).map((m) => {
          const lock = m === 'act2' && !st.act2;
          return `<button class="toggle ${st.mode === m ? 'on' : ''} ${lock ? 'locked' : ''}" data-mode="${m}" ${isHost ? '' : 'disabled'}>${MODE_LABEL[m]}${lock ? ' 🔒' : ''}</button>`;
        }).join('')}
        <span class="sep"></span>
        ${st.mode === 'duel'
          ? `<button class="toggle ${st.bestOf === 3 ? 'on' : ''}" data-bo="3" ${isHost ? '' : 'disabled'}>BEST OF 3</button><button class="toggle ${st.bestOf === 5 ? 'on' : ''}" data-bo="5" ${isHost ? '' : 'disabled'}>BEST OF 5</button>
             ${st.seats.length === 4 ? `<button class="toggle ${st.teams ? 'on' : ''}" id="teams" ${isHost ? '' : 'disabled'}>${st.teams ? 'TEAMS 2v2' : 'FREE FOR ALL'}</button>` : ''}`
          : `<button class="toggle ${!st.hard ? 'on' : ''}" data-hard="0" ${isHost ? '' : 'disabled'}>NORMAL</button><button class="toggle ${st.hard ? 'on hard' : ''}" data-hard="1" ${isHost ? '' : 'disabled'}>HARD</button>`}
      </div>
      <div class="mode-desc">${MODE_DESC[st.mode]}${isHost ? '' : ' · HOST เป็นคนเลือกโหมด'}</div>
      <div class="seats">${[0, 1, 2, 3].map(seatHtml).join('')}</div>
      <div class="lobby-status">${st.seats.length < need ? `ต้องมีผู้เล่นอย่างน้อย ${need} คน` : canStart ? (isHost ? 'ทุกคนพร้อม — กด START' : 'ทุกคนพร้อม — รอ HOST กด START') : 'รอทุกคนกด READY'}</div>
      <div class="row">
        ${isHost ? `<button class="big" id="start" ${canStart ? '' : 'disabled'}>START MATCH</button>` : ''}
        <button id="leave">LEAVE ROOM</button>
      </div>
    </div>`);
  const root = menus.root;
  root.querySelectorAll<HTMLElement>('[data-a]').forEach((el) => el.addEventListener('click', () => {
    if (!mine) return;
    const a = el.dataset.a;
    if (a === 'ready') on.seat({ ready: !mine.ready });
    else if (mine.ready) return;
    else if (a === 'left' || a === 'right') on.seat({ weapon: cycle(weaponsFor(st.mode), mine.weapon, a === 'left' ? -1 : 1) });
    else if (a === 'path' && (st.mode === 'duel' || codex.hasPathB(mine.weapon))) on.seat({ path: mine.path === 'a' ? 'b' : 'a' });
    sfx('ui', 0.6);
  }));
  if (isHost) {
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) => el.addEventListener('click', () => on.mode?.(el.dataset.mode as LobbyMode)));
    root.querySelectorAll<HTMLElement>('[data-bo]').forEach((el) => el.addEventListener('click', () => on.opt?.({ bestOf: Number(el.dataset.bo) })));
    root.querySelectorAll<HTMLElement>('[data-hard]').forEach((el) => el.addEventListener('click', () => on.opt?.({ hard: el.dataset.hard === '1' })));
    root.querySelector('#teams')?.addEventListener('click', () => on.opt?.({ teams: !st.teams }));
    root.querySelector('#start')?.addEventListener('click', () => canStart && on.start?.());
  }
  root.querySelector('#leave')!.addEventListener('click', on.leave);
  menus.onKey((e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (!mine) return;
    if (e.code === 'Enter' || e.code === 'Space') on.seat({ ready: !mine.ready });
    else if (mine.ready) return;
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') on.seat({ weapon: cycle(weaponsFor(st.mode), mine.weapon, -1) });
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') on.seat({ weapon: cycle(weaponsFor(st.mode), mine.weapon, 1) });
  });
}

// ====================================================================== HOST
class HostSession {
  st: LobbyState;
  private remotes = new Map<string, RemoteControls>();
  private hooks: Hooked | null = null;
  private events: unknown[][] = [];
  private tickN = 0;
  private inMatch = false;
  private pending = new Map<number, (v: unknown) => void>();
  private reqSeq = 0;

  constructor(public room: Room, name: string) {
    const ws = weaponsFor('campaign');
    this.st = { seats: [{ id: room.you, name, weapon: ws[0], path: 'a', ready: false }], mode: 'campaign', hard: false, bestOf: 3, teams: false, act2: codex.data.act1Cleared };
    this.lobby();
  }
  dispose() {
    if (this.hooks) uninstallHooks(this.hooks);
    this.hooks = null;
    run.afterTick = null;
  }
  private broadcast(d: Msg) {
    this.room.to('*', d);
  }
  private pushLobby() {
    this.broadcast({ k: 'lobby', st: this.st });
  }
  lobby() {
    this.inMatch = false;
    this.room.raw({ t: 'lock', v: false });
    if (this.hooks) uninstallHooks(this.hooks);
    this.hooks = null;
    run.afterTick = null;
    run.remoteChooser = null;
    for (const s of this.st.seats) s.ready = false;
    if (run.phase !== 'title') run.toTitle();
    this.pushLobby();
    this.draw();
  }
  private draw() {
    if (this.inMatch) return;
    renderLobby(this.st, this.room.you, true, this.room.code, {
      seat: (p) => this.updateSeat(this.room.you, p),
      mode: (m) => {
        if (m === 'act2' && !this.st.act2) return;
        this.st.mode = m;
        for (const s of this.st.seats) {
          s.ready = false;
          if (!weaponsFor(m).includes(s.weapon)) s.weapon = 'katana';
        }
        this.pushLobby();
        this.draw();
      },
      opt: (o) => {
        Object.assign(this.st, o);
        this.pushLobby();
        this.draw();
      },
      start: () => this.start(),
      leave: () => shutdown(),
    });
  }
  private updateSeat(id: string, p: Partial<Seat>) {
    const s = this.st.seats.find((x) => x.id === id);
    if (!s || this.inMatch) return;
    if (p.weapon && (WEAPONS as Record<string, unknown>)[p.weapon]) s.weapon = p.weapon;
    if (p.path === 'a' || p.path === 'b') s.path = p.path;
    if (typeof p.ready === 'boolean') s.ready = p.ready;
    this.pushLobby();
    this.draw();
  }

  onEvent(e: RoomEvent) {
    if (e.t === 'peer-join') {
      if (this.inMatch || this.st.seats.length >= 4) return;
      this.st.seats.push({ id: e.id, name: e.name, weapon: 'katana', path: 'a', ready: false });
      sfx('uiConfirm');
      this.pushLobby();
      this.draw();
    } else if (e.t === 'peer-leave') {
      const i = this.st.seats.findIndex((s) => s.id === e.id);
      if (i < 0) return;
      const name = this.st.seats[i].name;
      this.st.seats.splice(i, 1);
      if (this.inMatch) {
        // their fighter drops out of the match
        const rc = this.remotes.get(e.id);
        const p = W.players.find((q) => q.ctl === rc);
        if (p) {
          p.dead = true;
          p.hp = 0;
          p.state = 'dead';
          // co-op: the fighter leaves the party (PVP: it simply counts as knocked out)
          if (!W.pvp) {
            W.players = W.players.filter((q) => q !== p);
            run.cfg.slots = run.cfg.slots.filter((sl) => sl.ctl !== rc);
          }
        }
        hud.callout(`${name} ออกจากเกม`, '#ff4d6d', 2, 26);
        for (const [rid, res] of this.pending) {
          void rid;
          res(null);
        }
      } else {
        this.pushLobby();
        this.draw();
      }
    } else if (e.t === 'msg') {
      const d = e.d;
      if (d.k === 'seat') this.updateSeat(e.from, d as Partial<Seat>);
      else if (d.k === 'in') this.remotes.get(e.from)?.feed(d.s as NetInput);
      else if (d.k === 'pick') {
        const res = this.pending.get(d.req as number);
        this.pending.delete(d.req as number);
        res?.(d.v);
      } else if (d.k === 'hello') this.pushLobby();
    }
  }

  private start() {
    this.inMatch = true;
    this.room.raw({ t: 'lock', v: true });
    const st = this.st;
    this.remotes.clear();
    const slots = st.seats.map((s, i) => {
      const local = s.id === this.room.you;
      const ctl = local ? new MergedControls() : new RemoteControls(s.id);
      if (!local) this.remotes.set(s.id, ctl as RemoteControls);
      return { ctl, weapon: s.weapon, tag: s.name.slice(0, 10) || 'P' + (i + 1), squad: st.mode === 'duel' && st.teams && st.seats.length === 4 ? i % 2 : i, path: s.path };
    });
    const cfg: MatchCfg = { slots, winsNeeded: Math.ceil(st.bestOf / 2), online: true };
    this.broadcast({ k: 'start', mode: st.mode, seats: st.seats.map((s) => s.id) });
    this.events = [];
    this.hooks = installHooks((ev) => this.events.push(ev));
    run.remoteChooser = this.chooser();
    run.onLeave = () => {
      this.broadcast({ k: 'tolobby' });
      this.lobby();
      return true;
    };
    run.onEnd = (title, sub, color) => this.broadcast({ k: 'end', title, sub, color });
    run.afterTick = () => this.afterTick();
    handlers.start(st.mode as GameMode, st.hard, cfg);
  }

  /** remote players make their choices on their own screens */
  private chooser(): Chooser {
    const ask = <T>(p: Player, d: Msg): Promise<T> => new Promise((res) => {
      const id = [...this.remotes].find(([, c]) => c === p.ctl)?.[0];
      if (!id) return res(null as T);
      const req = ++this.reqSeq;
      this.pending.set(req, res as (v: unknown) => void);
      this.room.to(id, { ...d, req });
    });
    return {
      upgrade: async (p, offers, done, total) => {
        const id = await ask<string | null>(p, { k: 'ask', kind: 'upgrade', offers: offers.map((u) => u.id), done, total });
        return offers.find((u) => u.id === id) ?? offers[0];
      },
      path: async (p, weapon) => ((await ask<PathId | null>(p, { k: 'ask', kind: 'path', weapon })) === 'b' ? 'b' : 'a'),
      ascend: async (p, info) => {
        await ask(p, { k: 'ask', kind: 'ascend', info });
      },
    };
  }

  private afterTick() {
    if (++this.tickN % 2) return; // 30 snapshots / s
    this.broadcast(this.snapshot() as unknown as Msg);
  }

  private snapshot(): Snap {
    recording = true;
    const actors: ActorSnap[] = [];
    const rec = (a: Actor, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const r = recorder();
      try {
        draw(r.ctx);
      } catch { /* keep going */ }
      return { n: a.nid, x: r1(a.x), y: r1(a.y), vx: r1(a.vx), vy: r1(a.vy), c: r.cmds } as ActorSnap;
    };
    const list: Actor[] = [...W.enemies.filter((e) => !e.dead), ...W.players];
    list.sort((a, b) => a.y - b.y);
    for (const a of list) {
      if (isPlayer(a)) {
        if (a.dead && (W.pvp || W.players.length < 2)) continue;
        actors.push(rec(a, (c) => {
          if (a.dead) drawDowned(c, a);
          else {
            a.draw(c);
            if (W.players.length > 1) drawTag(c, a);
          }
        }));
      } else actors.push(rec(a, (c) => a.draw(c)));
    }
    // HUD metadata for every enemy (boss bars, off-screen arrows)
    for (const e of W.enemies) {
      let s = actors.find((x) => x.n === e.nid);
      if (!s) {
        s = { n: e.nid, x: r1(e.x), y: r1(e.y), vx: 0, vy: 0, c: [] };
        actors.push(s);
      }
      const b = e as unknown as { title?: string; phase?: number; hpPhase?: boolean; phase2Color?: string; stage?: number };
      s.m = { r: e.r, col: e.color, boss: e.isBoss, dead: e.dead, hp: r1(e.hp), mhp: e.maxHp, po: r1(e.posture), mpo: e.maxPosture, stg: r1(e.staggered), title: b.title ?? '', ph: b.phase ?? 1, hpPh: b.hpPhase ?? true, p2: b.phase2Color ?? e.color, st: b.stage };
    }
    const floor = recorder();
    for (const e of W.enemies) if (e.isBoss && !e.dead) (e as { drawFloor?: (c: CanvasRenderingContext2D) => void }).drawFloor?.(floor.ctx);
    drawObstacles(floor.ctx);
    drawPathWorld(floor.ctx);
    const over = recorder();
    drawEliteMarks(over.ctx, W.enemies);
    recording = false;

    const strikes = W.strikes.filter((s) => !(s.delay > 0 ? s.hideTele : s.hideActive ?? s.team === 'player')).map((s) => [
      r1(s.x), r1(s.y), shapeArr(s), r3(s.delay), r3(s.tele), s.color, s.team === 'player' ? 1 : 0, s.unblockable ? 1 : 0, r3(s.active),
    ]);
    const projs = W.projs.map((b) => {
      const from = (b as { from?: Vec }).from;
      return [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), r1(b.r), b.kind, b.color, b.tag ?? '', b.parryable ? 1 : 0, b.team === 'player' ? 1 : 0, (b as { charged?: boolean }).charged ? 1 : 0, from ? r1(from.x) : null, from ? r1(from.y) : null, b.delay ? r3(b.delay) : 0];
    });
    const ev = this.events;
    this.events = [];
    return {
      k: 's', t: r3(W.time), ph: run.phase, paused: run.paused, ar: r1(W.arenaR), at: W.arenaTargetR, th: run.theme, ti: W.tint,
      pl: W.players.map((p) => {
        const o: Record<string, unknown> = { mods: p.mods };
        for (const f of P_FIELDS) o[f] = typeof p[f] === 'number' ? r3(p[f] as number) : p[f];
        return o;
      }),
      ex: W.players.map((p) => p.execTarget?.nid ?? null),
      a: actors, fl: floor.cmds, ov: over.cmds, st: strikes, pr: projs,
      sty: [style.points, style.rank, style.combo, r3(style.comboTimer), style.maxCombo, r3(style.bump)],
      sc: W.scale, du: W.duel, pvp: W.pvp, ev,
    };
  }
}
function shapeArr(s: Strike): (string | number)[] {
  const sh = s.shape;
  switch (sh.k) {
    case 'circle': return ['c', r1(sh.r)];
    case 'ring': return ['r', r1(sh.r), r1(sh.w)];
    case 'sector': return ['s', r1(sh.r), r3(sh.arc), r3(sh.angle)];
    case 'line': return ['l', r3(sh.angle), r1(sh.len), r1(sh.w)];
  }
}
function shapeFrom(a: (string | number)[]): Strike['shape'] {
  switch (a[0]) {
    case 'c': return { k: 'circle', r: a[1] as number };
    case 'r': return { k: 'ring', r: a[1] as number, w: a[2] as number };
    case 's': return { k: 'sector', r: a[1] as number, arc: a[2] as number, angle: a[3] as number };
    default: return { k: 'line', angle: a[1] as number, len: a[2] as number, w: a[3] as number };
  }
}

// ====================================================================== CLIENT
class ClientSession implements ClientLoop {
  st: LobbyState | null = null;
  private inMatch = false;
  private snap: Snap | null = null;
  private snapAt = 0;
  private myPid = 0;
  private mirrors: Player[] = [];
  private proxies = new Map<number, { x: number; y: number; nid: number }>();
  private ctl = new MergedControls();
  private packer = new InputPacker();
  private sendT = 0;
  private menuOpen: 'none' | 'wait' | 'ask' | 'end' | 'pause' = 'none';
  private strikes: Strike[] = [];
  private trails = new Map<string, number[]>();
  private clock = 0;
  private ended = false;

  constructor(public room: Room, _name: string) {
    this.room.to('host', { k: 'hello' });
    menus.showWaiting('เข้าห้องแล้ว — กำลังโหลด lobby…');
  }
  dispose() {
    if (session.client === this) session.client = null;
  }
  get showHud() {
    return this.inMatch && !!this.snap && this.snap.ph !== 'victory';
  }
  private lobby() {
    if (!this.st) return;
    this.inMatch = false;
    session.client = null;
    run.toTitle();
    const me = this.room.you;
    renderLobby(this.st, me, false, this.room.code, {
      seat: (p) => this.room.to('host', { k: 'seat', ...p }),
      leave: () => shutdown(),
    });
  }

  onEvent(e: RoomEvent) {
    if (e.t !== 'msg') return;
    const d = e.d;
    if (d.k === 'lobby') {
      this.st = d.st as LobbyState;
      if (!this.inMatch) this.lobby();
    } else if (d.k === 'start') {
      const ids = d.seats as string[];
      this.myPid = Math.max(0, ids.indexOf(this.room.you));
      this.inMatch = true;
      this.ended = false;
      this.snap = null;
      this.mirrors = [];
      this.proxies.clear();
      this.trails.clear();
      menus.hide();
      this.menuOpen = 'none';
      audio.init();
      W.reset();
      W.stats = { kills: 0, parries: 0, perfects: 0, maxCombo: 0, hitsTaken: 0, time: 0, bestRank: 0, executions: 0, skillUse: {} };
      run.phase = 'fight';
      session.client = this;
    } else if (d.k === 's') {
      this.applySnap(d as unknown as Snap);
    } else if (d.k === 'ask') {
      this.answer(d);
    } else if (d.k === 'end') {
      this.ended = true;
      this.menuOpen = 'end';
      menus.set(`<div class="panel end ${d.title === 'DEFEATED' ? 'lost' : 'won'}">
        <div class="logo small" data-text="${esc(String(d.title))}" style="text-shadow:0 0 14px ${d.color},0 0 40px ${d.color}">${esc(String(d.title))}</div>
        <div class="up-sub">${esc(String(d.sub))}</div>
        <div class="up-sub">รอ HOST เลือก REMATCH หรือกลับ lobby…</div>
        <button id="leave">LEAVE ROOM</button></div>`);
      menus.root.querySelector('#leave')!.addEventListener('click', () => shutdown());
    } else if (d.k === 'tolobby') {
      this.inMatch = false;
      session.client = null;
      if (this.st) this.lobby();
    }
  }

  /** host asks this player to choose (upgrade card / path / acknowledge an ascension) */
  private answer(d: Msg) {
    const reply = (v: unknown) => {
      this.room.to('host', { k: 'pick', req: d.req, v });
      this.menuOpen = 'wait';
      menus.showWaiting('รอผู้เล่นคนอื่น…');
    };
    this.menuOpen = 'ask';
    if (d.kind === 'upgrade') {
      const offers = (d.offers as string[]).map((id) => UPGRADES.find((u) => u.id === id)!).filter(Boolean);
      menus.showUpgrades(offers, d.done as number, d.total as number, (u) => reply(u.id));
    } else if (d.kind === 'path') {
      menus.showPathChoice(d.weapon as WeaponId, (p) => reply(p));
    } else if (d.kind === 'ascend') {
      menus.showAscension(d.info as Parameters<typeof menus.showAscension>[0], () => reply(true));
    }
  }

  private mirror(i: number): Player {
    let m = this.mirrors[i];
    if (!m) {
      m = new Player();
      this.mirrors[i] = m;
    }
    return m;
  }
  private proxy(nid: number) {
    let p = this.proxies.get(nid);
    if (!p) {
      p = { x: 0, y: 0, nid };
      this.proxies.set(nid, p);
    }
    return p;
  }

  private applySnap(s: Snap) {
    this.snap = s;
    this.snapAt = performance.now() / 1000;
    this.clock = s.t;
    W.time = s.t;
    W.arenaR = s.ar;
    W.arenaTargetR = s.at;
    W.tint = s.ti;
    W.scale = s.sc;
    W.duel = s.du;
    W.pvp = s.pvp;
    run.theme = s.th;
    // fighters (HUD mirrors)
    W.players = s.pl.map((o, i) => {
      const m = this.mirror(i);
      Object.assign(m, o);
      m.mods = o.mods as Player['mods'];
      if (i === this.myPid) m.ctl = this.ctl;
      else if (!(m.ctl instanceof RemoteControls)) m.ctl = new RemoteControls('peer' + i);
      return m;
    });
    W.player = W.players[this.myPid] ?? W.players[0];
    // enemies (HUD) + entity positions (effects that follow them)
    const enemies: Actor[] = [];
    for (const a of s.a) {
      const px = this.proxy(a.n);
      px.x = a.x;
      px.y = a.y;
      if (a.m) {
        const m = a.m;
        enemies.push({
          nid: a.n, x: a.x, y: a.y, r: m.r, color: m.col, isBoss: m.boss, dead: m.dead, hp: m.hp, maxHp: m.mhp, posture: m.po, maxPosture: m.mpo, staggered: m.stg,
          title: m.title, phase: m.ph, hpPhase: m.hpPh, phase2Color: m.p2, stage: m.st, rimColor: () => (m.ph === 2 ? m.p2 : m.col),
        } as unknown as Actor);
      }
    }
    W.enemies = enemies;
    s.ex.forEach((nid, i) => {
      const m = W.players[i];
      if (m) m.execTarget = nid === null ? null : (enemies.find((e) => e.nid === nid) ?? null);
    });
    // style meter
    [style.points, style.rank, style.combo, style.comboTimer, style.maxCombo, style.bump] = s.sty;
    // telegraphs
    this.strikes = s.st.map((r) => {
      const a = r as (number | string | (string | number)[])[];
      return { x: a[0], y: a[1], shape: shapeFrom(a[2] as (string | number)[]), delay: a[3], tele: a[4], color: a[5], team: a[6] ? 'player' : 'enemy', unblockable: !!a[7], active: a[8], parryable: true, hideTele: false, hideActive: false } as unknown as Strike;
    });
    W.strikes = this.strikes;
    // projectiles (trails rebuilt locally)
    const seen = new Set<string>();
    W.projs = s.pr.map((r, i) => {
      const a = r as (number | string | null)[];
      const key = `${a[5]}:${i}`;
      seen.add(key);
      const tr = this.trails.get(key) ?? [];
      tr.push(a[0] as number, a[1] as number);
      if (tr.length > 16) tr.splice(0, 2);
      this.trails.set(key, tr);
      const b = { x: a[0], y: a[1], vx: a[2], vy: a[3], r: a[4], kind: a[5], color: a[6], tag: a[7], parryable: !!a[8], team: a[9] ? 'player' : 'enemy', charged: !!a[10], from: a[11] !== null ? { x: a[11], y: a[12] } : undefined, delay: a[13], trail: tr, life: 1 };
      return b as unknown as Projectile;
    });
    for (const k of [...this.trails.keys()]) if (!seen.has(k)) this.trails.delete(k);
    // effects, sounds, HUD messages
    for (const e of s.ev) this.playEvent(e);
    // menus follow the host's phase
    if (!this.ended) {
      if (s.ph === 'upgrade' && this.menuOpen === 'none') {
        this.menuOpen = 'wait';
        menus.showWaiting('ผู้เล่นกำลังเลือกพลัง…');
      } else if (s.ph !== 'upgrade' && (this.menuOpen === 'wait' || this.menuOpen === 'ask')) {
        this.menuOpen = 'none';
        menus.hide();
      }
      if (s.paused && this.menuOpen === 'none') {
        this.menuOpen = 'pause';
        menus.showWaiting('HOST หยุดเกมชั่วคราว');
      } else if (!s.paused && this.menuOpen === 'pause') {
        this.menuOpen = 'none';
        menus.hide();
      }
    }
  }

  private resolve(v: unknown): unknown {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.nid === 'number' && Object.keys(o).length === 1) return this.proxy(o.nid);
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(o)) out[k] = k === 'follow' && x && typeof x === 'object' && typeof (x as { nid?: number }).nid === 'number' ? this.proxy((x as { nid: number }).nid) : x;
      return out;
    }
    return v;
  }
  private playEvent(e: unknown[]) {
    try {
      const [kind, m, ...args] = e as [string, string, ...unknown[]];
      if (kind === 'f') (fx as unknown as Record<string, (...a: unknown[]) => void>)[m](...args.map((a) => this.resolve(a)));
      else if (kind === 'h') (hud as unknown as Record<string, (...a: unknown[]) => void>)[m](...args);
      else if (kind === 'w') (W as unknown as Record<string, (...a: unknown[]) => void>)[m](...args);
      else if (kind === 'a') {
        if (m === 'sfx') sfx(args[0] as Sfx, args[1] as number);
        else audio.setMusic(args[0] as MusicMode, args[1] as number);
      }
    } catch { /* unknown event */ }
  }

  frame(realDt: number) {
    hud.update(realDt);
    fx.update(realDt);
    const s = this.snap;
    // local clock runs between snapshots so telegraphs and animations stay smooth
    this.clock += realDt;
    W.time = this.clock;
    for (const st of this.strikes) if (st.delay > 0) st.delay = Math.max(0, st.delay - realDt);
    for (const b of W.projs) {
      b.x += b.vx * realDt;
      b.y += b.vy * realDt;
    }
    // inputs → host
    this.ctl.update(this.clock);
    this.packer.sample(this.ctl);
    if (input.pressed('pause') && this.inMatch && !this.ended && this.menuOpen === 'none') this.leaveMenu();
    const me = W.player;
    const lag = Math.min(0.12, performance.now() / 1000 - this.snapAt);
    const meAt = me ? { x: me.x + me.vx * lag, y: me.y + me.vy * lag } : { x: 0, y: 0 };
    this.sendT += realDt;
    if (this.sendT >= 1 / 40 && this.menuOpen !== 'ask') {
      this.sendT = 0;
      this.room.to('host', { k: 'in', s: this.packer.pack(this.ctl, meAt) });
    }
    this.ctl.endFrame();
    input.endFrame();
    // camera on my fighter
    if (s && me) {
      const m = this.ctl.aim(meAt) ?? meAt;
      const lead = this.ctl.kind === 'pad' ? 0.12 : 0.22;
      cam.update(realDt, meAt.x, meAt.y, (m.x - meAt.x) * lead, (m.y - meAt.y) * lead);
    } else cam.update(realDt, 0, 0, 0, 0);
  }

  private leaveMenu() {
    this.menuOpen = 'pause';
    menus.set(`<div class="panel"><div class="up-title">MENU</div><div class="up-sub">ออนไลน์ — เกมไม่หยุดระหว่างเปิดเมนูนี้</div>
      <button class="big" id="resume">RESUME</button><div class="row"><button id="leave">LEAVE ROOM</button></div></div>`);
    menus.root.querySelector('#resume')!.addEventListener('click', () => {
      this.menuOpen = 'none';
      menus.hide();
    });
    menus.root.querySelector('#leave')!.addEventListener('click', () => shutdown());
  }

  drawWorld(ctx: CanvasRenderingContext2D) {
    const s = this.snap;
    if (!s) return;
    const lag = Math.min(0.12, performance.now() / 1000 - this.snapAt);
    replay(ctx, s.fl);
    fx.drawUnder(ctx);
    drawStrikes(ctx);
    for (const a of s.a) if (a.c.length) replay(ctx, a.c, a.vx * lag, a.vy * lag);
    replay(ctx, s.ov);
    drawProjectiles(ctx);
    fx.drawOver(ctx);
    fx.drawTexts(ctx);
  }
}
