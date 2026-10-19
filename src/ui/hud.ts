/** In-game HUD drawn on canvas: bars, skills, combo rank, boss bars, callouts, banners, hints. */
import { TAU, clamp, easeOutBack, easeOutCubic } from '../core/math';
import { cam } from '../render/camera';
import { W } from '../game/world';
import { style, RANKS, RANK_COLORS, RANK_NAMES } from '../game/style';
import type { Boss } from '../game/bosses/base';
import { sprites } from '../render/sprites';

function uiImg(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number, alpha = 1) {
  const s = sprites.get(name);
  if (!s) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(s.img, 0, 0, s.fw, s.fh, x, y, w, h);
  ctx.restore();
  return true;
}

const FONT = 'Orbitron, "Chakra Petch", sans-serif';
const THAI = '"Chakra Petch", Orbitron, sans-serif';

interface Callout { text: string; color: string; life: number; max: number; size: number }

class Hud {
  callouts: Callout[] = [];
  banner: { title: string; sub: string; color: string; life: number; max: number; big: boolean; portrait?: string } | null = null;
  hint: { text: string; life: number } | null = null;
  bossGhost = new Map<object, number>();
  fps = 60;

  callout(text: string, color: string, life = 0.8, size = 40) {
    // replace an identical one rather than stacking
    this.callouts = this.callouts.filter((c) => c.text !== text);
    this.callouts.push({ text, color, life, max: life, size });
    if (this.callouts.length > 3) this.callouts.shift();
  }
  showBanner(title: string, sub: string, color = '#7ff6ff', life = 2.2, big = false, portrait?: string) {
    this.banner = { title, sub, color, life, max: life, big, portrait };
  }
  showHint(text: string, life = 6) {
    this.hint = { text, life };
  }
  update(dt: number) {
    for (const c of this.callouts) c.life -= dt;
    this.callouts = this.callouts.filter((c) => c.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.hint) {
      this.hint.life -= dt;
      if (this.hint.life <= 0) this.hint = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, showPlayerHud: boolean) {
    ctx.save();
    ctx.textBaseline = 'middle';
    if (showPlayerHud) {
      this.drawWorldPrompts(ctx, w, h);
      this.drawPlayer(ctx, w, h);
      this.drawSkills(ctx, w, h);
      this.drawStyle(ctx, w, h);
      this.drawBosses(ctx, w);
    }
    this.drawCallouts(ctx, w, h);
    this.drawBanner(ctx, w, h);
    if (this.hint && showPlayerHud) {
      const a = clamp(this.hint.life * 2, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `600 ${Math.round(clamp(w / 60, 14, 20))}px ${THAI}`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(this.hint.text).width;
      ctx.fillStyle = 'rgba(5,8,20,0.75)';
      roundRect(ctx, w / 2 - tw / 2 - 18, h - 168, tw + 36, 38, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(127,246,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#dffcff';
      ctx.fillText(this.hint.text, w / 2, h - 149);
      ctx.globalAlpha = 1;
    }
    if (W.debug) {
      ctx.font = `12px monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6dff9e';
      const p = W.player;
      const lines = [
        `FPS ${this.fps.toFixed(0)}  parts/proj/strikes ${W.projs.length}/${W.strikes.length}`,
        `state ${p?.state} combo ${p?.comboIdx} iframe ${p?.iframe.toFixed(2)} parry ${p?.parryT.toFixed(2)}`,
        `F2: skip stage`,
      ];
      lines.forEach((l, i) => ctx.fillText(l, 12, h - 60 + i * 16));
    }
    ctx.restore();
  }

  private drawWorldPrompts(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = W.player;
    // execution prompt
    if (p.execTarget) {
      const e = p.execTarget;
      const s = cam.worldToScreen(e.x, e.y - e.r - 40);
      const pulse = 1 + Math.sin(W.time * 12) * 0.08;
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(16 * pulse)}px ${FONT}`;
      ctx.fillStyle = '#ffe14d';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText('[CLICK] EXECUTE', s.x, s.y);
      ctx.fillText('[CLICK] EXECUTE', s.x, s.y);
    }
    // offscreen enemy indicators
    for (const e of W.enemies) {
      if (e.dead) continue;
      const s = cam.worldToScreen(e.x, e.y);
      const m = 30;
      if (s.x > m && s.x < w - m && s.y > m && s.y < h - m) continue;
      const cx = w / 2, cy = h / 2;
      const a = Math.atan2(s.y - cy, s.x - cx);
      const ex = clamp(s.x, m, w - m), ey = clamp(s.y, m, h - m);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = e.isBoss ? '#ff2d4a' : e.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, 8);
      ctx.lineTo(-6, -8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
    const p = W.player;
    const x = 24, y = 24;
    const bw = 300;
    // HP
    ctx.fillStyle = 'rgba(5,8,20,0.7)';
    roundRect(ctx, x - 8, y - 8, bw + 76, 104, 10);
    ctx.fill();
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7ff6ff';
    ctx.fillText('HP', x, y + 9);
    bar(ctx, x + 34, y, bw, 18, p.hp / p.maxHp, p.ghostHp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff4d6d' : '#6dff9e', '#ffffff');
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, x + 34 + bw - 6, y + 9);
    // stamina
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe14d';
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText('ST', x, y + 33);
    bar(ctx, x + 34, y + 27, bw * 0.75, 8, p.stamina / p.mods.staminaMax, p.stamina / p.mods.staminaMax, p.stamina < 25 ? '#ff9a3c' : '#ffe14d');
    // focus (segmented)
    ctx.fillStyle = '#b98cff';
    ctx.fillText('FOCUS', x, y + 54);
    const fx0 = x + 54, fw = bw - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(fx0, y + 48, fw, 12);
    const fk = p.focus / 100;
    const full = p.focus >= 100;
    ctx.fillStyle = full ? (Math.floor(W.time * 8) % 2 ? '#ffffff' : '#b98cff') : '#b98cff';
    ctx.fillRect(fx0, y + 48, fw * fk, 12);
    // cost markers
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (const sk of p.wpn.skills) {
      const cx = fx0 + fw * Math.min(1, (sk.cost * p.mods.skillCost) / 100);
      ctx.fillRect(cx - 1, y + 46, 2, 16);
    }
    // dash pips
    ctx.fillStyle = '#7ff6ff';
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText('DASH', x, y + 80);
    for (let i = 0; i < p.mods.dashMax; i++) {
      const px = x + 54 + i * 26;
      ctx.strokeStyle = '#7ff6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, y + 74);
      ctx.lineTo(px + 18, y + 74);
      ctx.lineTo(px + 12, y + 86);
      ctx.lineTo(px - 6, y + 86);
      ctx.closePath();
      ctx.stroke();
      const fill = i < p.dashCharges ? 1 : i === p.dashCharges ? p.dashRecharge / p.mods.dashCd : 0;
      if (fill > 0) {
        ctx.globalAlpha = fill >= 1 ? 1 : 0.35;
        ctx.fillStyle = '#7ff6ff';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (p.overdrive > 0) {
      ctx.fillStyle = '#7ff6ff';
      ctx.font = `800 12px ${FONT}`;
      ctx.fillText(`OVERDRIVE ${p.overdrive.toFixed(1)}s`, x + 54 + p.mods.dashMax * 26 + 16, y + 80);
    }
  }

  private drawSkills(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = W.player;
    const slots = [
      { key: 'Q', sk: p.wpn.skills[0], cost: p.wpn.skills[0].cost * p.mods.skillCost },
      { key: 'E', sk: p.wpn.skills[1], cost: p.wpn.skills[1].cost * p.mods.skillCost },
      { key: 'R', sk: { name: 'OVERDRIVE', id: 'overdrive' }, cost: 100 },
    ];
    const sw = 150, gap = 12;
    const total = slots.length * sw + (slots.length - 1) * gap;
    let x = w / 2 - total / 2;
    const y = h - 74;
    for (const s of slots) {
      const ready = p.focus >= s.cost;
      ctx.fillStyle = 'rgba(5,8,20,0.75)';
      roundRect(ctx, x, y, sw, 50, 8);
      ctx.fill();
      ctx.strokeStyle = ready ? p.wpn.color : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = ready ? 2 : 1;
      ctx.stroke();
      if (!ready) {
        ctx.fillStyle = 'rgba(185,140,255,0.18)';
        roundRect(ctx, x, y + 50 * (1 - p.focus / s.cost), sw, 50 * (p.focus / s.cost), 8);
        ctx.fill();
      }
      ctx.textAlign = 'left';
      const icon = uiImg(ctx, 'icon_skill_' + s.sk.id, x + 6, y + 7, 36, 36, ready ? 1 : 0.35);
      ctx.font = `800 ${icon ? 11 : 18}px ${FONT}`;
      ctx.fillStyle = ready ? '#ffffff' : '#5c6488';
      ctx.fillText(s.key, icon ? x + 4 : x + 12, icon ? y + 9 : y + 25);
      const tx = icon ? x + 48 : x + 36;
      ctx.font = `700 10px ${FONT}`;
      ctx.fillStyle = ready ? p.wpn.color : '#5c6488';
      ctx.fillText(s.sk.name, tx, y + 19);
      ctx.fillStyle = '#8a93b8';
      ctx.fillText(`${Math.round(s.cost)} FOCUS`, tx, y + 34);
      x += sw + gap;
    }
    // weapon slots
    const ws = 46;
    let wx = w / 2 - (p.weapons.length * (ws + 8)) / 2;
    const wy = y - 56;
    p.weapons.forEach((id, i) => {
      const on = i === p.wi;
      ctx.fillStyle = on ? 'rgba(127,246,255,0.15)' : 'rgba(5,8,20,0.7)';
      roundRect(ctx, wx, wy, ws, 40, 6);
      ctx.fill();
      ctx.strokeStyle = on ? '#ffffff' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `800 10px ${FONT}`;
      ctx.fillStyle = on ? '#ffffff' : '#8a93b8';
      ctx.fillText(String(i + 1), wx + ws / 2, wy + 12);
      if (!uiImg(ctx, 'icon_weapon_' + id, wx + ws / 2 - 11, wy + 16, 22, 22, on ? 1 : 0.5)) {
        ctx.font = `700 8px ${FONT}`;
        ctx.fillText(id.toUpperCase(), wx + ws / 2, wy + 28);
      }
      wx += ws + 8;
    });
  }

  private drawStyle(ctx: CanvasRenderingContext2D, w: number, _h: number) {
    const x = w - 30, y = 150;
    const r = style.rank;
    const col = RANK_COLORS[r];
    if (style.points < 5 && style.combo === 0) return;
    const pop = 1 + style.bump * 0.5;
    ctx.textAlign = 'right';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = `900 ${r >= 4 ? 64 : 54}px ${FONT}`;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 20;
    const jitter = r >= 5 ? Math.sin(W.time * 40) * 1.5 : 0;
    ctx.fillText(RANKS[r], jitter, 0);
    ctx.restore();
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = col;
    ctx.fillText(RANK_NAMES[r].toUpperCase(), x, y + 40);
    // progress
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x - 130, y + 54, 130, 4);
    ctx.fillStyle = col;
    ctx.fillRect(x - 130, y + 54, 130 * style.progress, 4);
    if (style.combo > 1) {
      ctx.font = `800 26px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${style.combo}`, x, y + 84);
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = '#8a93b8';
      ctx.fillText('HITS', x, y + 104);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x - 60, y + 114, 60 * clamp(style.comboTimer / 2.6, 0, 1), 2);
    }
  }

  private drawBosses(ctx: CanvasRenderingContext2D, w: number) {
    const bosses = W.enemies.filter((e) => e.isBoss) as Boss[];
    if (!bosses.length) return;
    const n = bosses.length;
    const totalW = Math.min(w * 0.5, 640);
    const bw = n > 1 ? totalW / n - 12 : totalW;
    bosses.forEach((b, i) => {
      const x = w / 2 - totalW / 2 + i * (bw + 24) - (n > 1 ? 6 : 0);
      // drop below the player panel when the screen is too narrow to fit both on one row
      const y = w / 2 - totalW / 2 < 410 ? 140 : 30;
      const g = this.bossGhost.get(b) ?? b.hp;
      const ng = g + (b.hp - g) * 0.04;
      this.bossGhost.set(b, ng < b.hp ? b.hp : ng);
      ctx.globalAlpha = b.dead ? 0.35 : 1;
      ctx.textAlign = 'left';
      ctx.font = `800 13px ${FONT}`;
      ctx.fillStyle = b.phase === 2 ? b.phase2Color : '#ffffff';
      ctx.fillText(b.title + (b.phase === 2 ? '  · II' : ''), x, y);
      bar(ctx, x, y + 12, bw, 14, b.hp / b.maxHp, ng / b.maxHp, b.phase === 2 ? b.phase2Color : '#ff4d6d', '#ffffff');
      // phase marker at 50%
      if (b.hpPhase && b.phase === 1) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + bw * 0.5 - 1, y + 10, 2, 18);
      }
      // posture
      const pk = b.maxPosture > 0 ? b.posture / b.maxPosture : 0;
      const stag = b.staggered > 0;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + bw * 0.15, y + 32, bw * 0.7, 6);
      ctx.fillStyle = stag ? (Math.floor(W.time * 10) % 2 ? '#ffffff' : '#ffe14d') : pk > 0.75 ? '#ff9a3c' : '#ffe14d';
      const pw = bw * 0.7 * (stag ? 1 : pk);
      ctx.fillRect(x + bw * 0.5 - pw / 2, y + 32, pw, 6);
      ctx.globalAlpha = 1;
    });
  }

  private drawCallouts(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.textAlign = 'center';
    let yy = h * 0.3;
    for (const c of this.callouts) {
      const t = 1 - c.life / c.max;
      const sc = t < 0.2 ? easeOutBack(t / 0.2) : 1 + (t - 0.2) * 0.1;
      const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, yy);
      ctx.scale(sc, sc);
      ctx.font = `900 italic ${c.size}px ${FONT}`;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(c.text, 0, -1);
      ctx.restore();
      yy += c.size * 1.1;
    }
  }

  private drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const b = this.banner;
    if (!b) return;
    const t = 1 - b.life / b.max;
    const inK = easeOutCubic(clamp(t / 0.15, 0, 1));
    const outK = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    const a = 1 - outK;
    const cy = h * (b.big ? 0.42 : 0.38);
    const bandH = b.big ? 150 : 110;
    ctx.save();
    ctx.globalAlpha = a;
    // band
    const grd = ctx.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.2, 'rgba(3,5,15,0.85)');
    grd.addColorStop(0.8, 'rgba(3,5,15,0.85)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, cy - (bandH / 2) * inK, w, bandH * inK);
    ctx.fillStyle = b.color;
    ctx.fillRect(w / 2 - (w * 0.35) * inK, cy - bandH / 2 * inK, w * 0.7 * inK, 2);
    ctx.fillRect(w / 2 - (w * 0.35) * inK, cy + bandH / 2 * inK - 2, w * 0.7 * inK, 2);
    // boss portrait slides in from the left; the title shifts right to make room
    let tx = w / 2;
    if (b.portrait && sprites.has(b.portrait)) {
      const ph = Math.min(h * 0.55, 420, w * 0.32);
      const px = w * 0.04 - (1 - inK) * 300;
      const pc = fadedPortrait(b.portrait);
      if (pc) {
        ctx.save();
        ctx.globalAlpha *= inK;
        ctx.drawImage(pc, px, cy - ph * 0.62, ph, ph * (pc.height / pc.width));
        ctx.restore();
      }
      tx = Math.min(w * 0.62, (px + ph + w) / 2 + 10);
    }
    // title slides in
    const slide = (1 - inK) * 200 + t * 30;
    ctx.textAlign = 'center';
    ctx.font = `900 ${b.big ? Math.round(clamp(w / (b.portrait && sprites.has(b.portrait) ? 18 : 14), 36, 84)) : Math.round(clamp(w / 22, 28, 56))}px ${FONT}`;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = b.color;
    ctx.fillText(b.title, tx + slide - 15, cy - (b.sub ? 14 : 0));
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = `500 ${Math.round(clamp(w / 75, 13, 18))}px ${THAI}`;
      ctx.fillStyle = '#d8def5';
      ctx.fillText(b.sub, tx - slide * 0.5 + 8, cy + (b.big ? 42 : 32));
    }
    ctx.restore();
  }
}

const fadedCache = new Map<string, HTMLCanvasElement>();
/** portrait art usually ends in a hard edge — fade the bottom so it melts into the banner */
function fadedPortrait(name: string) {
  let c = fadedCache.get(name);
  if (c) return c;
  const s = sprites.get(name);
  if (!s) return null;
  c = document.createElement('canvas');
  c.width = s.fw;
  c.height = s.fh;
  const g = c.getContext('2d')!;
  g.drawImage(s.img, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.62, 'rgba(0,0,0,1)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  fadedCache.set(name, c);
  return c;
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, ghost: number, col: string, ghostCol = 'rgba(255,255,255,0.7)') {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ghostCol;
  ctx.globalAlpha *= 0.6;
  ctx.fillRect(x, y, w * clamp(ghost, 0, 1), h);
  ctx.globalAlpha /= 0.6;
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * clamp(k, 0, 1), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w * clamp(k, 0, 1), Math.max(1, h * 0.3));
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const hud = new Hud();
void TAU;
