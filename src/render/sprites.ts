/**
 * Sprite system. Drop PNGs into src/assets/sprites/ named after a slot below — they are picked up
 * automatically (no manifest needed). Anything missing falls back to the procedural neon art.
 *
 * Conventions:
 *  - horizontal strip, all frames the same size; frame count defaults to width / height (square frames)
 *  - drawn facing RIGHT (0°), pivot = frame centre unless the slot says otherwise
 *  - 2 px per world unit
 *  - optional "<name>_glow.png" with the same layout is drawn additively on top (Ink & Neon emissive layer)
 *  - optional per-file overrides in src/assets/sprites/sprites.json: { "player_run": { "frames": 6, "fps": 14 } }
 */
import overridesRaw from '../assets/sprites/sprites.json';
import autoRaw from '../assets/sprites/sprites.auto.json';

export interface SlotDef {
  name: string;
  group: string;
  desc: string;
  size: string; // recommended frame size in px
  frames?: number; // recommended frame count (hint for the artist)
  fps?: number;
  loop?: boolean;
  pivot?: [number, number]; // normalised 0..1 within a frame
  ppu?: number; // pixels per world unit
  prio: 0 | 1 | 2;
}

export interface SpriteOverride { frames?: number; fps?: number; loop?: boolean; pivot?: [number, number]; ppu?: number; inner?: number }

const anim = (base: string, group: string, desc: string, size: string, prio: 0 | 1 | 2, states: [string, number, boolean?][]): SlotDef[] =>
  states.map(([s, frames, loop = true]) => ({
    name: `${base}_${s}`, group, desc: `${desc} — ${s}`, size, frames, loop,
    // only idle is truly required (missing states fall back to it); the player also needs move + attack
    prio: s === 'idle' || (base === 'player' && (s === 'move' || s === 'attack')) ? prio : (Math.max(prio, 1) as 1 | 2),
  }));

const BODY: [string, number, boolean?][] = [['idle', 4], ['move', 6], ['windup', 2, false], ['attack', 3, false], ['hurt', 2, false], ['death', 6, false]];
const BOSS_BODY: [string, number, boolean?][] = [['idle', 4], ['move', 6], ['windup', 2, false], ['attack', 3, false], ['stagger', 4], ['death', 8, false]];

/** every sprite the game knows how to use */
export const SLOTS: SlotDef[] = [
  // player
  ...anim('player', 'Player', 'ผู้เล่น', '96×96', 0, [['idle', 4], ['move', 6], ['attack', 3, false], ['dash', 2, false], ['guard', 2], ['charge', 4], ['hurt', 2, false], ['death', 6, false]]),
  // weapons — pivot at the grip on the left
  { name: 'weapon_katana', group: 'Weapons', desc: 'คาทานะ ชี้ขวา จุดหมุนที่ด้ามซ้ายสุด', size: '140×24', pivot: [0.04, 0.5], prio: 0 },
  { name: 'weapon_daggers', group: 'Weapons', desc: 'มีดคู่ 2 เล่มในภาพเดียว ชี้ขวา จุดหมุนซ้าย', size: '72×56', pivot: [0.05, 0.5], prio: 0 },
  { name: 'weapon_hammer', group: 'Weapons', desc: 'ค้อน ชี้ขวา (หัวค้อนอยู่ปลายขวา) จุดหมุนซ้าย', size: '120×64', pivot: [0.04, 0.5], prio: 0 },
  // minions
  ...anim('enemy_rusher', 'Enemies', 'Rusher r15', '80×80', 0, BODY),
  ...anim('enemy_gunner', 'Enemies', 'Gunner r14', '80×80', 0, BODY),
  ...anim('enemy_bulwark', 'Enemies', 'Bulwark r20', '110×110', 0, BODY),
  { name: 'enemy_bulwark_shield', group: 'Enemies', desc: 'โล่ Bulwark (ชิ้นแยก หันขวา จุดหมุน = กลางตัว)', size: '110×110', prio: 0 },
  ...anim('enemy_bomber', 'Enemies', 'Bomber r13', '72×72', 0, BODY),
  // bosses
  ...anim('boss_vanguard', 'Boss: Vanguard', 'Vanguard r30', '160×160', 0, BOSS_BODY),
  { name: 'boss_vanguard_shield', group: 'Boss: Vanguard', desc: 'โล่ (ชิ้นแยก จุดหมุน = กลางตัวบอส)', size: '160×160', prio: 0 },
  ...anim('boss_hex', 'Boss: Hex Weaver', 'Hex Weaver r26', '140×140', 0, BOSS_BODY),
  { name: 'boss_hex_ring', group: 'Boss: Hex Weaver', desc: 'วงเวทหมุนรอบตัว (โค้ดหมุนให้)', size: '220×220', prio: 1 },
  ...anim('boss_kael', 'Boss: Twin Fangs', 'Kael r22', '120×120', 0, BOSS_BODY),
  ...anim('boss_vex', 'Boss: Twin Fangs', 'Vex r20', '110×110', 0, BOSS_BODY),
  ...anim('boss_colossus', 'Boss: Colossus', 'Iron Colossus r54 (ไม่รวมแขน)', '256×256', 0, BOSS_BODY),
  { name: 'boss_colossus_arm', group: 'Boss: Colossus', desc: 'แขน 1 ข้าง (ใช้ซ้ำทั้งสองข้าง)', size: '96×96', prio: 0 },
  { name: 'boss_colossus_core', group: 'Boss: Colossus', desc: 'แกนกลางตอนเปิด (เรืองแสง)', size: '96×96', prio: 0 },
  ...anim('boss_mirror', 'Boss: Mirror', 'Mirror Sovereign r18', '110×110', 0, BOSS_BODY),
  // projectiles — white/grey art is tinted by the game
  { name: 'proj_orb', group: 'Projectiles', desc: 'ลูกแก้ว (ขาว → โค้ดย้อมสี)', size: '32×32', prio: 0 },
  { name: 'proj_orb_parry', group: 'Projectiles', desc: 'ลูกแก้วที่ Parry ได้ (มีสีทองในตัว)', size: '40×40', prio: 0 },
  { name: 'proj_knife', group: 'Projectiles', desc: 'มีดบิน ชี้ขวา (ขาว → ย้อมสี)', size: '48×16', prio: 0 },
  { name: 'proj_missile', group: 'Projectiles', desc: 'มิสไซล์ ชี้ขวา', size: '40×20', prio: 0 },
  { name: 'proj_mine', group: 'Projectiles', desc: 'ทุ่นระเบิด ยังไม่พร้อม', size: '32×32', prio: 1 },
  { name: 'proj_mine_armed', group: 'Projectiles', desc: 'ทุ่นระเบิด พร้อมระเบิด', size: '32×32', prio: 1 },
  { name: 'proj_wave', group: 'Projectiles', desc: 'คลื่นพระจันทร์เสี้ยว ชี้ขวา (ขาว → ย้อมสี)', size: '120×120', prio: 1 },
  // environment
  { name: 'arena_floor', group: 'Arena', desc: 'พื้นสนามวงกลม (ขยายให้พอดีสนามอัตโนมัติ)', size: '2048×2048', ppu: 2048 / 1120, prio: 0 },
  { name: 'arena_edge', group: 'Arena', desc: 'ขอบสนาม วงแหวนโปร่งตรงกลาง (ภาพเท่าพื้น + ขอบเผื่อ 5%)', size: '2048×2048', prio: 0 },
  { name: 'bg_void', group: 'Arena', desc: 'พื้นหลังนอกสนาม แบบต่อกันได้ (tile)', size: '512×512', prio: 0 },
  { name: 'pillar', group: 'Arena', desc: 'เสาหิน r36', size: '160×160', prio: 0 },
  { name: 'pillar_cracked', group: 'Arena', desc: 'เสาหินร้าว (HP < 50%)', size: '160×160', prio: 1 },
  // vfx — draw in white/grey, the game tints them
  { name: 'vfx_slash', group: 'VFX', desc: 'รอยฟันโค้ง กวาดจากบนลงล่างด้านขวาของจุดกลาง', size: '256×256', frames: 6, fps: 30, loop: false, prio: 0 },
  { name: 'vfx_slash_spin', group: 'VFX', desc: 'รอยฟันหมุนรอบตัว 360°', size: '256×256', frames: 6, fps: 26, loop: false, prio: 0 },
  { name: 'vfx_thrust', group: 'VFX', desc: 'รอยแทง ยิงไปทางขวา จุดหมุนซ้าย', size: '256×64', frames: 5, fps: 30, loop: false, pivot: [0, 0.5], prio: 0 },
  { name: 'vfx_hit', group: 'VFX', desc: 'ประกายตอนโดนตี', size: '128×128', frames: 5, fps: 30, loop: false, prio: 0 },
  { name: 'vfx_hit_crit', group: 'VFX', desc: 'ประกายคริติคอล', size: '160×160', frames: 6, fps: 30, loop: false, prio: 0 },
  { name: 'vfx_parry', group: 'VFX', desc: 'แฟลช Parry (เด่นที่สุด)', size: '256×256', frames: 8, fps: 30, loop: false, prio: 0 },
  { name: 'vfx_block', group: 'VFX', desc: 'ประกายตอน Block', size: '96×96', frames: 4, fps: 30, loop: false, prio: 1 },
  { name: 'vfx_explosion', group: 'VFX', desc: 'ระเบิด', size: '256×256', frames: 8, fps: 24, loop: false, prio: 0 },
  { name: 'vfx_shockwave', group: 'VFX', desc: 'คลื่นกระแทกบนพื้น', size: '256×256', frames: 6, fps: 24, loop: false, prio: 0 },
  { name: 'vfx_portal', group: 'VFX', desc: 'ประตูเกิดศัตรู', size: '128×128', frames: 8, fps: 20, loop: false, prio: 1 },
  { name: 'vfx_execute', group: 'VFX', desc: 'ท่าประหาร', size: '320×320', frames: 8, fps: 24, loop: false, prio: 1 },
  { name: 'vfx_storm_blade', group: 'VFX', desc: 'ใบดาบ Blade Storm 1 ชิ้น (แนวตั้ง)', size: '32×64', prio: 1 },
  { name: 'vfx_vortex', group: 'VFX', desc: 'Gravity Well น้ำวน (loop, โค้ดหมุนเพิ่ม)', size: '256×256', frames: 8, fps: 16, prio: 1 },
  // ui
  { name: 'ui_logo', group: 'UI', desc: 'โลโก้เกม (โปร่งใส)', size: '1200×300', prio: 1 },
  { name: 'ui_cursor', group: 'UI', desc: 'เป้าเล็ง (จุดกลางภาพ = จุดคลิก)', size: '32×32', prio: 1 },
  ...['phantom', 'storm', 'fan', 'mark', 'leap', 'well', 'overdrive'].map((s): SlotDef => ({ name: `icon_skill_${s}`, group: 'UI', desc: `ไอคอนสกิล ${s}`, size: '64×64', prio: 1 })),
  ...['katana', 'daggers', 'hammer'].map((s): SlotDef => ({ name: `icon_weapon_${s}`, group: 'UI', desc: `ไอคอนอาวุธ ${s}`, size: '64×64', prio: 1 })),
  ...['katana', 'daggers', 'hammer'].map((s): SlotDef => ({ name: `art_weapon_${s}`, group: 'UI', desc: `ภาพประกอบหน้าเลือกอาวุธ ${s}`, size: '560×280', prio: 2 })),
  ...['vanguard', 'hex', 'twins', 'colossus', 'mirror'].map((s): SlotDef => ({ name: `portrait_${s}`, group: 'UI', desc: `ภาพบอสตอนเปิดตัว ${s}`, size: '640×640', prio: 1 })),
  ...['common', 'rare', 'epic', 'legendary'].map((s): SlotDef => ({ name: `ui_card_${s}`, group: 'UI', desc: `กรอบการ์ดอัปเกรด ${s}`, size: '260×340', prio: 1 })),
];
export const SLOT_MAP = new Map(SLOTS.map((s) => [s.name, s]));

/** upgrade icons are optional: icon_upgrade_<id> (64×64), not listed individually */
const STATE_RE = /_(idle|move|windup|attack|hurt|death|stagger|dash|guard|charge)$/;
const ANIM_BASES = new Set(SLOTS.filter((s) => STATE_RE.test(s.name)).map((s) => s.name.replace(STATE_RE, '')));
/** slot names, plus optional variants: <base>_<move>_windup / <base>_<move> / any name + "_p2" (boss phase 2) */
export function isKnownName(name: string) {
  const n = name.replace(/_p2$/, '');
  if (SLOT_MAP.has(n) || n.startsWith('icon_upgrade_')) return true;
  for (const b of ANIM_BASES) if (n.startsWith(b + '_') && b.startsWith('boss_')) return true;
  return false;
}

export interface Sprite {
  name: string;
  img: HTMLImageElement;
  url: string;
  frames: number;
  fw: number;
  fh: number;
  fps: number;
  loop: boolean;
  pivot: [number, number];
  ppu: number;
  glow: Sprite | null;
  meta: SpriteOverride;
}

export interface DrawOpts {
  angle?: number;
  t?: number; // seconds since the animation started
  loop?: boolean;
  scale?: number;
  w?: number; // target width in world units (overrides ppu scale)
  alpha?: number;
  tint?: string; // multiply-tint (for white art)
  flash?: number; // 0..1 white silhouette overlay (hit flash)
  additive?: boolean;
  flipY?: boolean;
  sx?: number; // extra scale along the sprite's facing (procedural animation)
  sy?: number; // extra scale across it
  glow?: boolean; // draw the _glow layer (default true)
  outline?: string; // neon rim around the silhouette (readability on dark floors)
  outlineAlpha?: number;
}

// sprites.auto.json is written by tools/import-assets.mjs; sprites.json (hand-edited) wins over it
/** weapons are held by the grip on their left end; gauntlets/bows sit around their middle-left */
function defaultPivot(name: string): [number, number] {
  if (/^weapon_(gauntlets)/.test(name)) return [0.3, 0.5];
  if (/^weapon_(bow)/.test(name)) return [0.25, 0.5];
  if (/^weapon_/.test(name)) return [0.05, 0.5];
  if (/^boss_tempus_hand/.test(name)) return [0.03, 0.5];
  return [0.5, 0.5];
}

/** loaded before the menu appears */
const CORE_RE = /^(player_|weapon_|ui_(logo|cursor|card_)|icon_skill_(phantom|storm|fan|mark|leap|well|overdrive)|icon_weapon_|icon_tier_|icon_rift|icon_resonance|arena_floor|arena_edge|bg_void|pillar|enemy_(rusher|gunner|bulwark|bomber)_|vfx_(slash|thrust|hit|parry|explosion|shockwave|portal|block|ascend|resonance)|proj_(orb|knife|wave|missile|mine)|pickup_|portrait_(vanguard))/;
/** background streaming order: act I content first, act II / endless extras later */
function priority(n: string) {
  if (/^(boss_(vanguard|hex|kael|vex|colossus|mirror)|portrait_|art_weapon|icon_upgrade)/.test(n)) return 0;
  if (/^(enemy_|vfx_|proj_|icon_|art_path)/.test(n)) return 1;
  return 2;
}
import updateRaw from '../assets/update_names.json';
export const UPDATE_SLOTS = updateRaw as { name: string; group: string; prio: number; size: string; note: string }[];
const UPDATE_NAMES = new Set(UPDATE_SLOTS.map((i) => i.name));
/** names from the ASCENSION update table (docs/update_asset_prompts.json) */
export function isUpdateName(n: string) {
  return UPDATE_NAMES.has(n.replace(/_p2$/, ''));
}

const overrides = { ...(autoRaw as unknown as Record<string, SpriteOverride>), ...(overridesRaw as Record<string, SpriteOverride | string>) };
const files = import.meta.glob('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

class Sprites {
  private map = new Map<string, Sprite>();
  private tintCache = new Map<string, HTMLCanvasElement>();
  private urls = new Map<string, string>();
  private loading = new Map<string, Promise<void>>();
  /** resolves when the core set (menus, player, weapons, UI, common VFX) is decoded */
  ready: Promise<void>;
  /** resolves when every sprite has been decoded (background streaming) */
  all: Promise<void>;
  /** names of PNGs found that match no slot (likely typos) */
  unknown: string[] = [];
  loaded = 0;
  total = 0;

  constructor() {
    for (const [path, url] of Object.entries(files)) this.urls.set(path.split('/').pop()!.replace(/\.png$/i, ''), url);
    this.total = this.urls.size;
    for (const name of this.urls.keys()) {
      const base = name.replace(/_glow$/, '');
      if (!isKnownName(base) && !isUpdateName(base)) this.unknown.push(name);
    }
    if (this.unknown.length) console.warn('[sprites] files that match no slot:', this.unknown.join(', '));
    // core first (fast menu), everything else streams in the background, most-needed first
    const names = [...this.urls.keys()];
    const core = names.filter((n) => CORE_RE.test(n));
    this.ready = this.loadMany(core).then(() => console.info(`[sprites] core ready: ${core.length} sprites`));
    this.all = this.ready.then(() => this.loadMany(names.sort((a, b) => priority(a) - priority(b)), 6))
      .then(() => console.info(`[sprites] all loaded: ${this.map.size} sprites`));
  }

  /** decode one sprite (and its _glow layer) if not already loaded */
  load(name: string): Promise<void> {
    if (this.map.has(name) || !this.urls.has(name) || name.endsWith('_glow')) return Promise.resolve();
    let p = this.loading.get(name);
    if (p) return p;
    const decode = (n: string) => {
      // onload (not img.decode(), which can stall forever in hidden / background tabs)
      return new Promise<HTMLImageElement | null>((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => {
          console.warn('[sprites] failed to load', n);
          res(null);
        };
        img.src = this.urls.get(n)!;
      });
    };
    p = decode(name).then(async (img) => {
      if (!img || !img.naturalWidth) return;
      const spr = this.make(name, img, this.urls.get(name)!);
      if (this.urls.has(name + '_glow')) {
        const g = await decode(name + '_glow');
        if (g && g.naturalWidth) spr.glow = this.make(name + '_glow', g, this.urls.get(name + '_glow')!, spr);
      }
      this.map.set(name, spr);
      this.loaded++;
    });
    this.loading.set(name, p);
    return p;
  }
  /** load a list with limited concurrency */
  async loadMany(names: string[], concurrency = 8) {
    const queue = names.filter((n) => !n.endsWith('_glow'));
    let i = 0;
    const worker = async () => {
      while (i < queue.length) await this.load(queue[i++]);
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
  /** make sure every sprite whose name starts with one of the prefixes is loaded (e.g. before a boss intro) */
  ensure(...prefixes: string[]) {
    return this.loadMany([...this.urls.keys()].filter((n) => prefixes.some((p) => n.startsWith(p))), 8);
  }
  hasFile(name: string) {
    return this.urls.has(name);
  }

  private make(name: string, img: HTMLImageElement, url: string, like?: Sprite): Sprite {
    const slot = SLOT_MAP.get(name) ?? SLOT_MAP.get(name.replace(/_glow$/, ''));
    const o = overrides[name] ?? overrides[name.replace(/_glow$/, '')];
    const ov: SpriteOverride = typeof o === 'object' ? o : {};
    // strips: only animation slots are split into frames (width ÷ height must be a whole number); everything else is 1 frame
    const animated = !!slot && (slot.frames !== undefined || STATE_RE.test(name.replace(/_(glow|p2)$/, '').replace(/_p2$/, '')));
    const ratio = img.naturalWidth / img.naturalHeight;
    const auto = animated && Math.abs(ratio - Math.round(ratio)) < 0.02 ? Math.max(1, Math.round(ratio)) : 1;
    const frames = like?.frames ?? ov.frames ?? auto;
    return {
      name, img, url, frames,
      fw: img.naturalWidth / frames,
      fh: img.naturalHeight,
      fps: like?.fps ?? ov.fps ?? slot?.fps ?? 12,
      loop: like?.loop ?? ov.loop ?? slot?.loop ?? true,
      pivot: like?.pivot ?? ov.pivot ?? slot?.pivot ?? defaultPivot(name),
      ppu: like?.ppu ?? ov.ppu ?? slot?.ppu ?? 2,
      glow: null,
      meta: ov,
    };
  }

  has(name: string) {
    return this.map.has(name);
  }
  get(name: string) {
    return this.map.get(name) ?? null;
  }
  /** first existing name from a candidate list */
  first(...names: string[]) {
    for (const n of names) if (this.map.has(n)) return n;
    return null;
  }
  url(name: string) {
    return this.map.get(name)?.url ?? null;
  }
  /** seconds a non-looping animation lasts */
  duration(name: string) {
    const s = this.map.get(name);
    if (!s) return 0;
    // a single still image still needs time on screen (the game fades/scales it)
    return s.frames > 1 ? s.frames / s.fps : 0.28;
  }
  get count() {
    return this.map.size;
  }

  private tinted(s: Sprite, color: string, mode: 'mul' | 'fill') {
    const key = s.name + '|' + color + '|' + mode;
    let c = this.tintCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = s.img.naturalWidth;
    c.height = s.img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(s.img, 0, 0);
    g.globalCompositeOperation = mode === 'mul' ? 'multiply' : 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    if (mode === 'mul') {
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(s.img, 0, 0);
    }
    this.tintCache.set(key, c);
    return c;
  }

  /** silhouette grown by a few px, filled with a colour — cached per sprite+colour, same frame layout (+ padding) */
  private outlineSheet(s: Sprite, color: string) {
    const key = s.name + '|ol|' + color;
    let c = this.tintCache.get(key);
    if (c) return c;
    const pad = Math.max(2, Math.round(Math.max(s.fw, s.fh) * 0.022));
    const fw = s.fw + pad * 2, fh = s.fh + pad * 2;
    c = document.createElement('canvas');
    c.width = fw * s.frames;
    c.height = fh;
    const g = c.getContext('2d')!;
    const sil = this.tinted(s, color, 'fill');
    for (let f = 0; f < s.frames; f++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.drawImage(sil, f * s.fw, 0, s.fw, s.fh, f * fw + pad + Math.cos(a) * pad, pad + Math.sin(a) * pad, s.fw, s.fh);
      }
    }
    // hollow it out so only the rim remains (the body is drawn on top anyway, this keeps additive blending clean)
    g.globalCompositeOperation = 'destination-out';
    for (let f = 0; f < s.frames; f++) g.drawImage(s.img, f * s.fw, 0, s.fw, s.fh, f * fw + pad, pad, s.fw, s.fh);
    (c as any).pad = pad;
    this.tintCache.set(key, c);
    return c;
  }

  frameOf(s: Sprite, t: number, loop = s.loop) {
    const f = Math.floor(t * s.fps);
    return loop ? ((f % s.frames) + s.frames) % s.frames : Math.min(s.frames - 1, Math.max(0, f));
  }

  /** draw a sprite in world space; returns false if it doesn't exist (caller should fall back) */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): boolean {
    // online host: recording a draw list for clients
    const rec = (ctx as unknown as { __rec?: (n: string, x: number, y: number, o: DrawOpts) => void }).__rec;
    if (rec) {
      rec(name, x, y, o);
      return this.map.has(name);
    }
    const s = this.map.get(name);
    if (!s) return false;
    const fr = this.frameOf(s, o.t ?? 0, o.loop ?? s.loop);
    const k = o.w !== undefined ? o.w / s.fw : (1 / s.ppu) * (o.scale ?? 1);
    const dw = s.fw * k, dh = s.fh * k;
    ctx.save();
    ctx.translate(x, y);
    if (o.angle) ctx.rotate(o.angle);
    if (o.flipY) ctx.scale(1, -1);
    if (o.sx !== undefined || o.sy !== undefined) ctx.scale(o.sx ?? 1, o.sy ?? 1);
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.additive) ctx.globalCompositeOperation = 'lighter';
    const px = -s.pivot[0] * dw, py = -s.pivot[1] * dh;
    if (o.outline) {
      const ol = this.outlineSheet(s, o.outline);
      const pad = (ol as any).pad as number;
      const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pa * (o.outlineAlpha ?? 0.9);
      ctx.drawImage(ol, fr * (s.fw + pad * 2), 0, s.fw + pad * 2, s.fh + pad * 2, px - pad * k, py - pad * k, dw + pad * 2 * k, dh + pad * 2 * k);
      ctx.globalCompositeOperation = prev;
      ctx.globalAlpha = pa;
    }
    const src = o.tint ? this.tinted(s, o.tint, 'mul') : s.img;
    ctx.drawImage(src, fr * s.fw, 0, s.fw, s.fh, px, py, dw, dh);
    if (s.glow && o.glow !== false) {
      const gfr = Math.min(fr, s.glow.frames - 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(s.glow.img, gfr * s.glow.fw, 0, s.glow.fw, s.glow.fh, px, py, dw, dh);
    }
    if (o.flash && o.flash > 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, o.flash);
      ctx.drawImage(this.tinted(s, '#ffffff', 'fill'), fr * s.fw, 0, s.fw, s.fh, px, py, dw, dh);
    }
    ctx.restore();
    return true;
  }
}

export const sprites = new Sprites();

/** tracks which animation an entity is playing and since when */
export class AnimState {
  name = '';
  start = 0;
  set(name: string, now: number) {
    if (name !== this.name) {
      this.name = name;
      this.start = now;
    }
    return now - this.start;
  }
}
