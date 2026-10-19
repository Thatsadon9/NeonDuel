/** DOM overlay menus: title + weapon select, upgrade cards, pause/settings, end screen. */
import { audio, sfx } from '../audio/audio';
import { WEAPONS, ALL_WEAPONS, type WeaponId } from '../game/weapons';
import { FAMILIES, TIER_NAMES, TIER_THAI, TIER_UNLOCKS, type PathId } from '../game/ascension';
import { codex, PRICES, SKINS } from '../game/codex';
import { isTouchDevice } from './safe';
import type { Upgrade } from '../game/upgrades';
import type { RunStats } from '../game/world';
import { RANKS, RANK_COLORS } from '../game/style';
import type { SaveData, GameMode } from '../game/run';
import { sprites } from '../render/sprites';
import { fetchLeaderboard, submitRun, savedName, saveName, type LbEntry } from '../net/leaderboard';

export interface Settings { volume: number; music: number; shake: boolean; bloom: boolean }
const SET_KEY = 'neonduel.settings.v1';

function loadSettings(): Settings {
  // phones / tablets start with the lighter renderer (no bloom) — it can be switched on in the pause menu
  const d: Settings = { volume: 0.8, music: 0.55, shake: true, bloom: !isTouchDevice() };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') };
  } catch {
    return d;
  }
}

const RARITY_COL: Record<string, string> = { common: '#8fb8ff', rare: '#6dff9e', epic: '#c49bff', legendary: '#ffe14d' };
const WSTATS: Record<WeaponId, [number, number, number]> = { katana: [3, 3, 3], daggers: [5, 2, 4], hammer: [1, 5, 4], scythe: [2, 3, 3], gauntlets: [5, 2, 2], bow: [3, 4, 2] };

/** fullscreen (Android Chrome, iPad Safari, desktop) — hidden where unsupported (iPhone: use Add to Home Screen) */
const fsEl = () => document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
const fsOn = () => !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
function fsButton() {
  const el = fsEl();
  if (!el.requestFullscreen && !el.webkitRequestFullscreen) return '';
  return `<button class="toggle ${fsOn() ? 'on' : ''}" id="fullscreen">FULLSCREEN</button>`;
}
function bindFullscreen(root: HTMLElement) {
  root.querySelector('#fullscreen')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLElement;
    if (fsOn()) {
      void document.exitFullscreen?.();
      btn.classList.remove('on');
    } else {
      const el = fsEl();
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : (el.webkitRequestFullscreen?.(), undefined);
      p?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {})).catch(() => {});
      btn.classList.add('on');
    }
  });
}

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

class Menus {
  root!: HTMLDivElement;
  settings = loadSettings();
  onSettings: (s: Settings) => void = () => {};
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  /** opens the multiplayer screens (wired up in main.ts) */
  onMultiplayer: (() => void) | null = null;
  /** multiplayer: whose choice the current screen is (shown as a coloured chip) */
  who: { tag: string; color: string } | null = null;

  init() {
    this.root = document.getElementById('ui') as HTMLDivElement;
    this.onSettings(this.settings);
  }

  set(html: string) {
    this.root.innerHTML = (this.who ? `<div class="who-chip" style="--c:${this.who.color}">${this.who.tag} · เลือก</div>` : '') + html;
    this.root.classList.add('show');
    this.root.querySelectorAll('button, .card').forEach((b) => b.addEventListener('mouseenter', () => sfx('ui', 0.4)));
  }
  onKey(fn: ((e: KeyboardEvent) => void) | null) {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = fn;
    if (fn) window.addEventListener('keydown', fn);
  }
  hide() {
    this.who = null;
    this.root.classList.remove('show');
    this.root.innerHTML = '';
    this.onKey(null);
  }
  private saveSettings() {
    try {
      localStorage.setItem(SET_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
    this.onSettings(this.settings);
  }

  // ------------------------------------------------------------------ title
  private titleMode: GameMode = 'campaign';
  private titleToken = 0;
  showTitle(save: SaveData, onStart: (w: WeaponId, hard: boolean, mode: GameMode) => void) {
    let weapon: WeaponId = 'katana';
    let hard = false;
    const ids: WeaponId[] = ALL_WEAPONS;
    if (!codex.hasWeapon(weapon)) weapon = 'katana';
    const card = (id: WeaponId) => {
      const w = WEAPONS[id];
      const [spd, pow, pos] = WSTATS[id];
      const pip = (n: number) => '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(5 - n);
      const fam = FAMILIES[id];
      const owned = codex.hasWeapon(id);
      const art = sprites.url('art_weapon_' + id) ?? sprites.url(`art_path_${id}_a`);
      return `<div class="card wcard ${id === weapon ? 'sel' : ''} ${owned ? '' : 'locked'}" data-w="${id}" style="--c:${w.color}">
        ${art ? `<img class="wart" src="${art}" alt="">` : ''}
        <div class="wname">${w.name}</div><div class="wthai">${w.thai} · เริ่มที่ T0 “${fam.forms.t0.name}”</div>
        <div class="wdesc">${w.desc}</div>
        <div class="wstat"><span>SPEED</span><b>${pip(spd)}</b></div>
        <div class="wstat"><span>POWER</span><b>${pip(pow)}</b></div>
        <div class="wstat"><span>CONTROL</span><b>${pip(pos)}</b></div>
        <div class="wskills"><em>A</em> ${fam.a.name} → ${fam.a.mythic}<br><em>B</em> ${fam.b.name} → ${fam.b.mythic}${codex.hasPathB(id) ? '' : ' 🔒'}</div>
        ${owned ? '' : `<div class="wlock">🔒 ${PRICES.weapon[id]} ECHO SHARDS — ปลดใน ECHO CODEX</div>`}
      </div>`;
    };
    const render = () => {
      this.set(`
      <div class="title-wrap">
        ${sprites.url('ui_logo') ? `<img class="logo-img" src="${sprites.url('ui_logo')}" alt="NEON DUEL">` : '<div class="logo" data-text="NEON DUEL">NEON DUEL</div>'}
        <div class="tagline">ARENA OF ECHOES · สนามประลองแห่งเงาสะท้อน</div>
        <div class="section-label">เลือกอาวุธเริ่มต้น</div>
        <div class="wcards">${ids.map(card).join('')}</div>
        <div class="row">
          <button class="toggle ${this.titleMode === 'campaign' ? 'on' : ''}" data-mode="campaign">CAMPAIGN</button>
          <button class="toggle ${this.titleMode === 'act2' ? 'on act2' : ''} ${codex.data.act1Cleared ? '' : 'locked'}" data-mode="act2">ACT II${codex.data.act1Cleared ? '' : ' 🔒'}</button>
          <button class="toggle ${this.titleMode === 'endless' ? 'on endless' : ''}" data-mode="endless">ENDLESS</button>
          <span class="sep"></span>
          <button class="toggle ${!hard ? 'on' : ''}" data-diff="0">NORMAL</button>
          <button class="toggle ${hard ? 'on hard' : ''}" data-diff="1">HARD</button>
        </div>
        <div class="mode-desc">${this.titleMode === 'endless'
          ? 'ENDLESS — ศัตรูแกร่งขึ้นทุกรอบ · บอสทุก 5 รอบ · GAUNTLET ทุก 10 · RIFT SENTINEL รอบลงท้าย 7 · HOLLOW KING ทุก 25 · Elite ตั้งแต่รอบ 10'
          : this.titleMode === 'act2' ? 'ACT II — THE RIFT · 10 ด่าน บอสใหม่ 5 ตัว · เริ่มที่อาวุธ T2 + การ์ด rare 2 ใบ · จบที่ THE HOLLOW KING'
          : 'ACT I — 10 ด่าน บอส 5 ตัว · อาวุธเริ่มที่ T0 แล้วเลื่อนขั้นถึง T4 ระหว่างทาง'}</div>
        <button class="big" id="start">${this.titleMode === 'endless' ? 'ENTER THE ENDLESS' : this.titleMode === 'act2' ? 'ENTER THE RIFT' : 'ENTER THE ARENA'}</button>
        <div class="controls">
          <div><kbd>WASD</kbd> เคลื่อนที่</div><div><kbd>Mouse</kbd> เล็ง</div>
          <div><kbd>LMB</kbd> โจมตี / คอมโบ</div><div><kbd>Hold LMB</kbd> ท่าชาร์จ</div>
          <div><kbd>RMB</kbd>/<kbd>Shift</kbd> แตะ = Parry · ค้าง = Block</div><div><kbd>Space</kbd> Dash</div>
          <div><kbd>Q</kbd> <kbd>E</kbd> สกิล (ปลดที่ T2 / T3)</div><div><kbd>R</kbd> Overdrive · Ultimate (T4)</div>
          <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> สลับอาวุธ</div><div><kbd>Esc</kbd> พัก</div>
        </div>
        <div class="legend"><span class="o">■ ส้ม</span> = Parry/Block ได้ &nbsp; <span class="r">■ แดง</span> = ต้อง Dash หนี &nbsp; <span class="y">◎ ทอง</span> = สะท้อนกระสุนได้</div>
        <div class="touch-only touch-help">จอยซ้าย = เดิน · ปุ่ม ATK = โจมตี (ลากปุ่มเพื่อเล็ง / กดค้าง = ชาร์จ) · DASH · GUARD แตะ = Parry ค้าง = Block · Q E R = สกิล</div>
        <div class="row"><button id="mpopen" class="mp-btn">MULTIPLAYER · CO-OP / PVP</button>${fsButton()}</div>
        <div class="row"><button id="lbopen">LEADERBOARD</button><button id="codexopen">ECHO CODEX · ${codex.data.shards} ◆</button></div>
        <button class="small-link" id="gallery">ASSET CHECK · ตรวจไฟล์ภาพ</button>
        ${save.runs ? `<div class="best">BEST: ด่าน ${save.bestStage}/10${save.bestRound ? ` · ENDLESS รอบ ${save.bestRound}` : ''} · ชนะ ${save.wins} ครั้ง${save.bestTime ? ' · เวลาดีที่สุด ' + fmtTime(save.bestTime) : ''} · Rank สูงสุด <b style="color:${RANK_COLORS[save.bestRank]}">${RANKS[save.bestRank]}</b></div>` : ''}
      </div>`);
      this.root.querySelectorAll<HTMLElement>('.wcard').forEach((el) =>
        el.addEventListener('click', () => {
          if (!codex.hasWeapon(el.dataset.w as WeaponId)) {
            sfx('ui', 0.5);
            return;
          }
          weapon = el.dataset.w as WeaponId;
          sfx('uiConfirm');
          render();
        }));
      this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) =>
        el.addEventListener('click', () => {
          if (el.dataset.mode === 'act2' && !codex.data.act1Cleared) {
            sfx('ui', 0.5);
            const d = this.root.querySelector('.mode-desc');
            if (d) d.textContent = '🔒 ACT II ปลดล็อกเมื่อชนะ ACT I (Mirror Sovereign)';
            return;
          }
          this.titleMode = el.dataset.mode as GameMode;
          sfx('ui');
          render();
        }));
      this.root.querySelectorAll<HTMLElement>('[data-diff]').forEach((el) =>
        el.addEventListener('click', () => {
          hard = el.dataset.diff === '1';
          sfx('ui');
          render();
        }));
      this.root.querySelector('#start')!.addEventListener('click', go);
      bindFullscreen(this.root);
      this.root.querySelector('#mpopen')!.addEventListener('click', () => {
        sfx('uiConfirm');
        this.onMultiplayer?.();
      });
      this.root.querySelector('#codexopen')!.addEventListener('click', () => {
        sfx('ui');
        this.showCodex(() => this.showTitle(save, onStart));
      });
      this.root.querySelector('#lbopen')!.addEventListener('click', () => {
        sfx('ui');
        this.showLeaderboard(() => this.showTitle(save, onStart));
      });
      this.root.querySelector('#gallery')!.addEventListener('click', () => {
        location.search = '?sprites=1';
      });
    };
    const go = () => {
      audio.init();
      sfx('uiConfirm');
      onStart(weapon, hard, this.titleMode);
    };
    render();
    // weapon art streams in after the menu appears — refresh once it's there
    const token = ++this.titleToken;
    sprites.all.then(() => {
      if (this.titleToken === token && this.root.querySelector('.title-wrap')) render();
    });
    this.onKey((e) => {
      if (e.code === 'Enter') go();
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
      if (i >= 0 && codex.hasWeapon(ids[i])) {
        weapon = ids[i];
        audio.init();
        sfx('uiConfirm');
        render();
      }
    });
    // first interaction unlocks audio for the menu music
    const unlock = () => {
      audio.init();
      audio.setMusic('menu');
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
  }

  // ------------------------------------------------------------------ upgrades
  showUpgrades(offers: Upgrade[], done: number, total: number, onPick: (u: Upgrade) => void) {
    const dots = Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'on' : ''} ${i % 2 ? 'boss' : ''}"></i>`).join('');
    this.set(`
      <div class="up-wrap">
        ${total ? `<div class="progress">${dots}</div>` : `<div class="round-tag">ENDLESS · ROUND ${done} CLEARED</div>`}
        <div class="up-title">CHOOSE YOUR POWER</div>
        <div class="up-sub">เลือกพลัง 1 อย่าง · กด 1 / 2 / 3</div>
        <div class="ucards">
          ${offers.map((u, i) => `
            <div class="card ucard ${sprites.url('ui_card_' + u.rarity) ? 'framed' : ''}" data-i="${i}" style="--c:${RARITY_COL[u.rarity]};${sprites.url('ui_card_' + u.rarity) ? `background-image:url(${sprites.url('ui_card_' + u.rarity)})` : ''}">
              <div class="key">${i + 1}</div>
              <div class="icon">${sprites.url('icon_upgrade_' + u.id) ? `<img src="${sprites.url('icon_upgrade_' + u.id)}" alt="">` : u.icon}</div>
              <div class="rar">${u.rarity.toUpperCase()}</div>
              <div class="uname">${u.name}</div>
              <div class="udesc">${u.desc}</div>
            </div>`).join('')}
        </div>
      </div>`);
    let picked = false;
    const pick = (i: number) => {
      if (picked || !offers[i]) return;
      picked = true;
      const el = this.root.querySelector(`.ucard[data-i="${i}"]`);
      el?.classList.add('picked');
      setTimeout(() => onPick(offers[i]), 260);
    };
    this.root.querySelectorAll<HTMLElement>('.ucard').forEach((el) => el.addEventListener('click', () => pick(Number(el.dataset.i))));
    // small delay so a held attack click doesn't instantly choose
    setTimeout(() => {
      this.onKey((e) => {
        const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (i >= 0) pick(i);
      });
    }, 300);
  }

  // ------------------------------------------------------------------ pause
  showPause(onResume: () => void, onRestart: () => void, onQuit: () => void) {
    const s = this.settings;
    this.set(`
      <div class="panel">
        <div class="up-title">PAUSED</div>
        <label class="slider">MASTER <input type="range" min="0" max="1" step="0.05" value="${s.volume}" id="vol"></label>
        <label class="slider">MUSIC <input type="range" min="0" max="1" step="0.05" value="${s.music}" id="mus"></label>
        <div class="row">
          <button class="toggle ${s.shake ? 'on' : ''}" id="shake">SCREEN SHAKE</button>
          <button class="toggle ${s.bloom ? 'on' : ''}" id="bloom">BLOOM / GLOW</button>
          ${fsButton()}
        </div>
        <button class="big" id="resume">RESUME</button>
        <div class="row">
          <button id="restart">RESTART RUN</button>
          <button id="quit">QUIT TO TITLE</button>
        </div>
      </div>`);
    const $ = (id: string) => this.root.querySelector('#' + id) as HTMLInputElement;
    bindFullscreen(this.root);
    $('vol').addEventListener('input', () => {
      s.volume = Number($('vol').value);
      this.saveSettings();
    });
    $('mus').addEventListener('input', () => {
      s.music = Number($('mus').value);
      this.saveSettings();
    });
    $('shake').addEventListener('click', () => {
      s.shake = !s.shake;
      $('shake').classList.toggle('on', s.shake);
      this.saveSettings();
    });
    $('bloom').addEventListener('click', () => {
      s.bloom = !s.bloom;
      $('bloom').classList.toggle('on', s.bloom);
      this.saveSettings();
    });
    $('resume').addEventListener('click', onResume);
    $('restart').addEventListener('click', onRestart);
    $('quit').addEventListener('click', onQuit);
  }

  // ------------------------------------------------------------------ end
  showEnd(won: boolean, st: RunStats, stage: number, total: number, onRetry: () => void, onTitle: () => void,
    meta?: { weapon: string; hard: boolean; shot: string | null; mode: GameMode; round: number },
    endless?: { round: number; best: number }, shards = 0) {
    const rk = st.bestRank;
    // endless: rounds survived (the round you died in doesn't count)
    const cleared = endless ? Math.max(0, endless.round - 1) : won ? total : stage;
    this.set(`
      <div class="panel end ${won ? 'won' : 'lost'}">
        <div class="logo small" data-text="${won ? 'VICTORY' : 'DEFEATED'}">${won ? 'VICTORY' : 'DEFEATED'}</div>
        <div class="up-sub">${endless
          ? `ENDLESS — รอดมาได้ <b>${cleared}</b> รอบ${cleared >= endless.best && cleared > 0 ? ' · สถิติใหม่!' : ` · ดีที่สุด ${endless.best} รอบ`}`
          : won ? (menuMode === 'act2' ? 'มงกุฎแห่งความว่างเปล่าแตกสลาย — เจ้าคือตำนานแห่งรอยแยก' : 'เจ้าคือผู้พิชิตสนามประลอง — ACT II ปลดล็อกแล้ว!') : `ไปถึงด่าน ${stage + 1}/${total} — Parry และ Dash ให้แม่นขึ้นอีกนิด`}</div>
        ${shards ? `<div class="shards-earned">${sprites.url('icon_echo_shard') ? `<img src="${sprites.url('icon_echo_shard')}" alt="">` : '◆'} +${shards} ECHO SHARDS <small>(รวม ${codex.data.shards})</small></div>` : ''}
        <div class="stats">
          <div><span>TIME</span><b>${fmtTime(st.time)}</b></div>
          <div><span>KILLS</span><b>${st.kills}</b></div>
          <div><span>PARRIES</span><b>${st.parries}</b></div>
          <div><span>PERFECT DODGES</span><b>${st.perfects}</b></div>
          <div><span>EXECUTIONS</span><b>${st.executions}</b></div>
          <div><span>MAX COMBO</span><b>${st.maxCombo}</b></div>
          <div><span>HITS TAKEN</span><b>${st.hitsTaken}</b></div>
          <div><span>BEST RANK</span><b style="color:${RANK_COLORS[rk]}">${RANKS[rk]}</b></div>
        </div>
        <div class="lb-submit" id="lbsub" hidden>
          <input id="lbname" maxlength="16" placeholder="ชื่อของคุณ" value="${escapeHtml(savedName())}" autocomplete="off">
          <button id="lbsend">SUBMIT SCORE</button>
          <div class="lb-status" id="lbstatus"></div>
        </div>
        <div class="lb" id="lb"></div>
        <div class="row">
          <button class="big" id="retry">${won ? 'PLAY AGAIN' : 'RETRY'}</button>
          <button id="title">TITLE</button>
        </div>
      </div>`);
    this.root.querySelector('#retry')!.addEventListener('click', onRetry);
    this.root.querySelector('#title')!.addEventListener('click', onTitle);
    this.onKey((e) => {
      if (e.code === 'Enter' && !(e.target instanceof HTMLInputElement)) onRetry();
    });
    if (!meta) {
      // practice run: show the board read-only
      fetchLeaderboard(W_HARD(), 5, menuMode).then((list) => {
        const lb = this.root.querySelector('#lb');
        if (list && lb) lb.innerHTML = '<div class="lb-empty">รอบซ้อม / ผู้เล่นหลายคน ไม่ถูกบันทึกลง leaderboard</div>' + renderBoard(list, W_HARD(), '', menuMode);
      });
      return;
    }
    const hard = meta.hard;
    const lbEl = this.root.querySelector('#lb') as HTMLDivElement;
    const sub = this.root.querySelector('#lbsub') as HTMLDivElement;
    const status = this.root.querySelector('#lbstatus') as HTMLDivElement;
    const nameEl = this.root.querySelector('#lbname') as HTMLInputElement;
    const sendBtn = this.root.querySelector('#lbsend') as HTMLButtonElement;
    let mine = '';
    const refresh = async () => {
      const list = await fetchLeaderboard(hard, 10, meta.mode);
      if (!list) return; // API not available (static hosting) → stay hidden
      sub.hidden = false;
      lbEl.innerHTML = renderBoard(list, hard, mine, meta.mode);
    };
    const send = async () => {
      const name = nameEl.value.trim();
      if (!name) {
        status.textContent = 'ใส่ชื่อก่อนส่งคะแนน';
        nameEl.focus();
        return;
      }
      saveName(name);
      sendBtn.disabled = true;
      status.textContent = 'กำลังส่ง…';
      const r = await submitRun({
        name, mode: meta.mode, stage: cleared, won, hard, weapon: meta.weapon, time: st.time, kills: st.kills, parries: st.parries,
        perfects: st.perfects, executions: st.executions, maxCombo: st.maxCombo, bestRank: st.bestRank, shot: meta.shot,
      });
      if ('error' in r) {
        status.textContent = 'ส่งไม่สำเร็จ: ' + r.error;
        sendBtn.disabled = false;
        return;
      }
      mine = r.id;
      sfx('uiConfirm');
      status.innerHTML = `คะแนน <b>${r.score.toLocaleString()}</b> · อันดับ <b>#${r.rank}</b> ${meta.mode === 'endless' ? 'ENDLESS' : ''} ${hard ? '(HARD)' : ''}`;
      nameEl.disabled = true;
      await refresh();
    };
    sendBtn.addEventListener('click', send);
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    refresh();
  }

  // ------------------------------------------------------------------ ASCENSION
  /** full-screen ascension moment: rust shell shatters, the new form is revealed with its unlocks */
  showAscension(o: { weapon: WeaponId; tier: number; form: string; color: string; img: string | null; path?: PathId | null }, onDone: () => void) {
    const burst = sprites.url('vfx_ascend_burst');
    const shatter = sprites.url('vfx_ascend_shatter');
    const frame = sprites.url('ui_ascension_frame');
    const badge = sprites.url(`icon_tier_${o.tier}`);
    const unlocks = TIER_UNLOCKS[o.tier].map((u) => `<li>${u}</li>`).join('');
    const fam = FAMILIES[o.weapon];
    const pathLine = o.tier >= 3 && o.path ? `<div class="asc-path">${fam[o.path].passive}</div>` : '';
    this.set(`
      <div class="asc" style="--c:${o.color}">
        ${burst ? `<img class="asc-burst" src="${burst}" alt="">` : '<div class="asc-burst glow"></div>'}
        ${shatter ? `<img class="asc-shatter" src="${shatter}" alt="">` : ''}
        <div class="asc-tag">ASCENSION · T${o.tier} ${TIER_NAMES[o.tier]} · ${TIER_THAI[o.tier]}</div>
        ${o.img ? `<img class="asc-weapon ${o.tier >= 3 ? 'wide' : ''}" src="${o.img}" alt="">` : ''}
        <div class="asc-title" ${frame ? `style="background-image:url(${frame})"` : ''}>
          ${badge ? `<img class="asc-badge" src="${badge}" alt="">` : ''}<span>${o.form}</span>
        </div>
        ${pathLine}
        <ul class="asc-unlocks">${unlocks}</ul>
        <button class="big" id="ascok">CONTINUE</button>
      </div>`);
    sfx('ult');
    setTimeout(() => sfx('parry'), 380);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      sfx('uiConfirm');
      onDone();
    };
    this.root.querySelector('#ascok')!.addEventListener('click', go);
    setTimeout(() => this.onKey((e) => {
      if (e.code === 'Enter' || e.code === 'Space') go();
    }), 600);
  }

  /** T3: choose path A or B (B needs the Echo Codex unlock) */
  showPathChoice(weapon: WeaponId, onPick: (p: PathId) => void) {
    const fam = FAMILIES[weapon];
    const card = (pid: PathId) => {
      const pi = fam[pid];
      const locked = pid === 'b' && !codex.hasPathB(weapon);
      const art = sprites.url(`art_path_${weapon}_${pid}`);
      const icon = sprites.url(`icon_weapon_${weapon}_t3${pid}`);
      const frame = sprites.url('ui_path_card');
      return `<div class="card pcard ${locked ? 'locked' : ''}" data-p="${pid}" style="--c:${pi.color};${frame ? `background-image:url(${frame})` : ''}">
        <div class="key">${pid === 'a' ? 1 : 2}</div>
        ${art ? `<img class="part" src="${art}" alt="">` : icon ? `<img class="picon" src="${icon}" alt="">` : ''}
        <div class="pname">${pi.name}</div><div class="pthai">สาย${pi.thai} → ตำนาน ${pi.mythic}</div>
        <div class="pline"><b>PASSIVE</b> ${pi.passive}</div>
        <div class="pline"><b>E</b> ${pi.e}</div>
        <div class="pline dim"><b>T4 ULT</b> ${pi.ult}</div>
        ${locked ? `<div class="wlock">🔒 ปลดใน ECHO CODEX (${PRICES.pathB} ◆)</div>` : ''}
      </div>`;
    };
    this.set(`
      <div class="up-wrap">
        <div class="round-tag">ASCENSION · T3</div>
        <div class="up-title">CHOOSE YOUR PATH</div>
        <div class="up-sub">${WEAPONS[weapon].name} — เลือกได้ครั้งเดียวในรอบนี้ · กด 1 / 2</div>
        <div class="ucards">${card('a')}${card('b')}</div>
      </div>`);
    let picked = false;
    const pick = (pid: PathId) => {
      if (picked) return;
      if (pid === 'b' && !codex.hasPathB(weapon)) {
        sfx('ui', 0.5);
        return;
      }
      picked = true;
      this.root.querySelector(`.pcard[data-p="${pid}"]`)?.classList.add('picked');
      sfx('uiConfirm');
      setTimeout(() => onPick(pid), 280);
    };
    this.root.querySelectorAll<HTMLElement>('.pcard').forEach((el) => el.addEventListener('click', () => pick(el.dataset.p as PathId)));
    setTimeout(() => this.onKey((e) => {
      if (e.code === 'Digit1') pick('a');
      if (e.code === 'Digit2') pick('b');
    }), 300);
  }

  // ------------------------------------------------------------------ ECHO CODEX
  showCodex(onBack: () => void, tab: 'arsenal' | 'skins' | 'lore' = 'arsenal') {
    const d = codex.data;
    const tierRow = (id: WeaponId) => {
      const forms = ['t0', 't1', 't2', 't3a', 't3b', 't4a', 't4b'];
      return forms.map((f) => {
        const u = sprites.url(`icon_weapon_${id}_${f}`) ?? (f === 't2' ? sprites.url(`icon_weapon_${id}`) : null);
        return u ? `<img src="${u}" alt="" title="${f.toUpperCase()}">` : `<span class="noicon">${f.toUpperCase()}</span>`;
      }).join('');
    };
    const arsenal = ALL_WEAPONS.map((id) => {
      const w = WEAPONS[id], fam = FAMILIES[id];
      const owned = codex.hasWeapon(id), pb = codex.hasPathB(id);
      return `<div class="cx-row" style="--c:${w.color}">
        <div class="cx-head"><b>${w.name}</b><small>${w.thai}</small></div>
        <div class="cx-tiers">${tierRow(id)}</div>
        <div class="cx-actions">
          ${owned ? '<span class="ok">✓ ปลดแล้ว</span>' : `<button data-buy="weapon:${id}" ${d.shards < (PRICES.weapon[id] ?? 0) ? 'disabled' : ''}>ปลดอาวุธ · ${PRICES.weapon[id]} ◆</button>`}
          ${pb ? `<span class="ok">✓ สาย ${fam.b.name}</span>` : `<button data-buy="pathB:${id}" ${!owned || d.shards < PRICES.pathB ? 'disabled' : ''}>ปลดสาย ${fam.b.name} · ${PRICES.pathB} ◆</button>`}
        </div>
      </div>`;
    }).join('');
    const skins = SKINS.map((sk) => {
      const own = d.skins.includes(sk.id), on = d.skin === sk.id;
      return `<div class="cx-skin" style="--c:${sk.color}"><i></i><b>${sk.name}</b>
        ${own ? `<button data-skin="${sk.id}">${on ? 'กำลังใช้ ✓' : 'ใช้สีนี้'}</button>` : `<button data-buy="skin:${sk.id}" ${d.shards < sk.price ? 'disabled' : ''}>${sk.price} ◆</button>`}</div>`;
    }).join('');
    const LORE: [string, string, string][] = [
      ['vanguard', 'THE VANGUARD', 'อัศวินผู้สาบานจะเฝ้าประตูสนามประลอง โล่ของเขาไม่เคยแตก จนกระทั่งเจ้ามาถึง'],
      ['hex', 'HEX WEAVER', 'จอมเวทผู้ถักทอห่ากระสุนจากเส้นด้ายแห่งรอยแยก'],
      ['twins', 'TWIN FANGS', 'Kael และ Vex — คู่แฝดที่สาบานจะตายพร้อมกัน'],
      ['colossus', 'IRON COLOSSUS', 'สงครามจักรกลที่ถูกลืม หัวใจของมันยังเต้นด้วยลาวา'],
      ['mirror', 'MIRROR SOVEREIGN', 'เงาสะท้อนของนักสู้ทุกคนที่เคยยืนในสนามนี้'],
      ['nyxara', 'NYXARA, THE BLIGHT QUEEN', 'ราชินีที่หยั่งรากลงในซากของสวนต้องห้าม'],
      ['tempus', 'TEMPUS, THE CHRONO ARBITER', 'ผู้พิพากษาที่ตัดสินทุกการต่อสู้ — ซ้ำแล้วซ้ำอีก'],
      ['voltaris', 'VOLTARIS, THE STORM SERPENT', 'งูพายุที่ว่ายวนรอบยอดหอคอยมาตั้งแต่ก่อนกาลเวลา'],
      ['kagutsuchi', 'KAGUTSUCHI, THE ASHEN WARLORD', 'ขุนศึกที่เผาศาลเจ้าของตัวเองเพื่อพลังแห่งเถ้าถ่าน'],
      ['hollow', 'THE HOLLOW KING', 'ราชาผู้สวมมงกุฎแห่งความว่างเปล่า เขาคือที่มาของรอยแยกทั้งหมด'],
      ['sentinel', 'RIFT SENTINEL', 'รูปปั้นผู้เฝ้าแกนรอยแยก — ทำลายมันเพื่อเอา Rift Core'],
    ];
    const lore = LORE.map(([id, name, text]) => {
      const seen = d.seen.includes(id);
      const img = seen ? sprites.url('portrait_' + id) : null;
      return `<div class="cx-lore ${seen ? '' : 'unseen'}">${img ? `<img src="${img}" alt="">` : '<span class="q">?</span>'}
        <div><b>${seen ? name : '???'}</b><p>${seen ? text : 'ยังไม่เคยพบ'}</p></div></div>`;
    }).join('');
    this.set(`
      <div class="panel codex">
        <div class="up-title">ECHO CODEX</div>
        <div class="up-sub">◆ ${d.shards} ECHO SHARDS · ปลดล็อกถาวร (ไม่เพิ่มพลังดิบ)</div>
        <div class="row">
          <button class="toggle ${tab === 'arsenal' ? 'on' : ''}" data-tab="arsenal">ARSENAL</button>
          <button class="toggle ${tab === 'skins' ? 'on' : ''}" data-tab="skins">SKINS</button>
          <button class="toggle ${tab === 'lore' ? 'on' : ''}" data-tab="lore">LORE</button>
        </div>
        <div class="cx-body">${tab === 'arsenal' ? arsenal : tab === 'skins' ? `<div class="cx-skins">${skins}</div>` : `<div class="cx-lores">${lore}</div>`}</div>
        <button class="big" id="back">BACK</button>
      </div>`);
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => el.addEventListener('click', () => {
      sfx('ui');
      this.showCodex(onBack, el.dataset.tab as 'arsenal' | 'skins' | 'lore');
    }));
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => el.addEventListener('click', () => {
      const [kind, id] = el.dataset.buy!.split(':');
      if (codex.buy(kind as 'weapon' | 'pathB' | 'skin', id)) sfx('uiConfirm');
      else sfx('ui', 0.5);
      this.showCodex(onBack, tab);
    }));
    this.root.querySelectorAll<HTMLElement>('[data-skin]').forEach((el) => el.addEventListener('click', () => {
      codex.setSkin(el.dataset.skin!);
      sfx('ui');
      this.showCodex(onBack, tab);
    }));
    this.root.querySelector('#back')!.addEventListener('click', onBack);
    this.onKey((e) => {
      if (e.code === 'Escape') onBack();
    });
  }

  /** a simple "waiting for others" screen (multiplayer) */
  showWaiting(text: string) {
    this.who = null;
    this.set(`<div class="panel"><div class="up-title" style="font-size:28px">PLEASE WAIT</div><div class="up-sub">${text}</div><div class="spinner"></div></div>`);
  }

  /** PVP match result */
  showDuelEnd(r: { winner: string; color: string; table: { name: string; wins: number; color: string }[]; stats: RunStats }, onRematch: () => void, onTitle: () => void) {
    this.set(`
      <div class="panel end won" style="--c:${r.color}">
        <div class="logo small" data-text="VICTORY" style="text-shadow:0 0 14px ${r.color},0 0 44px ${r.color}">VICTORY</div>
        <div class="up-sub"><b style="color:${r.color}">${r.winner}</b> ชนะแมตช์!</div>
        <div class="duel-table">${r.table.map((t) => `<div style="--c:${t.color}"><span>${t.name}</span><b>${t.wins}</b></div>`).join('')}</div>
        <div class="stats">
          <div><span>PARRIES</span><b>${r.stats.parries}</b></div>
          <div><span>PERFECT DODGES</span><b>${r.stats.perfects}</b></div>
          <div><span>HITS TAKEN</span><b>${r.stats.hitsTaken}</b></div>
          <div><span>MATCH TIME</span><b>${fmtTime(r.stats.time)}</b></div>
        </div>
        <div class="row">
          <button class="big" id="rematch">REMATCH</button>
          <button id="title">TITLE</button>
        </div>
      </div>`);
    this.root.querySelector('#rematch')!.addEventListener('click', onRematch);
    this.root.querySelector('#title')!.addEventListener('click', onTitle);
  }

  /** standalone leaderboard panel (from the title screen) */
  async showLeaderboard(onBack: () => void) {
    let hard = false;
    let mode: GameMode = this.titleMode;
    const draw = async () => {
      this.set(`
        <div class="panel lbpanel">
          <div class="up-title">LEADERBOARD</div>
          <div class="row">
            <button class="toggle ${mode === 'campaign' ? 'on' : ''}" data-m="campaign">CAMPAIGN</button>
            <button class="toggle ${mode === 'act2' ? 'on act2' : ''}" data-m="act2">ACT II</button>
            <button class="toggle ${mode === 'endless' ? 'on endless' : ''}" data-m="endless">ENDLESS</button>
            <span class="sep"></span>
            <button class="toggle ${!hard ? 'on' : ''}" data-h="0">NORMAL</button>
            <button class="toggle ${hard ? 'on hard' : ''}" data-h="1">HARD</button>
          </div>
          <div class="lb" id="lb"><div class="lb-empty">กำลังโหลด…</div></div>
          <button class="big" id="back">BACK</button>
        </div>`);
      this.root.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => el.addEventListener('click', () => {
        hard = el.dataset.h === '1';
        sfx('ui');
        draw();
      }));
      this.root.querySelectorAll<HTMLElement>('[data-m]').forEach((el) => el.addEventListener('click', () => {
        mode = el.dataset.m as GameMode;
        sfx('ui');
        draw();
      }));
      this.root.querySelector('#back')!.addEventListener('click', onBack);
      const list = await fetchLeaderboard(hard, 20, mode);
      const lb = this.root.querySelector('#lb');
      if (lb) lb.innerHTML = list ? renderBoard(list, hard, '', mode) : '<div class="lb-empty">ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ leaderboard</div>';
    };
    this.onKey((e) => {
      if (e.code === 'Escape') onBack();
    });
    draw();
  }
}

/** current difficulty without importing the game world into the UI module */
let hardFlag = false;
let menuMode: GameMode = 'campaign';
export function setMenuHard(h: boolean, mode: GameMode = 'campaign') {
  hardFlag = h;
  menuMode = mode;
}
const W_HARD = () => hardFlag;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function renderBoard(list: LbEntry[], hard: boolean, mine: string, mode: GameMode = 'campaign') {
  const label = `${mode === 'endless' ? 'ENDLESS' : mode === 'act2' ? 'ACT II' : 'CAMPAIGN'}${hard ? ' · HARD' : ''}`;
  if (!list.length) return `<div class="lb-empty">ยังไม่มีใครบันทึกคะแนน ${label} — เป็นคนแรกเลย!</div>`;
  return `<div class="lb-title">TOP ${list.length} · ${label}</div>` + list.map((e, i) => `
    <div class="lb-row ${e.id === mine ? 'me' : ''}">
      <span class="lb-rank">${i + 1}</span>
      ${e.shotUrl ? `<img class="lb-shot" src="${escapeHtml(e.shotUrl)}" alt="" loading="lazy">` : '<span class="lb-shot"></span>'}
      <span class="lb-name">${escapeHtml(e.name)}<small>${mode === 'endless' ? 'ROUND ' + e.stage : e.won ? 'VICTORY' : 'ด่าน ' + e.stage + '/10'} · ${escapeHtml(e.weapon.toUpperCase())} · ${fmtTime(e.time)}</small></span>
      <span class="lb-score" style="color:${RANK_COLORS[e.bestRank] ?? '#fff'}">${e.score.toLocaleString()}<small>${RANKS[e.bestRank] ?? ''}</small></span>
    </div>`).join('');
}

export const menus = new Menus();
