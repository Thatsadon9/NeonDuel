/**
 * ECHO CODEX — permanent, power-neutral progression saved in localStorage:
 * Echo Shards (currency) unlock new weapon families, the B path of each family, and colour skins.
 * Also records which enemies/bosses the player has met (lore entries).
 */
import type { WeaponId } from './weapons';

export interface CodexData {
  shards: number;
  weapons: WeaponId[];
  pathB: WeaponId[];
  skins: string[];
  skin: string; // active skin id ('' = default)
  seen: string[]; // enemy/boss ids met
  bossesBeaten: string[];
  act1Cleared: boolean;
}

const KEY = 'neonduel.codex.v1';
const DEFAULT: CodexData = {
  shards: 0, weapons: ['katana', 'daggers', 'hammer'], pathB: [], skins: [], skin: '', seen: [], bossesBeaten: [], act1Cleared: false,
};

export const PRICES = {
  weapon: { scythe: 600, gauntlets: 600, bow: 900 } as Partial<Record<WeaponId, number>>,
  pathB: 300,
};
/** weapon neon recolours — purely cosmetic */
export const SKINS: { id: string; name: string; color: string; price: number }[] = [
  { id: 'crimson', name: 'CRIMSON', color: '#ff3c5a', price: 200 },
  { id: 'gold', name: 'GOLD', color: '#ffd24d', price: 300 },
  { id: 'void', name: 'VOID', color: '#b06bff', price: 500 },
];

let data: CodexData = load();

function load(): CodexData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (raw && typeof raw === 'object') return { ...DEFAULT, ...raw };
  } catch { /* first run */ }
  return { ...DEFAULT, weapons: [...DEFAULT.weapons] };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage unavailable */ }
}

export const codex = {
  get data() {
    return data;
  },
  reload() {
    data = load();
  },
  hasWeapon(id: WeaponId) {
    return data.weapons.includes(id);
  },
  hasPathB(id: WeaponId) {
    return data.pathB.includes(id);
  },
  skinColor(): string | null {
    return SKINS.find((s) => s.id === data.skin)?.color ?? null;
  },
  addShards(n: number) {
    data.shards += Math.max(0, Math.round(n));
    save();
  },
  /** spend shards; returns false if not affordable */
  buy(kind: 'weapon' | 'pathB' | 'skin', id: string): boolean {
    const price = kind === 'weapon' ? PRICES.weapon[id as WeaponId] ?? 0 : kind === 'pathB' ? PRICES.pathB : SKINS.find((s) => s.id === id)?.price ?? 0;
    if (data.shards < price) return false;
    if (kind === 'weapon' && !data.weapons.includes(id as WeaponId)) data.weapons.push(id as WeaponId);
    else if (kind === 'pathB' && !data.pathB.includes(id as WeaponId)) data.pathB.push(id as WeaponId);
    else if (kind === 'skin' && !data.skins.includes(id)) data.skins.push(id);
    else return false;
    data.shards -= price;
    save();
    return true;
  },
  setSkin(id: string) {
    data.skin = data.skin === id ? '' : id;
    save();
  },
  meet(id: string) {
    if (!data.seen.includes(id)) {
      data.seen.push(id);
      save();
    }
  },
  /** returns true the first time this boss is beaten (first-kill bonus) */
  beatBoss(id: string): boolean {
    if (data.bossesBeaten.includes(id)) return false;
    data.bossesBeaten.push(id);
    save();
    return true;
  },
  clearAct1() {
    data.act1Cleared = true;
    save();
  },
  /** admin: unlock every weapon, B path, skin and Act II */
  debugUnlockAll() {
    data.weapons = ['katana', 'daggers', 'hammer', 'scythe', 'gauntlets', 'bow'];
    data.pathB = [...data.weapons];
    data.skins = SKINS.map((k) => k.id);
    data.act1Cleared = true;
    save();
  },
  /** admin: back to a fresh profile */
  debugReset() {
    data = { ...DEFAULT, weapons: [...DEFAULT.weapons], pathB: [], skins: [], seen: [], bossesBeaten: [] };
    save();
  },
};
