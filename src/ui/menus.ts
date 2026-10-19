/** DOM overlay menus: title + weapon select, upgrade cards, pause/settings, end screen. */
import { audio, sfx } from '../audio/audio';
import { WEAPONS, type WeaponId } from '../game/weapons';
import type { Upgrade } from '../game/upgrades';
import type { RunStats } from '../game/world';
import { RANKS, RANK_COLORS } from '../game/style';
import type { SaveData } from '../game/run';
import { sprites } from '../render/sprites';
import { fetchLeaderboard, submitRun, savedName, saveName, type LbEntry } from '../net/leaderboard';

export interface Settings { volume: number; music: number; shake: boolean; bloom: boolean }
const SET_KEY = 'neonduel.settings.v1';

function loadSettings(): Settings {
  const d: Settings = { volume: 0.8, music: 0.55, shake: true, bloom: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') };
  } catch {
    return d;
  }
}

const RARITY_COL: Record<string, string> = { common: '#8fb8ff', rare: '#6dff9e', epic: '#c49bff', legendary: '#ffe14d' };
const WSTATS: Record<WeaponId, [number, number, number]> = { katana: [4, 3, 3], daggers: [5, 2, 2], hammer: [2, 5, 4] };

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

class Menus {
  root!: HTMLDivElement;
  settings = loadSettings();
  onSettings: (s: Settings) => void = () => {};
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  init() {
    this.root = document.getElementById('ui') as HTMLDivElement;
    this.onSettings(this.settings);
  }

  private set(html: string) {
    this.root.innerHTML = html;
    this.root.classList.add('show');
    this.root.querySelectorAll('button, .card').forEach((b) => b.addEventListener('mouseenter', () => sfx('ui', 0.4)));
  }
  private onKey(fn: ((e: KeyboardEvent) => void) | null) {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = fn;
    if (fn) window.addEventListener('keydown', fn);
  }
  hide() {
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
  showTitle(save: SaveData, onStart: (w: WeaponId, hard: boolean) => void) {
    let weapon: WeaponId = 'katana';
    let hard = false;
    const ids: WeaponId[] = ['katana', 'daggers', 'hammer'];
    const card = (id: WeaponId) => {
      const w = WEAPONS[id];
      const [spd, pow, pos] = WSTATS[id];
      const pip = (n: number) => '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(5 - n);
      return `<div class="card wcard ${id === weapon ? 'sel' : ''}" data-w="${id}" style="--c:${w.color}">
        ${sprites.url('art_weapon_' + id) ? `<img class="wart" src="${sprites.url('art_weapon_' + id)}" alt="">` : ''}
        <div class="wname">${w.name}</div><div class="wthai">${w.thai}</div>
        <div class="wdesc">${w.desc}</div>
        <div class="wstat"><span>SPEED</span><b>${pip(spd)}</b></div>
        <div class="wstat"><span>POWER</span><b>${pip(pow)}</b></div>
        <div class="wstat"><span>POSTURE</span><b>${pip(pos)}</b></div>
        <div class="wskills"><em>Q</em> ${w.skills[0].name}<br><em>E</em> ${w.skills[1].name}</div>
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
          <button class="toggle ${!hard ? 'on' : ''}" data-diff="0">NORMAL</button>
          <button class="toggle ${hard ? 'on hard' : ''}" data-diff="1">HARD</button>
        </div>
        <button class="big" id="start">ENTER THE ARENA</button>
        <div class="controls">
          <div><kbd>WASD</kbd> เคลื่อนที่</div><div><kbd>Mouse</kbd> เล็ง</div>
          <div><kbd>LMB</kbd> โจมตี / คอมโบ</div><div><kbd>Hold LMB</kbd> ท่าชาร์จ</div>
          <div><kbd>RMB</kbd>/<kbd>Shift</kbd> แตะ = Parry · ค้าง = Block</div><div><kbd>Space</kbd> Dash</div>
          <div><kbd>Q</kbd> <kbd>E</kbd> สกิล</div><div><kbd>R</kbd> Overdrive</div>
          <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> สลับอาวุธ</div><div><kbd>Esc</kbd> พัก</div>
        </div>
        <div class="legend"><span class="o">■ ส้ม</span> = Parry/Block ได้ &nbsp; <span class="r">■ แดง</span> = ต้อง Dash หนี &nbsp; <span class="y">◎ ทอง</span> = สะท้อนกระสุนได้</div>
        <div class="row"><button id="lbopen">LEADERBOARD</button></div>
        <button class="small-link" id="gallery">ASSET CHECK · ตรวจไฟล์ภาพ</button>
        ${save.runs ? `<div class="best">BEST: ด่าน ${save.bestStage}/10 · ชนะ ${save.wins} ครั้ง${save.bestTime ? ' · เวลาดีที่สุด ' + fmtTime(save.bestTime) : ''} · Rank สูงสุด <b style="color:${RANK_COLORS[save.bestRank]}">${RANKS[save.bestRank]}</b></div>` : ''}
      </div>`);
      this.root.querySelectorAll<HTMLElement>('.wcard').forEach((el) =>
        el.addEventListener('click', () => {
          weapon = el.dataset.w as WeaponId;
          sfx('uiConfirm');
          render();
        }));
      this.root.querySelectorAll<HTMLElement>('[data-diff]').forEach((el) =>
        el.addEventListener('click', () => {
          hard = el.dataset.diff === '1';
          sfx('ui');
          render();
        }));
      this.root.querySelector('#start')!.addEventListener('click', go);
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
      onStart(weapon, hard);
    };
    render();
    this.onKey((e) => {
      if (e.code === 'Enter') go();
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0) {
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
        <div class="progress">${dots}</div>
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
        </div>
        <button class="big" id="resume">RESUME</button>
        <div class="row">
          <button id="restart">RESTART RUN</button>
          <button id="quit">QUIT TO TITLE</button>
        </div>
      </div>`);
    const $ = (id: string) => this.root.querySelector('#' + id) as HTMLInputElement;
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
  showEnd(won: boolean, st: RunStats, stage: number, total: number, onRetry: () => void, onTitle: () => void, meta?: { weapon: string; hard: boolean; shot: string | null }) {
    const rk = st.bestRank;
    const cleared = won ? total : stage;
    this.set(`
      <div class="panel end ${won ? 'won' : 'lost'}">
        <div class="logo small" data-text="${won ? 'VICTORY' : 'DEFEATED'}">${won ? 'VICTORY' : 'DEFEATED'}</div>
        <div class="up-sub">${won ? 'เจ้าคือผู้พิชิตสนามประลอง — ลองโหมด HARD ดูไหม?' : `ไปถึงด่าน ${stage + 1}/${total} — Parry และ Dash ให้แม่นขึ้นอีกนิด`}</div>
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
      fetchLeaderboard(W_HARD(), 5).then((list) => {
        const lb = this.root.querySelector('#lb');
        if (list && lb) lb.innerHTML = '<div class="lb-empty">รอบซ้อม (เริ่มกลางเกม) ไม่ถูกบันทึกลง leaderboard</div>' + renderBoard(list, W_HARD(), '');
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
      const list = await fetchLeaderboard(hard, 10);
      if (!list) return; // API not available (static hosting) → stay hidden
      sub.hidden = false;
      lbEl.innerHTML = renderBoard(list, hard, mine);
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
        name, stage: cleared, won, hard, weapon: meta.weapon, time: st.time, kills: st.kills, parries: st.parries,
        perfects: st.perfects, executions: st.executions, maxCombo: st.maxCombo, bestRank: st.bestRank, shot: meta.shot,
      });
      if ('error' in r) {
        status.textContent = 'ส่งไม่สำเร็จ: ' + r.error;
        sendBtn.disabled = false;
        return;
      }
      mine = r.id;
      sfx('uiConfirm');
      status.innerHTML = `คะแนน <b>${r.score.toLocaleString()}</b> · อันดับ <b>#${r.rank}</b> ${hard ? '(HARD)' : ''}`;
      nameEl.disabled = true;
      await refresh();
    };
    sendBtn.addEventListener('click', send);
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    refresh();
  }

  /** standalone leaderboard panel (from the title screen) */
  async showLeaderboard(onBack: () => void) {
    let hard = false;
    const draw = async () => {
      this.set(`
        <div class="panel lbpanel">
          <div class="up-title">LEADERBOARD</div>
          <div class="row">
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
      this.root.querySelector('#back')!.addEventListener('click', onBack);
      const list = await fetchLeaderboard(hard, 20);
      const lb = this.root.querySelector('#lb');
      if (lb) lb.innerHTML = list ? renderBoard(list, hard, '') : '<div class="lb-empty">ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ leaderboard</div>';
    };
    this.onKey((e) => {
      if (e.code === 'Escape') onBack();
    });
    draw();
  }
}

/** current difficulty without importing the game world into the UI module */
let hardFlag = false;
export function setMenuHard(h: boolean) {
  hardFlag = h;
}
const W_HARD = () => hardFlag;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function renderBoard(list: LbEntry[], hard: boolean, mine: string) {
  if (!list.length) return `<div class="lb-empty">ยังไม่มีใครบันทึกคะแนน${hard ? 'โหมด HARD' : ''} — เป็นคนแรกเลย!</div>`;
  return `<div class="lb-title">TOP ${list.length}${hard ? ' · HARD' : ''}</div>` + list.map((e, i) => `
    <div class="lb-row ${e.id === mine ? 'me' : ''}">
      <span class="lb-rank">${i + 1}</span>
      ${e.shotUrl ? `<img class="lb-shot" src="${escapeHtml(e.shotUrl)}" alt="" loading="lazy">` : '<span class="lb-shot"></span>'}
      <span class="lb-name">${escapeHtml(e.name)}<small>${e.won ? 'VICTORY' : 'ด่าน ' + e.stage + '/10'} · ${escapeHtml(e.weapon.toUpperCase())} · ${fmtTime(e.time)}</small></span>
      <span class="lb-score" style="color:${RANK_COLORS[e.bestRank] ?? '#fff'}">${e.score.toLocaleString()}<small>${RANKS[e.bestRank] ?? ''}</small></span>
    </div>`).join('');
}

export const menus = new Menus();
