/**
 * HOME MENU — cinematic main menu (big neon menu on the left, rotating Mythic showcase on the right)
 * and the PLAY setup screen (mode · difficulty · weapon).
 */
import { audio, sfx } from '../audio/audio';
import { sprites } from '../render/sprites';
import { WEAPONS, ALL_WEAPONS, type WeaponId } from '../game/weapons';
import { FAMILIES, type PathId } from '../game/ascension';
import { codex, PRICES } from '../game/codex';
import { RANKS, RANK_COLORS } from '../game/style';
import { daily, timeLeft } from '../game/challenge';
import type { SaveData, GameMode } from '../game/run';

interface MenuHost {
  root: HTMLDivElement;
  set(html: string): void;
  onKey(fn: ((e: KeyboardEvent) => void) | null): void;
  onMultiplayer: (() => void) | null;
  onChallenges: (() => void) | null;
  onSettingsScreen: ((onBack: () => void) => void) | null;
  showCodex(onBack: () => void): void;
  showLeaderboard(onBack: () => void): void;
}
type Start = (w: WeaponId, diff: number, mode: GameMode) => void;

const WSTATS: Record<WeaponId, [number, number, number]> = { katana: [3, 3, 3], daggers: [5, 2, 4], hammer: [1, 5, 4], scythe: [2, 3, 3], gauntlets: [5, 2, 2], bow: [3, 4, 2] };
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/** remembered between visits */
const pref = { weapon: 'katana' as WeaponId, diff: 0, mode: 'campaign' as GameMode, focus: 0 };
let showcaseTimer = 0;

// ---------------------------------------------------------------- HOME
export function showHome(m: MenuHost, save: SaveData, onStart: Start) {
  clearInterval(showcaseTimer);
  const ch = daily();
  const showcase: { img: string; name: string; sub: string; color: string }[] = [];
  for (const id of ALL_WEAPONS) for (const p of ['a', 'b'] as PathId[]) {
    const img = sprites.url(`art_mythic_${id}_${p}`);
    const fam = FAMILIES[id][p];
    if (img) showcase.push({ img, name: fam.mythic, sub: `${WEAPONS[id].name} · สาย ${fam.name}`, color: fam.color });
  }
  if (!showcase.length) {
    const img = sprites.url('art_weapon_katana');
    if (img) showcase.push({ img, name: 'NEON KATANA', sub: 'ARENA OF ECHOES', color: '#7ff6ff' });
  }
  let sc = Math.floor(Math.random() * Math.max(1, showcase.length));
  const items: { id: string; label: string; sub: string; badge?: string; act: () => void }[] = [
    { id: 'play', label: 'PLAY', sub: 'Act I · Act II · Endless', act: () => showPlay(m, save, onStart) },
    { id: 'challenge', label: 'CHALLENGES', sub: `Daily · Weekly — รีเซ็ตใน ${timeLeft('daily')}`, badge: 'NEW', act: () => m.onChallenges?.() },
    { id: 'mp', label: 'MULTIPLAYER', sub: 'Co-op PVE · PVP Duel · Local / Online', act: () => m.onMultiplayer?.() },
    { id: 'codex', label: 'ECHO CODEX', sub: `◆ ${codex.data.shards} · ปลดอาวุธ / สาย / สกิน`, act: () => m.showCodex(() => showHome(m, save, onStart)) },
    { id: 'lb', label: 'LEADERBOARD', sub: 'อันดับโลก', act: () => m.showLeaderboard(() => showHome(m, save, onStart)) },
    { id: 'settings', label: 'SETTINGS', sub: 'เสียง · ปุ่ม · การเข้าถึง', act: () => m.onSettingsScreen?.(() => showHome(m, save, onStart)) },
  ];
  const best = save.runs
    ? `<span>BEST <b>ด่าน ${save.bestStage}/10</b></span>${save.bestRound ? `<span>ENDLESS <b>รอบ ${save.bestRound}</b></span>` : ''}<span>WINS <b>${save.wins}</b></span>${save.bestTime ? `<span>FASTEST <b>${fmtTime(save.bestTime)}</b></span>` : ''}<span>TOP RANK <b style="color:${RANK_COLORS[save.bestRank]}">${RANKS[save.bestRank]}</b></span>`
    : '<span>ยินดีต้อนรับสู่สนามประลอง — เริ่มที่ <b>PLAY</b></span>';
  const logo = sprites.url('ui_logo');
  const shard = sprites.url('icon_echo_shard');
  m.set(`
    <div class="home">
      <div class="home-bg"><i></i><i></i><i></i></div>
      <div class="home-left">
        ${logo ? `<img class="logo-img home-logo" src="${logo}" alt="NEON DUEL">` : '<div class="logo home-logo" data-text="NEON DUEL">NEON DUEL</div>'}
        <div class="home-tag">ARENA OF ECHOES <em>v2 · ASCENSION</em></div>
        <nav class="home-menu">
          ${items.map((it, i) => `<button class="hm-item ${i === pref.focus ? 'focus' : ''}" data-i="${i}" style="--d:${i * 0.05}s">
            <span class="hm-num">0${i + 1}</span><span class="hm-label" data-text="${it.label}">${it.label}</span>${it.badge ? `<span class="hm-badge">${it.badge}</span>` : ''}
            <span class="hm-sub">${it.sub}</span></button>`).join('')}
        </nav>
      </div>
      <div class="home-right">
        <div class="showcase" id="showcase">
          <div class="sc-ring"></div>
          <img class="sc-img" id="sc-img" alt="">
          <div class="sc-cap"><div class="sc-kicker">MYTHIC FORM</div><div class="sc-name" id="sc-name"></div><div class="sc-sub" id="sc-sub"></div></div>
          <div class="sc-dots" id="sc-dots"></div>
        </div>
        <div class="home-daily" data-go="challenge"><b>DAILY RIFT</b><span>${ch.key} · ${WEAPONS[ch.weapon].name} · ${ch.mods.length} modifiers</span></div>
      </div>
      <div class="home-bar">
        <span class="hb-shards">${shard ? `<img src="${shard}" alt="">` : '◆'} ${codex.data.shards}</span>${best}
        <span class="hb-keys"><kbd>↑</kbd><kbd>↓</kbd> เลือก · <kbd>ENTER</kbd> ตกลง</span>
      </div>
    </div>`);
  const root = m.root;
  const setShow = (i: number) => {
    if (!showcase.length) return;
    sc = (i + showcase.length) % showcase.length;
    const s = showcase[sc];
    const img = root.querySelector<HTMLImageElement>('#sc-img');
    const box = root.querySelector<HTMLElement>('#showcase');
    if (!img || !box) return;
    box.classList.remove('in');
    void box.offsetWidth;
    img.src = s.img;
    box.style.setProperty('--c', s.color);
    root.querySelector('#sc-name')!.textContent = s.name;
    root.querySelector('#sc-sub')!.textContent = s.sub;
    root.querySelector('#sc-dots')!.innerHTML = showcase.map((_, k) => `<i class="${k === sc ? 'on' : ''}"></i>`).join('');
    box.classList.add('in');
  };
  setShow(sc);
  showcaseTimer = window.setInterval(() => {
    if (!document.body.contains(root.querySelector('#showcase'))) return clearInterval(showcaseTimer);
    setShow(sc + 1);
  }, 4200);
  root.querySelector('#showcase')?.addEventListener('click', () => setShow(sc + 1));
  // parallax
  const home = root.querySelector<HTMLElement>('.home')!;
  home.addEventListener('mousemove', (e) => {
    const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
    home.style.setProperty('--px', String(x));
    home.style.setProperty('--py', String(y));
  });
  const btns = [...root.querySelectorAll<HTMLButtonElement>('.hm-item')];
  const focus = (i: number) => {
    pref.focus = (i + btns.length) % btns.length;
    btns.forEach((b, k) => b.classList.toggle('focus', k === pref.focus));
  };
  const go = (i: number) => {
    clearInterval(showcaseTimer);
    audio.init();
    sfx('uiConfirm');
    pref.focus = i;
    items[i].act();
  };
  btns.forEach((b, i) => {
    b.addEventListener('mouseenter', () => focus(i));
    b.addEventListener('click', () => go(i));
  });
  root.querySelector('[data-go="challenge"]')?.addEventListener('click', () => go(1));
  m.onKey((e) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      focus(pref.focus + 1);
      sfx('ui', 0.4);
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      focus(pref.focus - 1);
      sfx('ui', 0.4);
    } else if (e.code === 'Enter' || e.code === 'Space') go(pref.focus);
  });
  audio.setMusic('menu');
}

// ---------------------------------------------------------------- PLAY setup
const MODES: { id: GameMode; name: string; sub: string; portrait: string; color: string; lock?: () => boolean }[] = [
  { id: 'campaign', name: 'ACT I', sub: '10 ด่าน · บอส 5 ตัว · อาวุธเริ่ม T0 → T4', portrait: 'portrait_mirror', color: '#7ff6ff' },
  { id: 'act2', name: 'ACT II', sub: 'THE RIFT · บอสใหม่ 5 ตัว · เริ่ม T2', portrait: 'portrait_hollow', color: '#ff4dcf', lock: () => !codex.data.act1Cleared },
  { id: 'endless', name: 'ENDLESS', sub: 'สู้ไม่สิ้นสุด · Affix · Gauntlet · Throne Round', portrait: 'portrait_kagutsuchi', color: '#b98cff' },
];
const DIFFS = [
  { name: 'NORMAL', sub: 'ท้าทายแต่ยุติธรรม — ตายสักสองสามครั้งกว่าจะผ่าน Act I', color: '#7ff6ff' },
  { name: 'HARD', sub: 'ศัตรูแรง +25% · บอสต่อท่าเป็นคอมโบ · ช่วงเปิดสั้นลง', color: '#ff9a3c' },
  { name: 'NIGHTMARE', sub: 'ศัตรูแรง +55% · คอมโบถี่ · เฟส 2 เร็วขึ้น · มี Elite · Parry แคบลง', color: '#ff2d4a' },
];

export function showPlay(m: MenuHost, save: SaveData, onStart: Start) {
  if (!codex.hasWeapon(pref.weapon)) pref.weapon = 'katana';
  if (MODES.find((x) => x.id === pref.mode)?.lock?.()) pref.mode = 'campaign';
  const render = () => {
    const w = WEAPONS[pref.weapon], fam = FAMILIES[pref.weapon];
    const [spd, pow, ctl] = WSTATS[pref.weapon];
    const pip = (n: number) => '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(5 - n);
    const art = sprites.url('art_weapon_' + pref.weapon) ?? sprites.url(`art_path_${pref.weapon}_a`);
    m.set(`
      <div class="play">
        <div class="play-head"><button class="back-btn" id="back">‹ BACK</button><div class="up-title">CHOOSE YOUR RUN</div></div>
        <div class="play-modes">
          ${MODES.map((md) => {
            const lock = md.lock?.() ?? false;
            const img = sprites.url(md.portrait);
            return `<button class="pm ${pref.mode === md.id ? 'on' : ''} ${lock ? 'locked' : ''}" data-mode="${md.id}" style="--c:${md.color}">
              ${img ? `<img src="${img}" alt="">` : ''}<b>${md.name}${lock ? ' 🔒' : ''}</b><span>${lock ? 'ชนะ ACT I เพื่อปลดล็อก' : md.sub}</span></button>`;
          }).join('')}
        </div>
        <div class="play-diff">
          ${DIFFS.map((d, i) => `<button class="pd ${pref.diff === i ? 'on' : ''}" data-diff="${i}" style="--c:${d.color}"><b>${'☠'.repeat(i + 1)} ${d.name}</b><span>${d.sub}</span></button>`).join('')}
        </div>
        <div class="play-weapon" style="--c:${w.color}">
          <button class="pw-arrow" data-dw="-1">‹</button>
          <div class="pw-main">
            ${art ? `<img class="pw-art" src="${art}" alt="">` : ''}
            <div class="pw-info">
              <div class="pw-name">${w.name}</div>
              <div class="pw-thai">${w.thai} · เริ่มที่ T0 “${fam.forms.t0.name}”</div>
              <div class="pw-desc">${w.desc}</div>
              <div class="wstat"><span>SPEED</span><b>${pip(spd)}</b></div>
              <div class="wstat"><span>POWER</span><b>${pip(pow)}</b></div>
              <div class="wstat"><span>CONTROL</span><b>${pip(ctl)}</b></div>
              <div class="pw-paths"><span style="color:${fam.a.color}">A · ${fam.a.name} → ${fam.a.mythic}</span><span style="color:${fam.b.color}">B · ${fam.b.name} → ${fam.b.mythic}${codex.hasPathB(pref.weapon) ? '' : ' 🔒'}</span></div>
            </div>
          </div>
          <button class="pw-arrow" data-dw="1">›</button>
          <div class="pw-dots">${ALL_WEAPONS.map((id) => `<i class="${id === pref.weapon ? 'on' : ''} ${codex.hasWeapon(id) ? '' : 'lock'}" style="--c:${WEAPONS[id].color}" data-pick="${id}" title="${WEAPONS[id].name}${codex.hasWeapon(id) ? '' : ' — ' + PRICES.weapon[id] + ' ◆'}"></i>`).join('')}</div>
        </div>
        <button class="big play-go" id="go">ENTER THE ARENA</button>
        <div class="play-keys"><kbd>←</kbd><kbd>→</kbd> อาวุธ · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> โหมด · <kbd>ENTER</kbd> เริ่ม · <kbd>ESC</kbd> กลับ</div>
      </div>`);
    const root = m.root;
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) => el.addEventListener('click', () => {
      const md = MODES.find((x) => x.id === el.dataset.mode)!;
      if (md.lock?.()) return sfx('ui', 0.5);
      pref.mode = md.id;
      sfx('ui');
      render();
    }));
    root.querySelectorAll<HTMLElement>('[data-diff]').forEach((el) => el.addEventListener('click', () => {
      pref.diff = Number(el.dataset.diff);
      sfx('ui');
      render();
    }));
    root.querySelectorAll<HTMLElement>('[data-dw]').forEach((el) => el.addEventListener('click', () => cycle(Number(el.dataset.dw))));
    root.querySelectorAll<HTMLElement>('[data-pick]').forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset.pick as WeaponId;
      if (!codex.hasWeapon(id)) return sfx('ui', 0.5);
      pref.weapon = id;
      sfx('ui');
      render();
    }));
    root.querySelector('#go')!.addEventListener('click', start);
    root.querySelector('#back')!.addEventListener('click', back);
  };
  const cycle = (d: number) => {
    const owned = ALL_WEAPONS.filter((w) => codex.hasWeapon(w));
    const i = owned.indexOf(pref.weapon);
    pref.weapon = owned[(i + d + owned.length) % owned.length];
    sfx('ui', 0.6);
    render();
  };
  const start = () => {
    audio.init();
    sfx('uiConfirm');
    onStart(pref.weapon, pref.diff, pref.mode);
  };
  const back = () => {
    sfx('ui');
    showHome(m, save, onStart);
  };
  render();
  m.onKey((e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycle(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') cycle(1);
    else if (e.code === 'Enter') start();
    else if (e.code === 'Escape') back();
    else {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0 && !MODES[i].lock?.()) {
        pref.mode = MODES[i].id;
        render();
      }
    }
  });
}
