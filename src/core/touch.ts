/**
 * Touch controls for phones / tablets.
 *  - left half: floating move stick (appears under your thumb)
 *  - right: big ATTACK button — tap = combo, hold = charge, DRAG it = aim stick (otherwise auto-aim)
 *    around it DASH · GUARD (tap = parry, hold = block) · Q · E · R, plus weapon swap and pause.
 * Turns itself on at the first touch; mouse / keyboard / gamepad keep working alongside.
 */
import type { Action } from './input';
import type { Controls, Vec } from './controls';
import { sprites } from '../render/sprites';
import { safeInsets } from '../ui/safe';

type BtnId = 'attack' | 'dash' | 'guard' | 'skill1' | 'skill2' | 'ult' | 'wnext' | 'pause';
interface Btn { id: BtnId; x: number; y: number; r: number; label: string; touch: number | null; dx: number; dy: number }
export interface TouchHudInfo {
  /** skill icons / readiness for the buttons */
  q?: { icon: string; ready: boolean; locked: boolean; cd?: number } | null;
  e?: { icon: string; ready: boolean; locked: boolean; cd?: number } | null;
  r?: { icon: string; ready: boolean; locked: boolean; cd?: number } | null;
  dashes?: number;
  canSwap?: boolean;
  color?: string;
}

const STICK_MAX = 58; // px of thumb travel for full speed
const AIM_DEAD = 16;

export class TouchControls implements Controls {
  readonly id = 'touch';
  readonly kind = 'touch' as const;
  /** becomes true at the first touch on the game canvas */
  enabled = false;
  /** true when touch was the last input used (merged controls switch aiming to it) */
  usedRecently = false;
  /** auto-aim helper (nearest enemy), supplied by the game */
  autoAim: ((from: Vec) => Vec | null) | null = null;
  /** HUD data for the button faces, supplied each frame by the game */
  info: TouchHudInfo = {};
  private w = 1;
  private h = 1;
  private u = 60;
  private stick = { id: null as number | null, ox: 0, oy: 0, x: 0, y: 0 };
  private btns: Btn[] = [];
  private held = new Set<Action>();
  private pending = new Set<Action>();
  private pressedAt = new Map<Action, number>();
  private pressedFrame = new Set<Action>();
  private now = 0;
  private aimDir: Vec | null = null;

  attach(el: HTMLElement) {
    const opt = { passive: false } as AddEventListenerOptions;
    el.addEventListener('touchstart', (e) => this.onStart(e), opt);
    el.addEventListener('touchmove', (e) => this.onMove(e), opt);
    el.addEventListener('touchend', (e) => this.onEnd(e), opt);
    el.addEventListener('touchcancel', (e) => this.onEnd(e), opt);
    // a real mouse / key means the player switched device
    window.addEventListener('keydown', () => (this.usedRecently = false));
    window.addEventListener('mousemove', (e) => {
      if ((e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities?.firesTouchEvents) return;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.usedRecently = false;
    });
    this.layout(window.innerWidth, window.innerHeight);
  }

  /** button positions from the screen size (and the notch / home-bar safe areas) */
  layout(w: number, h: number) {
    this.w = w;
    this.h = h;
    const ins = safeInsets();
    const sr = ins.right, sb = ins.bottom, st = ins.top, sl = ins.left;
    const u = Math.max(40, Math.min(72, Math.min(w, h) * 0.105));
    this.u = u;
    const ax = w - sr - u * 1.55, ay = h - sb - u * 1.5;
    const ring = (deg: number, dist: number) => [ax + Math.cos((deg * Math.PI) / 180) * dist * u, ay + Math.sin((deg * Math.PI) / 180) * dist * u];
    const mk = (id: BtnId, [x, y]: number[], r: number, label: string): Btn => ({ id, x, y, r: r * u, label, touch: null, dx: 0, dy: 0 });
    this.btns = [
      mk('attack', [ax, ay], 1.05, 'ATK'),
      mk('dash', ring(180, 2.15), 0.66, 'DASH'),
      mk('guard', ring(222, 2.1), 0.62, 'GUARD'),
      mk('skill1', ring(258, 2.15), 0.56, 'Q'),
      mk('skill2', ring(294, 2.15), 0.56, 'E'),
      mk('ult', ring(262, 3.45), 0.5, 'R'),
      mk('wnext', [sl + u * 0.85, h - sb - u * 3.75], 0.42, '⇄'),
      mk('pause', [w - sr - u * 0.6, st + u * 0.6], 0.36, 'II'),
    ];
  }

  // ---------------------------------------------------------------- touch events
  private menuOpen() {
    return document.getElementById('ui')?.classList.contains('show') ?? false;
  }
  private hit(x: number, y: number): Btn | null {
    let best: Btn | null = null, bd = Infinity;
    for (const b of this.btns) {
      const d = Math.hypot(x - b.x, y - b.y);
      // generous hit area — thumbs are big
      if (d < b.r * 1.25 && d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }
  private onStart(e: TouchEvent) {
    this.enabled = true;
    this.usedRecently = true;
    if (this.menuOpen()) return; // DOM menus handle their own taps
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const b = this.hit(t.clientX, t.clientY);
      if (b && b.touch === null) {
        b.touch = t.identifier;
        b.dx = b.dy = 0;
        this.down(b.id);
        continue;
      }
      // anywhere on the left 55% (not on a button) → move stick
      if (this.stick.id === null && t.clientX < this.w * 0.55) {
        this.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
      }
    }
  }
  private onMove(e: TouchEvent) {
    if (this.menuOpen()) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stick.id) {
        this.stick.x = t.clientX;
        this.stick.y = t.clientY;
        // the stick base follows a thumb that drifts too far
        const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
        if (d > STICK_MAX * 1.6) {
          this.stick.ox = this.stick.x - (dx / d) * STICK_MAX * 1.6;
          this.stick.oy = this.stick.y - (dy / d) * STICK_MAX * 1.6;
        }
      }
      const b = this.btns.find((x) => x.touch === t.identifier);
      if (b) {
        b.dx = t.clientX - b.x;
        b.dy = t.clientY - b.y;
        if (b.id === 'attack') {
          const d = Math.hypot(b.dx, b.dy);
          this.aimDir = d > AIM_DEAD ? { x: b.dx / d, y: b.dy / d } : null;
        }
      }
    }
  }
  private onEnd(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stick.id) this.stick.id = null;
      const b = this.btns.find((x) => x.touch === t.identifier);
      if (b) {
        b.touch = null;
        this.held.delete(b.id as Action);
        if (b.id === 'attack') this.aimDir = null;
      }
    }
    if (!this.menuOpen()) e.preventDefault();
  }
  private down(id: BtnId) {
    if (id !== 'pause' && id !== 'wnext') this.held.add(id as Action);
    this.pending.add(id as Action);
    navigator.vibrate?.(8);
  }
  /** drop all touches (e.g. a menu opened mid-press) */
  reset() {
    this.stick.id = null;
    for (const b of this.btns) b.touch = null;
    this.held.clear();
    this.aimDir = null;
  }

  // ---------------------------------------------------------------- Controls
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
    if (this.stick.id === null) return { x: 0, y: 0 };
    const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
    if (d < 6) return { x: 0, y: 0 };
    const k = Math.min(1, d / STICK_MAX) / d;
    return { x: dx * k, y: dy * k };
  }
  aim(from: Vec): Vec | null {
    if (this.aimDir) return { x: from.x + this.aimDir.x * 200, y: from.y + this.aimDir.y * 200 };
    const auto = this.autoAim?.(from);
    if (auto) return auto;
    const m = this.move();
    if (m.x || m.y) return { x: from.x + m.x * 200, y: from.y + m.y * 200 };
    return null;
  }
  update(now: number) {
    this.now = now;
    if (this.menuOpen() && (this.held.size || this.stick.id !== null)) this.reset();
    for (const a of this.pending) {
      this.pressedAt.set(a, now);
      this.pressedFrame.add(a);
    }
    this.pending.clear();
  }
  endFrame() {
    this.pressedFrame.clear();
  }

  // ---------------------------------------------------------------- drawing (screen space)
  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.enabled) return;
    if (w !== this.w || h !== this.h) this.layout(w, h);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const col = this.info.color ?? '#7ff6ff';
    // move stick
    const s = this.stick;
    const bx = s.id !== null ? s.ox : this.u * 1.9, by = s.id !== null ? s.oy : h - this.u * 1.9;
    ctx.globalAlpha = s.id !== null ? 0.9 : 0.35;
    ctx.strokeStyle = 'rgba(127,246,255,0.6)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(8,12,30,0.35)';
    ctx.beginPath();
    ctx.arc(bx, by, STICK_MAX + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const m = this.move();
    ctx.fillStyle = 'rgba(127,246,255,0.55)';
    ctx.beginPath();
    ctx.arc(bx + m.x * STICK_MAX, by + m.y * STICK_MAX, 24, 0, Math.PI * 2);
    ctx.fill();
    // buttons
    for (const b of this.btns) {
      const on = b.touch !== null;
      let face = b.label, icon: string | null = null, dim = false;
      const sk = b.id === 'skill1' ? this.info.q : b.id === 'skill2' ? this.info.e : b.id === 'ult' ? this.info.r : undefined;
      if (sk !== undefined) {
        if (sk === null || sk.locked) dim = true;
        else {
          icon = sk.icon;
          dim = !sk.ready;
        }
      }
      if (b.id === 'wnext' && !this.info.canSwap) continue;
      ctx.globalAlpha = dim ? 0.35 : on ? 0.95 : 0.7;
      ctx.fillStyle = on ? 'rgba(127,246,255,0.28)' : 'rgba(8,12,30,0.55)';
      ctx.strokeStyle = b.id === 'attack' ? col : b.id === 'dash' ? '#7ff6ff' : b.id === 'guard' ? '#ffe14d' : 'rgba(200,210,255,0.6)';
      ctx.lineWidth = b.id === 'attack' ? 3 : 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (icon && sprites.draw(ctx, icon, b.x, b.y, { w: b.r * 1.35 })) {
        /* skill icon */
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.round(b.r * (face.length > 2 ? 0.42 : 0.6))}px Orbitron, sans-serif`;
        ctx.fillText(face, b.x, b.y + 1);
      }
      // cooldown sweep
      if (sk && sk.cd && sk.cd > 0) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sk.cd);
        ctx.closePath();
        ctx.fill();
      }
      // dash charges
      if (b.id === 'dash' && this.info.dashes !== undefined) {
        for (let i = 0; i < this.info.dashes; i++) {
          ctx.fillStyle = '#7ff6ff';
          ctx.beginPath();
          ctx.arc(b.x - 8 + i * 8, b.y + b.r * 0.62, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // aim drag indicator on the attack button
      if (b.id === 'attack' && on && this.aimDir) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + this.aimDir.x * b.r * 1.4, b.y + this.aimDir.y * b.r * 1.4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** one touch surface per screen */
export const touch = new TouchControls();
