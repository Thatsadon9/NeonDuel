export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const angleTo = (ax: number, ay: number, bx: number, by: number) => Math.atan2(by - ay, bx - ax);

/** shortest signed difference b - a, in (-PI, PI] */
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const rotateTowards = (a: number, b: number, maxStep: number) => {
  const d = angleDiff(a, b);
  return a + clamp(d, -maxStep, maxStep);
};

/** frame-rate independent exponential smoothing factor */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** distance from point to segment */
export const segDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
};

export function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}
