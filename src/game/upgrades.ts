/** Between-stage upgrade cards. */
import type { Player } from './player';
import { WEAPONS, type WeaponId } from './weapons';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
  stack?: number; // max picks (default 1)
  can?: (p: Player) => boolean;
  apply: (p: Player) => void;
}

const W8: Record<Rarity, number> = { common: 10, rare: 6, epic: 3, legendary: 1.2 };

const weaponCard = (id: WeaponId): Upgrade => ({
  id: 'w_' + id,
  name: 'ปลดล็อก ' + WEAPONS[id].name,
  desc: `${WEAPONS[id].thai}: ${WEAPONS[id].desc} (กด 1/2/3 สลับอาวุธได้กลางคอมโบ)`,
  rarity: 'epic',
  icon: id === 'daggers' ? '⟋⟍' : id === 'hammer' ? '▣' : '/',
  can: (p) => !p.weapons.includes(id),
  apply: (p) => {
    p.weapons.push(id);
  },
});

export const UPGRADES: Upgrade[] = [
  weaponCard('katana'),
  weaponCard('daggers'),
  weaponCard('hammer'),
  { id: 'dash+', name: 'Phase Step', desc: '+1 ชาร์จ Dash', rarity: 'rare', icon: '»', stack: 2, apply: (p) => { p.mods.dashMax++; p.dashCharges++; } },
  { id: 'dashcd', name: 'Quick Recovery', desc: 'Dash ฟื้นชาร์จเร็วขึ้น 30%', rarity: 'common', icon: '↻', stack: 2, apply: (p) => (p.mods.dashCd *= 0.7) },
  { id: 'flame', name: 'Ember Trail', desc: 'Dash ทิ้งรอยไฟเผาศัตรูที่เดินผ่าน', rarity: 'rare', icon: '♨', apply: (p) => (p.mods.dashFlame = true) },
  { id: 'nova', name: 'Parry Nova', desc: 'Parry สำเร็จปล่อยคลื่นกระแทกรอบตัว', rarity: 'rare', icon: '✷', apply: (p) => (p.mods.parryNova = true) },
  { id: 'window', name: 'Hawk Eye', desc: 'หน้าต่าง Parry กว้างขึ้น 50%', rarity: 'common', icon: '◎', apply: (p) => (p.mods.parryWindow *= 1.5) },
  { id: 'thunder', name: 'Thunder Edge', desc: 'ทุกการโจมตีครั้งที่ 4 ปล่อยสายฟ้าโซ่ไปยังศัตรูรอบ ๆ', rarity: 'epic', icon: 'ϟ', apply: (p) => (p.mods.thunder = true) },
  { id: 'blood', name: 'Bloodthirst', desc: 'เมื่อ Style Rank ≥ A ทุกการตีฟื้น HP', rarity: 'rare', icon: '♥', apply: (p) => (p.mods.bloodthirst = true) },
  { id: 'speed', name: 'Swift Feet', desc: 'ความเร็วเคลื่อนที่ +12%', rarity: 'common', icon: '➶', stack: 2, apply: (p) => (p.mods.speedMul *= 1.12) },
  { id: 'hp', name: 'Iron Heart', desc: 'HP สูงสุด +25 และฟื้นเต็ม', rarity: 'common', icon: '✚', stack: 3, apply: (p) => { p.maxHp += 25; p.hp = p.maxHp; } },
  { id: 'focus', name: 'Focus Flow', desc: 'ได้ Focus เพิ่มขึ้น 40%', rarity: 'common', icon: '◈', stack: 2, apply: (p) => (p.mods.focusGain *= 1.4) },
  { id: 'exec', name: 'Executioner', desc: 'ดาเมจใส่ศัตรูที่ Stagger +60% และท่า Execute แรงขึ้น', rarity: 'rare', icon: '☠', apply: (p) => (p.mods.execMul *= 1.6) },
  { id: 'after', name: 'Afterimage', desc: 'Perfect Dodge ทิ้งร่างเงาที่ฟันศัตรูรอบ ๆ', rarity: 'epic', icon: '◐', apply: (p) => (p.mods.afterimage = true) },
  { id: 'posture', name: 'Heavy Hand', desc: 'ดาเมจ Posture +40%', rarity: 'common', icon: '⬣', stack: 2, apply: (p) => (p.mods.postureMul *= 1.4) },
  { id: 'glass', name: 'Glass Cannon', desc: 'ดาเมจ +35% แต่ HP สูงสุด −20%', rarity: 'rare', icon: '◇', apply: (p) => { p.mods.dmgMul *= 1.35; p.maxHp = Math.round(p.maxHp * 0.8); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: 'sharp', name: 'Keen Edge', desc: 'ดาเมจ +15% และโอกาสคริติคอล +7%', rarity: 'common', icon: '⚔', stack: 3, apply: (p) => { p.mods.dmgMul *= 1.15; p.mods.crit += 0.07; } },
  { id: 'wind', name: 'Second Wind', desc: 'รอดจากการโจมตีที่ถึงตายได้ 1 ครั้งต่อด่าน', rarity: 'legendary', icon: '❂', apply: (p) => (p.mods.secondWind = true) },
  { id: 'charge', name: 'Overcharge', desc: 'ชาร์จเร็วขึ้น 40% และดาเมจท่าชาร์จ +30%', rarity: 'rare', icon: '⚡', apply: (p) => { p.mods.chargeSpeed *= 1.4; p.mods.chargeDmg *= 1.3; } },
  { id: 'reflect', name: 'Mirror Guard', desc: 'Block กระสุนแล้วสะท้อนกลับอัตโนมัติ', rarity: 'rare', icon: '⟲', apply: (p) => (p.mods.reflectGuard = true) },
  { id: 'momentum', name: 'Momentum', desc: 'ดาเมจ +5% ต่อระดับ Style Rank', rarity: 'epic', icon: '▲', apply: (p) => (p.mods.momentum = true) },
  { id: 'stamina', name: 'Stamina Core', desc: 'Stamina +50% และฟื้นเร็วขึ้น', rarity: 'common', icon: '◉', apply: (p) => { p.mods.staminaMax *= 1.5; p.mods.staminaRegen *= 1.4; } },
  { id: 'tempo', name: 'Tempo', desc: 'ความเร็วการโจมตี +15%', rarity: 'rare', icon: '♪', stack: 2, apply: (p) => (p.mods.atkSpeed *= 1.15) },
  { id: 'cheap', name: 'Efficiency', desc: 'สกิลใช้ Focus ลดลง 25%', rarity: 'rare', icon: '◔', apply: (p) => (p.mods.skillCost *= 0.75) },
  { id: 'od', name: 'Overclock', desc: 'Overdrive นานขึ้น 3 วินาที', rarity: 'rare', icon: '∞', apply: (p) => (p.mods.overdriveTime += 3) },
  { id: 'reaper', name: 'Reaper', desc: 'กำจัดศัตรูฟื้น HP 4', rarity: 'common', icon: '✦', apply: (p) => (p.mods.killHeal += 4) },
  { id: 'mend', name: 'Mend', desc: 'ฟื้น HP 60% ทันที', rarity: 'common', icon: '❤', stack: 99, can: (p) => p.hp < p.maxHp * 0.85, apply: (p) => (p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.6)) },
];

/** pick n distinct offers; forceWeapon guarantees a weapon unlock when available */
export function rollUpgrades(p: Player, taken: Record<string, number>, n = 3, forceWeapon = false): Upgrade[] {
  const pool = UPGRADES.filter((u) => (taken[u.id] ?? 0) < (u.stack ?? 1) && (!u.can || u.can(p)));
  const out: Upgrade[] = [];
  if (forceWeapon) {
    const wc = pool.filter((u) => u.id.startsWith('w_'));
    if (wc.length) out.push(wc[Math.floor(Math.random() * wc.length)]);
  }
  while (out.length < n) {
    const cand = pool.filter((u) => !out.includes(u));
    if (!cand.length) break;
    let total = 0;
    for (const u of cand) total += W8[u.rarity];
    let r = Math.random() * total;
    let pickU = cand[cand.length - 1];
    for (const u of cand) {
      r -= W8[u.rarity];
      if (r <= 0) {
        pickU = u;
        break;
      }
    }
    out.push(pickU);
  }
  return out;
}
