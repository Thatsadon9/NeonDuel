/**
 * Gamepad navigation for every DOM menu: D-pad / left stick moves a highlight between buttons and cards
 * (spatial navigation), A clicks, B = Escape, Start = Enter. Any connected pad can drive the menus.
 * Screens with their own pad handling (the local lobby) set `padnav.suspended`.
 */
import { connectedPads } from '../core/controls';

const FOCUSABLE = '.card:not(.locked), button:not(:disabled), input, select';
type Dir = 'up' | 'down' | 'left' | 'right';

class PadNav {
  suspended = false;
  private prev = new Map<number, Set<string>>();
  private repeatT = new Map<string, number>();
  private focused: HTMLElement | null = null;

  start() {
    const loop = (now: number) => {
      this.poll(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // mouse users take over again
    window.addEventListener('mousemove', () => this.clear(), { passive: true });
  }

  private clear() {
    this.focused?.classList.remove('padfocus');
    this.focused = null;
  }

  private root() {
    const ui = document.getElementById('ui');
    return ui && ui.classList.contains('show') ? ui : null;
  }

  private poll(now: number) {
    const root = this.root();
    if (!root || this.suspended) {
      if (!root) this.clear();
      this.prev.clear();
      return;
    }
    if (this.focused && !root.contains(this.focused)) this.focused = null;
    for (const g of connectedPads()) {
      const down = new Set<string>();
      const b = (i: number) => !!g.buttons[i]?.pressed;
      if (b(12) || (g.axes[1] ?? 0) < -0.6) down.add('up');
      if (b(13) || (g.axes[1] ?? 0) > 0.6) down.add('down');
      if (b(14) || (g.axes[0] ?? 0) < -0.6) down.add('left');
      if (b(15) || (g.axes[0] ?? 0) > 0.6) down.add('right');
      if (b(0)) down.add('a');
      if (b(1)) down.add('b');
      if (b(9)) down.add('start');
      const prev = this.prev.get(g.index) ?? new Set<string>();
      for (const k of down) {
        const key = g.index + k;
        const fresh = !prev.has(k);
        // directions auto-repeat while held
        const rep = !fresh && (k === 'up' || k === 'down' || k === 'left' || k === 'right') && now > (this.repeatT.get(key) ?? Infinity);
        if (fresh) this.repeatT.set(key, now + 380);
        else if (rep) this.repeatT.set(key, now + 120);
        if (fresh || rep) this.press(root, k);
      }
      this.prev.set(g.index, down);
    }
  }

  private press(root: HTMLElement, k: string) {
    if (k === 'b') return key('Escape');
    if (k === 'start') return key('Enter');
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    if (!this.focused) {
      this.focus(root.querySelector<HTMLElement>('.card:not(.locked)') ?? root.querySelector<HTMLElement>('button.big') ?? items[0]);
      if (k !== 'a') return;
    }
    if (k === 'a') {
      const f = this.focused!;
      if (f instanceof HTMLInputElement && f.type === 'range') return;
      f.click();
      return;
    }
    const f = this.focused!;
    if (f instanceof HTMLInputElement && f.type === 'range' && (k === 'left' || k === 'right')) {
      const step = Number(f.step) || 0.05;
      f.value = String(Number(f.value) + (k === 'left' ? -step : step));
      f.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const next = spatial(f, items, k as Dir);
    if (next) this.focus(next);
  }

  private focus(el: HTMLElement | null) {
    if (!el) return;
    this.focused?.classList.remove('padfocus');
    this.focused = el;
    el.classList.add('padfocus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.dispatchEvent(new Event('mouseenter'));
  }
}

function key(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
}

/** nearest element in a direction (primary distance + penalty for sideways offset) */
function spatial(from: HTMLElement, items: HTMLElement[], dir: Dir): HTMLElement | null {
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best: HTMLElement | null = null, bs = Infinity;
  for (const el of items) {
    if (el === from) continue;
    const q = el.getBoundingClientRect();
    const x = q.left + q.width / 2, y = q.top + q.height / 2;
    const dx = x - cx, dy = y - cy;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 4) continue;
    const score = along + side * 2.2;
    if (score < bs) {
      bs = score;
      best = el;
    }
  }
  return best;
}

export const padnav = new PadNav();
