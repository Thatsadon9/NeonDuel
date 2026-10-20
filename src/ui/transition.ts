/**
 * INK WIPE — a brush stroke of ink covers the screen and is dragged away to reveal the new arena
 * (stage start, retry, back to title). Pure overlay: it never blocks or delays the game logic.
 */
import { reduced } from './motion';

function edgePath(seed: number) {
  // ragged brush edge on the left of a 1200×1000 ink slab
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts: string[] = [];
  // a brush edge: slow wobble + fine bristle noise + the odd deep stroke
  const ph = rnd() * 6;
  for (let y = 0; y <= 1000; y += 16) {
    const wob = Math.sin(y / 140 + ph) * 26 + Math.sin(y / 53 + ph * 2) * 9;
    const bristle = rnd() * 14;
    const gouge = rnd() < 0.06 ? 30 + rnd() * 40 : 0;
    pts.push(`${(200 + wob + bristle + gouge).toFixed(0)},${y}`);
  }
  return { d: `M${pts[0]} L${pts.slice(1).join(' L')} L1200,1000 L1200,0 Z`, edge: `M${pts.join(' L')}` };
}

export function inkReveal(color = '#7ff6ff') {
  if (reduced()) return;
  document.querySelectorAll('.ink-wipe').forEach((e) => e.remove());
  const { d, edge } = edgePath(1 + Math.floor(Math.random() * 1e6));
  const drops = Array.from({ length: 9 }, () => {
    const y = Math.random() * 1000, r = 6 + Math.random() * 22;
    return `<circle cx="${(120 + Math.random() * 60).toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}"/>`;
  }).join('');
  const el = document.createElement('div');
  el.className = 'ink-wipe';
  el.innerHTML = `<svg viewBox="0 0 1200 1000" preserveAspectRatio="none">
    <defs><filter id="inkglow" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <path d="${d}" fill="#04050d"/><g fill="#04050d">${drops}</g>
    <path d="${edge}" fill="none" stroke="${color}" stroke-width="10" opacity=".55" filter="url(#inkglow)"/>
    <path d="${edge}" fill="none" stroke="${color}" stroke-width="2.5"/></svg>`;
  document.body.appendChild(el);
  el.animate(
    [{ transform: 'translateX(0) skewX(-4deg)' }, { transform: 'translateX(0) skewX(-4deg)', offset: 0.12 }, { transform: 'translateX(118vw) skewX(-10deg)' }],
    { duration: 720, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' },
  ).onfinish = () => el.remove();
  setTimeout(() => el.remove(), 1200); // never leave the ink up (e.g. animations paused in a background tab)
}
