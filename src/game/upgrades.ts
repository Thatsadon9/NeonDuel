/** Between-stage upgrade cards. */
import type { Player } from './player';
import { WEAPONS, type WeaponId } from './weapons';
import { codex } from './codex';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
  stack?: number; // max picks (default 1)
  endless?: boolean; // only offered in endless mode
  /** AUGMENT: reshapes a skill / dash / parry with a trade-off (special card frame) */
  augment?: boolean;
  can?: (p: Player) => boolean;
  apply: (p: Player) => void;
}

const W8: Record<Rarity, number> = { common: 10, rare: 6, epic: 3, legendary: 1.2 };

const weaponCard = (id: WeaponId): Upgrade => ({
  id: 'w_' + id,
  name: 'ปลดล็อก ' + WEAPONS[id].name,
  desc: `${WEAPONS[id].thai}: ${WEAPONS[id].desc} (เริ่มต่ำกว่าอาวุธในมือ 1 ขั้น · กด 1/2/3 สลับได้กลางคอมโบ)`,
  rarity: 'epic',
  icon: { daggers: '⟋⟍', hammer: '▣', katana: '/', scythe: '☾', gauntlets: '✊', bow: '➶' }[id],
  can: (p) => !p.weapons.includes(id) && p.weapons.length < 3 && codex.hasWeapon(id),
  apply: (p) => p.unlockWeapon(id),
});

/** two augments that change the same slot exclude each other */
const noAug = (...ids: string[]) => (p: Player) => !ids.some((id) => (p as unknown as { augs?: Set<string> }).augs?.has(id));
const aug = (u: Omit<Upgrade, 'augment' | 'apply'> & { apply: (p: Player) => void; excl?: string[] }): Upgrade => ({
  ...u,
  augment: true,
  can: (p) => (u.can ? u.can(p) : true) && noAug(...(u.excl ?? []), u.id)(p),
  apply: (p) => {
    ((p as unknown as { augs?: Set<string> }).augs ??= new Set()).add(u.id);
    u.apply(p);
  },
});

/** AUGMENTS — they change how something works, each with a cost */
export const AUGMENTS: Upgrade[] = [
  aug({ id: 'a_q_over', name: 'OVERCLOCK · Q', desc: 'สกิล Q ดาเมจ ×1.4 แต่คูลดาวน์ +60%', rarity: 'rare', icon: 'Q⇑', can: (p) => p.tier >= 2, excl: ['a_q_quick'], apply: (p) => { p.mods.qDmg *= 1.4; p.mods.qCd *= 1.6; } }),
  aug({ id: 'a_q_quick', name: 'QUICKDRAW · Q', desc: 'คูลดาวน์ Q −40% แต่ดาเมจ Q ×0.75', rarity: 'rare', icon: 'Q⇆', can: (p) => p.tier >= 2, excl: ['a_q_over'], apply: (p) => { p.mods.qCd *= 0.6; p.mods.qDmg *= 0.75; } }),
  aug({ id: 'a_e_heavy', name: 'HEAVY · E', desc: 'สกิล E ดาเมจ ×1.35 และ Posture ×1.5 แต่ใช้ Focus +15', rarity: 'epic', icon: 'E⬣', can: (p) => p.tier >= 2, excl: ['a_e_echo'], apply: (p) => { p.mods.eDmg *= 1.35; p.mods.eHeavy = true; p.mods.eCostAdd += 15; } }),
  aug({ id: 'a_e_echo', name: 'ECHO · E', desc: 'หลังใช้ E การตีธรรมดาแรงขึ้น 30% นาน 3 วินาที · ดาเมจ E ×0.85', rarity: 'rare', icon: 'E≋', can: (p) => p.tier >= 2, excl: ['a_e_heavy'], apply: (p) => { p.mods.echoE = true; p.mods.eDmg *= 0.85; } }),
  aug({ id: 'a_dash_blast', name: 'BLAST STEP', desc: 'Dash ทิ้งระเบิดหลัง 0.25 วิ แต่ Dash ใช้ Stamina +35%', rarity: 'epic', icon: '»✷', excl: ['a_dash_feather'], apply: (p) => { p.mods.blastStep = true; p.mods.dashStam *= 1.35; } }),
  aug({ id: 'a_dash_feather', name: 'FEATHER STEP', desc: 'Dash ใช้ Stamina −40% แต่ช่วงอมตะสั้นลง 30%', rarity: 'rare', icon: '»~', excl: ['a_dash_blast'], apply: (p) => { p.mods.dashStam *= 0.6; p.mods.dashIframe *= 0.7; } }),
  aug({ id: 'a_counter', name: 'COUNTER EDGE', desc: 'Parry สำเร็จสวนกลับทันที แต่หน้าต่าง Parry แคบลง 20%', rarity: 'epic', icon: '⟲⚔', can: (p) => p.wpn.id !== 'gauntlets', apply: (p) => { p.mods.counterEdge = true; p.mods.parryWindow *= 0.8; } }),
  aug({ id: 'a_overload', name: 'OVERLOAD · R', desc: 'คูลดาวน์ R −35% แต่ใช้ R เสีย HP 15', rarity: 'epic', icon: 'R⚡', apply: (p) => { p.mods.overload = true; p.mods.rCd *= 0.65; } }),
  aug({ id: 'a_thief', name: 'TIME THIEF', desc: 'Perfect Dodge ลดคูลดาวน์ Q/E 2 วิ แต่หน้าต่าง Perfect แคบลง 20%', rarity: 'rare', icon: '◷', apply: (p) => { p.mods.timeThief = true; p.mods.perfectWin *= 0.8; } }),
  aug({ id: 'a_blood', name: 'BLOOD PRICE', desc: 'Focus ไม่พอใช้ Q/E ได้โดยจ่าย HP แทน (1 HP ต่อ 3 Focus)', rarity: 'legendary', icon: '♥◈', can: (p) => p.tier >= 2, apply: (p) => { p.mods.bloodPrice = true; } }),
];

export const UPGRADES: Upgrade[] = [
  ...AUGMENTS,
  weaponCard('katana'),
  weaponCard('daggers'),
  weaponCard('hammer'),
  weaponCard('scythe'),
  weaponCard('gauntlets'),
  weaponCard('bow'),
  { id: 'dash+', name: 'Phase Step', desc: '+1 ชาร์จ Dash', rarity: 'rare', icon: '»', stack: 2, apply: (p) => { p.mods.dashMax++; p.dashCharges++; } },
  { id: 'dashcd', name: 'Quick Recovery', desc: 'Dash ฟื้นชาร์จเร็วขึ้น 30%', rarity: 'common', icon: '↻', stack: 2, apply: (p) => (p.mods.dashCd *= 0.7) },
  { id: 'flame', name: 'Ember Trail', desc: 'Dash ทิ้งรอยไฟเผาศัตรูที่เดินผ่าน', rarity: 'rare', icon: '♨', apply: (p) => (p.mods.dashFlame = true) },
  { id: 'nova', name: 'Parry Nova', desc: 'Parry สำเร็จปล่อยคลื่นกระแทกรอบตัว', rarity: 'rare', icon: '✷', apply: (p) => (p.mods.parryNova = true) },
  { id: 'window', name: 'Hawk Eye', desc: 'หน้าต่าง Parry กว้างขึ้น 50%', rarity: 'common', icon: '◎', apply: (p) => (p.mods.parryWindow *= 1.5) },
  { id: 'thunder', name: 'Thunder Edge', desc: 'ทุกการโจมตีครั้งที่ 4 ปล่อยสายฟ้าโซ่ไปยังศัตรูรอบ ๆ', rarity: 'epic', icon: 'ϟ', apply: (p) => (p.mods.thunder = true) },
  { id: 'blood', name: 'Bloodthirst', desc: 'เมื่อ Style Rank ≥ S ทุกการตีฟื้น HP เล็กน้อย', rarity: 'rare', icon: '♥', apply: (p) => (p.mods.bloodthirst = true) },
  { id: 'speed', name: 'Swift Feet', desc: 'ความเร็วเคลื่อนที่ +12%', rarity: 'common', icon: '➶', stack: 2, apply: (p) => (p.mods.speedMul *= 1.12) },
  { id: 'hp', name: 'Iron Heart', desc: 'HP สูงสุด +25 และฟื้นเต็ม', rarity: 'common', icon: '✚', stack: 3, apply: (p) => { p.maxHp += 25; p.hp = p.maxHp; } },
  { id: 'focus', name: 'Focus Flow', desc: 'ได้ Focus เพิ่มขึ้น 25%', rarity: 'common', icon: '◈', stack: 2, apply: (p) => (p.mods.focusGain *= 1.25) },
  { id: 'exec', name: 'Executioner', desc: 'ดาเมจใส่ศัตรูที่ Stagger +30% และท่า Execute แรงขึ้น', rarity: 'rare', icon: '☠', apply: (p) => (p.mods.execMul *= 1.3) },
  { id: 'after', name: 'Afterimage', desc: 'Perfect Dodge ทิ้งร่างเงาที่ฟันศัตรูรอบ ๆ', rarity: 'epic', icon: '◐', apply: (p) => (p.mods.afterimage = true) },
  { id: 'posture', name: 'Heavy Hand', desc: 'ดาเมจ Posture +40%', rarity: 'common', icon: '⬣', stack: 2, apply: (p) => (p.mods.postureMul *= 1.4) },
  { id: 'glass', name: 'Glass Cannon', desc: 'ดาเมจ +25% แต่ HP สูงสุด −30%', rarity: 'rare', icon: '◇', apply: (p) => { p.mods.dmgMul *= 1.25; p.maxHp = Math.round(p.maxHp * 0.7); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: 'sharp', name: 'Keen Edge', desc: 'ดาเมจ +10% และโอกาสคริติคอล +5%', rarity: 'common', icon: '⚔', stack: 2, apply: (p) => { p.mods.dmgMul *= 1.1; p.mods.crit += 0.05; } },
  { id: 'wind', name: 'Second Wind', desc: 'รอดจากการโจมตีที่ถึงตายได้ 1 ครั้งต่อด่าน', rarity: 'legendary', icon: '❂', apply: (p) => (p.mods.secondWind = true) },
  { id: 'charge', name: 'Overcharge', desc: 'ชาร์จเร็วขึ้น 40% และดาเมจท่าชาร์จ +30%', rarity: 'rare', icon: '⚡', apply: (p) => { p.mods.chargeSpeed *= 1.4; p.mods.chargeDmg *= 1.3; } },
  { id: 'reflect', name: 'Mirror Guard', desc: 'Block กระสุนแล้วสะท้อนกลับอัตโนมัติ', rarity: 'rare', icon: '⟲', apply: (p) => (p.mods.reflectGuard = true) },
  { id: 'momentum', name: 'Momentum', desc: 'ดาเมจ +3% ต่อระดับ Style Rank', rarity: 'epic', icon: '▲', apply: (p) => (p.mods.momentum = true) },
  { id: 'stamina', name: 'Stamina Core', desc: 'Stamina +50% และฟื้นเร็วขึ้น', rarity: 'common', icon: '◉', apply: (p) => { p.mods.staminaMax *= 1.5; p.mods.staminaRegen *= 1.4; } },
  { id: 'tempo', name: 'Tempo', desc: 'ความเร็วการโจมตี +15%', rarity: 'rare', icon: '♪', stack: 2, apply: (p) => (p.mods.atkSpeed *= 1.15) },
  { id: 'cheap', name: 'Efficiency', desc: 'สกิล Q/E ใช้ Focus ลดลง 20%', rarity: 'rare', icon: '◔', apply: (p) => (p.mods.skillCost *= 0.8) },
  { id: 'od', name: 'Overclock', desc: 'Overdrive นานขึ้น 3 วินาที', rarity: 'rare', icon: '∞', apply: (p) => (p.mods.overdriveTime += 3) },
  { id: 'reaper', name: 'Reaper', desc: 'กำจัดศัตรูฟื้น HP 2', rarity: 'common', icon: '✦', apply: (p) => (p.mods.killHeal += 2) },
  { id: 'mend', name: 'Mend', desc: 'ฟื้น HP 40% ทันที', rarity: 'common', icon: '❤', stack: 3, can: (p) => p.hp < p.maxHp * 0.85, apply: (p) => (p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4)) },
  // ---- endless: infinitely stackable growth so the player keeps pace with enemy scaling
  { id: 'inf_power', name: 'Power Surge', desc: 'ดาเมจ +5% (สูงสุด ×2.5)', rarity: 'common', icon: '✶', stack: Infinity, endless: true, can: (p) => p.mods.dmgMul < 2.5, apply: (p) => (p.mods.dmgMul *= 1.05) },
  { id: 'inf_vital', name: 'Vitality', desc: 'HP สูงสุด +12 และฟื้น 12 (ซ้อนได้ไม่จำกัด)', rarity: 'common', icon: '✚', stack: Infinity, endless: true, apply: (p) => { p.maxHp += 12; p.heal(12); } },
  { id: 'inf_focus', name: 'Deep Focus', desc: 'ได้ Focus เพิ่ม 5% (สูงสุด 5 ใบ)', rarity: 'common', icon: '◈', stack: 5, endless: true, apply: (p) => (p.mods.focusGain *= 1.05) },
  { id: 'inf_break', name: 'Breaker', desc: 'ดาเมจ Posture +12% (ซ้อนได้ไม่จำกัด)', rarity: 'common', icon: '⬣', stack: Infinity, endless: true, apply: (p) => (p.mods.postureMul *= 1.12) },
  { id: 'inf_haste', name: 'Haste', desc: 'ความเร็วโจมตีและเคลื่อนที่ +4% (ซ้อนได้ไม่จำกัด)', rarity: 'rare', icon: '»', stack: Infinity, endless: true, apply: (p) => { p.mods.atkSpeed *= 1.04; p.mods.speedMul *= 1.04; } },
  { id: 'inf_crit', name: 'Precision', desc: 'โอกาสคริติคอล +4% (ซ้อนได้ไม่จำกัด สูงสุด 60%)', rarity: 'rare', icon: '◎', stack: Infinity, endless: true, can: (p) => p.mods.crit < 0.6, apply: (p) => (p.mods.crit = Math.min(0.6, p.mods.crit + 0.04)) },
];

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/**
 * pick n distinct offers; forceWeapon guarantees a weapon unlock when available.
 * endless: also offers the infinitely stackable cards; minRarity: boss rewards skip commons when possible.
 */
export function rollUpgrades(p: Player, taken: Record<string, number>, n = 3, forceWeapon = false, opts: { endless?: boolean; minRarity?: Rarity } = {}): Upgrade[] {
  let pool = UPGRADES.filter((u) => (taken[u.id] ?? 0) < (u.stack ?? 1) && (!u.can || u.can(p)) && (!u.endless || opts.endless));
  if (opts.minRarity) {
    const hi = pool.filter((u) => RANK[u.rarity] >= RANK[opts.minRarity!]);
    if (hi.length >= n) pool = hi;
  }
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
