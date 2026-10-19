/** Keyboard + mouse state with edge detection and timestamped presses (for input buffering). */
import { bindings } from './bindings';
export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'attack' | 'guard' | 'dash'
  | 'skill1' | 'skill2' | 'ult'
  | 'w1' | 'w2' | 'w3'
  | 'wnext'
  | 'pause' | 'debug' | 'skip';


class Input {
  private held = new Map<Action, number>(); // count of sources holding
  private pressedAt = new Map<Action, number>(); // performance.now() of last press
  private pressedFrame = new Set<Action>();
  private releasedFrame = new Set<Action>();
  mouseX = 0;
  mouseY = 0;
  /** set on mouse movement (lets merged controls switch aiming back to the mouse) */
  mouseMoved = false;
  /** game-clock time used for buffering, set by the loop */
  now = 0;
  enabled = true;
  /** true while a rebinding prompt owns the keyboard */
  capture = false;

  attach(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (this.capture) return; // the Settings screen is listening for a new binding
      const a = bindings.keyAction(e.code);
      if (!a) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'F1' || e.code === 'F2' || (e.code === 'Tab' && !(e.target instanceof HTMLInputElement))) e.preventDefault();
      if (e.repeat) return;
      this.down(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = bindings.keyAction(e.code);
      if (a) this.up(a);
    });
    el.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseMoved = true;
    });
    el.addEventListener('mousedown', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (e.button === 0) this.down('attack');
      if (e.button === 2) this.down('guard');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.up('attack');
      if (e.button === 2) this.up('guard');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => {
      this.held.clear();
    });
  }

  private down(a: Action) {
    this.held.set(a, (this.held.get(a) ?? 0) + 1);
    this.pressedAt.set(a, this.now);
    this.pressedFrame.add(a);
  }
  private up(a: Action) {
    const n = (this.held.get(a) ?? 0) - 1;
    if (n <= 0) {
      this.held.delete(a);
      this.releasedFrame.add(a);
    } else this.held.set(a, n);
  }

  isDown(a: Action) {
    return this.enabled && this.held.has(a);
  }
  pressed(a: Action) {
    return this.enabled && this.pressedFrame.has(a);
  }
  released(a: Action) {
    return this.releasedFrame.has(a);
  }
  /** true if pressed within the last `window` seconds and not yet consumed */
  buffered(a: Action, window: number) {
    if (!this.enabled) return false;
    const t = this.pressedAt.get(a);
    return t !== undefined && this.now - t <= window;
  }
  consume(a: Action) {
    this.pressedAt.delete(a);
    this.pressedFrame.delete(a);
  }
  /** call at end of each fixed tick */
  endFrame() {
    this.pressedFrame.clear();
    this.releasedFrame.clear();
  }
  clearAll() {
    this.pressedAt.clear();
    this.pressedFrame.clear();
    this.releasedFrame.clear();
  }
}

export const input = new Input();
