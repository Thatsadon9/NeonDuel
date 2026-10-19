/**
 * Per-player control sources. Every Player reads a Controls object instead of the global keyboard:
 *  - KbmControls      keyboard + mouse (wraps the global `input`)
 *  - PadControls      one standard-mapping gamepad (twin-stick, auto-aim when the right stick is idle)
 *  - MergedControls   keyboard/mouse OR the first gamepad (single player)
 *  - RemoteControls   fed by the network (online clients)
 */
import { input, type Action } from './input';
import { cam } from '../render/camera';

export interface Vec {
  x: number;
  y: number;
}

export interface Controls {
  readonly id: string;
  /** device kind, for HUD prompts */
  readonly kind: 'kbm' | 'pad' | 'net';
  isDown(a: Action): boolean;
  pressed(a: Action): boolean;
  buffered(a: Action, window: number): boolean;
  consume(a: Action): void;
  /** analog movement, length ≤ 1 */
  move(): Vec;
  /** world point to aim at (null = keep the current aim / let the player auto-aim) */
  aim(from: Vec): Vec | null;
  /** poll devices; called once per fixed tick with the game clock */
  update(now: number): void;
  endFrame(): void;
}

// ---------------------------------------------------------------- keyboard + mouse
export class KbmControls implements Controls {
  readonly id = 'kbm';
  readonly kind = 'kbm' as const;
  isDown(a: Action) {
    return input.isDown(a);
  }
  pressed(a: Action) {
    return input.pressed(a);
  }
  buffered(a: Action, w: number) {
    return input.buffered(a, w);
  }
  consume(a: Action) {
    input.consume(a);
  }
  move(): Vec {
    let x = 0, y = 0;
    if (input.isDown('left')) x -= 1;
    if (input.isDown('right')) x += 1;
    if (input.isDown('up')) y -= 1;
    if (input.isDown('down')) y += 1;
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }
  aim(): Vec | null {
    return cam.screenToWorld(input.mouseX, input.mouseY);
  }
  update(now: number) {
    input.now = now;
  }
  endFrame() {
    /* the global input is cleared by the main loop */
  }
}

// ---------------------------------------------------------------- gamepad
/** standard mapping (Xbox layout): A dash · X attack · LB/LT guard · Y Q · B E · RB R · D-pad weapons · Start pause */
const PAD_BUTTONS: [number, Action][] = [
  [0, 'dash'], [2, 'attack'], [7, 'attack'], [4, 'guard'], [6, 'guard'], [3, 'skill1'], [1, 'skill2'], [5, 'ult'],
  [14, 'w1'], [12, 'w2'], [15, 'w3'], [9, 'pause'],
];
const DEAD = 0.22;

/** live gamepads, ignoring empty slots */
export function connectedPads(): Gamepad[] {
  return (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected);
}

export class PadControls implements Controls {
  readonly kind = 'pad' as const;
  private held = new Set<Action>();
  private pressedAt = new Map<Action, number>();
  private pressedFrame = new Set<Action>();
  private now = 0;
  private lx = 0;
  private ly = 0;
  private rx = 0;
  private ry = 0;
  /** auto-aim helper supplied by the game (nearest target direction) */
  autoAim: ((from: Vec) => Vec | null) | null = null;
  constructor(public index: number) {}
  get id() {
    return 'pad' + this.index;
  }
  get pad() {
    return navigator.getGamepads?.()[this.index] ?? null;
  }
  isDown(a: Action) {
    return this.held.has(a);
  }
  pressed(a: Action) {
    return this.pressedFrame.has(a);
  }
  buffered(a: Action, w: number) {
    const t = this.pressedAt.get(a);
    return t !== undefined && this.now - t <= w;
  }
  consume(a: Action) {
    this.pressedAt.delete(a);
    this.pressedFrame.delete(a);
  }
  move(): Vec {
    const l = Math.hypot(this.lx, this.ly);
    if (l < DEAD) return { x: 0, y: 0 };
    const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l;
    return { x: this.lx * k, y: this.ly * k };
  }
  aim(from: Vec): Vec | null {
    if (Math.hypot(this.rx, this.ry) > 0.35) return { x: from.x + this.rx * 200, y: from.y + this.ry * 200 };
    const auto = this.autoAim?.(from);
    if (auto) return auto;
    const m = this.move();
    if (m.x || m.y) return { x: from.x + m.x * 200, y: from.y + m.y * 200 };
    return null;
  }
  update(now: number) {
    this.now = now;
    const g = this.pad;
    if (!g) {
      this.held.clear();
      this.lx = this.ly = this.rx = this.ry = 0;
      return;
    }
    const ax = g.axes;
    this.lx = ax[0] ?? 0;
    this.ly = ax[1] ?? 0;
    this.rx = ax[2] ?? 0;
    this.ry = ax[3] ?? 0;
    const down = new Set<Action>();
    for (const [b, a] of PAD_BUTTONS) {
      const btn = g.buttons[b];
      if (btn && (btn.pressed || btn.value > 0.5)) down.add(a);
    }
    for (const a of down) {
      if (!this.held.has(a)) {
        this.pressedAt.set(a, now);
        this.pressedFrame.add(a);
      }
    }
    this.held = down;
  }
  endFrame() {
    this.pressedFrame.clear();
  }
  /** short rumble (where supported) */
  rumble(strength = 0.5, ms = 120) {
    const act = (this.pad as unknown as { vibrationActuator?: { playEffect?: (t: string, o: object) => void } } | null)?.vibrationActuator;
    act?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 });
  }
}

// ---------------------------------------------------------------- keyboard OR first pad (single player)
export class MergedControls implements Controls {
  readonly id = 'merged';
  private kb = new KbmControls();
  pad = new PadControls(0);
  /** whichever device was used last decides aiming */
  private last: 'kbm' | 'pad' = 'kbm';
  get kind() {
    return this.last;
  }
  isDown(a: Action) {
    return this.kb.isDown(a) || this.pad.isDown(a);
  }
  pressed(a: Action) {
    return this.kb.pressed(a) || this.pad.pressed(a);
  }
  buffered(a: Action, w: number) {
    return this.kb.buffered(a, w) || this.pad.buffered(a, w);
  }
  consume(a: Action) {
    this.kb.consume(a);
    this.pad.consume(a);
  }
  move(): Vec {
    const p = this.pad.move();
    return p.x || p.y ? p : this.kb.move();
  }
  aim(from: Vec): Vec | null {
    return this.last === 'pad' ? this.pad.aim(from) : this.kb.aim();
  }
  update(now: number) {
    this.kb.update(now);
    const g = connectedPads()[0];
    this.pad.index = g ? g.index : 0;
    this.pad.update(now);
    const p = this.pad.move();
    if (p.x || p.y || PAD_BUTTONS.some(([, a]) => this.pad.pressed(a))) this.last = 'pad';
    if (input.mouseMoved) {
      this.last = 'kbm';
      input.mouseMoved = false;
    }
  }
  endFrame() {
    this.pad.endFrame();
  }
}

// ---------------------------------------------------------------- network
export const NET_ACTIONS: Action[] = ['attack', 'guard', 'dash', 'skill1', 'skill2', 'ult', 'w1', 'w2', 'w3'];

/** state sent by an online client every tick */
export interface NetInput {
  b: number; // held bitmask (NET_ACTIONS order)
  p: number; // presses since last packet
  mx: number; // movement ×100
  my: number;
  ax: number | null; // aim point (world)
  ay: number | null;
  /** client-predicted position/velocity of its own fighter (client owns its movement) */
  pos?: [number, number, number, number];
}

export class RemoteControls implements Controls {
  readonly kind = 'net' as const;
  private held = new Set<Action>();
  private pressedAt = new Map<Action, number>();
  private pressedFrame = new Set<Action>();
  private pending = 0;
  private now = 0;
  private mv: Vec = { x: 0, y: 0 };
  private aimPt: Vec | null = null;
  /** latest client-owned position (x, y, vx, vy) */
  pos: [number, number, number, number] | null = null;
  constructor(readonly id: string) {}
  feed(s: NetInput) {
    if (s.pos) this.pos = s.pos;
    this.held.clear();
    NET_ACTIONS.forEach((a, i) => {
      if (s.b & (1 << i)) this.held.add(a);
    });
    this.pending |= s.p;
    this.mv = { x: s.mx / 100, y: s.my / 100 };
    this.aimPt = s.ax === null || s.ay === null ? null : { x: s.ax, y: s.ay };
  }
  isDown(a: Action) {
    return this.held.has(a);
  }
  pressed(a: Action) {
    return this.pressedFrame.has(a);
  }
  buffered(a: Action, w: number) {
    const t = this.pressedAt.get(a);
    return t !== undefined && this.now - t <= w;
  }
  consume(a: Action) {
    this.pressedAt.delete(a);
    this.pressedFrame.delete(a);
  }
  move() {
    return this.mv;
  }
  aim(): Vec | null {
    return this.aimPt;
  }
  update(now: number) {
    this.now = now;
    if (!this.pending) return;
    NET_ACTIONS.forEach((a, i) => {
      if (this.pending & (1 << i)) {
        this.pressedAt.set(a, now);
        this.pressedFrame.add(a);
      }
    });
    this.pending = 0;
  }
  endFrame() {
    this.pressedFrame.clear();
  }
}

/** pack local controls into a network packet (presses = edges since the last packet) */
export class InputPacker {
  private presses = 0;
  sample(c: Controls) {
    NET_ACTIONS.forEach((a, i) => {
      if (c.pressed(a)) this.presses |= 1 << i;
    });
  }
  pack(c: Controls, from: Vec, pos?: [number, number, number, number]): NetInput {
    let b = 0;
    NET_ACTIONS.forEach((a, i) => {
      if (c.isDown(a)) b |= 1 << i;
    });
    const m = c.move();
    const aim = c.aim(from);
    const out: NetInput = { b, p: this.presses, mx: Math.round(m.x * 100), my: Math.round(m.y * 100), ax: aim ? Math.round(aim.x) : null, ay: aim ? Math.round(aim.y) : null };
    if (pos) out.pos = pos.map((v) => Math.round(v * 10) / 10) as [number, number, number, number];
    this.presses = 0;
    return out;
  }
}
