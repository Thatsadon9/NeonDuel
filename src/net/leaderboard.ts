/** Client for the leaderboard API (server/api.mjs). Fails soft: on static hosting without the API, the UI hides itself. */

export interface LbEntry {
  id: string;
  name: string;
  score: number;
  stage: number;
  won: boolean;
  hard: boolean;
  weapon: string;
  time: number;
  kills: number;
  parries: number;
  bestRank: number;
  createdAt: string;
  shotUrl: string | null;
}
export interface RunSubmission {
  name: string;
  mode: 'campaign' | 'endless';
  stage: number;
  won: boolean;
  hard: boolean;
  weapon: string;
  time: number;
  kills: number;
  parries: number;
  perfects: number;
  executions: number;
  maxCombo: number;
  bestRank: number;
  shot?: string | null;
}

const NAME_KEY = 'neonduel.name.v1';
let snapCanvas: HTMLCanvasElement | null = null;

export function setSnapshotCanvas(c: HTMLCanvasElement) {
  snapCanvas = c;
}
/** small JPEG of the current game frame for the leaderboard card */
export function snapshot(width = 480): string | null {
  if (!snapCanvas || !snapCanvas.width) return null;
  try {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((snapCanvas.height / snapCanvas.width) * width);
    c.getContext('2d')!.drawImage(snapCanvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

export function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch { /* storage unavailable */ }
}

export async function fetchLeaderboard(hard: boolean, limit = 10, mode: 'campaign' | 'endless' = 'campaign'): Promise<LbEntry[] | null> {
  try {
    const r = await fetch(`api/leaderboard?mode=${mode}&hard=${hard ? 1 : 0}&limit=${limit}`, { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()).entries as LbEntry[];
  } catch {
    return null;
  }
}

export async function submitRun(run: RunSubmission): Promise<{ id: string; score: number; rank: number } | { error: string }> {
  try {
    const r = await fetch('api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { error: body.error ?? `HTTP ${r.status}` };
    return body;
  } catch {
    return { error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' };
  }
}
