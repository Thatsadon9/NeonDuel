/**
 * Multiplayer front end: LOCAL lobby (couch, up to 4 — keyboard/mouse + gamepads) and the ONLINE lobby
 * (rooms over WebSocket, see src/net/mp.ts). Modes: co-op PVE (Act I / Act II / Endless) or PVP duel.
 */
import { sfx, audio } from '../audio/audio';
import { menus } from './menus';
import { padnav } from './padnav';
import { sprites } from '../render/sprites';
import { KbmControls, PadControls, connectedPads, type Controls } from '../core/controls';
import { touch } from '../core/touch';
import { WEAPONS, ALL_WEAPONS, type WeaponId } from '../game/weapons';
import { FAMILIES, type PathId } from '../game/ascension';
import { codex } from '../game/codex';
import { PLAYER_COLORS } from '../game/player';
import type { GameMode, MatchCfg } from '../game/run';

export type LobbyMode = 'campaign' | 'act2' | 'endless' | 'duel';
export const MODE_LABEL: Record<LobbyMode, string> = { campaign: 'ACT I', act2: 'ACT II', endless: 'ENDLESS', duel: 'PVP DUEL' };
export const MODE_DESC: Record<LobbyMode, string> = {
  campaign: 'CO-OP · ACT I — 10 ด่าน บอส 5 ตัว · บอส HP เพิ่มตามจำนวนคน · ล้มแล้วเพื่อนชุบได้',
  act2: 'CO-OP · ACT II — เริ่ม T2 · บอสใหม่ 5 ตัว จบที่ Hollow King',
  endless: 'CO-OP · ENDLESS — สู้ไปเรื่อย ๆ ด้วยกัน รอบละยากขึ้น',
  duel: 'PVP · ดวลเป็นยก — ทุกคนใช้อาวุธร่าง MYTHIC (T4) ตามสายที่เลือก · ยกเกิน 45 วิ สนามหด',
};

export interface Seat {
  ctl: Controls;
  device: string;
  weapon: WeaponId;
  path: PathId;
  ready: boolean;
  squad: number;
}

export interface LobbyHandlers {
  start(mode: GameMode, hard: boolean, cfg: MatchCfg): void;
  back(): void;
  online(): void;
}

/** weapons a seat may use in this mode (PVP: every weapon; co-op: what this device has unlocked) */
export function weaponsFor(mode: LobbyMode): WeaponId[] {
  return mode === 'duel' ? ALL_WEAPONS : ALL_WEAPONS.filter((w) => codex.hasWeapon(w));
}
export function cycle<T>(list: T[], cur: T, d: number): T {
  const i = list.indexOf(cur);
  return list[(i + d + list.length) % list.length];
}

/** first screen: LOCAL or ONLINE */
export function showMultiplayer(h: LobbyHandlers) {
  menus.set(`
    <div class="panel mp-menu">
      <div class="up-title">MULTIPLAYER</div>
      <div class="up-sub">สูงสุด 4 คน · CO-OP PVE หรือ PVP DUEL</div>
      <div class="mp-choices">
        <div class="card mp-choice" id="mp-local" style="--c:#7ff6ff"><b>LOCAL</b><span>เล่นจอเดียวกัน · คีย์บอร์ด+เมาส์ และจอยเกม (สูงสุด 4)</span></div>
        <div class="card mp-choice" id="mp-online" style="--c:#ff4d8a"><b>ONLINE</b><span>สร้างห้อง / ใส่รหัสห้อง · เล่นข้ามเครื่อง</span></div>
      </div>
      <button id="back">BACK</button>
    </div>`);
  menus.root.querySelector('#mp-local')!.addEventListener('click', () => {
    sfx('uiConfirm');
    showLocalLobby(h);
  });
  menus.root.querySelector('#mp-online')!.addEventListener('click', () => {
    sfx('uiConfirm');
    h.online();
  });
  menus.root.querySelector('#back')!.addEventListener('click', h.back);
  menus.onKey((e) => {
    if (e.code === 'Escape') h.back();
  });
}

// ---------------------------------------------------------------- LOCAL lobby
export function showLocalLobby(h: LobbyHandlers) {
  let mode: LobbyMode = 'campaign';
  let hard = false;
  let bestOf = 3;
  let teams = false;
  const seats: Seat[] = [];
  let alive = true;
  padnav.suspended = true;
  const prevPad = new Map<number, Set<number>>();
  const kbSeat = () => seats.find((s) => s.device === 'kbm');
  const padSeat = (i: number) => seats.find((s) => s.ctl instanceof PadControls && s.ctl.index === i);

  const close = () => {
    alive = false;
    padnav.suspended = false;
  };
  const join = (ctl: Controls, device: string) => {
    if (seats.length >= 4) return;
    const ws = weaponsFor(mode);
    seats.push({ ctl, device, weapon: ws[seats.length % ws.length], path: 'a', ready: false, squad: seats.length });
    sfx('uiConfirm');
    render();
  };
  const leave = (s: Seat) => {
    seats.splice(seats.indexOf(s), 1);
    sfx('ui');
    render();
  };
  const fixSeats = () => {
    const ws = weaponsFor(mode);
    for (const [i, s] of seats.entries()) {
      if (!ws.includes(s.weapon)) s.weapon = ws[0];
      s.squad = mode === 'duel' && teams && seats.length === 4 ? i % 2 : i;
    }
  };
  const tryStart = () => {
    fixSeats();
    const need = mode === 'duel' ? 2 : 1;
    if (seats.length < need || !seats.every((s) => s.ready)) return;
    close();
    audio.init();
    sfx('uiConfirm');
    const cfg: MatchCfg = {
      slots: seats.map((s, i) => ({ ctl: s.ctl, weapon: s.weapon, tag: 'P' + (i + 1), squad: s.squad, path: s.path })),
      winsNeeded: Math.ceil(bestOf / 2),
    };
    h.start(mode, hard, cfg);
  };
  const act = (s: Seat, a: 'left' | 'right' | 'up' | 'down' | 'ready' | 'back') => {
    if (a === 'back') {
      if (s.ready) s.ready = false;
      else leave(s);
      render();
      return;
    }
    if (a === 'ready') {
      s.ready = !s.ready;
      sfx(s.ready ? 'uiConfirm' : 'ui');
      render();
      tryStart();
      return;
    }
    if (s.ready) return;
    if (a === 'left' || a === 'right') s.weapon = cycle(weaponsFor(mode), s.weapon, a === 'left' ? -1 : 1);
    else if (mode === 'duel' || codex.hasPathB(s.weapon)) s.path = s.path === 'a' ? 'b' : 'a';
    sfx('ui', 0.6);
    render();
  };

  const seatCard = (i: number) => {
    const s = seats[i];
    const col = PLAYER_COLORS[i];
    if (!s) {
      return `<div class="seat empty" style="--c:${col}"><div class="seat-tag">P${i + 1}</div>
        <div class="seat-join">กด <kbd>A</kbd> บนจอย<br>หรือ <kbd>ENTER</kbd> บนคีย์บอร์ด<br>เพื่อเข้าร่วม</div>
        ${seats.some((x) => x.device === 'touch') ? '' : '<button class="seat-touch">แตะเพื่อเข้าร่วม (จอสัมผัส)</button>'}</div>`;
    }
    const w = WEAPONS[s.weapon], fam = FAMILIES[s.weapon];
    const art = sprites.url('art_weapon_' + s.weapon) ?? sprites.url(`icon_weapon_${s.weapon}_t2`);
    const pathInfo = fam[s.path];
    const team = mode === 'duel' && teams && seats.length === 4 ? `<div class="seat-team">TEAM ${s.squad === 0 ? 'A' : 'B'}</div>` : '';
    return `<div class="seat ${s.ready ? 'ready' : ''}" style="--c:${col};--w:${w.color}" data-i="${i}">
      <div class="seat-tag">P${i + 1} <small>${s.device === 'kbm' ? 'KEYBOARD + MOUSE' : s.device === 'touch' ? 'TOUCH' : 'GAMEPAD ' + ((s.ctl as PadControls).index + 1)}</small></div>
      ${team}
      <div class="seat-weapon">
        <button class="arrow" data-a="left">◀</button>
        <div>${art ? `<img src="${art}" alt="">` : ''}<b>${w.name}</b><small>${w.thai}</small></div>
        <button class="arrow" data-a="right">▶</button>
      </div>
      <button class="seat-path" data-a="up" style="--p:${pathInfo.color}">สาย ${pathInfo.name}${mode === 'duel' ? ' · T4 ' + pathInfo.mythic : codex.hasPathB(s.weapon) ? '' : ' 🔒B'}</button>
      <button class="seat-ready" data-a="ready">${s.ready ? '✓ READY' : 'READY?'}</button>
    </div>`;
  };

  const render = () => {
    if (!alive) return;
    fixSeats();
    const need = mode === 'duel' ? 2 : 1;
    const allReady = seats.length >= need && seats.every((s) => s.ready);
    menus.set(`
      <div class="lobby">
        <div class="up-title">LOCAL MULTIPLAYER</div>
        <div class="row">
          ${(Object.keys(MODE_LABEL) as LobbyMode[]).map((m) => {
            const lock = m === 'act2' && !codex.data.act1Cleared;
            return `<button class="toggle ${mode === m ? 'on' : ''} ${lock ? 'locked' : ''}" data-mode="${m}">${MODE_LABEL[m]}${lock ? ' 🔒' : ''}</button>`;
          }).join('')}
          <span class="sep"></span>
          ${mode === 'duel'
            ? `<button class="toggle ${bestOf === 3 ? 'on' : ''}" data-bo="3">BEST OF 3</button><button class="toggle ${bestOf === 5 ? 'on' : ''}" data-bo="5">BEST OF 5</button>
               ${seats.length === 4 ? `<button class="toggle ${teams ? 'on' : ''}" id="teams">${teams ? 'TEAMS 2v2' : 'FREE FOR ALL'}</button>` : ''}`
            : `<button class="toggle ${!hard ? 'on' : ''}" data-hard="0">NORMAL</button><button class="toggle ${hard ? 'on hard' : ''}" data-hard="1">HARD</button>`}
        </div>
        <div class="mode-desc">${MODE_DESC[mode]}</div>
        <div class="seats">${[0, 1, 2, 3].map(seatCard).join('')}</div>
        <div class="lobby-help">
          <span><kbd>◀ ▶</kbd> อาวุธ</span><span><kbd>▲ ▼</kbd> สาย</span><span><kbd>A</kbd>/<kbd>Enter</kbd> พร้อม</span><span><kbd>B</kbd>/<kbd>Esc</kbd> ยกเลิก/ออก</span><span><kbd>LB RB</kbd> เปลี่ยนโหมด</span>
        </div>
        <div class="lobby-status">${seats.length < need ? `ต้องมีผู้เล่นอย่างน้อย ${need} คน` : allReady ? 'กำลังเริ่ม…' : 'รอทุกคนกด READY'}</div>
        <button id="back">BACK</button>
      </div>`);
    const root = menus.root;
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) => el.addEventListener('click', () => setMode(el.dataset.mode as LobbyMode)));
    root.querySelectorAll<HTMLElement>('[data-bo]').forEach((el) => el.addEventListener('click', () => {
      bestOf = Number(el.dataset.bo);
      render();
    }));
    root.querySelectorAll<HTMLElement>('[data-hard]').forEach((el) => el.addEventListener('click', () => {
      hard = el.dataset.hard === '1';
      render();
    }));
    root.querySelector('#teams')?.addEventListener('click', () => {
      teams = !teams;
      render();
    });
    root.querySelectorAll<HTMLElement>('.seat[data-i] [data-a]').forEach((el) => el.addEventListener('click', () => {
      const seat = seats[Number(el.closest<HTMLElement>('.seat')!.dataset.i)];
      if (seat) act(seat, el.dataset.a as 'left');
    }));
    root.querySelector('#back')!.addEventListener('click', () => {
      close();
      h.back();
    });
    root.querySelectorAll('.seat-touch').forEach((el) => el.addEventListener('click', () => join(touch, 'touch')));
  };
  const setMode = (m: LobbyMode) => {
    if (m === 'act2' && !codex.data.act1Cleared) return sfx('ui', 0.5);
    mode = m;
    for (const s of seats) s.ready = false;
    sfx('ui');
    render();
  };

  // keyboard seat
  menus.onKey((e) => {
    const s = kbSeat();
    if (!s) {
      if (e.code === 'Enter' || e.code === 'Space') join(new KbmControls(), 'kbm');
      else if (e.code === 'Escape') {
        if (seats.length === 0) {
          close();
          h.back();
        }
      }
      return;
    }
    const map: Record<string, 'left' | 'right' | 'up' | 'down' | 'ready' | 'back'> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Enter: 'ready', Space: 'ready', Escape: 'back',
    };
    const a = map[e.code];
    if (a) act(s, a);
  });

  // gamepads (own loop: padnav is suspended here)
  const loop = () => {
    if (!alive) return;
    for (const g of connectedPads()) {
      const prev = prevPad.get(g.index) ?? new Set<number>();
      const now = new Set<number>();
      g.buttons.forEach((b, i) => b.pressed && now.add(i));
      const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0;
      if (ax < -0.6) now.add(100);
      if (ax > 0.6) now.add(101);
      if (ay < -0.6) now.add(102);
      if (ay > 0.6) now.add(103);
      const hit = (i: number) => now.has(i) && !prev.has(i);
      const s = padSeat(g.index);
      if (!s) {
        if (hit(0) || hit(9)) join(new PadControls(g.index), 'pad');
        else if (hit(1) && seats.length === 0) {
          close();
          h.back();
          return;
        }
      } else {
        if (hit(14) || hit(100)) act(s, 'left');
        if (hit(15) || hit(101)) act(s, 'right');
        if (hit(12) || hit(102) || hit(13) || hit(103)) act(s, 'up');
        if (hit(0) || hit(9)) act(s, 'ready');
        if (hit(1)) act(s, 'back');
        if (hit(4)) setMode(cycle(Object.keys(MODE_LABEL) as LobbyMode[], mode, -1));
        if (hit(5)) setMode(cycle(Object.keys(MODE_LABEL) as LobbyMode[], mode, 1));
      }
      prevPad.set(g.index, now);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  render();
}
