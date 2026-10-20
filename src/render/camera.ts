import { damp, clamp } from '../core/math';

/** Follow camera with mouse lead, trauma-based shake, zoom punch and cinematic focus override. */
class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  baseZoom = 1;
  zoomMul = 1; // cinematic zoom target multiplier
  private zoomMulCur = 1;
  punch = 0; // additive zoom impulse
  trauma = 0;
  shakeEnabled = true;
  ox = 0;
  oy = 0;
  rot = 0;
  w = 1280;
  h = 720;
  focus: { x: number; y: number } | null = null;
  private t = 0;
  /** spring velocity (critically damped follow: no overshoot, no lag-jerk) */
  private vx = 0;
  private vy = 0;

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.baseZoom = Math.min(w / 1450, h / 920);
    // phones: show less of the arena so fighters stay readable
    if (Math.min(w, h) < 600) this.baseZoom = Math.min(w / 1000, h / 620);
  }

  /** jump straight to a point (stage start) */
  snap(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
  }

  addTrauma(v: number) {
    this.trauma = clamp(this.trauma + v, 0, 1);
  }

  update(realDt: number, tx: number, ty: number, leadX: number, leadY: number) {
    this.t += realDt;
    let gx = tx, gy = ty;
    if (this.focus) {
      gx = this.focus.x;
      gy = this.focus.y;
    } else {
      gx += clamp(leadX, -170, 170);
      gy += clamp(leadY, -120, 120);
    }
    const om = this.focus ? 5 : 10;
    const dt = Math.min(realDt, 1 / 30);
    this.vx += (om * om * (gx - this.x) - 2 * om * this.vx) * dt;
    this.vy += (om * om * (gy - this.y) - 2 * om * this.vy) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.zoomMulCur += (this.zoomMul - this.zoomMulCur) * damp(4, realDt);
    this.punch *= Math.exp(-8 * realDt);
    this.zoom = this.baseZoom * this.zoomMulCur * (1 + this.punch);
    this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    const s = this.shakeEnabled ? this.trauma * this.trauma : 0;
    const t = this.t * 38;
    this.ox = s * 26 * (Math.sin(t * 1.1) + Math.sin(t * 2.7 + 1.3) * 0.5);
    this.oy = s * 26 * (Math.cos(t * 1.3 + 0.7) + Math.sin(t * 3.1 + 2.1) * 0.5);
    this.rot = s * 0.035 * Math.sin(t * 0.9 + 4);
  }

  apply(ctx: CanvasRenderingContext2D, dpr: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(this.w / 2, this.h / 2);
    ctx.rotate(this.rot);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.ox / this.zoom, -this.y + this.oy / this.zoom);
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.w / 2) / this.zoom + this.x,
      y: (sy - this.h / 2) / this.zoom + this.y,
    };
  }
  worldToScreen(wx: number, wy: number) {
    return { x: (wx - this.x) * this.zoom + this.w / 2, y: (wy - this.y) * this.zoom + this.h / 2 };
  }
}

export const cam = new Camera();
