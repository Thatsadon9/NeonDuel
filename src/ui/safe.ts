/** device safe-area insets (notch, rounded corners, home indicator) in CSS px */
let probe: HTMLDivElement | null = null;
let cache = { top: 0, right: 0, bottom: 0, left: 0 };
let cacheAt = -1;
export function safeInsets() {
  const now = performance.now();
  if (now - cacheAt < 500) return cache;
  cacheAt = now;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  cache = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  return cache;
}
/** true on phones / tablets (coarse pointer, touch) */
export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
