/** SETTINGS: audio/video, key & gamepad rebinding, accessibility. */
import { sfx } from '../audio/audio';
import { menus } from './menus';
import { padnav } from './padnav';
import { input } from '../core/input';
import { connectedPads } from '../core/controls';
import { bindings, REBINDABLE, keyName, padName } from '../core/bindings';

type Tab = 'av' | 'keys' | 'pad' | 'access';

export function showSettings(onBack: () => void, tab: Tab = 'av') {
  const s = menus.settings;
  const tabs: [Tab, string][] = [['av', 'AUDIO / VIDEO'], ['keys', 'KEYBOARD'], ['pad', 'GAMEPAD'], ['access', 'ACCESSIBILITY']];
  const tog = (id: string, on: boolean, label: string, desc = '') => `<button class="set-tog ${on ? 'on' : ''}" data-tog="${id}"><b><i class="sw"></i>${label}</b>${desc ? `<small>${desc}</small>` : ''}</button>`;
  const slider = (id: string, label: string, v: number, min: number, max: number, step: number) =>
    `<label class="slider">${label} <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-sl="${id}"><span>${id === 'hudScale' ? Math.round(v * 100) + '%' : v.toFixed(2)}</span></label>`;
  let body = '';
  if (tab === 'av') {
    body = `${slider('volume', 'MASTER', s.volume, 0, 1, 0.05)}${slider('music', 'MUSIC', s.music, 0, 1, 0.05)}
      <div class="set-grid">${tog('shake', s.shake, 'SCREEN SHAKE')}${tog('bloom', s.bloom, 'BLOOM / GLOW', 'ปิดเพื่อให้ลื่นขึ้นบนเครื่องสเปกต่ำ')}</div>`;
  } else if (tab === 'keys') {
    body = `<div class="bind-list">${REBINDABLE.map(({ a, label }) => {
      const k = bindings.keys[a] ?? [];
      return `<div class="bind-row"><span>${label}</span><button data-bk="${a}:0">${keyName(k[0])}</button><button data-bk="${a}:1">${keyName(k[1])}</button></div>`;
    }).join('')}</div><div class="set-note">เมาส์: คลิกซ้าย = โจมตี · คลิกขวา = Parry/Block (คงที่)</div>`;
  } else if (tab === 'pad') {
    body = `<div class="bind-list">${REBINDABLE.filter((r) => !['up', 'down', 'left', 'right'].includes(r.a)).map(({ a, label }) => {
      const p = bindings.pads[a] ?? [];
      return `<div class="bind-row"><span>${label}</span><button data-bp="${a}:0">${padName(p[0])}</button><button data-bp="${a}:1">${padName(p[1])}</button></div>`;
    }).join('')}</div>
    ${slider('deadzone', 'STICK DEADZONE', s.deadzone, 0.05, 0.45, 0.01)}
    <div class="set-grid">${tog('aimAssist', s.aimAssist, 'AIM ASSIST', 'ปล่อยสติ๊กขวา = เล็งศัตรูใกล้สุดอัตโนมัติ')}</div>
    <div class="set-note">สติ๊กซ้าย = เดิน · สติ๊กขวา = เล็ง (คงที่)</div>`;
  } else {
    body = `<div class="set-grid">
      ${tog('reduceFlash', s.reduceFlash, 'REDUCE FLASHES', 'ลดแสงวาบเต็มจอ 70% · ปิด impact frame')}
      ${tog('reduceMotion', s.reduceMotion, 'REDUCE MOTION', 'ปิดแอนิเมชันเมนู / การ์ด / การเปลี่ยนฉาก')}
      ${tog('colorSafe', s.colorSafe, 'COLOUR-SAFE TELEGRAPHS', 'ป้องกันไม่ได้ = ม่วงแดง · Parry ได้ = เหลือง')}
      ${tog('shake', s.shake, 'SCREEN SHAKE')}
    </div>
    ${slider('hudScale', 'HUD SIZE', s.hudScale, 0.8, 1.4, 0.05)}`;
  }
  menus.set(`
    <div class="panel settings">
      <div class="up-title">SETTINGS</div>
      <div class="row">${tabs.map(([t, n]) => `<button class="toggle ${t === tab ? 'on' : ''}" data-tab="${t}">${n}</button>`).join('')}</div>
      <div class="set-body">${body}</div>
      <div class="row">${tab === 'keys' || tab === 'pad' ? '<button id="reset" class="danger">RESET CONTROLS</button>' : ''}<button class="big" id="back">BACK</button></div>
    </div>`);
  const root = menus.root;
  const again = (t: Tab = tab) => showSettings(onBack, t);
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => el.addEventListener('click', () => {
    sfx('ui');
    again(el.dataset.tab as Tab);
  }));
  root.querySelectorAll<HTMLElement>('[data-tog]').forEach((el) => el.addEventListener('click', () => {
    const k = el.dataset.tog as 'shake' | 'bloom' | 'reduceFlash' | 'colorSafe' | 'aimAssist' | 'reduceMotion';
    s[k] = !s[k];
    menus.saveSettings();
    sfx('ui');
    // flip in place so the switch animates (the same toggle can appear twice, e.g. SCREEN SHAKE)
    root.querySelectorAll(`[data-tog="${k}"]`).forEach((b) => b.classList.toggle('on', s[k]));
  }));
  root.querySelectorAll<HTMLInputElement>('[data-sl]').forEach((el) => el.addEventListener('input', () => {
    const k = el.dataset.sl as 'volume' | 'music' | 'hudScale' | 'deadzone';
    s[k] = Number(el.value);
    const out = el.nextElementSibling;
    if (out) out.textContent = k === 'hudScale' ? Math.round(s[k] * 100) + '%' : s[k].toFixed(2);
    menus.saveSettings();
  }));
  // keyboard rebinding: click a slot, press a key (Esc cancels)
  root.querySelectorAll<HTMLElement>('[data-bk]').forEach((el) => el.addEventListener('click', () => {
    const [a, slot] = el.dataset.bk!.split(':');
    el.textContent = 'กดปุ่ม…';
    el.classList.add('wait');
    input.capture = true;
    const on = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.removeEventListener('keydown', on, true);
      input.capture = false;
      if (e.code !== 'Escape') bindings.setKey(a as never, Number(slot), e.code);
      sfx('uiConfirm');
      again();
    };
    window.addEventListener('keydown', on, true);
  }));
  // gamepad rebinding: click a slot, press a pad button
  root.querySelectorAll<HTMLElement>('[data-bp]').forEach((el) => el.addEventListener('click', () => {
    const [a, slot] = el.dataset.bp!.split(':');
    el.textContent = 'กดปุ่มจอย…';
    el.classList.add('wait');
    padnav.suspended = true;
    const held = new Set<string>();
    for (const g of connectedPads()) g.buttons.forEach((b, i) => b.pressed && held.add(g.index + ':' + i));
    const t0 = performance.now();
    const poll = () => {
      for (const g of connectedPads()) for (let i = 0; i < g.buttons.length; i++) {
        const id = g.index + ':' + i;
        if (g.buttons[i].pressed && !held.has(id)) {
          padnav.suspended = false;
          bindings.setPad(a as never, Number(slot), i);
          sfx('uiConfirm');
          again();
          return;
        }
        if (!g.buttons[i].pressed) held.delete(id);
      }
      if (performance.now() - t0 > 6000) {
        padnav.suspended = false;
        again();
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }));
  root.querySelector('#reset')?.addEventListener('click', () => {
    bindings.reset();
    sfx('ui');
    again();
  });
  root.querySelector('#back')!.addEventListener('click', onBack);
  menus.onKey((e) => {
    if (e.code === 'Escape' && !input.capture) onBack();
  });
}
