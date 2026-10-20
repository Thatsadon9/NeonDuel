/**
 * UI MOTION — screen enter / leave transitions, staggered reveals, button ripples, count-ups and fly-to effects.
 * Everything uses the Web Animations API (no CSS class juggling) and collapses to instant when Reduce Motion is on.
 */
export const motion = { reduce: false };

export function reduced() {
  return motion.reduce || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** the house curve: fast out, soft landing */
export const EASE = 'cubic-bezier(.2,.9,.25,1)';
export const POP = 'cubic-bezier(.2,1.4,.35,1)';

/** screens that animate themselves (home, play setup, ascension, cards) skip the generic panel entrance */
const SELF_ANIMATED = '.home, .play, .asc, .ucards';
const STAGGER = '.up-title, .up-sub, .progress, .round-tag, .map-strip, .stats > div, .slider, .set-tog, .bind-row, .row > button, button.big, .ch-card, .lb-row, .shards-earned, .end-boss';

/** what makes two renders "the same screen" (re-renders of one screen don't replay the transition) */
export function screenKey(root: HTMLElement) {
  const el = Array.from(root.children).find((c) => !c.classList.contains('who-chip'));
  return el ? el.tagName + '.' + el.className.replace(/\s+(on|sel|picked|focus|padfocus)\b/g, '') + '|' + (el.querySelector('.up-title, .logo')?.textContent ?? '') : '';
}

/** fade the previous screen out on a layer above the new one */
export function leave(nodes: Node[], from: HTMLElement) {
  if (!nodes.length || reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'ui-leave';
  const cs = getComputedStyle(from);
  layer.style.alignItems = cs.alignItems;
  layer.style.padding = cs.padding;
  layer.append(...nodes);
  document.body.appendChild(layer);
  const a = layer.animate(
    [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-14px) scale(.985)', filter: 'blur(4px)' }],
    { duration: 200, easing: 'ease-in', fill: 'forwards' },
  );
  a.onfinish = () => layer.remove();
  setTimeout(() => layer.remove(), 600);
}

/** new screen: panel rises in, then its parts arrive one after another */
export function enter(root: HTMLElement) {
  if (reduced() || root.querySelector(SELF_ANIMATED)) return;
  const panel = Array.from(root.children).find((c) => !c.classList.contains('who-chip')) as HTMLElement | undefined;
  panel?.animate(
    [{ opacity: 0, transform: 'translateY(22px) scale(.97)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 380, easing: EASE, fill: 'backwards' },
  );
  let i = 0;
  root.querySelectorAll<HTMLElement>(STAGGER).forEach((el) => {
    if (el.closest('.home, .play, .asc')) return;
    el.animate(
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
      { duration: 340, delay: 80 + Math.min(i++, 14) * 35, easing: EASE, fill: 'backwards' },
    );
  });
}

/** light ripple from the pointer on any button press */
export function bindRipples(root: HTMLElement) {
  root.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b || b.closest('.home') || reduced()) return;
    const r = b.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'ripple';
    const d = Math.max(r.width, r.height) * 2.2;
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s);
    s.animate([{ transform: 'scale(0)', opacity: 0.55 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => s.remove();
  });
}

/** count a number up (stats tally); `fmt` renders intermediate values */
export function countUp(el: HTMLElement, to: number, dur: number, delay: number, fmt: (v: number) => string, onTick?: () => void, onDone?: () => void) {
  if (reduced() || to <= 0) {
    el.textContent = fmt(to);
    onDone?.();
    return;
  }
  el.textContent = fmt(0);
  const t0 = performance.now() + delay;
  let last = -1;
  let finished = false;
  // frames don't run in a background tab: make sure the real value always lands
  setTimeout(() => {
    if (finished || !el.isConnected) return;
    finished = true;
    el.textContent = fmt(to);
    onDone?.();
  }, delay + dur + 400);
  const step = (now: number) => {
    if (!el.isConnected || finished) return;
    const k = Math.min(1, Math.max(0, (now - t0) / dur));
    const v = to * (1 - Math.pow(1 - k, 3));
    const shown = Number.isInteger(to) ? Math.round(v) : v;
    if (k > 0 && shown !== last) {
      last = shown;
      onTick?.();
    }
    el.textContent = fmt(shown);
    if (k < 1) requestAnimationFrame(step);
    else {
      finished = true;
      onDone?.();
    }
  };
  requestAnimationFrame(step);
}

/** a small glowing token flies from one element to another (shards into the shop item, etc.) */
export function flyTo(from: Element, to: Element, html: string, color = '#b98cff') {
  if (reduced()) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly-token';
  el.innerHTML = html;
  el.style.color = color;
  document.body.appendChild(el);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 120;
  el.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${mx}px, ${my}px) scale(1.3)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(.4)`, opacity: 0.9 },
    ],
    { duration: 520, easing: 'cubic-bezier(.4,0,.6,1)' },
  ).onfinish = () => el.remove();
}

/** shake an element (not enough money, locked, …) */
export function shake(el: Element) {
  if (reduced()) return;
  el.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
    { duration: 320, easing: 'ease-out' },
  );
}
