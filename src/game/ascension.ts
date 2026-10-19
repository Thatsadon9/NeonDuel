/**
 * ASCENSION — weapons grow from a worn T0 form to a mythic T4 form.
 * Resonance (earned by fighting with a weapon) + Rift Cores (dropped by bosses) unlock each tier;
 * at T3 the player picks path A or B. See docs/UPDATE_ASCENSION.md.
 */
import type { WeaponId } from './weapons';
import { T } from './tuning';

export type Tier = 0 | 1 | 2 | 3 | 4;
export type PathId = 'a' | 'b';
export interface Prog {
  res: number;
  tier: Tier;
  path: PathId | null;
}

/** resonance needed to REACH each tier */
export const TIER_REQ = [0, 120, 400, 800, 1900];
/** rift cores consumed to reach each tier */
export const CORE_REQ = [0, 0, 0, 1, 2];
/** weapon damage multiplier per tier (damage only — never defence) */
export const TIER_DMG = T.tierDmg;
export const TIER_NAMES = ['WORN', 'TEMPERED', 'AWAKENED', 'ASCENDED', 'MYTHIC'];
export const TIER_THAI = ['สึกกร่อน', 'ผ่านไฟ', 'ตื่น', 'เลื่อนขั้น', 'ตำนาน'];
/** what each tier unlocks (shown on the ascension screen) */
export const TIER_UNLOCKS = [
  ['คอมโบ 3 จังหวะ', 'Dash · Block · Parry'],
  ['คอมโบเต็ม', 'ท่าชาร์จ (กดค้าง)', 'Dash Attack', `ดาเมจ ×${TIER_DMG[1]}`],
  ['สกิล Q', 'สกิล E พื้นฐาน (อาวุธเดิม)', `ดาเมจ ×${TIER_DMG[2]}`],
  ['เลือกสาย A / B', 'สกิล E ประจำสาย', 'Passive ประจำสาย', `ดาเมจ ×${TIER_DMG[3]}`],
  ['Signature Ultimate (R)', 'Passive แรงขึ้น ×1.5', `ดาเมจ ×${TIER_DMG[4]}`],
];

export interface FormInfo {
  name: string;
  color: string;
}
export interface PathInfo {
  name: string;
  thai: string;
  color: string;
  passive: string;
  e: string;
  ult: string;
  mythic: string;
}
export interface Family {
  forms: { t0: FormInfo; t1: FormInfo; t2: FormInfo };
  a: PathInfo;
  b: PathInfo;
}

export const FAMILIES: Record<WeaponId, Family> = {
  katana: {
    forms: { t0: { name: 'Rusted Katana', color: '#9a8f86' }, t1: { name: 'Tempered Katana', color: '#bfefff' }, t2: { name: 'Neon Katana', color: '#7ff6ff' } },
    a: { name: 'RAIJIN', thai: 'สายฟ้า', color: '#5ad8ff', mythic: 'TAKEMIKAZUCHI', passive: 'ทุกการตีครั้งที่ 4 ปล่อยสายฟ้าโซ่ · Dash ผ่านศัตรูทิ้งประจุไฟฟ้า', e: 'THUNDERCLAP STEP — วาร์ปฟันสายฟ้า 3 ครั้ง', ult: "HEAVEN'S VERDICT — ฟ้าผ่า 6 ครั้ง + ร่างสายฟ้า 3 วินาที" },
    b: { name: 'YAMI', thai: 'เงามืด', color: '#9d5bff', mythic: 'TSUKUYOMI', passive: 'คริติคอลทิ้งรอยจันทร์ — ซ้อน 3 ชั้นระเบิด · คริติคอล +10%', e: 'MOON SEVERANCE — รอยฟันจันทร์เสี้ยวตกใส่พื้นที่', ult: 'ECLIPSE — หยุดเวลาศัตรู 1.4 วินาที (บอส 0.8) แล้วดาเมจ 35% ระเบิดซ้ำ' },
  },
  daggers: {
    forms: { t0: { name: 'Bent Knives', color: '#9a8f86' }, t1: { name: 'Paired Stilettos', color: '#ffc4da' }, t2: { name: 'Twin Fangs', color: '#ff4d8a' } },
    a: { name: 'VENOM', thai: 'พิษ', color: '#7dff4d', mythic: 'HYDRA FANGS', passive: 'เลือดไหลกลายเป็นพิษ ซ้อน 10 ชั้นแล้วระเบิดติดศัตรูรอบข้าง', e: 'TOXIC BLOOM — ปาขวดพิษ เมฆพิษขยายดาเมจ', ult: 'PLAGUE TIDE — ศัตรูที่ติดพิษระเบิดเป็นลูกโซ่' },
    b: { name: 'PHANTOM', thai: 'ภาพลวง', color: '#c9b8ff', mythic: 'MIRAGE FANGS', passive: 'Perfect Dodge สร้างร่างเงาที่ฟันตาม', e: 'SHADOW PACK — เรียกร่างเงา 2 ตัวสู้ข้างเรา', ult: 'HUNDRED SHADOWS — ร่างเงา 8 ตัวพุ่งฟันข้ามจอ' },
  },
  hammer: {
    forms: { t0: { name: 'Iron Maul', color: '#9a8f86' }, t1: { name: 'Forged Hammer', color: '#ffd9a0' }, t2: { name: 'Graviton', color: '#ffb347' } },
    a: { name: 'MAGMA', thai: 'ลาวา', color: '#ff5a1f', mythic: 'RAGNAROK MAUL', passive: 'ทุบพื้นทิ้งรอยแยกลาวาลุกไหม้', e: 'ERUPTION — เสาภูเขาไฟ 3 ต้นตามแนวเล็ง', ult: 'WORLD BREAKER — แผ่นดินไหวทั้งสนาม' },
    b: { name: 'SINGULARITY', thai: 'หลุมดำ', color: '#b06bff', mythic: 'COLLAPSE', passive: 'การตีดึงศัตรูเข้าหา · กระสุนศัตรูใกล้ตัวช้าลง 25%', e: 'EVENT HORIZON — สนามโน้มถ่วงรอบตัว กระสุนช้า 70%', ult: 'BLACK STAR — หลุมดำยักษ์ดูดแล้วยุบตัว' },
  },
  scythe: {
    forms: { t0: { name: 'Field Sickle', color: '#9a8f86' }, t1: { name: 'Iron Scythe', color: '#c8ffe8' }, t2: { name: 'Reaper Chain', color: '#3dffb0' } },
    a: { name: 'HARVEST', thai: 'วิญญาณ', color: '#9dff6b', mythic: 'THANATOS', passive: 'ศัตรูตายทิ้งดวงวิญญาณ เก็บแล้วฟื้น HP (1 ดวง/วินาที)', e: 'SOUL REAP — วงเคียวยักษ์ ประหารลูกน้อง HP < 20%', ult: 'LAST HARVEST — ประหารลูกน้อง HP < 30% ทั้งจอ · บอส −5%' },
    b: { name: 'WRAITH', thai: 'ภูตโซ่', color: '#7fb8ff', mythic: 'BANSHEE', passive: 'โซ่ผูกศัตรู — ดาเมจ 30% ส่งต่อให้ศัตรูอีกตัว', e: 'CHAINS OF BINDING — ผูกศัตรู 4 ตัวแบ่งดาเมจ', ult: 'WAILING REQUIEM — เสียงกรีดร้อง ลูกน้องหนี บอสเสีย Posture' },
  },
  gauntlets: {
    forms: { t0: { name: 'Wrapped Knuckles', color: '#9a8f86' }, t1: { name: 'Steel Knuckles', color: '#ffd0b8' }, t2: { name: 'Pulse Gauntlets', color: '#ff7a3c' } },
    a: { name: 'TITAN', thai: 'หินผา', color: '#ffb347', mythic: 'ATLAS', passive: 'Posture ×1.35 · Counter ทำให้บอสเสียหลักนานขึ้น', e: 'SEISMIC FIST — คลื่นกระแทกรูปกรวย ทำลายโล่', ult: 'MOUNTAIN BREAKER — หมัดเดียว Posture 60%' },
    b: { name: 'TEMPEST', thai: 'ลม', color: '#7dfff0', mythic: 'FUJIN', passive: 'ต่อยติดกันเร่งความเร็ว สูงสุด +25% · Dash ทิ้งพายุ', e: 'GALE RUSH — พุ่งต่อย 8 ครั้งแบบอมตะ', ult: 'THOUSAND GALE — พายุหมัด 3 วินาที' },
  },
  bow: {
    forms: { t0: { name: "Hunter's Bow", color: '#9a8f86' }, t1: { name: 'Recurve Bow', color: '#fff0b0' }, t2: { name: 'Lightbow', color: '#ffd24d' } },
    a: { name: 'STARFALL', thai: 'ดาวตก', color: '#ffe14d', mythic: 'ASTRAEA', passive: 'ลูกศรชาร์จตกเป็นอุกกาบาต AoE', e: 'METEOR ARROW — ยิงขึ้นฟ้า ตกเป็นอุกกาบาตยักษ์', ult: 'CONSTELLATION — ศรสวรรค์ตกใส่เป้า 7 ตัว' },
    b: { name: 'PRISM', thai: 'ปริซึม', color: '#e8f4ff', mythic: 'SPECTRA', passive: 'ลูกศรแตกเป็น 2 เมื่อโดนเป้า', e: 'REFRACTION — ลำแสง 6 เส้นกระจายรอบตัว', ult: 'RAINBOW LANCE — ลำแสงรุ้งกวาด 3 วินาที' },
  },
};

export function newProg(): Prog {
  return { res: 0, tier: 0, path: null };
}
export function formKey(p: Prog): string {
  if (p.tier <= 2) return 't' + p.tier;
  return `t${p.tier}${p.path ?? 'a'}`;
}
export function formName(id: WeaponId, p: Prog): string {
  const f = FAMILIES[id];
  if (p.tier <= 2) return f.forms[('t' + p.tier) as 't0' | 't1' | 't2'].name;
  const path = f[p.path ?? 'a'];
  return p.tier === 4 ? path.mythic : path.name;
}
/** neon colour of the current form (worn forms are dull) */
export function formColor(id: WeaponId, p: Prog, base: string): string {
  if (p.tier <= 1) return FAMILIES[id].forms[('t' + p.tier) as 't0' | 't1'].color;
  if (p.tier === 2) return base;
  return FAMILIES[id][p.path ?? 'a'].color;
}
/** next tier is reachable (resonance + cores), but not yet taken */
export function canAscend(p: Prog, cores: number) {
  if (p.tier >= 4) return false;
  return p.res >= TIER_REQ[p.tier + 1] && cores >= CORE_REQ[p.tier + 1];
}
/** 0..1 progress towards the next tier's resonance */
export function resProgress(p: Prog) {
  if (p.tier >= 4) return 1;
  const lo = TIER_REQ[p.tier], hi = TIER_REQ[p.tier + 1];
  return Math.max(0, Math.min(1, (p.res - lo) / (hi - lo)));
}
