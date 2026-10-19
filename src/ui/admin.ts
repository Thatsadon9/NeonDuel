/**
 * DEBUG / ADMIN MODE — hidden. Unlock it with any of:
 *   keyboard  ↑ ↑ ↓ ↓ ← → ← → B A        (Konami code, anywhere)
 *   touch     tap the NEON DUEL logo 7 times quickly (title screen)
 *   gamepad   hold SELECT + START for 2 seconds
 * Once unlocked: ` (backtick) / F10 or the ⚙ button opens the admin panel. Using any cheat marks the
 * run as "cheated": no leaderboard, no best records, no Echo Shards.
 */
import { W } from '../game/world';
import { run, type GameMode, type BossId } from '../game/run';
import { MergedControls } from '../core/controls';
import { connectedPads } from '../core/controls';
import { ALL_WEAPONS, WEAPONS, type WeaponId } from '../game/weapons';
import { TIER_REQ, formName, type Tier, type PathId } from '../game/ascension';
import { UPGRADES } from '../game/upgrades';
import { codex } from '../game/codex';
import { hud } from './hud';
import { fx } from '../render/fx';
import { sfx } from '../audio/audio';
import type { MinionKind } from '../game/minions';
import type { Theme } from '../game/run';
import { runBench } from './bench';

const KEY = 'neonduel.admin.v1';
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const BOSSES: BossId[] = ['vanguard', 'hex', 'twins', 'colossus', 'mirror', 'nyxara', 'tempus', 'voltaris', 'kagutsuchi', 'hollow'];
const MINIONS: MinionKind[] = ['rusher', 'gunner', 'shield', 'bomber', 'swarmling', 'wraith', 'lancer', 'acolyte', 'sentry', 'broodmother', 'brute', 'mirror_shard'];
const THEMES: [Theme, string][] = [['', 'Shattered Temple'], ['blight', 'Blight Garden'], ['clock', 'Clockwork Sanctum'], ['storm', 'Storm Spire'], ['shrine', 'Burning Shrine'], ['hollow', 'Hollow Throne']];

const load = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const store = (v: boolean) => {
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
};

class Admin {
  unlocked = load();
  private panel: HTMLDivElement | null = null;
  private fab: HTMLButtonElement | null = null;
  private keys: string[] = [];
  private taps: number[] = [];
  private padHold = 0;
  private path: PathId = 'a';
  private benchHtml = '';
  private open = false;

  init() {
    window.addEventListener('keydown', (e) => this.onKey(e));
    // touch / mouse: tap the logo 7 times within 3 seconds
    document.getElementById('ui')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.logo-img, .logo')) return;
      const now = performance.now();
      this.taps = [...this.taps.filter((x) => now - x < 3000), now];
      if (this.taps.length >= 7) this.unlock();
    });
    // gamepad: hold SELECT + START
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const held = connectedPads().some((g) => g.buttons[8]?.pressed && g.buttons[9]?.pressed);
      this.padHold = held ? this.padHold + dt : 0;
      if (this.padHold > 2) {
        this.padHold = -999;
        if (this.unlocked) this.toggle();
        else this.unlock();
      }
      if (!held && this.padHold < 0) this.padHold = 0;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    if (this.unlocked) this.showFab();
  }

  private onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    this.keys = [...this.keys, e.code].slice(-KONAMI.length);
    if (this.keys.join() === KONAMI.join()) {
      this.keys = [];
      this.unlock();
      return;
    }
    if (this.unlocked && (e.code === 'Backquote' || e.code === 'F10')) {
      e.preventDefault();
      this.toggle();
    }
  }

  unlock() {
    if (!this.unlocked) {
      this.unlocked = true;
      store(true);
      sfx('ult');
      hud.callout('DEBUG MODE UNLOCKED', '#6dff9e', 2, 40);
      this.showFab();
    }
    this.toggle(true);
  }
  lock() {
    this.unlocked = false;
    store(false);
    this.toggle(false);
    this.fab?.remove();
    this.fab = null;
    W.god = false;
    Object.assign(W.cheats, { oneHit: false, infFocus: false, infDash: false, freeze: false, timeScale: 1 });
    W.debug = false;
    hud.callout('DEBUG MODE LOCKED', '#8a93b8', 1.4, 30);
  }

  private showFab() {
    if (this.fab) return;
    const b = document.createElement('button');
    b.id = 'admin-fab';
    b.textContent = '⚙';
    b.title = 'Admin (` / F10)';
    b.addEventListener('click', () => this.toggle());
    document.body.appendChild(b);
    this.fab = b;
  }

  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    if (!this.open) {
      this.panel?.remove();
      this.panel = null;
      return;
    }
    if (!this.panel) {
      this.panel = document.createElement('div');
      this.panel.id = 'admin';
      document.body.appendChild(this.panel);
      // keep game keys / touches from leaking through the panel
      for (const ev of ['keydown', 'mousedown', 'touchstart', 'pointerdown', 'wheel']) this.panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    }
    this.render();
  }

  /** mark the current run as cheated (and say so once) */
  private taint() {
    if (!W.cheated && run.phase !== 'title') hud.callout('CHEATED RUN — ไม่บันทึกสถิติ', '#ff9a3c', 1.4, 22);
    W.cheated = true;
  }

  private render() {
    const p = this.panel;
    if (!p) return;
    const pl = W.player;
    const playing = run.phase !== 'title' && !!pl;
    const cur = playing ? pl.weapons[pl.wi] : 'katana';
    const pr = playing ? pl.cur : null;
    const c = W.cheats;
    const tog = (id: string, on: boolean, label: string) => `<button class="adm-t ${on ? 'on' : ''}" data-t="${id}">${on ? '●' : '○'} ${label}</button>`;
    const opt = <T extends string>(list: T[], sel?: T, fmt: (v: T) => string = (v) => v) => list.map((v) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${fmt(v)}</option>`).join('');
    const online = run.cfg.online;
    p.innerHTML = `
      <div class="adm-head"><b>⚙ ADMIN / DEBUG</b><button data-a="close">✕</button></div>
      <div class="adm-status">${run.phase === 'title' ? 'ยังไม่ได้เริ่มเกม' : `${run.mode.toUpperCase()} · ${run.mode === 'endless' ? 'ROUND ' + run.round : run.mode === 'duel' ? 'ROUND ' + run.duelRound : 'STAGE ' + (run.stage - run.actStart + 1)} · ${run.phase}`}
        ${W.cheated || W.god ? '<span class="adm-warn">CHEATED — ไม่บันทึก</span>' : ''}${online ? '<span class="adm-warn">ONLINE: ใช้ได้เฉพาะเครื่อง HOST</span>' : ''}</div>

      <div class="adm-sec">PLAYER</div>
      <div class="adm-grid">
        ${tog('god', W.god, 'God Mode')}${tog('oneHit', c.oneHit, '1 Hit Kill')}
        ${tog('infFocus', c.infFocus, 'Infinite Focus')}${tog('infDash', c.infDash, 'Infinite Dash')}
        ${tog('freeze', c.freeze, 'Freeze Enemies')}${tog('hitbox', W.debug, 'Show Hitboxes')}
      </div>
      <div class="adm-row">TIME
        ${[0.25, 0.5, 1, 2].map((v) => `<button class="adm-t ${c.timeScale === v ? 'on' : ''}" data-ts="${v}">×${v}</button>`).join('')}
      </div>
      <div class="adm-row"><button data-a="heal" ${playing ? '' : 'disabled'}>Heal Full</button><button data-a="kill" ${playing ? '' : 'disabled'}>Kill All / Next</button></div>

      <div class="adm-sec">JUMP TO STAGE</div>
      <div class="adm-row">
        <select id="adm-mode">${opt(['campaign', 'act2', 'endless'] as GameMode[], run.mode === 'duel' ? 'campaign' : run.mode, (m) => (m === 'campaign' ? 'ACT I' : m === 'act2' ? 'ACT II' : 'ENDLESS'))}</select>
        <input id="adm-stage" type="number" min="1" max="999" value="${run.mode === 'endless' ? Math.max(1, run.round) : Math.min(10, (run.stage % 10) + 1)}" title="ด่าน 1–10 (Endless = รอบ)">
        <select id="adm-w">${opt(ALL_WEAPONS, cur, (w) => WEAPONS[w].name)}</select>
        <button data-a="jump">GO</button>
      </div>

      <div class="adm-sec">WEAPON · ${playing && pr ? `${formName(cur, pr)} T${pr.tier}` : '—'}</div>
      <div class="adm-row">
        <button data-a="lvl" ${playing ? '' : 'disabled'}>Instant Level Up</button>
        <button data-a="max" ${playing ? '' : 'disabled'}>Max (T4)</button>
        <button class="adm-t ${this.path === 'a' ? 'on' : ''}" data-path="a">สาย A</button><button class="adm-t ${this.path === 'b' ? 'on' : ''}" data-path="b">สาย B</button>
      </div>
      <div class="adm-row">
        <button data-a="res" ${playing ? '' : 'disabled'}>+500 Resonance</button><button data-a="core" ${playing ? '' : 'disabled'}>+1 Rift Core</button>
        <select id="adm-addw">${opt(ALL_WEAPONS, undefined, (w) => WEAPONS[w].name)}</select><button data-a="addw" ${playing ? '' : 'disabled'}>Give Weapon</button>
      </div>
      <div class="adm-row">
        <select id="adm-up">${UPGRADES.map((u) => `<option value="${u.id}">${u.name} (${u.rarity})</option>`).join('')}</select>
        <button data-a="up" ${playing ? '' : 'disabled'}>Give Upgrade</button>
      </div>

      <div class="adm-sec">SPAWN</div>
      <div class="adm-row">
        <select id="adm-min">${opt(MINIONS)}</select>
        <input id="adm-n" type="number" min="1" max="20" value="3">
        <label class="adm-chk"><input type="checkbox" id="adm-elite"> Elite</label>
        <button data-a="spawn" ${playing ? '' : 'disabled'}>Spawn</button>
      </div>
      <div class="adm-row">
        <select id="adm-boss">${opt(BOSSES)}</select><button data-a="boss" ${playing ? '' : 'disabled'}>Spawn Boss</button>
        <select id="adm-theme">${THEMES.map(([v, n]) => `<option value="${v}" ${run.theme === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </div>

      <div class="adm-sec">BALANCE BENCH</div>
      <div class="adm-row">
        <select id="adm-bw">${opt(ALL_WEAPONS, cur, (w) => WEAPONS[w].name)}</select>
        <select id="adm-bt">${['0', '1', '2', '3', '4'].map((t) => `<option value="${t}" ${t === '3' ? 'selected' : ''}>T${t}</option>`).join('')}</select>
        <button data-a="bench">Run (10 bosses)</button>
      </div>
      <div id="adm-bench" class="adm-bench">${this.benchHtml}</div>

      <div class="adm-sec">ECHO CODEX · ${codex.data.shards} ◆</div>
      <div class="adm-row">
        <button data-a="unlockall">Unlock All Weapons / Paths / Skins / Act II</button>
      </div>
      <div class="adm-row"><button data-a="shards">+1000 Shards</button><button data-a="reset" class="danger">Reset Codex</button></div>

      <div class="adm-row adm-foot"><button data-a="lock" class="danger">Lock Debug Mode</button><small>เปิด/ปิด: <kbd>\`</kbd> หรือ <kbd>F10</kbd></small></div>`;

    const $ = <T extends HTMLElement>(id: string) => p.querySelector('#' + id) as T;
    p.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => el.addEventListener('click', () => {
      const t = el.dataset.t!;
      if (t === 'god') W.god = !W.god;
      else if (t === 'hitbox') W.debug = !W.debug;
      else {
        const k = t as 'oneHit' | 'infFocus' | 'infDash' | 'freeze';
        W.cheats[k] = !W.cheats[k];
      }
      if (t !== 'hitbox') this.taint();
      sfx('ui');
      this.render();
    }));
    p.querySelectorAll<HTMLElement>('[data-ts]').forEach((el) => el.addEventListener('click', () => {
      W.cheats.timeScale = Number(el.dataset.ts);
      if (W.cheats.timeScale !== 1) this.taint();
      this.render();
    }));
    p.querySelectorAll<HTMLElement>('[data-path]').forEach((el) => el.addEventListener('click', () => {
      this.path = el.dataset.path as PathId;
      this.render();
    }));
    $('adm-theme').addEventListener('change', () => {
      run.theme = ($('adm-theme') as HTMLSelectElement).value as Theme;
    });
    p.querySelectorAll<HTMLElement>('[data-a]').forEach((el) => el.addEventListener('click', () => this.act(el.dataset.a!, $)));
  }

  private act(a: string, $: <T extends HTMLElement>(id: string) => T) {
    const p = W.player;
    const val = (id: string) => ($(id) as HTMLInputElement | HTMLSelectElement).value;
    switch (a) {
      case 'close': return this.toggle(false);
      case 'lock': return this.lock();
      case 'heal':
        for (const q of W.players) {
          q.dead = false;
          if (q.state === 'dead') q.state = 'free';
          q.hp = q.maxHp;
          q.stamina = q.mods.staminaMax;
        }
        this.taint();
        break;
      case 'kill':
        run.debugKillAll();
        break;
      case 'jump': {
        const mode = val('adm-mode') as GameMode;
        const n = Math.max(1, Math.floor(Number(val('adm-stage')) || 1));
        const at = mode === 'endless' ? n - 1 : mode === 'act2' ? 10 + Math.min(10, n) - 1 : Math.min(10, n) - 1;
        // a single-slot match config also bypasses the codex weapon lock
        run.start(val('adm-w') as WeaponId, W.hardMode, at, mode, { slots: [{ ctl: new MergedControls(), weapon: val('adm-w') as WeaponId }] });
        W.cheated = true;
        run.ranked = false;
        break;
      }
      case 'lvl':
      case 'max': {
        const id = p.weapons[p.wi], pr = p.prog[id];
        if (pr.tier >= 4 && pr.path === this.path) break;
        const t = (a === 'max' ? 4 : Math.min(4, pr.tier + 1)) as Tier;
        pr.tier = t;
        pr.res = Math.max(pr.res, TIER_REQ[t]);
        if (t >= 3) pr.path = this.path; // the A/B picker decides the path
        fx.anim('vfx_ascend_burst', p.x, p.y, { w: 260, dur: 1.2 });
        fx.ring(p.x, p.y, 10, 200, 0.6, p.weaponColor(), 8, true);
        hud.callout(`${formName(id, pr)} · T${t}`, p.weaponColor(), 1.4, 34);
        sfx('ult');
        this.taint();
        break;
      }
      case 'res':
        p.addRes(500);
        this.taint();
        break;
      case 'core':
        p.cores++;
        p.addRes(0.001);
        this.taint();
        break;
      case 'addw': {
        const w = val('adm-addw') as WeaponId;
        if (!p.weapons.includes(w)) {
          if (p.weapons.length >= 3) p.weapons.pop();
          p.unlockWeapon(w);
          this.taint();
        }
        break;
      }
      case 'up': {
        const u = UPGRADES.find((x) => x.id === val('adm-up'));
        if (u) {
          u.apply(p);
          hud.callout(u.name, '#6dff9e', 1, 28);
          this.taint();
        }
        break;
      }
      case 'spawn':
        run.debugSpawnMinion(val('adm-min') as MinionKind, Math.min(20, Math.max(1, Number(val('adm-n')) || 1)), ($('adm-elite') as HTMLInputElement).checked);
        break;
      case 'boss':
        run.debugSpawnBoss(val('adm-boss') as BossId);
        break;
      case 'unlockall':
        codex.debugUnlockAll();
        hud.callout('ALL UNLOCKED', '#ffe14d', 1.4, 30);
        if (run.phase === 'title') run.toTitle();
        break;
      case 'shards':
        codex.addShards(1000);
        if (run.phase === 'title') run.toTitle();
        break;
      case 'bench': {
        const w = val('adm-bw') as WeaponId, t = Number(val('adm-bt')) as Tier;
        const head = `<div class="adm-bh">${WEAPONS[w].name} T${t}${t >= 3 ? ' สาย ' + this.path.toUpperCase() : ''} — บอทไม่หลบ/ไม่ Parry</div>`;
        this.benchHtml = head + '<div>กำลังรัน…</div>';
        this.render();
        const lines: string[] = [];
        void runBench({
          weapon: w, tier: t, path: this.path,
          onRow: (r) => {
            lines.push(`<tr><td>${r.boss}</td><td class="${r.killed ? '' : 'bad'}">${r.killed ? r.secs + 's' : '>' + r.secs + 's'}</td><td>${r.taken}</td><td>${r.casts}</td><td>${r.perfects}</td></tr>`);
            this.benchHtml = head + `<table><tr><th>BOSS</th><th>TTK</th><th>DMG IN</th><th>SKILLS</th><th>PERF</th></tr>${lines.join('')}</table>`;
            const el = this.panel?.querySelector('#adm-bench');
            if (el) el.innerHTML = this.benchHtml;
          },
        });
        return;
      }
      case 'reset':
        if (!confirm('รีเซ็ต Echo Codex ทั้งหมด (อาวุธ, สาย B, สกิน, Shards, Lore)?')) return;
        codex.debugReset();
        if (run.phase === 'title') run.toTitle();
        break;
    }
    sfx('uiConfirm', 0.6);
    this.render();
  }
}

export const admin = new Admin();
