import './ui/style.css';
import { input } from './core/input';
import { Renderer } from './render/renderer';
import { cam } from './render/camera';
import { fx } from './render/fx';
import { audio } from './audio/audio';
import { hud } from './ui/hud';
import { menus } from './ui/menus';
import { run } from './game/run';
import { W } from './game/world';
import type { WeaponId } from './game/weapons';
import { sprites } from './render/sprites';
import { showGallery } from './ui/gallery';
import { setSnapshotCanvas } from './net/leaderboard';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
input.attach(canvas);
setSnapshotCanvas(canvas);
window.addEventListener('resize', () => renderer.resize());

menus.onSettings = (s) => {
  audio.setVolume(s.volume);
  audio.setMusicVolume(s.music);
  cam.shakeEnabled = s.shake;
  renderer.bloom = s.bloom;
  fx.quality = s.bloom ? 1 : 0.7;
};
menus.init();

// custom crosshair once sprites are decoded
sprites.ready.then(() => {
  const cur = sprites.get('ui_cursor');
  if (cur) canvas.style.cursor = `url(${cur.url}) ${Math.round(cur.fw / 2)} ${Math.round(cur.fh / 2)}, crosshair`;
});

// dev shortcut: ?stage=N&weapon=katana&hard=1 jumps straight into a stage
const qs = new URLSearchParams(location.search);
// wait for sprite art so menus can show the logo/icons on first paint
const ui = document.getElementById('ui')!;
ui.innerHTML = '<div id="loading">LOADING ART<span>…</span></div>';
ui.classList.add('show');
sprites.ready.then(() => {
  ui.classList.remove('show');
  if (qs.has('sprites')) {
    showGallery();
  } else if (qs.has('stage')) {
    run.toTitle();
    const m = qs.get('mode');
    const mode = m === 'endless' || m === 'act2' ? m : 'campaign';
    // campaign: stage 0–9 · act2: stage 10–19 · endless: stage N starts at round N+1 (practice, unranked)
    const max = mode === 'endless' ? 999 : mode === 'act2' ? 19 : 9;
    run.start((qs.get('weapon') as WeaponId) || 'katana', qs.get('hard') === '1', Math.max(0, Math.min(max, Number(qs.get('stage')) || 0)), mode);
  } else run.toTitle();
});

if (import.meta.env.DEV && qs.get('god') === '1') W.god = true;
const STEP = 1 / 60;
if (import.meta.env.DEV) {
  (window as any).__nd = {
    W, run, input, cam, hud, sprites,
    /** advance the simulation synchronously (for automated testing) */
    step(n: number) {
      for (let i = 0; i < n; i++) {
        run.tick(STEP);
        input.endFrame();
      }
    },
    /** render one frame at a fixed size and save it via the dev server (returns the file path) */
    async shot(name: string, w = 1280, h = 720) {
      const dw = Object.getOwnPropertyDescriptor(window, 'innerWidth'), dh = Object.getOwnPropertyDescriptor(window, 'innerHeight');
      Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
      const dpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
      renderer.resize();
      cam.update(0, cam.x, cam.y, 0, 0); // recompute zoom for the capture size
      renderer.render((ctx) => run.drawWorld(ctx), (ctx) => hud.draw(ctx, renderer.w, renderer.h, run.showHud && !!W.player), 1 / 60);
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      for (const [k, d] of [['innerWidth', dw], ['innerHeight', dh], ['devicePixelRatio', dpr]] as const) {
        if (d) Object.defineProperty(window, k, d);
        else delete (window as any)[k];
      }
      renderer.resize();
      return (await fetch('/__shot?name=' + encodeURIComponent(name), { method: 'POST', body: blob })).text();
    },
    render() {
      renderer.render((ctx) => run.drawWorld(ctx), (ctx) => hud.draw(ctx, renderer.w, renderer.h, run.showHud && !!W.player), 1 / 60);
    },
  };
}
let acc = 0;
let last = performance.now();
let fpsAcc = 0, fpsN = 0;

function frame(now: number) {
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += realDt;
  fpsAcc += realDt;
  fpsN++;
  if (fpsAcc > 0.5) {
    hud.fps = fpsN / fpsAcc;
    fpsAcc = 0;
    fpsN = 0;
  }
  let steps = 0;
  while (acc >= STEP && steps < 6) {
    run.tick(STEP);
    input.endFrame();
    acc -= STEP;
    steps++;
  }
  if (steps === 6) acc = 0;
  renderer.render(
    (ctx) => run.drawWorld(ctx),
    (ctx) => hud.draw(ctx, renderer.w, renderer.h, run.showHud && !!W.player),
    realDt,
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
