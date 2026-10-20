/** Branching-map screens: choose the next node, rest site, and the run shop. */
import { sfx } from '../audio/audio';
import { menus } from './menus';
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
  let picked = false;
  const pick = (i: number) => {
    if (picked || !nodes[i]) return;
    picked = true;
    sfx('uiConfirm');
    menus.root.querySelector(`.node[data-i="${i}"]`)?.classList.add('picked');
    setTimeout(() => onPick(nodes[i]), 260);
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
  let done = false;
  const go = (c: 'heal' | 'train') => {
    if (done) return;
    done = true;
    sfx('uiConfirm');
    onPick(c);
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
  const render = () => {
    const sh = getShards();
    const icon = sprites.url('icon_echo_shard');
    menus.set(`
      <div class="up-wrap">
        <div class="up-title">ECHO MERCHANT</div>
        <div class="up-sub">${icon ? `<img class="shard-ico" src="${icon}" alt="">` : '◆'} ${sh} Echo Shards ของรอบนี้ (ที่ใช้ไปจะไม่ถูกเก็บเข้า Codex)</div>
        <div class="ucards shop">
          ${items.map((it, i) => `<div class="card node shop-item ${it.sold ? 'sold' : ''} ${!it.sold && sh < it.price ? 'poor' : ''}" data-i="${i}" style="--c:#b98cff">
            <div class="node-icon">${it.icon}</div><div class="uname">${it.name}</div><div class="udesc">${it.desc}</div>
            <div class="price">${it.sold ? 'SOLD' : '◆ ' + it.price}</div></div>`).join('')}
        </div>
        <button class="big" id="leave">LEAVE</button>
      </div>`);
    menus.root.querySelectorAll<HTMLElement>('.shop-item').forEach((el) => el.addEventListener('click', () => {
      const it = items[Number(el.dataset.i)];
      if (it.sold || getShards() < it.price) return sfx('ui', 0.5);
      if (buy(it)) {
        it.sold = true;
        sfx('uiConfirm');
      }
      render();
    }));
    menus.root.querySelector('#leave')!.addEventListener('click', () => {
      sfx('ui');
      onLeave();
    });
  };
  render();
}
