/** Branching-map screens: choose the next node, rest site, and the run shop. */
import { sfx } from '../audio/audio';
import { menus, dealCards, bindTilt } from './menus';
import { reduced, EASE, flyTo, shake } from './motion';
import { sprites } from '../render/sprites';

export type NodeKind = 'battle' | 'elite' | 'rest' | 'shop';
export const NODE_INFO: Record<NodeKind, { name: string; icon: string; color: string; desc: string }> = {
  battle: { name: 'BATTLE', icon: '⚔', color: '#7ff6ff', desc: 'ด่านปกติ — ได้ Resonance และการ์ดตามปกติ' },
  elite: { name: 'ELITE', icon: '♛', color: '#ffd24d', desc: 'ศัตรู Elite เพียบ · ยากขึ้นมาก · ได้การ์ดระดับ EPIC ขึ้นไป และ ◆ +15' },
  rest: { name: 'REST', icon: '✚', color: '#6dff9e', desc: 'ข้ามการต่อสู้ · ฟื้น HP 40% หรือ ฝึกอาวุธ (+200 Resonance) · เติมขวดยาเต็ม' },
  shop: { name: 'SHOP', icon: '◆', color: '#b98cff', desc: 'ข้ามการต่อสู้ · ใช้ Echo Shards ที่เก็บได้รอบนี้ซื้อของ' },
};

/** stage strip: ● cleared · ◆ boss · ◇ upcoming */
function strip(done: number, total: number) {
  return `<div class="map-strip">${Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'on' : ''} ${i % 2 ? 'boss' : ''} ${i === done ? 'here' : ''}"></i>`).join('')}</div>`;
}

export function showMap(nodes: NodeKind[], done: number, total: number, shards: number, onPick: (n: NodeKind) => void) {
  menus.set(`
    <div class="up-wrap">
      ${strip(done, total)}
      <div class="up-title">CHOOSE YOUR ROUTE</div>
      <div class="up-sub">เส้นทางถัดไปก่อนถึงบอส · ◆ ${shards} ของรอบนี้ · กด 1 / 2 / 3</div>
      <div class="ucards map-nodes">
        ${nodes.map((n, i) => {
          const k = NODE_INFO[n];
          return `<div class="card node" data-i="${i}" style="--c:${k.color}">
            <div class="key">${i + 1}</div>
            <div class="node-icon">${k.icon}</div>
            <div class="uname">${k.name}</div>
            <div class="udesc">${k.desc}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`);
  const cards = Array.from(menus.root.querySelectorAll<HTMLElement>('.node'));
  dealCards(cards, false);
  cards.forEach(bindTilt);
  // the route marker pulses towards the next stage
  menus.root.querySelector('.map-strip i.here')?.animate([{ transform: 'skewX(-20deg) scaleX(.3)', opacity: 0.3 }, { transform: 'skewX(-20deg) scaleX(1)', opacity: 1 }], { duration: 700, delay: 300, easing: EASE, fill: 'backwards' });
  let picked = false;
  const pick = (i: number) => {
    if (picked || !nodes[i]) return;
    picked = true;
    sfx('uiConfirm');
    const el = cards[i];
    el.classList.add('picked');
    el.style.transform = '';
    nodeChosen(el, cards.filter((c) => c !== el));
    setTimeout(() => onPick(nodes[i]), reduced() ? 260 : 620);
  };
  menus.root.querySelectorAll<HTMLElement>('.node').forEach((el) => el.addEventListener('click', () => pick(Number(el.dataset.i))));
  setTimeout(() => menus.onKey((e) => {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0) pick(i);
  }), 250);
}

export function showRest(onPick: (c: 'heal' | 'train') => void) {
  menus.set(`
    <div class="up-wrap">
      <div class="up-title">REST SITE</div>
      <div class="up-sub">พักสักครู่ก่อนเผชิญหน้าบอส — เลือก 1 อย่าง · ขวดยาถูกเติมเต็มแล้ว</div>
      <div class="ucards">
        <div class="card node" data-c="heal" style="--c:#6dff9e"><div class="key">1</div><div class="node-icon">✚</div><div class="uname">HEAL</div><div class="udesc">ฟื้น HP 40%</div></div>
        <div class="card node" data-c="train" style="--c:#ffe14d"><div class="key">2</div><div class="node-icon">⚒</div><div class="uname">TRAIN</div><div class="udesc">อาวุธในมือ +200 Resonance</div></div>
      </div>
    </div>`);
  const cards = Array.from(menus.root.querySelectorAll<HTMLElement>('.node'));
  dealCards(cards, false);
  cards.forEach(bindTilt);
  let done = false;
  const go = (c: 'heal' | 'train') => {
    if (done) return;
    done = true;
    sfx(c === 'heal' ? 'heal' : 'uiConfirm');
    const el = menus.root.querySelector<HTMLElement>(`.node[data-c="${c}"]`);
    if (el) {
      el.classList.add('picked');
      el.style.transform = '';
      nodeChosen(el, cards.filter((x) => x !== el));
      if (c === 'heal' && !reduced()) wave('#6dff9e');
    }
    setTimeout(() => onPick(c), reduced() ? 120 : 650);
  };
  menus.root.querySelectorAll<HTMLElement>('.node').forEach((el) => el.addEventListener('click', () => go(el.dataset.c as 'heal' | 'train')));
  setTimeout(() => menus.onKey((e) => {
    if (e.code === 'Digit1') go('heal');
    if (e.code === 'Digit2') go('train');
  }), 250);
}

export interface ShopItem { id: string; name: string; desc: string; price: number; icon: string; sold?: boolean }

/** run shop: buy as many as you can afford, then LEAVE */
export function showShop(items: ShopItem[], getShards: () => number, buy: (it: ShopItem) => boolean, onLeave: () => void) {
  let first = true;
  const render = (bought = -1) => {
    const sh = getShards();
    const icon = sprites.url('icon_echo_shard');
    menus.set(`
      <div class="up-wrap">
        <div class="up-title">ECHO MERCHANT</div>
        <div class="up-sub"><span class="shard-bank">${icon ? `<img class="shard-ico" src="${icon}" alt="">` : '◆'} ${sh}</span> Echo Shards ของรอบนี้ (ที่ใช้ไปจะไม่ถูกเก็บเข้า Codex)</div>
        <div class="ucards shop">
          ${items.map((it, i) => `<div class="card node shop-item ${it.sold ? 'sold' : ''} ${!it.sold && sh < it.price ? 'poor' : ''}" data-i="${i}" style="--c:#b98cff">
            <div class="node-icon">${it.icon}</div><div class="uname">${it.name}</div><div class="udesc">${it.desc}</div>
            <div class="price">${it.sold ? 'SOLD' : '◆ ' + it.price}</div></div>`).join('')}
        </div>
        <button class="big" id="leave">LEAVE</button>
      </div>`);
    const cards = Array.from(menus.root.querySelectorAll<HTMLElement>('.shop-item'));
    if (first) dealCards(cards, false);
    first = false;
    cards.forEach(bindTilt);
    if (bought >= 0 && cards[bought] && !reduced()) {
      // the price is paid: shards fly in, then SOLD is stamped on
      const el = cards[bought];
      const bank = menus.root.querySelector('.shard-bank');
      if (bank) for (let k = 0; k < 4; k++) setTimeout(() => flyTo(bank, el, icon ? `<img src="${icon}" alt="">` : '◆'), k * 70);
      el.animate([{ scale: '1' }, { scale: '1.08', offset: 0.5 }, { scale: '1' }], { duration: 420, delay: 380, easing: EASE });
      el.querySelector('.price')?.animate([{ transform: 'scale(2.4) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1 }], { duration: 380, delay: 420, easing: 'cubic-bezier(.2,1.5,.35,1)', fill: 'backwards' });
      setTimeout(() => sfx('stamp', 0.7), 450);
    }
    cards.forEach((el) => el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      const it = items[i];
      if (it.sold || getShards() < it.price) {
        sfx('ui', 0.5);
        if (!it.sold) {
          shake(el);
          el.animate([{ boxShadow: '0 0 0 rgba(255,45,74,0)' }, { boxShadow: '0 0 30px rgba(255,45,74,.8)' }, { boxShadow: '0 0 0 rgba(255,45,74,0)' }], { duration: 400 });
        }
        return;
      }
      if (buy(it)) {
        it.sold = true;
        sfx('uiConfirm');
      }
      render(i);
    }));
    menus.root.querySelector('#leave')!.addEventListener('click', () => {
      sfx('ui');
      onLeave();
    });
  };
  render();
}

/** a map / rest choice: the chosen card swells and glows, the others sink away */
function nodeChosen(el: HTMLElement, others: HTMLElement[]) {
  if (reduced()) return;
  el.animate([{ scale: '1', filter: 'brightness(1)' }, { scale: '1.12', filter: 'brightness(1.5)', offset: 0.4 }, { scale: '1.06', filter: 'brightness(1.2)' }], { duration: 520, easing: EASE, fill: 'forwards' });
  for (const o of others) o.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0.15, translate: '0 30px' }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
}

/** full-screen soft pulse of colour (rest site heal) */
function wave(color: string) {
  const el = document.createElement('div');
  el.className = 'ui-wave';
  el.style.setProperty('--c', color);
  document.body.appendChild(el);
  el.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 0.8, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 900, easing: 'ease-out' }).onfinish = () => el.remove();
}
