/** Rebindable controls (keyboard + gamepad), saved per device. */
import type { Action } from './input';

export const REBINDABLE: { a: Action; label: string }[] = [
  { a: 'up', label: 'เดินขึ้น' }, { a: 'down', label: 'เดินลง' }, { a: 'left', label: 'เดินซ้าย' }, { a: 'right', label: 'เดินขวา' },
  { a: 'attack', label: 'โจมตี' }, { a: 'guard', label: 'Parry / Block' }, { a: 'dash', label: 'Dash' },
  { a: 'skill1', label: 'สกิล Q' }, { a: 'skill2', label: 'สกิล E' }, { a: 'ult', label: 'R (Overdrive / Ultimate)' },
  { a: 'w1', label: 'อาวุธ 1' }, { a: 'w2', label: 'อาวุธ 2' }, { a: 'w3', label: 'อาวุธ 3' }, { a: 'wnext', label: 'สลับอาวุธถัดไป' },
  { a: 'heal', label: 'ใช้ขวดยา (Heal)' },
  { a: 'pause', label: 'พักเกม' },
];

const KEY_DEFAULTS: Partial<Record<Action, string[]>> = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'], guard: ['ShiftLeft', 'KeyK'], dash: ['Space', 'KeyL'],
  skill1: ['KeyQ'], skill2: ['KeyE'], ult: ['KeyR'], w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], wnext: ['Tab'], heal: ['KeyF'], pause: ['Escape', 'KeyP'],
};
/** standard mapping (Xbox layout) */
const PAD_DEFAULTS: Partial<Record<Action, number[]>> = {
  dash: [0], attack: [2, 7], guard: [4, 6], skill1: [3], skill2: [1], ult: [5], w1: [14], w2: [12], w3: [15], heal: [13], pause: [9],
};
/** never rebindable */
const FIXED: Record<string, Action> = { F1: 'debug', F2: 'skip', ShiftRight: 'guard' };

const KEY = 'neonduel.bindings.v1';
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

function load(): { keys: Partial<Record<Action, string[]>>; pads: Partial<Record<Action, number[]>> } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (v && v.keys && v.pads) {
      // actions added after these bindings were saved get their defaults (if those inputs are still free)
      const usedK = new Set(Object.values(v.keys).flat()), usedP = new Set(Object.values(v.pads).flat());
      for (const [a, d] of Object.entries(KEY_DEFAULTS)) if (!(a in v.keys)) v.keys[a] = d!.filter((c) => !usedK.has(c));
      for (const [a, d] of Object.entries(PAD_DEFAULTS)) if (!(a in v.pads)) v.pads[a] = d!.filter((b) => !usedP.has(b));
      return v;
    }
  } catch { /* defaults */ }
  return { keys: clone(KEY_DEFAULTS), pads: clone(PAD_DEFAULTS) };
}

class Bindings {
  keys: Partial<Record<Action, string[]>>;
  pads: Partial<Record<Action, number[]>>;
  private keyMap = new Map<string, Action>();
  private padPairs: [number, Action][] = [];
  constructor() {
    const v = load();
    this.keys = v.keys;
    this.pads = v.pads;
    this.rebuild();
  }
  private rebuild() {
    this.keyMap.clear();
    for (const [code, a] of Object.entries(FIXED)) this.keyMap.set(code, a);
    for (const [a, codes] of Object.entries(this.keys)) for (const c of codes ?? []) if (c) this.keyMap.set(c, a as Action);
    this.padPairs = [];
    for (const [a, btns] of Object.entries(this.pads)) for (const b of btns ?? []) if (b >= 0) this.padPairs.push([b, a as Action]);
  }
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ keys: this.keys, pads: this.pads }));
    } catch { /* ignore */ }
    this.rebuild();
  }
  keyAction(code: string): Action | undefined {
    return this.keyMap.get(code);
  }
  padList() {
    return this.padPairs;
  }
  /** bind a key to slot 0/1 of an action (removing it from any other action) */
  setKey(a: Action, slot: number, code: string) {
    for (const list of Object.values(this.keys)) if (list) for (let i = 0; i < list.length; i++) if (list[i] === code) list[i] = '';
    const l = (this.keys[a] ??= []);
    l[slot] = code;
    this.save();
  }
  setPad(a: Action, slot: number, btn: number) {
    for (const list of Object.values(this.pads)) if (list) for (let i = 0; i < list.length; i++) if (list[i] === btn) list[i] = -1;
    const l = (this.pads[a] ??= []);
    l[slot] = btn;
    this.save();
  }
  reset() {
    this.keys = clone(KEY_DEFAULTS);
    this.pads = clone(PAD_DEFAULTS);
    this.save();
  }
}
export const bindings = new Bindings();

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→', 'HOME'];
export const padName = (b: number | undefined) => (b === undefined || b < 0 ? '—' : PAD_NAMES[b] ?? 'B' + b);
export const keyName = (c: string | undefined) => {
  if (!c) return '—';
  return c.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('Left', ' L').replace('Right', ' R').replace('Space', 'SPACE').replace('Escape', 'ESC');
};
