/** World-space visual effects: particles, slash arcs, shockwave rings, afterimages, beams, damage numbers. */
import { TAU, rand, easeOutCubic, easeOutBack, clamp } from '../core/math';
import { sprites } from './sprites';

const enum PK { Dot, Streak, Shard, Smoke, Ember }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  drag: number; kind: PK; rot: number; vr: number;
}
interface Slash {
  x: number; y: number; angle: number; r: number; arc: number; dir: number;
  width: number; color: string; core: string; life: number; max: number; follow?: { x: number; y: number };
}
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; width: number; fill?: boolean }
interface Ghost { x: number; y: number; angle: number; r: number; color: string; life: number; max: number; kind: 'player' | 'circle' | 'diamond' }
interface Beam { x1: number; y1: number; x2: number; y2: number; w: number; color: string; life: number; max: number }
interface FText { x: number; y: number; vy: number; text: string; color: string; size: number; life: number; max: number }
interface Anim {
  name: string; x: number; y: number; angle: number; t: number; dur: number; w?: number; tint?: string;
  additive: boolean; under: boolean; loop: boolean; hold: boolean; follow?: { x: number; y: number }; flipY?: boolean;
}
interface Bolt { pts: { x: number; y: number }[]; color: string; life: number; max: number; w: number }

const MAX_PARTS = 2600;

class FX {
  parts: Particle[] = [];
  slashes: Slash[] = [];
  rings: Ring[] = [];
  ghosts: Ghost[] = [];
  beams: Beam[] = [];
  texts: FText[] = [];
  bolts: Bolt[] = [];
  anims: Anim[] = [];
  quality = 1; // 0.5 low .. 1 high

  clear() {
    this.parts.length = 0;
    this.slashes.length = 0;
    this.rings.length = 0;
    this.ghosts.length = 0;
    this.beams.length = 0;
    this.texts.length = 0;
    this.bolts.length = 0;
    this.anims.length = 0;
  }

  private add(p: Particle) {
    if (this.parts.length >= MAX_PARTS) this.parts.shift();
    this.parts.push(p);
  }

  /** directional sparks (streaks) */
  sparks(x: number, y: number, angle: number, spread: number, count: number, speed: number, color: string, life = 0.35, size = 2) {
    count = Math.ceil(count * this.quality);
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread, spread);
      const s = speed * rand(0.35, 1.15);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1.2), max: life, size: size * rand(0.7, 1.3), color, drag: 5, kind: PK.Streak, rot: 0, vr: 0 });
    }
  }
  burst(x: number, y: number, count: number, speed: number, color: string, life = 0.6, size = 3) {
    count = Math.ceil(count * this.quality);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = speed * rand(0.2, 1);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.5, 1.2), max: life, size: size * rand(0.5, 1.4), color, drag: 3.5, kind: PK.Dot, rot: 0, vr: 0 });
    }
  }
  shards(x: number, y: number, count: number, speed: number, color: string, life = 1.0, size = 7) {
    count = Math.ceil(count * this.quality);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = speed * rand(0.3, 1);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1.3), max: life, size: size * rand(0.5, 1.5), color, drag: 2.2, kind: PK.Shard, rot: rand(0, TAU), vr: rand(-12, 12) });
    }
  }
  smoke(x: number, y: number, count: number, color = 'rgba(120,160,255,0.25)', speed = 60, size = 14, life = 0.7) {
    count = Math.ceil(count * this.quality);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = speed * rand(0.2, 1);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1.2), max: life, size: size * rand(0.6, 1.3), color, drag: 3, kind: PK.Smoke, rot: 0, vr: 0 });
    }
  }
  ember(x: number, y: number, vx: number, vy: number, color: string, life = 0.5, size = 2.5) {
    this.add({ x, y, vx, vy, life, max: life, size, color, drag: 2, kind: PK.Ember, rot: 0, vr: 0 });
  }

  /** play a one-shot (or timed looping) sprite animation; no-op when the sprite is missing */
  anim(name: string, x: number, y: number, o: { angle?: number; w?: number; tint?: string; additive?: boolean; under?: boolean; dur?: number; loop?: boolean; hold?: number; follow?: { x: number; y: number }; flipY?: boolean } = {}) {
    if (!sprites.has(name)) return false;
    // hold = keep the last frame on screen for this many extra seconds (corpses), fading out
    const dur = o.dur ?? sprites.duration(name) + (o.hold ?? 0);
    this.anims.push({ name, x, y, angle: o.angle ?? 0, t: 0, dur, w: o.w, tint: o.tint, additive: o.additive ?? true, under: o.under ?? false, loop: o.loop ?? false, hold: (o.hold ?? 0) > 0, follow: o.follow, flipY: o.flipY });
    return true;
  }

  slash(x: number, y: number, angle: number, r: number, arc: number, dir: number, color: string, opts: { width?: number; life?: number; core?: string; follow?: { x: number; y: number } } = {}) {
    const life = opts.life ?? 0.22;
    this.slashes.push({ x, y, angle, r, arc, dir, width: opts.width ?? r * 0.45, color, core: opts.core ?? '#ffffff', life, max: life, follow: opts.follow });
  }
  ring(x: number, y: number, r0: number, r1: number, life: number, color: string, width = 4, fill = false) {
    // big filled rings are impacts on the ground → shockwave sprite if provided
    if (fill && r1 >= 100) this.anim('vfx_shockwave', x, y, { w: r1 * 2.1, tint: color, under: true });
    this.rings.push({ x, y, r0, r1, life, max: life, color, width, fill });
  }
  ghost(x: number, y: number, angle: number, r: number, color: string, life = 0.25, kind: Ghost['kind'] = 'player') {
    this.ghosts.push({ x, y, angle, r, color, life, max: life, kind });
  }
  beam(x1: number, y1: number, x2: number, y2: number, w: number, color: string, life = 0.2) {
    this.beams.push({ x1, y1, x2, y2, w, color, life, max: life });
  }
  text(x: number, y: number, text: string, color: string, size = 18) {
    this.texts.push({ x: x + rand(-8, 8), y, vy: -70, text, color, size, life: 0.8, max: 0.8 });
  }
  bolt(x1: number, y1: number, x2: number, y2: number, color = '#bfe9ff', w = 2.5, life = 0.18) {
    const pts = [{ x: x1, y: y1 }];
    const n = 7;
    const nx = -(y2 - y1), ny = x2 - x1;
    const nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = rand(-1, 1) * 22;
      pts.push({ x: x1 + (x2 - x1) * t + (nx / nl) * off, y: y1 + (y2 - y1) * t + (ny / nl) * off });
    }
    pts.push({ x: x2, y: y2 });
    this.bolts.push({ pts, color, life, max: life, w });
  }

  update(dt: number) {
    const ps = this.parts;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ps[j++] = p;
    }
    ps.length = j;
    const tick = <T extends { life: number }>(arr: T[]) => {
      let n = 0;
      for (const o of arr) {
        o.life -= dt;
        if (o.life > 0) arr[n++] = o;
      }
      arr.length = n;
    };
    tick(this.slashes);
    tick(this.rings);
    tick(this.ghosts);
    tick(this.beams);
    tick(this.bolts);
    for (const a of this.anims) a.t += dt;
    this.anims = this.anims.filter((a) => a.t < a.dur);
    for (const t of this.texts) t.y += t.vy * dt, (t.vy *= Math.exp(-3 * dt));
    tick(this.texts);
  }

  private drawAnims(ctx: CanvasRenderingContext2D, under: boolean) {
    for (const a of this.anims) {
      if (a.under !== under) continue;
      const x = a.follow ? a.follow.x : a.x, y = a.follow ? a.follow.y : a.y;
      const k = a.loop || a.hold ? 1 : sprites.duration(a.name) / Math.max(0.001, a.dur);
      let alpha = a.hold ? Math.min(1, (a.dur - a.t) / 0.4) : 1;
      let scale = 1;
      const still = (sprites.get(a.name)?.frames ?? 1) === 1;
      if (still && !a.hold) {
        // animate a single still image: quick pop-in, then grow and fade
        const u = a.t / a.dur;
        scale = a.loop ? 1 : u < 0.2 ? 0.7 + 1.5 * u : 1 + (u - 0.2) * 0.25;
        if (!a.loop) alpha = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8;
        else alpha = Math.min(1, a.t / 0.2, (a.dur - a.t) / 0.3);
      }
      const angle = still && a.loop ? a.angle + a.t * 2.5 : a.angle;
      sprites.draw(ctx, a.name, x, y, { angle, t: a.t * k, loop: a.loop, w: a.w !== undefined ? a.w * scale : undefined, scale, tint: a.tint, additive: a.additive, flipY: a.flipY, alpha });
    }
  }

  /** drawn under actors */
  drawUnder(ctx: CanvasRenderingContext2D) {
    this.drawAnims(ctx, true);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.rings) {
      const t = 1 - g.life / g.max;
      const r = g.r0 + (g.r1 - g.r0) * easeOutCubic(t);
      const a = 1 - t;
      ctx.globalAlpha = a;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = g.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(g.x, g.y, Math.max(0, r), 0, TAU);
      ctx.stroke();
      if (g.fill) {
        ctx.globalAlpha = a * 0.15;
        ctx.fillStyle = g.color;
        ctx.fill();
      }
    }
    for (const g of this.ghosts) {
      const a = (g.life / g.max) * 0.55;
      ctx.globalAlpha = a;
      ctx.fillStyle = g.color;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (g.kind === 'diamond') {
        ctx.moveTo(g.x + g.r, g.y);
        ctx.lineTo(g.x, g.y + g.r);
        ctx.lineTo(g.x - g.r, g.y);
        ctx.lineTo(g.x, g.y - g.r);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.arc(g.x, g.y, g.r, 0, TAU);
        ctx.globalAlpha = a * 0.35;
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.stroke();
        if (g.kind === 'player') {
          ctx.beginPath();
          ctx.moveTo(g.x + Math.cos(g.angle) * g.r * 1.5, g.y + Math.sin(g.angle) * g.r * 1.5);
          ctx.lineTo(g.x + Math.cos(g.angle + 2.3) * g.r, g.y + Math.sin(g.angle + 2.3) * g.r);
          ctx.lineTo(g.x + Math.cos(g.angle - 2.3) * g.r, g.y + Math.sin(g.angle - 2.3) * g.r);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /** drawn over actors */
  drawOver(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // slashes
    for (const s of this.slashes) {
      const t = 1 - s.life / s.max;
      const spr = s.arc >= TAU - 0.01 ? 'vfx_slash_spin' : 'vfx_slash';
      if (sprites.has(spr)) {
        const cx = s.follow ? s.follow.x : s.x, cy = s.follow ? s.follow.y : s.y;
        // art sweeps top→bottom on the right side; dir -1 mirrors it
        const sp = sprites.get(spr)!;
        if (sp.frames > 1) {
          sprites.draw(ctx, spr, cx, cy, { angle: s.angle, t: t * sprites.duration(spr), loop: false, w: s.r * 2.1, tint: s.color, additive: true, flipY: s.dir < 0 });
        } else {
          // single still: sweep it through the arc while fading — reads as a swing
          const sweep = (t < 0.35 ? -0.35 + t : 0) * s.dir * Math.min(s.arc, 2.5);
          const a = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
          sprites.draw(ctx, spr, cx, cy, { angle: s.angle + sweep, w: s.r * 2.15 * (0.92 + t * 0.12), tint: s.color, additive: true, flipY: s.dir < 0, alpha: a });
          sprites.draw(ctx, spr, cx, cy, { angle: s.angle + sweep, w: s.r * 2.05, tint: '#ffffff', additive: true, flipY: s.dir < 0, alpha: a * 0.45 });
        }
        continue;
      }
      const reveal = clamp(t / 0.35, 0, 1);
      const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      const cx = s.follow ? s.follow.x : s.x;
      const cy = s.follow ? s.follow.y : s.y;
      const N = 18;
      const a0 = s.angle - (s.arc / 2) * s.dir;
      const sweep = s.arc * easeOutCubic(reveal);
      const tail = Math.max(0, sweep - s.arc * 0.9 * (t < 0.35 ? 0 : (t - 0.35) / 0.65));
      const start = sweep - tail;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = a0 + (start + (sweep - start) * u) * s.dir;
        ctx.lineTo(cx + Math.cos(a) * s.r, cy + Math.sin(a) * s.r);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N;
        const a = a0 + (start + (sweep - start) * u) * s.dir;
        const w = s.width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.15)), 0.8);
        ctx.lineTo(cx + Math.cos(a) * (s.r - w), cy + Math.sin(a) * (s.r - w));
      }
      ctx.closePath();
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = s.color;
      ctx.fill();
      // bright core edge
      ctx.globalAlpha = fade;
      ctx.strokeStyle = s.core;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = a0 + (start + (sweep - start) * u) * s.dir;
        ctx.lineTo(cx + Math.cos(a) * (s.r - 2), cy + Math.sin(a) * (s.r - 2));
      }
      ctx.stroke();
    }
    // beams
    ctx.lineCap = 'round';
    for (const b of this.beams) {
      const a = b.life / b.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, b.w * a * 0.3);
      ctx.stroke();
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = b.life / b.max;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w;
      ctx.beginPath();
      for (const p of b.pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    // particles
    for (const p of this.parts) {
      const a = Math.min(1, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.kind === PK.Streak) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else if (p.kind === PK.Shard) {
        ctx.fillStyle = p.color;
        const c = Math.cos(p.rot) * p.size, s = Math.sin(p.rot) * p.size;
        ctx.beginPath();
        ctx.moveTo(p.x + c, p.y + s);
        ctx.lineTo(p.x - s * 0.4, p.y + c * 0.4);
        ctx.lineTo(p.x - c, p.y - s);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === PK.Smoke) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      } else {
        ctx.fillStyle = p.color;
        const sz = p.kind === PK.Ember ? p.size * a : p.size * (0.4 + a * 0.6);
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }
    ctx.restore();
    this.drawAnims(ctx, false);
  }

  drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const u = 1 - t.life / t.max;
      const sc = u < 0.25 ? easeOutBack(u / 0.25) : 1;
      ctx.globalAlpha = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      ctx.font = `800 ${Math.round(t.size * sc)}px Orbitron, "Chakra Petch", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}

export const fx = new FX();
