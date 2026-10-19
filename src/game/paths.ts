/**
 * ASCENSION path kits: for every weapon family × path (A/B) — a passive, the T3 E skill and the T4 Signature Ultimate.
 * Passives react to player events (hit / kill / parry / perfect dodge / dash / attack / arrows).
 * Also owns small world helpers used by the kits: soul pickups, shadow clones and tethers.
 */
import { TAU, angleTo, dist, rand, angleDiff } from '../core/math';
import type { Co } from '../core/co';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { sprites } from '../render/sprites';
import { sfx } from '../audio/audio';
import { W, strike, shoot, type Actor, type HitInfo, type Projectile } from './world';
import type { Player } from './player';
import type { AttackDef, SkillDef, WeaponId } from './weapons';
import { fireArrow } from './weapons';
import type { PathId } from './ascension';

export interface Passive {
  onHit?(p: Player, t: Actor, h: HitInfo): void;
  onKill?(p: Player, a: Actor): void;
  onParry?(p: Player, h: HitInfo): void;
  onPerfect?(p: Player): void;
  onDash?(p: Player): void;
  onAttack?(p: Player, a: AttackDef): void;
  onCharged?(p: Player): void;
  onArrowHit?(p: Player, t: Actor, b: Projectile): void;
  onArrowEnd?(p: Player, b: Projectile): void;
  update?(p: Player, dt: number): void;
  draw?(p: Player, ctx: CanvasRenderingContext2D): void;
  critBonus?: number;
  postureMul?: number;
}
export interface Kit {
  e: SkillDef;
  ult: SkillDef;
  passive: Passive;
}

// ------------------------------------------------------------------ shared world helpers (reset each stage)
interface Soul { x: number; y: number; t: number }
interface Clone { x: number; y: number; life: number; cd: number; color: string }
interface Tether { a: Actor; b: Actor; life: number; color: string }
const souls: Soul[] = [];
const clones: Clone[] = [];
const tethers: Tether[] = [];
const bound = new Set<Actor>();
let boundT = 0;
let hitCount = 0;

export function resetPathWorld() {
  souls.length = 0;
  clones.length = 0;
  tethers.length = 0;
  bound.clear();
  boundT = 0;
  hitCount = 0;
}

const near = (x: number, y: number, r: number, n = 99) =>
  W.enemies.filter((e) => !e.dead && dist(x, y, e.x, e.y) < r).sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y)).slice(0, n);
const aimPoint = (p: Player, max: number) => {
  const m = p.aimPoint();
  const d = Math.min(max, dist(p.x, p.y, m.x, m.y));
  return { x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d };
};
function hitAt(p: Player, x: number, y: number, r: number, dmg: number, posture: number, tag: string, o: { delay?: number; color?: string; stun?: number; knock?: number; tele?: boolean } = {}) {
  return strike({
    team: 'player', x, y, shape: { k: 'circle', r }, delay: o.delay ?? 0, active: 0.06, damage: p.dmg(dmg), posture: posture * p.postureMul,
    knock: o.knock ?? 260, hitstop: 0.05, tag, skill: true, crit: p.crit, color: o.color ?? p.weaponColor(), stunTime: o.stun,
    hideTele: o.tele === false,
  });
}
function bolt(p: Player, from: { x: number; y: number }, t: Actor, dmg: number) {
  fx.bolt(from.x, from.y, t.x, t.y, '#bfe9ff', 2.5, 0.22);
  strike({ team: 'player', x: t.x, y: t.y, shape: { k: 'circle', r: 10 }, active: 0.02, damage: p.dmg(dmg), posture: 4, knock: 60, hitstop: 0.01, tag: 'chain', skill: true, hideActive: true, color: '#bfe9ff' });
}

/** world update for kit helpers (souls, clones, tethers) — called by the run every tick */
export function updatePathWorld(p: Player, dt: number) {
  // souls drift to the player and get absorbed
  for (let i = souls.length - 1; i >= 0; i--) {
    const s = souls[i];
    s.t += dt;
    const d = dist(s.x, s.y, p.x, p.y);
    if (d < 160) {
      s.x += ((p.x - s.x) / d) * 420 * dt;
      s.y += ((p.y - s.y) / d) * 420 * dt;
    }
    if (d < 26) {
      p.heal(2 * p.mythic);
      p.focus = Math.min(100, p.focus + 3 * p.mythic);
      fx.burst(p.x, p.y, 4, 120, '#9dff6b', 0.3, 2);
      souls.splice(i, 1);
    } else if (s.t > 8) souls.splice(i, 1);
  }
  // shadow clones: dash-slash the nearest enemy every 0.4s
  for (let i = clones.length - 1; i >= 0; i--) {
    const c = clones[i];
    c.life -= dt;
    c.cd -= dt;
    if (c.life <= 0) {
      fx.smoke(c.x, c.y, 6, 'rgba(200,184,255,0.25)', 80, 12, 0.4);
      clones.splice(i, 1);
      continue;
    }
    const t = W.nearestEnemy(c.x, c.y, 520);
    if (t && c.cd <= 0) {
      c.cd = 0.4;
      const a = angleTo(c.x, c.y, t.x, t.y);
      const nx = t.x - Math.cos(a) * (t.r + 26), ny = t.y - Math.sin(a) * (t.r + 26);
      fx.ghost(c.x, c.y, a, 16, c.color, 0.2);
      c.x = nx;
      c.y = ny;
      fx.slash(c.x, c.y, a, 80, 2.2, Math.random() < 0.5 ? 1 : -1, c.color, { width: 26, life: 0.18 });
      strike({ team: 'player', x: c.x, y: c.y, shape: { k: 'sector', r: 90, arc: 2.2, angle: a }, active: 0.05, damage: p.dmg(9), posture: 5, knock: 90, hitstop: 0.02, tag: 'clone', skill: true, color: c.color, onHit: (e) => (e.bleed = Math.min(10, e.bleed + 1)) });
    }
  }
  for (let i = tethers.length - 1; i >= 0; i--) {
    const t = tethers[i];
    t.life -= dt;
    if (t.life <= 0 || t.a.dead || t.b.dead || dist(t.a.x, t.a.y, t.b.x, t.b.y) > 520) tethers.splice(i, 1);
  }
  if (boundT > 0) {
    boundT -= dt;
    if (boundT <= 0) bound.clear();
    for (const e of bound) if (e.dead) bound.delete(e);
  }
}
export function drawPathWorld(ctx: CanvasRenderingContext2D) {
  for (const s of souls) {
    if (!sprites.draw(ctx, 'pickup_soul', s.x, s.y + Math.sin(s.t * 6) * 3, { w: 22, additive: true })) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#9dff6b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  for (const c of clones) {
    const n = sprites.first('player_attack', 'player_idle');
    if (!n || !sprites.draw(ctx, n, c.x, c.y, { angle: W.time * 0.5, tint: c.color, alpha: 0.55, additive: true })) fx.ghost(c.x, c.y, 0, 16, c.color, 0.05);
  }
  const lines: [Actor, Actor, string][] = tethers.map((t) => [t.a, t.b, t.color]);
  const b = [...bound];
  for (let i = 1; i < b.length; i++) lines.push([b[i - 1], b[i], '#7fb8ff']);
  for (const [a, c, col] of lines) {
    const ang = angleTo(a.x, a.y, c.x, c.y);
    const d = dist(a.x, a.y, c.x, c.y);
    if (!sprites.draw(ctx, sprites.first('vfx_binding_chains', 'vfx_tether') ?? '', (a.x + c.x) / 2, (a.y + c.y) / 2, { angle: ang, w: d, tint: col, additive: true, alpha: 0.8 })) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}
function spawnClone(p: Player, life: number, x = p.x, y = p.y) {
  clones.push({ x, y, life, cd: 0.1, color: '#c9b8ff' });
  fx.smoke(x, y, 8, 'rgba(200,184,255,0.3)', 100, 14, 0.5);
}

const ult = (id: string, name: string, thai: string, run: (p: Player) => Co, instant = false): SkillDef => ({ id, name, thai, cost: 100, run, instant });
const eSkill = (id: string, name: string, thai: string, cost: number, run: (p: Player) => Co, instant = false): SkillDef => ({ id, name, thai, cost, run, instant });

function* ultIntro(p: Player, color: string): Co {
  sfx('ult');
  W.slowMo(0.25, 0.5);
  W.flash(color, 0.45);
  cam.punch = 0.1;
  fx.ring(p.x, p.y, 10, 260, 0.6, color, 10, true);
  yield 0.12;
}

// ------------------------------------------------------------------ KITS
export const KITS: Record<string, Kit> = {
  // ================= KATANA
  katana_a: {
    passive: {
      onHit(p, t, h) {
        if (h.tag === 'chain') return;
        if (++hitCount % 4 === 0) {
          for (const e of near(t.x, t.y, 300, 3)) bolt(p, t, e, 10 * p.mythic);
          sfx('thunder', 0.6);
        }
      },
      onDash(p) {
        const x = p.x, y = p.y;
        strike({ team: 'player', x, y, shape: { k: 'circle', r: 55 }, delay: 0.25, active: 0.05, damage: p.dmg(8 * p.mythic), posture: 4, knock: 80, hitstop: 0.01, tag: 'static', skill: true, hideTele: true, color: '#5ad8ff', onStart: () => fx.bolt(x, y - 40, x, y, '#bfe9ff', 2, 0.15) });
      },
    },
    e: eSkill('thunderclap', 'THUNDERCLAP STEP', 'วาร์ปฟันสายฟ้า 3 ครั้ง', 45, function* (p) {
      sfx('skill');
      p.invuln = 0.9;
      for (let i = 0; i < 3; i++) {
        const t = W.nearestEnemy(p.x, p.y, 520) ?? null;
        const a = t ? angleTo(p.x, p.y, t.x, t.y) : p.aim + (i - 1) * 0.8;
        const len = t ? dist(p.x, p.y, t.x, t.y) + t.r + 60 : 220;
        const x0 = p.x, y0 = p.y;
        p.x += Math.cos(a) * len;
        p.y += Math.sin(a) * len;
        W.confine(p);
        p.facing = p.aim = a;
        fx.anim('vfx_thunderclap', (x0 + p.x) / 2, (y0 + p.y) / 2, { angle: a, w: Math.max(160, len) });
        fx.beam(x0, y0, p.x, p.y, 6, '#5ad8ff', 0.3);
        strike({ team: 'player', x: x0, y: y0, shape: { k: 'line', angle: a, len, w: 60 }, active: 0.05, damage: p.dmg(30), posture: 18 * p.postureMul, knock: 160, hitstop: 0.06, tag: 'thunderclap', skill: true, crit: p.crit, color: '#5ad8ff' });
        sfx('thunder');
        yield 0.1;
      }
    }),
    ult: ult('heaven_verdict', "HEAVEN'S VERDICT", 'ฟ้าผ่า 6 ครั้ง แล้วร่างกลายเป็นสายฟ้า 4 วินาที', function* (p) {
      yield* ultIntro(p, '#5ad8ff');
      const targets = near(p.x, p.y, 700);
      for (let i = 0; i < 6; i++) {
        const t = targets.length ? targets[i % targets.length] : null;
        const x = t ? t.x : p.x + rand(-200, 200), y = t ? t.y : p.y + rand(-200, 200);
        fx.anim('vfx_heaven_verdict', x, y - 60, { w: 120 });
        fx.anim('vfx_lightning_strike', x, y - 40, { w: 80 });
        hitAt(p, x, y, 75, 45, 25, 'verdict', { stun: 0.5 });
        sfx('thunder');
        W.shake(0.3);
        yield 0.1;
      }
      p.stormT = 4;
    }),
  },
  katana_b: {
    passive: {
      critBonus: 0.1,
      onHit(p, t, h) {
        if (!h.crit || h.tag === 'voidburst') return;
        const marks = ((t as any).voidMarks = ((t as any).voidMarks ?? 0) + 1);
        fx.anim('vfx_void_mark', t.x, t.y - t.r, { w: 40 });
        if (marks >= 3) {
          (t as any).voidMarks = 0;
          fx.anim('vfx_moon_severance', t.x, t.y, { w: 160 });
          strike({ team: 'player', x: t.x, y: t.y, shape: { k: 'circle', r: 60 }, delay: 0.12, active: 0.05, damage: p.dmg(35 * p.mythic), posture: 20, knock: 120, hitstop: 0.08, tag: 'voidburst', skill: true, hideTele: true, color: '#9d5bff' });
          sfx('slashHeavy');
        }
      },
    },
    e: eSkill('moon_severance', 'MOON SEVERANCE', 'รอยฟันจันทร์เสี้ยวตกใส่พื้นที่', 45, function* (p) {
      sfx('skill');
      const c = aimPoint(p, 320);
      fx.anim('vfx_moon_severance', c.x, c.y, { w: 360, dur: 1.0 });
      hitAt(p, c.x, c.y, 170, 70, 40, 'moon', { delay: 0.75, color: '#9d5bff', stun: 0.6 });
      yield 0.15;
    }, true),
    ult: ult('eclipse', 'ECLIPSE', 'หยุดเวลาศัตรู 2 วินาที แล้วดาเมจทั้งหมดระเบิดซ้ำ', function* (p) {
      yield* ultIntro(p, '#9d5bff');
      fx.anim('vfx_eclipse', p.x, p.y, { w: 900, dur: 2.4, additive: true });
      W.eclipseT = 2.4;
      for (const e of W.enemies) (e as any).eclipseDmg = 0;
      for (let t = 0; t < 2.4; t += 0.1) yield 0.1;
    }, true),
  },
  // ================= TWIN FANGS
  daggers_a: {
    passive: {
      onHit(p, t, h) {
        if (h.tag === 'venomburst' || h.skill) return;
        t.bleed = Math.min(10, t.bleed + 1);
        if (t.bleed >= 10) {
          t.bleed = 0;
          fx.anim('vfx_plague_burst', t.x, t.y, { w: 190 });
          strike({ team: 'player', x: t.x, y: t.y, shape: { k: 'circle', r: 95 }, active: 0.05, damage: p.dmg(30 * p.mythic), posture: 12, knock: 200, hitstop: 0.05, tag: 'venomburst', skill: true, hideActive: true, color: '#7dff4d', onHit: (e) => (e.bleed = Math.min(10, e.bleed + 3)) });
          sfx('explosion', 0.4);
        }
      },
    },
    e: eSkill('toxic_bloom', 'TOXIC BLOOM', 'ปาขวดพิษ เมฆพิษขยายดาเมจ', 45, function* (p) {
      sfx('skill');
      const c = aimPoint(p, 380);
      fx.anim('vfx_toxic_cloud', c.x, c.y, { w: 280, dur: 4, loop: true, under: true });
      strike({ team: 'player', x: c.x, y: c.y, shape: { k: 'circle', r: 130 }, active: 4, rehit: 0.4, damage: p.dmg(5), posture: 2, knock: 0, hitstop: 0, tag: 'toxic', skill: true, hideActive: true, color: '#7dff4d', stunTime: 0.05, onHit: (e) => (e.bleed = Math.min(10, e.bleed + 1)) });
      yield 0.1;
    }, true),
    ult: ult('plague_tide', 'PLAGUE TIDE', 'ศัตรูที่ติดพิษระเบิดเป็นลูกโซ่', function* (p) {
      yield* ultIntro(p, '#7dff4d');
      const list = W.enemies.filter((e) => !e.dead && e.bleed > 0);
      if (!list.length) list.push(...near(p.x, p.y, 500, 4));
      for (const e of list) {
        fx.anim('vfx_plague_burst', e.x, e.y, { w: 240 });
        strike({ team: 'player', x: e.x, y: e.y, shape: { k: 'circle', r: 110 }, active: 0.05, damage: p.dmg(20 + e.bleed * 10), posture: 15, knock: 260, hitstop: 0.04, tag: 'plague', skill: true, hideActive: true, color: '#7dff4d' });
        e.bleed = 0;
        sfx('explosion', 0.5);
        yield 0.06;
      }
    }),
  },
  daggers_b: {
    passive: {
      onPerfect(p) {
        spawnClone(p, 3 * p.mythic);
      },
    },
    e: eSkill('shadow_pack', 'SHADOW PACK', 'เรียกร่างเงา 2 ตัวสู้ข้างเรา 5 วินาที', 45, function* (p) {
      sfx('skill');
      spawnClone(p, 5, p.x + 40, p.y);
      spawnClone(p, 5, p.x - 40, p.y);
      yield 0.1;
    }, true),
    ult: ult('hundred_shadows', 'HUNDRED SHADOWS', 'ร่างเงา 8 ตัวพุ่งฟันข้ามจอ', function* (p) {
      yield* ultIntro(p, '#c9b8ff');
      const targets = near(p.x, p.y, 800);
      for (let i = 0; i < 8; i++) {
        const t = targets.length ? targets[i % targets.length] : null;
        const cx = t ? t.x : p.x, cy = t ? t.y : p.y;
        const a = rand(0, TAU);
        const x0 = cx - Math.cos(a) * 260, y0 = cy - Math.sin(a) * 260;
        fx.anim('vfx_shadow_slash', cx, cy, { angle: a, w: 520 });
        strike({ team: 'player', x: x0, y: y0, shape: { k: 'line', angle: a, len: 520, w: 70 }, active: 0.05, damage: p.dmg(32), posture: 14, knock: 120, hitstop: 0.04, tag: 'shadows', skill: true, crit: 0.4, color: '#c9b8ff', hideActive: true, onHit: (e) => (e.bleed = Math.min(10, e.bleed + 2)) });
        sfx('slash');
        yield 0.07;
      }
    }),
  },
  // ================= GRAVITON
  hammer_a: {
    passive: {
      onAttack(p, a) {
        if (!a.circle) return;
        const x = p.x + Math.cos(p.facing) * a.circle.off, y = p.y + Math.sin(p.facing) * a.circle.off;
        fireGround(p, x, y, 110, 3 * p.mythic);
      },
      onCharged(p) {
        fireGround(p, p.x + Math.cos(p.aim) * 120, p.y + Math.sin(p.aim) * 120, 120, 3 * p.mythic);
      },
    },
    e: eSkill('eruption', 'ERUPTION', 'เสาภูเขาไฟ 3 ต้นตามแนวเล็ง', 45, function* (p) {
      sfx('skill');
      const a = p.aim;
      for (let i = 1; i <= 3; i++) {
        const x = p.x + Math.cos(a) * 120 * i, y = p.y + Math.sin(a) * 120 * i;
        fx.anim('vfx_eruption', x, y, { w: 190 });
        hitAt(p, x, y, 85, 45, 30, 'eruption', { stun: 0.6, knock: 360, color: '#ff5a1f' });
        sfx('slam', 0.7);
        W.shake(0.3);
        yield 0.18;
      }
    }),
    ult: ult('world_breaker', 'WORLD BREAKER', 'แผ่นดินไหวทั้งสนาม', function* (p) {
      yield* ultIntro(p, '#ff5a1f');
      fx.anim('vfx_world_breaker', p.x, p.y, { w: 1100 });
      sfx('slam');
      sfx('explosion');
      W.shake(1);
      for (const e of W.enemies) {
        if (e.dead) continue;
        if (e.isBoss) e.addPosture(e.maxPosture * 0.5);
        else e.stun = Math.max(e.stun, 2.5);
        strike({ team: 'player', x: e.x, y: e.y, shape: { k: 'circle', r: 10 }, active: 0.02, damage: p.dmg(e.isBoss ? 40 : 60), posture: 0, knock: 300, hitstop: 0.02, tag: 'quake', skill: true, hideActive: true, color: '#ff5a1f' });
      }
      yield 0.3;
    }),
  },
  hammer_b: {
    passive: {
      onHit(p, t, h) {
        if (t.isBoss || h.kind === 'proj') return;
        const a = angleTo(t.x, t.y, p.x, p.y);
        t.vx += Math.cos(a) * 160;
        t.vy += Math.sin(a) * 160;
      },
      update(p) {
        for (const b of W.projs) {
          if (b.team !== 'enemy' || (b as any).slowed) continue;
          if (dist(b.x, b.y, p.x, p.y) < 150 * p.mythic) {
            (b as any).slowed = true;
            b.vx *= 0.5;
            b.vy *= 0.5;
          }
        }
      },
    },
    e: eSkill('event_horizon', 'EVENT HORIZON', 'สนามโน้มถ่วงรอบตัว 4 วินาที กระสุนช้า 70%', 50, function* (p) {
      sfx('skill');
      fx.anim('vfx_event_horizon', p.x, p.y, { w: 360, dur: 4, loop: true, follow: p, under: true });
      for (let t = 0; t < 4; t += 1 / 30) {
        for (const b of W.projs) {
          if (b.team === 'enemy' && !(b as any).horizon && dist(b.x, b.y, p.x, p.y) < 175) {
            (b as any).horizon = true;
            b.vx *= 0.3;
            b.vy *= 0.3;
          }
        }
        for (const e of W.enemies) if (!e.dead && !e.isBoss && dist(e.x, e.y, p.x, p.y) < 175) (e.vx *= 0.85), (e.vy *= 0.85);
        yield 1 / 30;
      }
    }, true),
    ult: ult('black_star', 'BLACK STAR', 'หลุมดำยักษ์ดูดทุกอย่าง แล้วยุบตัว', function* (p) {
      yield* ultIntro(p, '#b06bff');
      const c = aimPoint(p, 420);
      fx.anim('vfx_black_star', c.x, c.y, { w: 520, dur: 3, loop: true, under: true });
      for (let t = 0; t < 3; t += 1 / 30) {
        for (const e of W.enemies) {
          if (e.dead) continue;
          const d = dist(e.x, e.y, c.x, c.y);
          if (d < 420 && d > 8) {
            const f = (e.isBoss ? 500 : 2600) * (1 - e.kbResist * 0.5) / 30;
            e.vx += ((c.x - e.x) / d) * f;
            e.vy += ((c.y - e.y) / d) * f;
          }
        }
        for (const b of W.projs) if (b.team === 'enemy' && dist(b.x, b.y, c.x, c.y) < 300) W.killProj(b);
        yield 1 / 30;
      }
      sfx('explosion');
      W.shake(0.8);
      fx.ring(c.x, c.y, 10, 300, 0.6, '#b06bff', 12, true);
      hitAt(p, c.x, c.y, 240, 120, 60, 'blackstar', { knock: 700, color: '#b06bff' });
    }, true),
  },
  // ================= REAPER CHAIN
  scythe_a: {
    passive: {
      onKill(_p, a) {
        souls.push({ x: a.x, y: a.y, t: 0 });
      },
    },
    e: eSkill('soul_reap', 'SOUL REAP', 'วงเคียวยักษ์ ประหารลูกน้อง HP < 20%', 45, function* (p) {
      sfx('skill');
      const a = p.aim;
      fx.anim('vfx_soul_reap', p.x, p.y, { angle: a, w: 470 });
      strike({
        team: 'player', x: p.x, y: p.y, shape: { k: 'sector', r: 230, arc: 3.4, angle: a }, active: 0.08, damage: p.dmg(50), posture: 30 * p.postureMul,
        knock: 300, hitstop: 0.1, tag: 'soulreap', skill: true, crit: p.crit, color: '#9dff6b',
        onHit: (e) => {
          if (!e.isBoss && !e.dead && e.hp < e.maxHp * 0.2) {
            e.hp = 0;
            e.onHit({ damage: 1, posture: 0, knock: 0, angle: a, hitstop: 0, unblockable: true, parryable: false, sx: p.x, sy: p.y, kind: 'aoe', tag: 'reaped', skill: true });
          }
        },
      });
      sfx('slashHeavy');
      yield 0.25;
    }),
    ult: ult('last_harvest', 'LAST HARVEST', 'ประหารลูกน้อง HP < 30% ทั้งจอ', function* (p) {
      yield* ultIntro(p, '#9dff6b');
      fx.anim('vfx_last_harvest', p.x, p.y, { w: 1000 });
      for (const e of W.enemies) {
        if (e.dead) continue;
        const dmg = e.isBoss ? e.hp * 0.1 : e.hp < e.maxHp * 0.3 ? e.hp + 1 : p.dmg(40);
        strike({ team: 'player', x: e.x, y: e.y, shape: { k: 'circle', r: 10 }, active: 0.02, damage: dmg, posture: 0, knock: 200, hitstop: 0.02, tag: 'harvest', skill: true, hideActive: true, color: '#9dff6b' });
        souls.push({ x: e.x, y: e.y, t: 0 });
      }
      p.focus = 100;
      sfx('slashHeavy');
      W.shake(0.6);
      yield 0.3;
    }),
  },
  scythe_b: {
    passive: {
      onHit(p, t, h) {
        if (h.tag === 'wraithshare' || h.tag === 'bound') return;
        // a tether links the last two enemies you struck; damage echoes along it
        const other = tethers.find((x) => x.a === t || x.b === t);
        if (other) {
          const o = other.a === t ? other.b : other.a;
          strike({ team: 'player', x: o.x, y: o.y, shape: { k: 'circle', r: 8 }, active: 0.02, damage: h.damage * 0.4 * p.mythic, posture: 0, knock: 0, hitstop: 0, tag: 'wraithshare', skill: true, hideActive: true, color: '#7fb8ff' });
        } else {
          const n = W.nearestEnemy(t.x, t.y, 420, (e) => e !== t);
          if (n) tethers.push({ a: t, b: n, life: 4, color: '#7fb8ff' });
          if (tethers.length > 2) tethers.shift();
        }
        if (bound.has(t)) {
          for (const e of bound) if (e !== t && !e.dead) strike({ team: 'player', x: e.x, y: e.y, shape: { k: 'circle', r: 8 }, active: 0.02, damage: h.damage * 0.5, posture: 0, knock: 0, hitstop: 0, tag: 'bound', skill: true, hideActive: true, color: '#7fb8ff' });
        }
      },
    },
    e: eSkill('binding_chains', 'CHAINS OF BINDING', 'ผูกศัตรู 4 ตัว แบ่งดาเมจกัน 6 วินาที', 45, function* (p) {
      sfx('skill');
      bound.clear();
      for (const e of near(p.x, p.y, 460, 4)) bound.add(e);
      boundT = 6;
      sfx('clank');
      yield 0.1;
    }, true),
    ult: ult('wailing_requiem', 'WAILING REQUIEM', 'เสียงกรีดร้อง ลูกน้องหนี บอสเสีย Posture', function* (p) {
      yield* ultIntro(p, '#7fb8ff');
      const a = p.aim;
      fx.anim('vfx_wailing_cone', p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200, { angle: a, w: 480 });
      strike({
        team: 'player', x: p.x, y: p.y, shape: { k: 'sector', r: 460, arc: 2.1, angle: a }, active: 0.08, damage: p.dmg(30), posture: 0, knock: 600, hitstop: 0.06, tag: 'wail', skill: true, color: '#7fb8ff',
        onHit: (e) => {
          if (e.isBoss) e.addPosture(e.maxPosture * 0.4);
          else e.stun = Math.max(e.stun, 3);
        },
      });
      W.shake(0.6);
      yield 0.3;
    }),
  },
  // ================= PULSE GAUNTLETS
  gauntlets_a: {
    passive: { postureMul: 1.6 },
    e: eSkill('seismic_fist', 'SEISMIC FIST', 'คลื่นกระแทกรูปกรวย ทำลายโล่', 45, function* (p) {
      sfx('skill');
      const a = p.aim;
      fx.anim('vfx_seismic_fist', p.x + Math.cos(a) * 130, p.y + Math.sin(a) * 130, { angle: a, w: 300 });
      strike({
        team: 'player', x: p.x, y: p.y, shape: { k: 'sector', r: 260, arc: 1.3, angle: a }, active: 0.08, damage: p.dmg(40), posture: 45 * p.postureMul,
        knock: 420, hitstop: 0.1, tag: 'seismic', skill: true, color: '#ffb347',
        onHit: (e) => {
          const any = e as any;
          if (any.shieldHp !== undefined) any.shieldHp = 0;
        },
      });
      sfx('slam');
      W.shake(0.5);
      yield 0.25;
    }),
    ult: ult('mountain_breaker', 'MOUNTAIN BREAKER', 'หมัดเดียว Posture 60%', function* (p) {
      yield* ultIntro(p, '#ffb347');
      yield 0.25;
      const a = p.aim;
      fx.anim('vfx_mountain_fist', p.x + Math.cos(a) * 110, p.y + Math.sin(a) * 110, { w: 360 });
      for (const e of W.enemies) {
        if (e.dead || dist(p.x, p.y, e.x, e.y) > 240 + e.r || Math.abs(angleDiff(a, angleTo(p.x, p.y, e.x, e.y))) > 0.9) continue;
        if (e.isBoss) e.addPosture(e.maxPosture * 0.6);
        strike({ team: 'player', x: e.x, y: e.y, shape: { k: 'circle', r: 10 }, active: 0.02, damage: p.dmg(e.isBoss ? 80 : 150), posture: 0, knock: 700, hitstop: 0.15, tag: 'mountain', skill: true, hideActive: true, color: '#ffb347' });
      }
      sfx('execute');
      W.shake(1);
      yield 0.3;
    }),
  },
  gauntlets_b: {
    passive: {
      onHit(p, _t, h) {
        if (h.skill) return;
        p.tempo = Math.min(0.4 * p.mythic, p.tempo + 0.05);
        p.tempoT = 1.2;
      },
      onDash(p) {
        const x = p.x, y = p.y;
        fx.anim('vfx_tornado', x, y, { w: 120, dur: 1.5, loop: true, under: true });
        strike({ team: 'player', x, y, shape: { k: 'circle', r: 60 }, active: 1.5, rehit: 0.3, damage: p.dmg(4), posture: 2, knock: 40, hitstop: 0, tag: 'gust', skill: true, hideActive: true, color: '#7dfff0' });
      },
    },
    e: eSkill('gale_rush', 'GALE RUSH', 'พุ่งต่อย 8 ครั้งแบบอมตะ', 45, function* (p) {
      sfx('skill');
      p.invuln = 1;
      const a = p.aim;
      for (let i = 0; i < 8; i++) {
        p.x += Math.cos(a) * 36;
        p.y += Math.sin(a) * 36;
        W.confine(p);
        fx.anim('vfx_gale_rush', p.x, p.y, { angle: a, w: 160 });
        strike({ team: 'player', x: p.x, y: p.y, shape: { k: 'sector', r: 90, arc: 1.6, angle: a }, active: 0.04, damage: p.dmg(9), posture: 6, knock: 60, hitstop: 0.02, tag: 'gale', skill: true, color: '#7dfff0' });
        sfx('hit', 0.6);
        yield 0.05;
      }
    }),
    ult: ult('thousand_gale', 'THOUSAND GALE', 'พายุหมัด 3 วินาที', function* (p) {
      yield* ultIntro(p, '#7dfff0');
      fx.anim('vfx_tornado', p.x, p.y, { w: 320, dur: 3, loop: true, follow: p });
      strike({ team: 'player', x: p.x, y: p.y, owner: p, follow: true, shape: { k: 'circle', r: 140 }, active: 3, rehit: 0.08, damage: p.dmg(5), posture: 3, knock: 30, hitstop: 0.005, tag: 'thousand', skill: true, hideActive: true, color: '#7dfff0', stunTime: 0.1 });
      p.invuln = 1.5;
      yield 0.1;
    }, true),
  },
  // ================= LIGHTBOW
  bow_a: {
    passive: {
      onArrowEnd(p, b) {
        if (!(b as any).charged) return;
        meteor(p, b.x, b.y, 120, 50 * p.mythic, 0.8);
      },
    },
    e: eSkill('meteor_arrow', 'METEOR ARROW', 'ยิงขึ้นฟ้า ตกเป็นอุกกาบาตยักษ์', 45, function* (p) {
      sfx('skill');
      const c = aimPoint(p, 500);
      fx.beam(p.x, p.y, p.x, p.y - 400, 4, '#ffe14d', 0.3);
      meteor(p, c.x, c.y, 170, 90, 1.0);
      yield 0.1;
    }, true),
    ult: ult('constellation', 'CONSTELLATION', 'ศรสวรรค์ตกใส่เป้า 7 ตัว', function* (p) {
      yield* ultIntro(p, '#ffe14d');
      const targets = near(p.x, p.y, 900, 7);
      for (const t of targets) fx.anim('vfx_constellation', t.x, t.y, { w: 150, dur: 0.9 });
      yield 0.8;
      for (const t of targets) {
        if (t.dead) continue;
        fx.anim('vfx_lightning_strike', t.x, t.y - 40, { w: 90, tint: '#ffe14d' });
        hitAt(p, t.x, t.y, 70, 110, 40, 'constellation', { color: '#ffe14d' });
        sfx('explosion', 0.4);
        yield 0.06;
      }
    }),
  },
  bow_b: {
    passive: {
      onArrowHit(p, t, b) {
        if ((b as any).child || b.skill) return;
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(b.vy, b.vx) + i * 0.5;
          const c = fireArrow(p, a, { dmg: 6 * p.mythic, speed: 1100, skill: true, tag: 'prism', color: '#e8f4ff' });
          c.x = t.x + Math.cos(a) * (t.r + 8);
          c.y = t.y + Math.sin(a) * (t.r + 8);
          (c as any).child = true;
          c.hitSet = new Set([t]);
        }
      },
    },
    e: eSkill('refraction', 'REFRACTION', 'ลำแสง 6 เส้นกระจายรอบตัว', 45, function* (p) {
      sfx('skill');
      fx.anim('vfx_refraction', p.x, p.y, { w: 840 });
      for (let i = 0; i < 6; i++) {
        const a = p.aim + (i * TAU) / 6;
        strike({ team: 'player', x: p.x, y: p.y, shape: { k: 'line', angle: a, len: 420, w: 28 }, active: 0.06, damage: p.dmg(35), posture: 14, knock: 160, hitstop: 0.04, tag: 'refract', skill: true, color: '#e8f4ff' });
        fx.beam(p.x, p.y, p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420, 6, '#e8f4ff', 0.3);
      }
      sfx('laser', 0.6);
      yield 0.15;
    }, true),
    ult: ult('rainbow_lance', 'RAINBOW LANCE', 'ลำแสงรุ้งกวาด 3 วินาที', function* (p) {
      yield* ultIntro(p, '#ffffff');
      sfx('laser');
      let a = p.aim;
      const s = strike({ team: 'player', x: p.x, y: p.y, owner: p, follow: true, shape: { k: 'line', angle: a, len: 620, w: 46 }, active: 3, rehit: 0.12, damage: p.dmg(14), posture: 5, knock: 40, hitstop: 0.005, tag: 'lance', skill: true, hideActive: true, color: '#ffffff' });
      for (let t = 0; t < 3; t += 0.05) {
        a += Math.max(-0.06, Math.min(0.06, angleDiff(a, p.aim)));
        (s.shape as { angle: number }).angle = a;
        fx.anim('vfx_rainbow_beam', p.x + Math.cos(a) * 310, p.y + Math.sin(a) * 310, { angle: a, w: 640, dur: 0.08 });
        W.shake(0.03);
        yield 0.05;
      }
    }),
  },
};

function fireGround(p: Player, x: number, y: number, r: number, life: number) {
  fx.anim('vfx_fire_ground', x, y, { w: r * 2.2, dur: life, loop: true, under: true });
  strike({ team: 'player', x, y, shape: { k: 'circle', r }, active: life, rehit: 0.4, damage: p.dmg(6), posture: 2, knock: 0, hitstop: 0, tag: 'magma', skill: true, hideActive: true, color: '#ff5a1f', stunTime: 0.05 });
}
function meteor(p: Player, x: number, y: number, r: number, dmg: number, delay: number) {
  fx.anim('proj_meteor_arrow', x, y - 80, { w: 70, dur: delay });
  strike({
    team: 'player', x, y, shape: { k: 'circle', r }, delay, active: 0.06, damage: p.dmg(dmg), posture: 30 * p.postureMul, knock: 380, hitstop: 0.08, tag: 'meteor', skill: true, crit: p.crit, color: '#ffe14d',
    onStart: () => {
      fx.anim('vfx_explosion', x, y, { w: r * 2.4, tint: '#ffe14d' });
      fx.ring(x, y, 10, r * 1.2, 0.4, '#ffe14d', 8, true);
      sfx('explosion', 0.6);
      W.shake(0.3);
    },
  });
}

export function kitFor(id: WeaponId, path: PathId | null): Kit | null {
  return path ? KITS[`${id}_${path}`] ?? null : null;
}
