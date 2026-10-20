/** DOM overlay menus: title + weapon select, upgrade cards, pause/settings, end screen. */
import { motion, reduced, screenKey, leave, enter, bindRipples, countUp, EASE } from './motion';
import { audio, sfx } from '../audio/audio';
import { WEAPONS, ALL_WEAPONS, type WeaponId } from '../game/weapons';
import { FAMILIES, TIER_NAMES, TIER_THAI, TIER_UNLOCKS, type PathId } from '../game/ascension';
import { codex, PRICES, SKINS } from '../game/codex';
import { showHome } from './home';
import { isTouchDevice } from './safe';
import type { Upgrade } from '../game/upgrades';
import type { RunStats } from '../game/world';
import { RANKS, RANK_COLORS } from '../game/style';
import type { SaveData, GameMode } from '../game/run';
import { sprites } from '../render/sprites';
import { fetchLeaderboard, submitRun, savedName, saveName, type LbEntry, type LbMode } from '../net/leaderboard';

/** a boss as it stood when the party fell (defeat screen) */
export interface EndBoss { title: string; hp: number; maxHp: number; phase: string; color: string; split: number | null }

/** "you were THIS close" line for the defeat screen / banner */
export function closeness(left: number) {
  return left <= 0.1 ? 'เกือบแล้ว!! อีกฟันเดียว' : left <= 0.25 ? 'อีกนิดเดียว — ลองอีกที!' : left <= 0.5 ? 'เกินครึ่งทางแล้ว' : 'ทุกการตายคือบทเรียน';
}

export interface Settings {
  volume: number; music: number; shake: boolean; bloom: boolean;
  // accessibility
  reduceFlash: boolean; hudScale: number; colorSafe: boolean; aimAssist: boolean; deadzone: number; reduceMotion: boolean;
}
const SET_KEY = 'neonduel.settings.v1';

function loadSettings(): Settings {
  // phones / tablets start with the lighter renderer (no bloom) — it can be switched on in the pause menu
  const d: Settings = { volume: 0.8, music: 0.55, shake: true, bloom: !isTouchDevice(), reduceFlash: false, hudScale: 1, colorSafe: false, aimAssist: true, deadzone: 0.22, reduceMotion: false };
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

/** card frame art: augments have their own */
const cardFrame = (u: Upgrade) => (u.augment ? 'ui_card_augment' : 'ui_card_' + u.rarity);

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

class Menus {
  root!: HTMLDivElement;
  settings = loadSettings();
  onSettings: (s: Settings) => void = () => {};
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  /** opens the settings screen (wired up in main.ts); onBack returns to the caller */
  onSettingsScreen: ((onBack: () => void) => void) | null = null;
  /** opens the daily / weekly challenge screen (wired up in main.ts) */
  onChallenges: (() => void) | null = null;
  /** opens the multiplayer screens (wired up in main.ts) */
  onMultiplayer: (() => void) | null = null;
  /** multiplayer: whose choice the current screen is (shown as a coloured chip) */
  who: { tag: string; color: string } | null = null;

  init() {
    this.root = document.getElementById('ui') as HTMLDivElement;
    bindRipples(this.root);
    this.applyMotion();
    this.onSettings(this.settings);
  }
  private applyMotion() {
    motion.reduce = this.settings.reduceMotion;
    document.documentElement.classList.toggle('reduce-motion', reduced());
  }

  set(html: string) {
    const wasShown = this.root.classList.contains('show');
    const before = screenKey(this.root);
    const old = wasShown ? Array.from(this.root.childNodes) : [];
    for (const n of old) n.remove();
    this.root.innerHTML = (this.who ? `<div class="who-chip" style="--c:${this.who.color}">${this.who.tag} · เลือก</div>` : '') + html;
    this.root.classList.add('show');
    this.root.querySelectorAll('button, .card').forEach((b) => b.addEventListener('mouseenter', () => sfx('ui', 0.4)));
    // a re-render of the same screen (toggles, shop purchases) swaps in place; a new screen gets the full transition
    if (screenKey(this.root) !== before) {
      leave(old, this.root);
      enter(this.root);
    }
  }
  onKey(fn: ((e: KeyboardEvent) => void) | null) {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = fn;
    if (fn) window.addEventListener('keydown', fn);
  }
  hide() {
    this.who = null;
    if (this.root.classList.contains('show')) {
      const old = Array.from(this.root.childNodes);
      for (const n of old) n.remove();
      leave(old, this.root);
    }
    this.root.classList.remove('show');
    this.root.innerHTML = '';
    this.onKey(null);
  }
  saveSettings() {
    try {
      localStorage.setItem(SET_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
    this.applyMotion();
    this.onSettings(this.settings);
  }

  // ------------------------------------------------------------------ title
  private titleMode: GameMode = 'campaign';
  private titleToken = 0;
  /** home menu (see home.ts) */
  showTitle(save: SaveData, onStart: (w: WeaponId, diff: number, mode: GameMode) => void) {
    showHome(this, save, onStart);
  }

  // ------------------------------------------------------------------ upgrades
  showUpgrades(offers: Upgrade[], done: number, total: number, onPick: (u: Upgrade) => void) {
    const dots = Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'on' : ''} ${i % 2 ? 'boss' : ''}"></i>`).join('');
    this.set(`
      <div class="up-wrap deal">
        ${total ? `<div class="progress">${dots}</div>` : `<div class="round-tag">ENDLESS · ROUND ${done} CLEARED</div>`}
        <div class="up-title">CHOOSE YOUR POWER</div>
        <div class="up-sub">เลือกพลัง 1 อย่าง · กด 1 / 2 / 3</div>
        <div class="ucards">
          ${offers.map((u, i) => `
            <div class="card ucard r-${u.rarity} ${u.augment ? 'aug' : ''} ${sprites.url(cardFrame(u)) ? 'framed' : ''}" data-i="${i}" style="--c:${RARITY_COL[u.rarity]};${sprites.url(cardFrame(u)) ? `background-image:url(${sprites.url(cardFrame(u))})` : ''}">
              <div class="key">${i + 1}</div>
              <div class="icon">${sprites.url('icon_upgrade_' + u.id) ? `<img src="${sprites.url('icon_upgrade_' + u.id)}" alt="">` : u.icon}</div>
              <div class="rar">${u.augment ? 'AUGMENT · ' : ''}${u.rarity.toUpperCase()}</div>
              <div class="uname">${u.name}</div>
              <div class="udesc">${u.desc}</div>
              <div class="shine"></div>
              <div class="cover"><i></i></div>
            </div>`).join('')}
        </div>
      </div>`);
    const cards = Array.from(this.root.querySelectorAll<HTMLElement>('.ucard'));
    dealCards(cards, true);
    cards.forEach((el) => bindTilt(el));
    let picked = false;
    const pick = (i: number) => {
      if (picked || !offers[i]) return;
      picked = true;
      const el = cards[i];
      // a pick before the reveal finished: jump straight to the revealed state
      // (looping ones, like the legendary holo shine, can't be finished — and must not abort the pick)
      for (const c of cards) for (const a of c.getAnimations({ subtree: true })) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish();
      el.classList.add('picked');
      sfx('whoosh', 0.6);
      chooseCard(el, cards.filter((c) => c !== el), () => onPick(offers[i]));
    };
    cards.forEach((el) => el.addEventListener('click', () => pick(Number(el.dataset.i))));
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
      <div class="panel pause">
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
          <button id="settings">SETTINGS</button>
          <button id="restart">RESTART RUN</button>
          <button id="quit">QUIT TO TITLE</button>
        </div>
      </div>`);
    const $ = (id: string) => this.root.querySelector('#' + id) as HTMLInputElement;
    bindFullscreen(this.root);
    this.root.querySelector('#settings')?.addEventListener('click', () => this.onSettingsScreen?.(() => this.showPause(onResume, onRestart, onQuit)));
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
    meta?: { weapon: string; hard: boolean; shot: string | null; mode: LbMode; round: number; seed?: string },
    endless?: { round: number; best: number }, shards = 0, bosses: EndBoss[] = []) {
    const rk = st.bestRank;
    // endless: rounds survived (the round you died in doesn't count)
    const cleared = endless ? Math.max(0, endless.round - 1) : won ? total : stage;
    this.set(`
      <div class="panel end ${won ? 'won' : 'lost'}">
        <div class="logo small" data-text="${won ? 'VICTORY' : 'DEFEATED'}">${won ? 'VICTORY' : 'DEFEATED'}</div>
        <div class="up-sub">${endless
          ? `ENDLESS — รอดมาได้ <b>${cleared}</b> รอบ${cleared >= endless.best && cleared > 0 ? ' · สถิติใหม่!' : ` · ดีที่สุด ${endless.best} รอบ`}`
          : won ? (menuMode === 'act2' ? 'มงกุฎแห่งความว่างเปล่าแตกสลาย — เจ้าคือตำนานแห่งรอยแยก' : 'เจ้าคือผู้พิชิตสนามประลอง — ACT II ปลดล็อกแล้ว!') : `ไปถึงด่าน ${stage + 1}/${total} — Parry และ Dash ให้แม่นขึ้นอีกนิด`}</div>
        ${!won && bosses.length ? endBosses(bosses) : ''}
        ${shards ? `<div class="shards-earned">${sprites.url('icon_echo_shard') ? `<img src="${sprites.url('icon_echo_shard')}" alt="">` : '◆'} +${shards} ECHO SHARDS <small>(รวม ${codex.data.shards})</small></div>` : ''}
        <div class="stats">
          <div><span>TIME</span><b data-n="${st.time}" data-f="t">${fmtTime(st.time)}</b></div>
          <div><span>KILLS</span><b data-n="${st.kills}">${st.kills}</b></div>
          <div><span>PARRIES</span><b data-n="${st.parries}">${st.parries}</b></div>
          <div><span>PERFECT DODGES</span><b data-n="${st.perfects}">${st.perfects}</b></div>
          <div><span>EXECUTIONS</span><b data-n="${st.executions}">${st.executions}</b></div>
          <div><span>MAX COMBO</span><b data-n="${st.maxCombo}">${st.maxCombo}</b></div>
          <div><span>HITS TAKEN</span><b data-n="${st.hitsTaken}">${st.hitsTaken}</b></div>
          <div><span>BEST RANK</span><b class="rank-stamp" style="color:${RANK_COLORS[rk]};--rc:${RANK_COLORS[rk]}">${RANKS[rk]}</b></div>
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
    tallyStats(this.root, !!endless && cleared >= endless.best && cleared > 0);
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
      const list = await fetchLeaderboard(hard, 10, meta.mode, meta.seed);
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
        name, mode: meta.mode, seed: meta.seed, stage: cleared, won, hard, weapon: meta.weapon, time: st.time, kills: st.kills, parries: st.parries,
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
let menuMode: LbMode = 'campaign';
export function setMenuHard(h: boolean, mode: LbMode = 'campaign') {
  hardFlag = h;
  menuMode = mode;
}
const W_HARD = () => hardFlag;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderBoard(list: LbEntry[], hard: boolean, mine: string, mode: LbMode = 'campaign') {
  const label = mode === 'daily' ? 'DAILY' : mode === 'weekly' ? 'WEEKLY' : `${mode === 'endless' ? 'ENDLESS' : mode === 'act2' ? 'ACT II' : 'CAMPAIGN'}${hard ? ' · HARD' : ''}`;
  if (!list.length) return `<div class="lb-empty">ยังไม่มีใครบันทึกคะแนน ${label} — เป็นคนแรกเลย!</div>`;
  return `<div class="lb-title">TOP ${list.length} · ${label}</div>` + list.map((e, i) => `
    <div class="lb-row ${e.id === mine ? 'me' : ''}">
      <span class="lb-rank">${i + 1}</span>
      ${e.shotUrl ? `<img class="lb-shot" src="${escapeHtml(e.shotUrl)}" alt="" loading="lazy">` : '<span class="lb-shot"></span>'}
      <span class="lb-name">${escapeHtml(e.name)}<small>${mode === 'endless' || mode === 'daily' ? 'ROUND ' + e.stage : e.won ? 'VICTORY' : 'ด่าน ' + e.stage + '/10'} · ${escapeHtml(e.weapon.toUpperCase())} · ${fmtTime(e.time)}</small></span>
      <span class="lb-score" style="color:${RANK_COLORS[e.bestRank] ?? '#fff'}">${e.score.toLocaleString()}<small>${RANKS[e.bestRank] ?? ''}</small></span>
    </div>`).join('');
}

export const menus = new Menus();

function endBosses(list: EndBoss[]) {
  const hp = list.reduce((a, b) => a + Math.max(0, b.hp), 0), max = list.reduce((a, b) => a + b.maxHp, 0);
  const left = max > 0 ? hp / max : 1;
  return `<div class="end-boss">${list.map((b) => {
    const k = Math.max(0, b.hp) / b.maxHp;
    const pct = k > 0 && k < 0.01 ? '<1' : String(Math.round(k * 100));
    return `<div class="eb" style="--c:${b.color}">
      <div class="eb-row"><span>${escapeHtml(b.title)}${b.phase ? ` · ${b.phase}` : ''}</span><b>${k <= 0 ? 'DOWN' : `HP ${pct}%`}</b></div>
      <div class="eb-bar"><i style="width:${k * 100}%"></i>${b.split ? `<em style="left:${b.split * 100}%"></em>` : ''}</div>
    </div>`;
  }).join('')}<div class="eb-msg">${closeness(left)}</div></div>`;
}

// ====================================================================== card motion
/**
 * deal a hand of cards: they fly up from below in a fan, then (flip) turn over one by one;
 * EPIC / LEGENDARY cards announce themselves with a light pillar and a shimmer.
 */
export function dealCards(cards: HTMLElement[], flip: boolean) {
  if (reduced()) {
    cards.forEach((c) => c.classList.add('revealed'));
    return;
  }
  const n = cards.length;
  const vh = window.innerHeight;
  cards.forEach((c, i) => {
    const fan = (i - (n - 1) / 2) * 9;
    const r = c.getBoundingClientRect();
    const dx = window.innerWidth / 2 - (r.left + r.width / 2);
    const dy = vh - r.top + 40;
    const d = i * 110;
    c.animate(
      [{ translate: `${dx}px ${dy}px`, rotate: `${fan * 2.5}deg`, opacity: 0 }, { translate: '0 -14px', rotate: `${fan * 0.15}deg`, opacity: 1, offset: 0.75 }, { translate: '0 0', rotate: '0deg', opacity: 1 }],
      { duration: 520, delay: d, easing: EASE, fill: 'backwards' },
    );
    setTimeout(() => sfx('cardDeal', 0.5), d);
    if (!flip) return;
    const fd = 420 + i * 150 + 120;
    const cover = c.querySelector<HTMLElement>('.cover');
    c.animate([{ scale: '1 1' }, { scale: '0.02 1.04', offset: 0.5 }, { scale: '1 1' }], { duration: 380, delay: fd, easing: 'ease-in-out' });
    cover?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5001 }, { opacity: 0 }], { duration: 380, delay: fd, fill: 'both' });
    setTimeout(() => {
      if (!c.isConnected) return;
      sfx('cardFlip', 0.7);
      c.classList.add('revealed');
      const rare = c.classList.contains('r-legendary') || c.classList.contains('r-epic');
      if (rare) {
        c.classList.add('beam');
        sfx('shimmer', c.classList.contains('r-legendary') ? 1 : 0.6);
        sparks(c, c.classList.contains('r-legendary') ? 22 : 12);
        if (c.classList.contains('r-legendary')) c.parentElement?.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 260 });
      }
    }, fd + 190);
  });
}

/** sparks bursting out of a card */
function sparks(card: HTMLElement, n: number) {
  for (let k = 0; k < n; k++) {
    const s = document.createElement('i');
    s.className = 'spark';
    card.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 120;
    s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }],
      { duration: 600 + Math.random() * 500, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => s.remove();
  }
}

/** 3D tilt + holo shine that follow the pointer (mouse / pen only) */
export function bindTilt(el: HTMLElement) {
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || reduced() || el.classList.contains('picked')) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${(-py * 14).toFixed(2)}deg) rotateY(${(px * 16).toFixed(2)}deg) translateY(-8px) scale(1.03)`;
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    el.classList.add('tilt');
  });
  el.addEventListener('pointerleave', () => {
    el.style.transform = '';
    el.classList.remove('tilt');
  });
}

/** the chosen card glides to the centre and is absorbed; the others burn away */
export function chooseCard(el: HTMLElement, others: HTMLElement[], done: () => void) {
  if (reduced()) {
    setTimeout(done, 200);
    return;
  }
  el.style.transform = '';
  const r = el.getBoundingClientRect();
  const dx = window.innerWidth / 2 - (r.left + r.width / 2), dy = window.innerHeight / 2 - (r.top + r.height / 2);
  for (const o of others) {
    o.animate([{ opacity: 1, filter: 'none', translate: '0 0' }, { opacity: 0, filter: 'blur(8px) brightness(2.2) sepia(1) saturate(4) hue-rotate(-25deg)', translate: '0 50px' }],
      { duration: 420, easing: 'ease-in', fill: 'forwards' });
  }
  el.animate(
    [
      { translate: '0 0', scale: '1', filter: 'brightness(1)' },
      { translate: `${dx}px ${dy}px`, scale: '1.18', filter: 'brightness(1.25)', offset: 0.6 },
      { translate: `${dx}px ${dy}px`, scale: '1.12', filter: 'brightness(1.4)', offset: 0.78 },
      { translate: `${dx}px ${dy}px`, scale: '0.05', filter: 'brightness(4)', opacity: 0 },
    ],
    { duration: 820, easing: EASE, fill: 'forwards' },
  );
  setTimeout(() => sfx('shimmer', 0.5), 560);
  setTimeout(done, 800);
}

/** end screen: numbers count up one row after another, then the rank is stamped down */
function tallyStats(root: HTMLElement, record: boolean) {
  const cells = Array.from(root.querySelectorAll<HTMLElement>('.stats b[data-n]'));
  const stamp = root.querySelector<HTMLElement>('.rank-stamp');
  const t0 = 420;
  cells.forEach((b, i) => {
    const n = Number(b.dataset.n);
    countUp(b, n, 520, t0 + i * 110, (v) => (b.dataset.f === 't' ? fmtTime(v) : String(Math.round(v))), () => sfx('tick', 0.6));
  });
  if (!stamp) return;
  const at = t0 + cells.length * 110 + 450;
  if (reduced()) return;
  stamp.style.opacity = '0';
  setTimeout(() => {
    if (!stamp.isConnected) return;
    stamp.style.opacity = '';
    stamp.classList.add('stamped');
    sfx('stamp', 0.9);
    stamp.closest('.panel')?.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(3px,4px)' }, { transform: 'translate(-2px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 220 });
    if (record) {
      const sub = root.querySelector('.up-sub');
      sub?.classList.add('record');
      sfx('shimmer', 0.8);
    }
  }, at);
}
