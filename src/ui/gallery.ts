/** ?sprites=1 — asset checklist: every sprite slot, whether its PNG was found, and a live animated preview. */
import { sprites, SLOTS, type SlotDef } from '../render/sprites';

const PRIO = ['P0 จำเป็น', 'P1 สมบูรณ์', 'P2 ขัดเกลา'];

export async function showGallery() {
  await sprites.ready;
  const root = document.getElementById('ui') as HTMLDivElement;
  root.classList.add('show', 'gallery-mode');
  const groups = new Map<string, SlotDef[]>();
  for (const s of SLOTS) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  const counts = [0, 1, 2].map((p) => {
    const all = SLOTS.filter((s) => s.prio === p);
    return `${PRIO[p]}: <b>${all.filter((s) => sprites.has(s.name)).length}/${all.length}</b>`;
  });
  const extras = [...new Set(SLOTS.map((s) => s.name))].length;
  root.innerHTML = `
    <div class="gallery">
      <div class="g-head">
        <div>
          <div class="up-title">ASSET CHECK</div>
          <div class="up-sub">วาง PNG ใน <code>src/assets/sprites/</code> ตั้งชื่อตามช่องด้านล่าง แล้วหน้านี้จะรีโหลดเอง · ${counts.join(' · ')} · รวม ${sprites.count} ไฟล์จาก ${extras} ช่อง</div>
        </div>
        <button id="g-back">BACK TO GAME</button>
      </div>
      ${sprites.unknown.length ? `<div class="g-warn">⚠ ไฟล์ที่ชื่อไม่ตรงช่องใดเลย (พิมพ์ผิด?): ${sprites.unknown.map((n) => `<code>${n}.png</code>`).join(' ')}</div>` : ''}
      <div class="g-note">ตัวเลือกเพิ่มเติม: <code>&lt;ชื่อ&gt;_glow.png</code> = เลเยอร์เรืองแสง (วาดบวกแสงทับ) ·
        <code>&lt;ชื่อ&gt;_p2.png</code> = เวอร์ชันบอสเฟส 2 · <code>boss_&lt;id&gt;_&lt;ท่า&gt;_windup.png</code> / <code>boss_&lt;id&gt;_&lt;ท่า&gt;.png</code> = ท่าเฉพาะของบอส ·
        <code>icon_upgrade_&lt;id&gt;.png</code> = ไอคอนการ์ดอัปเกรด</div>
      ${[...groups].map(([g, list]) => `
        <div class="g-group">${g}</div>
        <div class="g-grid">
          ${list.map((s) => {
            const sp = sprites.get(s.name);
            const meta = sp ? `${sp.frames} เฟรม · ${Math.round(sp.fw)}×${sp.fh}px · ${sp.fps}fps${sp.glow ? ' · +glow' : ''}` : `แนะนำ ${s.size}${s.frames ? ` · ${s.frames} เฟรม` : ''}`;
            return `<div class="g-item ${sp ? 'ok' : 'miss'} p${s.prio}">
              <canvas width="112" height="112" data-name="${sp ? s.name : ''}"></canvas>
              <div class="g-info">
                <div class="g-name"><span>${sp ? '✓' : '·'}</span> ${s.name}.png</div>
                <div class="g-desc">${s.desc}</div>
                <div class="g-meta">${meta} · P${s.prio}</div>
              </div>
            </div>`;
          }).join('')}
        </div>`).join('')}
    </div>`;
  root.querySelector('#g-back')!.addEventListener('click', () => (location.search = ''));
  root.querySelectorAll<HTMLElement>('.g-name').forEach((el) =>
    el.addEventListener('click', () => navigator.clipboard?.writeText(el.innerText.replace(/^[✓·]\s*/, '').trim())));

  const canvases = [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-name]')].filter((c) => c.dataset.name);
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    for (const c of canvases) {
      const sp = sprites.get(c.dataset.name!)!;
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      const fr = sprites.frameOf(sp, t, true);
      const k = Math.min((c.width - 8) / sp.fw, (c.height - 8) / sp.fh);
      const w = sp.fw * k, h = sp.fh * k;
      const x = (c.width - w) / 2, y = (c.height - h) / 2;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(sp.img, fr * sp.fw, 0, sp.fw, sp.fh, x, y, w, h);
      if (sp.glow) {
        g.globalCompositeOperation = 'lighter';
        g.drawImage(sp.glow.img, Math.min(fr, sp.glow.frames - 1) * sp.glow.fw, 0, sp.glow.fw, sp.glow.fh, x, y, w, h);
      }
      // pivot marker
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ff4d8a';
      g.fillRect(x + sp.pivot[0] * w - 2, y + sp.pivot[1] * h - 2, 4, 4);
    }
    requestAnimationFrame(loop);
  };
  if (canvases.length) requestAnimationFrame(loop);
}
