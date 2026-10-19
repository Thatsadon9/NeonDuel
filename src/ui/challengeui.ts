/** DAILY / WEEKLY challenge screen. */
import { sfx } from '../audio/audio';
import { menus, renderBoard } from './menus';
import { sprites } from '../render/sprites';
import { WEAPONS } from '../game/weapons';
import { daily, weekly, timeLeft, bestOf, MODS, type Challenge } from '../game/challenge';
import { fetchLeaderboard } from '../net/leaderboard';
import { MergedControls } from '../core/controls';
import { run } from '../game/run';

export function showChallenges(onBack: () => void) {
  const list = [daily(), weekly()];
  const card = (c: Challenge) => {
    const w = WEAPONS[c.weapon];
    const art = sprites.url('art_weapon_' + c.weapon) ?? sprites.url(`art_path_${c.weapon}_a`);
    const best = bestOf(c.key);
    const bestTxt = c.kind === 'daily' ? (best ? `ROUND ${best}` : '—') : best ? (best >= 11 ? 'VICTORY' : `ด่าน ${best}/10`) : '—';
    return `<div class="ch-card" style="--c:${c.kind === 'daily' ? '#7ff6ff' : '#ff4dcf'}">
      <div class="ch-head"><b>${c.title}</b><span>${c.key} · เหลือ ${timeLeft(c.kind)}</span></div>
      <div class="ch-body">
        ${art ? `<img src="${art}" alt="">` : ''}
        <div>
          <div class="ch-weapon" style="color:${w.color}">${w.name}</div>
          <div class="ch-base">${c.kind === 'daily' ? 'ENDLESS — รอดให้นานที่สุด' : 'ACT I — ผ่าน 10 ด่านให้ได้'}</div>
          <div class="ch-mods">${c.mods.map((m) => `<span style="--m:${MODS[m].color}" title="${MODS[m].desc}">${MODS[m].name}<small>${MODS[m].desc}</small></span>`).join('')}</div>
          <div class="ch-best">BEST: <b>${bestTxt}</b></div>
        </div>
      </div>
      <div class="lb ch-lb" id="lb-${c.kind}"><div class="lb-empty">กำลังโหลด leaderboard…</div></div>
      <button class="big" data-go="${c.kind}">START</button>
    </div>`;
  };
  menus.set(`
    <div class="ch-wrap">
      <div class="up-title">CHALLENGES</div>
      <div class="up-sub">ทุกคนได้ seed เดียวกัน — อาวุธ, Modifier, ศัตรู และการ์ดเหมือนกันหมด · แข่งกันบน leaderboard</div>
      <div class="ch-cards">${list.map(card).join('')}</div>
      <button id="back">BACK</button>
    </div>`);
  for (const c of list) {
    void fetchLeaderboard(false, 5, c.kind, c.key).then((rows) => {
      const el = menus.root.querySelector('#lb-' + c.kind);
      if (!el) return;
      el.innerHTML = rows ? renderBoard(rows, false, '', c.kind) : '<div class="lb-empty">leaderboard ใช้ไม่ได้ (ต้องเปิดผ่าน server ของเกม)</div>';
    });
  }
  menus.root.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => el.addEventListener('click', () => {
    const c = list.find((x) => x.kind === el.dataset.go)!;
    sfx('uiConfirm');
    run.start(c.weapon, 0, 0, c.kind === 'daily' ? 'endless' : 'campaign', { slots: [{ ctl: new MergedControls(), weapon: c.weapon }], challenge: c });
  }));
  menus.root.querySelector('#back')!.addEventListener('click', onBack);
  menus.onKey((e) => {
    if (e.code === 'Escape') onBack();
  });
}
