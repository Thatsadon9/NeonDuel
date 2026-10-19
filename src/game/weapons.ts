/** Weapon definitions: combo frame data, dash attacks, charged attacks and skills. */
import { TAU, angleTo, clamp, dist, rand, angleDiff } from '../core/math';
import type { Co } from '../core/co';
import { fx } from '../render/fx';
import { cam } from '../render/camera';
import { sfx, type Sfx } from '../audio/audio';
import { W, strike, shoot, type Actor } from './world';
import { sprites } from '../render/sprites';
import type { Player } from './player';

export type WeaponId = 'katana' | 'daggers' | 'hammer';

export interface AttackDef {
  name: string;
  startup: number;
  active: number;
  recovery: number;
  dmg: number;
  posture: number;
  range: number;
  arc: number;
  lunge: number;
  hitstop: number;
  shake: number;
  knock: number;
  dir: 1 | -1;
  sfx: Sfx;
  /** fraction of recovery after which the next combo input is accepted */
  cancel?: number;
  thrust?: boolean; // line hitbox
  circle?: { off: number; r: number }; // AoE in front
  heavy?: boolean;
  bleed?: number;
  slashW?: number;
  stun?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  thai: string;
  cost: number;
  /** if true, the player keeps control (cast is instant) */
  instant?: boolean;
  run: (p: Player) => Co;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  thai: string;
  desc: string;
  color: string;
  core: string;
  moveMul: number;
  combo: AttackDef[];
  dash: AttackDef;
  chargeTime: number;
  charged: (p: Player) => Co;
  skills: [SkillDef, SkillDef];
}

// ------------------------------------------------------------------ helpers
/** delayed "cut" — the anime-style slash that lands after the dash */
function delayedCut(p: Player, t: Actor, dmg: number, posture: number, delay: number, tag: string) {
  const a = rand(0, TAU);
  strike({
    team: 'player', x: t.x, y: t.y, owner: undefined, shape: { k: 'circle', r: 8 }, delay,
    active: 0.03, damage: p.dmg(dmg), posture: posture * p.mods.postureMul, knock: 80, hitstop: 0.06, tag, skill: true,
    crit: p.mods.crit + 0.15, hideTele: true, hideActive: true, color: '#ffffff',
    onStart: (s) => {
      if (!t.dead) {
        s.x = t.x;
        s.y = t.y;
      }
      fx.beam(s.x - Math.cos(a) * 110, s.y - Math.sin(a) * 110, s.x + Math.cos(a) * 110, s.y + Math.sin(a) * 110, 9, '#7ff6ff', 0.3);
      fx.beam(s.x - Math.cos(a + 1.6) * 80, s.y - Math.sin(a + 1.6) * 80, s.x + Math.cos(a + 1.6) * 80, s.y + Math.sin(a + 1.6) * 80, 6, '#ffffff', 0.25);
      fx.sparks(s.x, s.y, a, Math.PI, 14, 600, '#bdfcff', 0.35, 2.5);
      sfx('slashHeavy', 0.8);
      W.shake(0.25);
    },
  });
}

function lineToEdge(x: number, y: number, a: number, maxLen: number) {
  // clamp travel inside arena
  let len = maxLen;
  for (let i = 0; i < 20; i++) {
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    if (Math.hypot(ex, ey) < W.arenaR - 24) break;
    len *= 0.88;
  }
  return len;
}

// ------------------------------------------------------------------ KATANA
const katana: WeaponDef = {
  id: 'katana',
  name: 'KATANA',
  thai: 'ดาบคาทานะ',
  desc: 'สมดุล เร็ว ระยะกลาง — คอมโบ 4 จังหวะ ชาร์จเป็น Iaido พุ่งฟันเป็นเส้น',
  color: '#7ff6ff',
  core: '#ffffff',
  moveMul: 1,
  combo: [
    { name: 'k1', startup: 0.07, active: 0.08, recovery: 0.2, dmg: 14, posture: 9, range: 100, arc: 2.3, lunge: 270, hitstop: 0.045, shake: 0.12, knock: 170, dir: 1, sfx: 'slash', cancel: 0.25 },
    { name: 'k2', startup: 0.06, active: 0.08, recovery: 0.2, dmg: 14, posture: 9, range: 100, arc: 2.3, lunge: 270, hitstop: 0.045, shake: 0.12, knock: 170, dir: -1, sfx: 'slash', cancel: 0.25 },
    { name: 'k3', startup: 0.08, active: 0.07, recovery: 0.24, dmg: 18, posture: 12, range: 140, arc: 0, lunge: 430, hitstop: 0.06, shake: 0.18, knock: 260, dir: 1, sfx: 'stab', thrust: true, cancel: 0.3 },
    { name: 'k4', startup: 0.12, active: 0.12, recovery: 0.36, dmg: 28, posture: 24, range: 125, arc: TAU, lunge: 140, hitstop: 0.09, shake: 0.35, knock: 440, dir: 1, sfx: 'slashHeavy', heavy: true, slashW: 50 },
  ],
  dash: { name: 'kd', startup: 0.03, active: 0.08, recovery: 0.24, dmg: 20, posture: 14, range: 160, arc: 0, lunge: 560, hitstop: 0.06, shake: 0.2, knock: 300, dir: 1, sfx: 'stab', thrust: true },
  chargeTime: 0.6,
  *charged(p) {
    // IAIDO — dash along aim leaving a delayed cut line
    const a = p.aim;
    const len = lineToEdge(p.x, p.y, a, 380);
    const x0 = p.x, y0 = p.y;
    p.invuln = Math.max(p.invuln, 0.35);
    sfx('dash');
    for (let i = 0; i < 10; i++) fx.ghost(x0 + Math.cos(a) * len * (i / 10), y0 + Math.sin(a) * len * (i / 10), a, p.r, '#7ff6ff', 0.35);
    p.x += Math.cos(a) * len;
    p.y += Math.sin(a) * len;
    W.confine(p);
    p.vx = Math.cos(a) * 200;
    p.vy = Math.sin(a) * 200;
    fx.beam(x0, y0, p.x, p.y, 4, '#7ff6ff', 0.25);
    yield 0.14;
    sfx('slashHeavy');
    fx.beam(x0, y0, p.x, p.y, 16, '#7ff6ff', 0.35);
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      fx.sparks(x0 + (p.x - x0) * t, y0 + (p.y - y0) * t, a + Math.PI / 2 * (i % 2 ? 1 : -1), 0.4, 3, 400, '#bdfcff');
    }
    strike({
      team: 'player', x: x0, y: y0, shape: { k: 'line', angle: a, len, w: 70 }, active: 0.05,
      damage: p.dmg(55) * p.mods.chargeDmg, posture: 45 * p.mods.postureMul, knock: 300, hitstop: 0.12, tag: 'iaido', crit: p.mods.crit + 0.2,
      color: '#7ff6ff',
    });
    W.shake(0.45);
    cam.punch = 0.06;
    yield 0.18;
  },
  skills: [
    {
      id: 'phantom', name: 'PHANTOM SLASH', thai: 'พุ่งทะลุศัตรู 3 ครั้ง แล้วรอยฟันระเบิดพร้อมกัน', cost: 35,
      *run(p) {
        const targets: Actor[] = [];
        const alive = W.enemies.filter((e) => !e.dead && dist(p.x, p.y, e.x, e.y) < 650);
        alive.sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y));
        for (let i = 0; i < 3; i++) if (alive.length) targets.push(alive[i % alive.length]);
        sfx('skill');
        W.slowMo(0.5, 0.6);
        p.invuln = 1.2;
        const marks: Actor[] = [];
        for (let i = 0; i < 3; i++) {
          const t = targets[i];
          const x0 = p.x, y0 = p.y;
          let a: number;
          if (t && !t.dead) a = angleTo(p.x, p.y, t.x, t.y);
          else a = p.aim + (i - 1) * 0.9;
          const len = t && !t.dead ? lineToEdge(p.x, p.y, a, dist(p.x, p.y, t.x, t.y) + t.r + 70) : lineToEdge(p.x, p.y, a, 260);
          p.x += Math.cos(a) * len;
          p.y += Math.sin(a) * len;
          W.confine(p);
          p.aim = a;
          p.facing = a;
          for (let k = 0; k < 7; k++) fx.ghost(x0 + (p.x - x0) * (k / 7), y0 + (p.y - y0) * (k / 7), a, p.r, '#b98cff', 0.4);
          fx.beam(x0, y0, p.x, p.y, 5, '#b98cff', 0.5);
          sfx('dash', 0.9);
          if (t) marks.push(t);
          yield 0.09;
        }
        yield 0.22;
        W.hitStop(0.06);
        W.flash('#b98cff', 0.25);
        for (let i = 0; i < marks.length; i++) delayedCut(p, marks[i], 34, 26, i * 0.06, 'phantom');
        yield 0.15;
      },
    },
    {
      id: 'storm', name: 'BLADE STORM', thai: 'ใบดาบหมุนรอบตัว 3.5 วินาที ฟันศัตรูและทำลายกระสุน', cost: 45, instant: true,
      *run(p) {
        sfx('skill');
        fx.ring(p.x, p.y, 20, 120, 0.4, '#7ff6ff', 5);
        p.bladeStormT = 3.5;
        strike({
          team: 'player', x: p.x, y: p.y, owner: p, follow: true, shape: { k: 'circle', r: 92 }, active: 3.5, rehit: 0.18,
          damage: p.dmg(6), posture: 4 * p.mods.postureMul, knock: 90, hitstop: 0.015, tag: 'storm', skill: true, crit: p.mods.crit,
          stunTime: 0.12,
          onUpdate: (s) => {
            for (const b of W.projs) {
              if (b.team === 'enemy' && !b.unblockable && dist(b.x, b.y, p.x, p.y) < 100) {
                W.killProj(b);
                fx.sparks(b.x, b.y, angleTo(p.x, p.y, b.x, b.y), 0.6, 4, 300, '#7ff6ff');
              }
            }
            s.damage = p.dmg(6);
          },
        });
        yield 0.1;
      },
    },
  ],
};

// ------------------------------------------------------------------ DAGGERS
const dagStab = (name: string, dir: 1 | -1): AttackDef => ({
  name, startup: 0.035, active: 0.06, recovery: 0.12, dmg: 7, posture: 4, range: 78, arc: 1.7, lunge: 210, hitstop: 0.03,
  shake: 0.07, knock: 90, dir, sfx: 'stab', cancel: 0.1, bleed: 1, slashW: 18,
});
const daggers: WeaponDef = {
  id: 'daggers',
  name: 'TWIN FANGS',
  thai: 'มีดคู่',
  desc: 'เร็วมาก ระยะสั้น ติดเลือด แทงหลังแรงขึ้น — ชาร์จเป็น Shadow Step วาร์ปไปด้านหลังศัตรู',
  color: '#ff4d8a',
  core: '#ffd1e3',
  moveMul: 1.1,
  combo: [
    dagStab('d1', 1), dagStab('d2', -1), dagStab('d3', 1), dagStab('d4', -1),
    { name: 'd5', startup: 0.06, active: 0.08, recovery: 0.3, dmg: 17, posture: 12, range: 92, arc: 2.6, lunge: 320, hitstop: 0.07, shake: 0.22, knock: 300, dir: 1, sfx: 'slashHeavy', bleed: 2, slashW: 30 },
  ],
  dash: { name: 'dd', startup: 0.02, active: 0.1, recovery: 0.18, dmg: 12, posture: 8, range: 88, arc: TAU, lunge: 260, hitstop: 0.04, shake: 0.12, knock: 160, dir: 1, sfx: 'slash', bleed: 1, slashW: 22 },
  chargeTime: 0.45,
  *charged(p) {
    const t = W.nearestEnemy(p.x, p.y, 520, (e) => Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, e.x, e.y))) < 1.2) ?? W.nearestEnemy(p.x, p.y, 380);
    if (!t) {
      // short blink forward
      const a = p.aim;
      p.teleport(p.x + Math.cos(a) * lineToEdge(p.x, p.y, a, 200), p.y + Math.sin(a) * lineToEdge(p.x, p.y, a, 200));
      yield 0.1;
      return;
    }
    const behind = t.facing + Math.PI;
    p.teleport(t.x + Math.cos(behind) * (t.r + 34), t.y + Math.sin(behind) * (t.r + 34));
    p.aim = p.facing = angleTo(p.x, p.y, t.x, t.y);
    p.invuln = Math.max(p.invuln, 0.3);
    yield 0.06;
    fx.slash(p.x, p.y, p.aim, 90, 2.6, 1, '#ff4d8a', { width: 36, life: 0.25, follow: p });
    fx.slash(p.x, p.y, p.aim, 80, 2.6, -1, '#ffd1e3', { width: 20, life: 0.25, follow: p });
    sfx('slashHeavy');
    strike({
      team: 'player', x: p.x, y: p.y, owner: p, follow: true, shape: { k: 'sector', r: 100, arc: 2.6, angle: p.aim }, active: 0.06,
      damage: p.dmg(42) * p.mods.chargeDmg, posture: 26 * p.mods.postureMul, knock: 260, hitstop: 0.1, tag: 'shadow', crit: 1,
      color: '#ff4d8a', onHit: (e) => (e.bleed += 3),
    });
    W.shake(0.3);
    yield 0.2;
  },
  skills: [
    {
      id: 'fan', name: 'FAN OF KNIVES', thai: 'ปามีด 11 เล่มเป็นรูปพัด ทะลุและติดเลือด', cost: 30, instant: true,
      *run(p) {
        sfx('skill');
        const n = 11;
        for (let wave = 0; wave < (p.overdrive > 0 ? 2 : 1); wave++) {
          for (let i = 0; i < n; i++) {
            const a = p.aim + (i / (n - 1) - 0.5) * 1.3;
            shoot({
              team: 'player', x: p.x, y: p.y, vx: Math.cos(a) * 1050, vy: Math.sin(a) * 1050, r: 9, kind: 'knife',
              damage: p.dmg(9), posture: 5 * p.mods.postureMul, life: 0.7, color: '#ff4d8a', pierce: 1, skill: true, tag: 'fan', knock: 120,
              onHit: (_b, e) => (e.bleed += 1),
            });
          }
          sfx('slash');
          yield 0.15;
        }
      },
    },
    {
      id: 'mark', name: 'DEATH MARK', thai: 'ปาคุไนนำวิถี — โดนแล้ววาร์ปไปฟันรัว 4 ครั้ง', cost: 45,
      *run(p) {
        sfx('skill');
        let hit: Actor | null = null;
        const tgt = W.nearestEnemy(p.x, p.y, 700, (e) => Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, e.x, e.y))) < 0.7);
        const b = shoot({
          team: 'player', x: p.x, y: p.y, vx: Math.cos(p.aim) * 1500, vy: Math.sin(p.aim) * 1500, r: 10, kind: 'knife',
          damage: p.dmg(8), posture: 4, life: 0.6, color: '#ffd1e3', skill: true, tag: 'mark', homing: tgt ? 10 : 0, target: tgt ?? undefined,
          onHit: (_b, e) => (hit = e),
        });
        while (!b.dead) yield 0;
        const t = hit as Actor | null;
        if (!t || t.dead) {
          p.focus = Math.min(100, p.focus + 22);
          return;
        }
        W.slowMo(0.35, 0.7);
        p.invuln = 1;
        for (let i = 0; i < 4; i++) {
          if (t.dead) break;
          const a = rand(0, TAU);
          p.teleport(t.x + Math.cos(a) * (t.r + 40), t.y + Math.sin(a) * (t.r + 40));
          p.aim = p.facing = angleTo(p.x, p.y, t.x, t.y);
          fx.slash(p.x, p.y, p.aim, 85, 2.4, i % 2 ? 1 : -1, '#ff4d8a', { width: 26, life: 0.2, follow: p });
          sfx('slash');
          strike({
            team: 'player', x: p.x, y: p.y, owner: p, follow: true, shape: { k: 'sector', r: 100, arc: 2.4, angle: p.aim }, active: 0.05,
            damage: p.dmg(17), posture: 10 * p.mods.postureMul, knock: 60, hitstop: 0.05, tag: 'mark', skill: true, crit: 0.5, color: '#ff4d8a',
            onHit: (e) => (e.bleed += 1),
          });
          yield 0.08;
        }
        yield 0.1;
      },
    },
  ],
};

// ------------------------------------------------------------------ HAMMER
const hammer: WeaponDef = {
  id: 'hammer',
  name: 'GRAVITON',
  thai: 'ค้อนกราวิตอน',
  desc: 'ช้า หนัก ทำลาย Posture ดีที่สุด — ชาร์จยิงคลื่นกระแทกทะลุทุกอย่าง',
  color: '#ffb347',
  core: '#fff2d6',
  moveMul: 0.93,
  combo: [
    { name: 'h1', startup: 0.15, active: 0.1, recovery: 0.3, dmg: 26, posture: 24, range: 125, arc: 2.5, lunge: 230, hitstop: 0.08, shake: 0.28, knock: 380, dir: 1, sfx: 'slashHeavy', cancel: 0.3, slashW: 55 },
    { name: 'h2', startup: 0.14, active: 0.1, recovery: 0.32, dmg: 28, posture: 26, range: 125, arc: 2.5, lunge: 230, hitstop: 0.08, shake: 0.28, knock: 380, dir: -1, sfx: 'slashHeavy', cancel: 0.3, slashW: 55 },
    { name: 'h3', startup: 0.22, active: 0.1, recovery: 0.45, dmg: 42, posture: 42, range: 0, arc: 0, lunge: 160, hitstop: 0.13, shake: 0.6, knock: 520, dir: 1, sfx: 'slam', circle: { off: 60, r: 145 }, heavy: true, stun: 0.6 },
  ],
  dash: { name: 'hd', startup: 0.05, active: 0.12, recovery: 0.3, dmg: 24, posture: 22, range: 120, arc: TAU, lunge: 200, hitstop: 0.07, shake: 0.3, knock: 400, dir: 1, sfx: 'slashHeavy', slashW: 50 },
  chargeTime: 0.7,
  *charged(p) {
    const a = p.aim;
    sfx('slam');
    W.shake(0.5);
    fx.ring(p.x, p.y, 20, 140, 0.4, '#ffb347', 8);
    shoot({
      team: 'player', x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, r: 34, kind: 'wave',
      damage: p.dmg(40) * p.mods.chargeDmg, posture: 38 * p.mods.postureMul, life: 0.9, color: '#ffb347', pierce: 99, tag: 'quake', knock: 420,
      noObstacle: true,
      onUpdate: (b) => {
        if (Math.random() < 0.6) fx.ember(b.x + rand(-20, 20), b.y + rand(-20, 20), rand(-40, 40), rand(-40, 40), '#ffb347', 0.4, 3);
      },
    });
    strike({
      team: 'player', x: p.x, y: p.y, shape: { k: 'circle', r: 90 }, active: 0.05, damage: p.dmg(20), posture: 20 * p.mods.postureMul,
      knock: 400, hitstop: 0.08, tag: 'quake', color: '#ffb347',
    });
    yield 0.3;
  },
  skills: [
    {
      id: 'leap', name: 'METEOR LEAP', thai: 'กระโดดไปยังเคอร์เซอร์ ทุบพื้นเป็นคลื่นกระแทกมหาศาล', cost: 35,
      *run(p) {
        sfx('skill');
        const m = p.aimPoint();
        const a = angleTo(p.x, p.y, m.x, m.y);
        const d = Math.min(400, dist(p.x, p.y, m.x, m.y));
        const len = lineToEdge(p.x, p.y, a, d);
        const x0 = p.x, y0 = p.y, x1 = p.x + Math.cos(a) * len, y1 = p.y + Math.sin(a) * len;
        p.invuln = 0.6;
        const T = 0.36;
        strike({ team: 'player', x: x1, y: y1, shape: { k: 'circle', r: 175 }, delay: T, active: 0.001, damage: 0, posture: 0, knock: 0, hideActive: true, noHit: true, color: '#ffb347', tag: 'tele' });
        for (let t = 0; t < T; t += 1 / 60) {
          const u = t / T;
          p.x = x0 + (x1 - x0) * u;
          p.y = y0 + (y1 - y0) * u;
          p.z = Math.sin(u * Math.PI) * 60;
          fx.ghost(p.x, p.y - p.z, a, p.r, '#ffb347', 0.2);
          yield 0;
        }
        p.z = 0;
        p.x = x1;
        p.y = y1;
        W.confine(p);
        sfx('slam');
        sfx('explosion', 0.6);
        W.hitStop(0.1);
        W.shake(0.75);
        cam.punch = 0.08;
        fx.ring(p.x, p.y, 20, 210, 0.5, '#ffb347', 10, true);
        fx.ring(p.x, p.y, 10, 300, 0.7, '#fff2d6', 4);
        fx.shards(p.x, p.y, 26, 520, '#ffb347', 0.9, 8);
        fx.smoke(p.x, p.y, 14, 'rgba(255,180,90,0.25)', 200, 22, 0.9);
        strike({
          team: 'player', x: p.x, y: p.y, shape: { k: 'circle', r: 180 }, active: 0.06, damage: p.dmg(50), posture: 50 * p.mods.postureMul,
          knock: 600, hitstop: 0.12, tag: 'leap', skill: true, crit: p.mods.crit, color: '#ffb347', stunTime: 0.8,
        });
        yield 0.25;
      },
    },
    {
      id: 'well', name: 'GRAVITY WELL', thai: 'หลุมแรงโน้มถ่วงดูดศัตรูและกลืนกระสุน แล้วระเบิด', cost: 50, instant: true,
      *run(p) {
        sfx('skill');
        const m = p.aimPoint();
        const a = angleTo(p.x, p.y, m.x, m.y);
        const d = Math.min(420, dist(p.x, p.y, m.x, m.y));
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        const R = 210;
        fx.anim('vfx_vortex', x, y, { w: R * 2.1, dur: 2.2, loop: true, tint: '#c49bff', under: true });
        strike({
          team: 'player', x, y, shape: { k: 'circle', r: R }, active: 2.2, rehit: 0.25, damage: p.dmg(5), posture: 6 * p.mods.postureMul,
          knock: -60, hitstop: 0.01, tag: 'well', skill: true, hideActive: true, color: '#c49bff', stunTime: 0.3,
          onUpdate: (s, dt) => {
            for (const e of W.enemies) {
              if (e.dead) continue;
              const dd = dist(e.x, e.y, x, y);
              if (dd < R + 60 && dd > 10) {
                const f = (e.isBoss ? 260 : 1500) * (1 - e.kbResist * 0.5);
                e.vx += ((x - e.x) / dd) * f * dt;
                e.vy += ((y - e.y) / dd) * f * dt;
              }
            }
            for (const b of W.projs) if (b.team === 'enemy' && dist(b.x, b.y, x, y) < R) W.killProj(b);
            if (Math.random() < 0.9) {
              const aa = rand(0, TAU), rr = rand(R * 0.5, R);
              fx.ember(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, -Math.cos(aa) * rr * 2.2, -Math.sin(aa) * rr * 2.2, '#c49bff', 0.45, 3);
            }
            if (Math.floor(W.time * 6) !== Math.floor((W.time - dt) * 6)) fx.ring(x, y, R, 10, 0.5, '#c49bff', 2);
          },
          onEnd: () => {
            sfx('explosion');
            W.shake(0.5);
            fx.ring(x, y, 10, R * 1.2, 0.5, '#c49bff', 10, true);
            fx.shards(x, y, 24, 500, '#c49bff', 0.9, 7);
            strike({
              team: 'player', x, y, shape: { k: 'circle', r: R }, active: 0.05, damage: p.dmg(40), posture: 40 * p.mods.postureMul,
              knock: 500, hitstop: 0.1, tag: 'well', skill: true, color: '#c49bff',
            });
          },
        });
        yield 0.12;
      },
    },
  ],
};

export const WEAPONS: Record<WeaponId, WeaponDef> = { katana, daggers, hammer };

/** draw the held weapon */
export function drawWeapon(ctx: CanvasRenderingContext2D, id: WeaponId, x: number, y: number, ang: number, r: number, glow: string) {
  if (sprites.has('weapon_' + id)) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    sprites.draw(ctx, 'weapon_' + id, x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, { angle: ang, scale: 1.15, outline: glow, outlineAlpha: 0.55 });
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = glow;
  ctx.fillStyle = glow;
  if (id === 'katana') {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(r * 0.6, 0);
    ctx.quadraticCurveTo(r * 2.4, -4, r * 3.9, -7);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.75, -6);
    ctx.lineTo(r * 0.75, 6);
    ctx.stroke();
  } else if (id === 'daggers') {
    for (const s of [-1, 1]) {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, s * r * 0.7);
      ctx.lineTo(r * 1.9, s * r * 0.55);
      ctx.stroke();
    }
  } else {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 0);
    ctx.lineTo(r * 2.8, 0);
    ctx.stroke();
    ctx.fillStyle = '#1a1206';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(r * 2.5, -r * 0.8, r * 0.9, r * 1.6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

