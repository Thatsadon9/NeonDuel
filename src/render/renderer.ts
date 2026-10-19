/** Scene rendering with a cheap multi-pass bloom, chromatic hit-ghosting, flashes, vignette and scanlines. */
import { TAU, rand } from '../core/math';
import { cam } from './camera';
import { audio } from '../audio/audio';
import { W } from '../game/world';
import { sprites } from './sprites';
import { run } from '../game/run';

const THEME_TINT: Record<string, string> = { blight: '#7dff4d', clock: '#ffd24d', storm: '#5ad8ff', shrine: '#ff5a1f', hollow: '#b9b0ff' };

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scene = document.createElement('canvas');
  sctx: CanvasRenderingContext2D;
  b1 = document.createElement('canvas');
  b1c: CanvasRenderingContext2D;
  b2 = document.createElement('canvas');
  b2c: CanvasRenderingContext2D;
  scan = document.createElement('canvas');
  dpr = 1;
  w = 0;
  h = 0;
  bloom = true;
  private hasFilter: boolean;
  private stars: { x: number; y: number; s: number; tw: number }[] = [];
  private scanPattern: CanvasPattern | null = null;
  arenaColor = '#7ff6ff';
  private voidPattern: CanvasPattern | null = null;
  private voidName = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.sctx = this.scene.getContext('2d')!;
    this.b1c = this.b1.getContext('2d')!;
    this.b2c = this.b2.getContext('2d')!;
    this.hasFilter = typeof (this.b1c as any).filter === 'string';
    for (let i = 0; i < 260; i++) {
      const a = rand(0, TAU), r = rand(620, 1700);
      this.stars.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, s: rand(0.6, 2.2), tw: rand(0, TAU) });
    }
    this.scan.width = 1;
    this.scan.height = 3;
    const sc = this.scan.getContext('2d')!;
    sc.fillStyle = 'rgba(0,0,0,0.5)';
    sc.fillRect(0, 2, 1, 1);
    this.scanPattern = this.ctx.createPattern(this.scan, 'repeat');
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const c of [this.canvas, this.scene]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.b1.width = Math.max(1, Math.round(this.w / 4));
    this.b1.height = Math.max(1, Math.round(this.h / 4));
    this.b2.width = Math.max(1, Math.round(this.w / 10));
    this.b2.height = Math.max(1, Math.round(this.h / 10));
    cam.resize(this.w, this.h);
  }

  drawArena(ctx: CanvasRenderingContext2D) {
    const R = W.arenaR;
    const beat = 1 - audio.beatPhase();
    const pulse = beat * beat;
    ctx.save();
    // arena theme (Act II): themed art when it exists, a tinted default arena otherwise
    const th = run.theme;
    const tint = th ? THEME_TINT[th] : '';
    const bgName = th && sprites.has('bg_' + th) ? 'bg_' + th : 'bg_void';
    const floorName = th && sprites.has(`arena_${th}_floor`) ? `arena_${th}_floor` : 'arena_floor';
    const edgeName = th && sprites.has(`arena_${th}_edge`) ? `arena_${th}_edge` : 'arena_edge';
    const themedFloor = floorName !== 'arena_floor';
    if (bgName !== this.voidName) {
      this.voidName = bgName;
      this.voidPattern = null;
    }
    const bg = sprites.get(bgName);
    if (bg) {
      this.voidPattern ??= ctx.createPattern(bg.img, 'repeat');
      if (this.voidPattern) {
        // slight parallax: the pattern scrolls slower than the world
        const m = new DOMMatrix().translateSelf(cam.x * 0.25, cam.y * 0.25).scaleSelf(1 / bg.ppu, 1 / bg.ppu);
        this.voidPattern.setTransform(m);
        ctx.fillStyle = this.voidPattern;
        ctx.globalAlpha = 0.5;
        const vw = cam.w / cam.zoom + 400, vh = cam.h / cam.zoom + 400;
        ctx.fillRect(cam.x - vw / 2, cam.y - vh / 2, vw, vh);
        ctx.globalAlpha = 1;
      }
    }
    const floorArt = sprites.has(floorName);
    for (const s of bg ? [] : this.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(W.time * 1.5 + s.tw));
      ctx.fillStyle = `rgba(160,190,255,${0.5 * tw})`;
      const px = s.x + cam.x * 0.25, py = s.y + cam.y * 0.25;
      ctx.fillRect(px, py, s.s, s.s);
    }
    // floor
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, '#0b1030');
    g.addColorStop(0.7, '#080b22');
    g.addColorStop(1, '#0a0820');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    ctx.clip();
    if (floorArt) {
      // keep the floor dim so ink characters stay readable
      sprites.draw(ctx, floorName, 0, 0, { w: 1120, alpha: 0.55 });
    }
    if (tint && !themedFloor) {
      // no themed floor yet: wash the default floor in the theme colour
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // grid (fainter over real floor art)
    const step = 80;
    ctx.strokeStyle = `rgba(90,130,255,${(0.07 + pulse * 0.06) * (floorArt ? 0.35 : 1)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -R; x <= R; x += step) {
      ctx.moveTo(x, -R);
      ctx.lineTo(x, R);
    }
    for (let y = -R; y <= R; y += step) {
      ctx.moveTo(-R, y);
      ctx.lineTo(R, y);
    }
    ctx.stroke();
    // concentric rings + pulse wave
    ctx.strokeStyle = 'rgba(127,246,255,0.06)';
    ctx.lineWidth = 2;
    for (let r = 120; r < R && !floorArt; r += 140) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    const wave = (1 - beat) * R;
    ctx.strokeStyle = `rgba(127,246,255,${0.08 * beat})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, wave, 0, TAU);
    ctx.stroke();
    // center sigil
    if (floorArt) ctx.globalAlpha = 0;
    ctx.strokeStyle = 'rgba(185,140,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU + W.time * 0.05;
      ctx.lineTo(Math.cos(a) * 90, Math.sin(a) * 90);
    }
    ctx.stroke();
    ctx.restore();

    // edge
    const edge = sprites.get(edgeName);
    // the wall's inner face sits exactly on the arena boundary
    if (edge && sprites.draw(ctx, edgeName, 0, 0, { w: (R * 2) / (edge.meta.inner ?? 0.95), alpha: 0.72, tint: W.arenaTargetR < 560 ? '#ff9ae6' : edgeName === 'arena_edge' && tint ? tint : undefined })) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shrinking = W.arenaTargetR < 560;
    const ec = shrinking ? '#ff4dcf' : this.arenaColor;
    ctx.strokeStyle = ec;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 14;
    ctx.globalAlpha = 0.12 + pulse * 0.1;
    ctx.stroke();
    // rune ticks
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU + W.time * 0.03;
      const l = i % 6 === 0 ? 18 : 8;
      ctx.moveTo(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8));
      ctx.lineTo(Math.cos(a) * (R + 8 + l), Math.sin(a) * (R + 8 + l));
    }
    ctx.stroke();
    ctx.restore();
  }

  /** draw world into the scene canvas, then composite + post fx to screen; hud drawn last in screen space */
  render(drawWorld: (ctx: CanvasRenderingContext2D) => void, drawScreen: (ctx: CanvasRenderingContext2D) => void, realDt: number) {
    const { sctx, ctx, dpr, w, h } = this;
    const sw = this.scene.width, sh = this.scene.height;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.fillStyle = '#04050d';
    sctx.fillRect(0, 0, sw, sh);
    cam.apply(sctx, dpr);
    this.drawArena(sctx);
    drawWorld(sctx);

    // composite
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.scene, 0, 0);
    if (this.bloom) {
      const b1c = this.b1c, b2c = this.b2c;
      b1c.globalCompositeOperation = 'source-over';
      b1c.clearRect(0, 0, this.b1.width, this.b1.height);
      if (this.hasFilter) (b1c as any).filter = 'brightness(0.9) contrast(1.6) blur(3px)';
      b1c.drawImage(this.scene, 0, 0, this.b1.width, this.b1.height);
      if (this.hasFilter) (b1c as any).filter = 'none';
      b2c.clearRect(0, 0, this.b2.width, this.b2.height);
      if (this.hasFilter) (b2c as any).filter = 'blur(4px)';
      b2c.drawImage(this.b1, 0, 0, this.b2.width, this.b2.height);
      if (this.hasFilter) (b2c as any).filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.65;
      ctx.drawImage(this.b1, 0, 0, sw, sh);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.b2, 0, 0, sw, sh);
    }
    // chromatic ghosting on hurt
    if (W.aberration > 0.02) {
      const k = W.aberration * 9 * dpr;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 * W.aberration;
      ctx.drawImage(this.scene, k, 0);
      ctx.drawImage(this.scene, -k, k * 0.3);
      W.aberration = Math.max(0, W.aberration - realDt * 3);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // overdrive tint
    if (W.tint > 0) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = 'rgba(0,200,255,0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // slow-mo desaturating edge
    const slow = W.slowTime > 0 ? 1 - W.slowScale : 0;
    // vignette
    const p = W.player;
    const low = p && !p.dead && p.hp / p.maxHp < 0.3 ? 0.35 + Math.sin(W.time * 6) * 0.15 : 0;
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, low > 0 ? `rgba(120,0,20,${0.55 + low})` : `rgba(0,0,0,${0.55 + slow * 0.3})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    // flash
    if (W.flashA > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = W.flashA;
      ctx.fillStyle = W.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      W.flashA = Math.max(0, W.flashA - realDt * 3.5);
    }
    // scanlines
    if (this.scanPattern) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = this.scanPattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    drawScreen(ctx);
  }
}
