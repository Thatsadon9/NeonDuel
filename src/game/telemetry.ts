/**
 * PLAYTEST LOG — records every run locally so long playtests produce numbers:
 * time per stage, damage taken by source, what killed you, skills / parries / perfects, cards and ascensions.
 * View & export from Debug Mode (admin panel). Nothing leaves the device.
 */
import { W } from './world';
import { style } from './style';

export interface StageLog {
  name: string;
  kind: string;
  secs: number;
  taken: number;
  /** damage taken grouped by "enemy · attack" */
  sources: Record<string, number>;
  skills: number;
  parries: number;
  perfects: number;
  execs: number;
  maxRank: number;
  cleared: boolean;
  node?: string;
}
export interface RunLog {
  id: string;
  date: string;
  mode: string;
  diff: number;
  weapon: string;
  players: number;
  cheated: boolean;
  stages: StageLog[];
  cards: string[];
  ascensions: string[];
  result: 'win' | 'dead' | 'quit' | 'running';
  cause: string;
  secs: number;
}

const KEY = 'neonduel.playtest.v1';
const MAX_RUNS = 40;

function load(): RunLog[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(list: RunLog[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_RUNS)));
  } catch { /* storage full or blocked */ }
}

class Telemetry {
  runs: RunLog[] = load();
  private cur: RunLog | null = null;
  private stage: StageLog | null = null;
  private snap = { time: 0, skills: 0, parries: 0, perfects: 0, execs: 0 };
  private lastHit = '';

  private skillTotal() {
    return Object.values(W.stats?.skillUse ?? {}).reduce((a, b) => a + b, 0);
  }

  startRun(mode: string, weapon: string, players: number) {
    this.endRun('quit', '');
    this.cur = {
      id: Math.random().toString(36).slice(2, 10), date: new Date().toISOString(), mode, diff: W.diff, weapon, players, cheated: W.cheated,
      stages: [], cards: [], ascensions: [], result: 'running', cause: '', secs: 0,
    };
    this.runs.push(this.cur);
    save(this.runs);
  }

  stageStart(name: string, kind: string, node?: string) {
    if (!this.cur) return;
    this.stageEnd(false);
    const s = W.stats;
    this.snap = { time: s.time, skills: this.skillTotal(), parries: s.parries, perfects: s.perfects, execs: s.executions };
    this.stage = { name, kind, secs: 0, taken: 0, sources: {}, skills: 0, parries: 0, perfects: 0, execs: 0, maxRank: 0, cleared: false, node };
    this.cur.stages.push(this.stage);
  }

  stageEnd(cleared: boolean) {
    const st = this.stage;
    if (!st || !this.cur) return;
    const s = W.stats;
    st.secs = Math.round((s.time - this.snap.time) * 10) / 10;
    st.skills = this.skillTotal() - this.snap.skills;
    st.parries = s.parries - this.snap.parries;
    st.perfects = s.perfects - this.snap.perfects;
    st.execs = s.executions - this.snap.execs;
    st.cleared = cleared;
    this.cur.secs = Math.round(s.time);
    this.cur.cheated ||= W.cheated;
    this.stage = null;
    save(this.runs);
  }

  /** a player took damage */
  damage(source: string, amount: number) {
    const st = this.stage;
    if (!st) return;
    st.taken = Math.round(st.taken + amount);
    st.sources[source] = Math.round((st.sources[source] ?? 0) + amount);
    st.maxRank = Math.max(st.maxRank, style.rank);
    this.lastHit = source;
  }
  card(id: string) {
    this.cur?.cards.push(id);
  }
  ascend(what: string) {
    this.cur?.ascensions.push(what);
  }
  endRun(result: 'win' | 'dead' | 'quit', cause = this.lastHit) {
    if (!this.cur) return;
    this.stageEnd(false);
    if (this.cur.result === 'running') {
      this.cur.result = result;
      this.cur.cause = result === 'dead' ? cause : '';
    }
    this.cur = null;
    save(this.runs);
  }

  clear() {
    this.runs = [];
    save(this.runs);
  }

  /** aggregate view for the admin panel */
  summary() {
    const runs = this.runs.filter((r) => !r.cheated && r.result !== 'running');
    const deaths: Record<string, number> = {};
    const sources: Record<string, number> = {};
    const stageTime: Record<string, { n: number; secs: number; taken: number }> = {};
    const cards: Record<string, number> = {};
    for (const r of runs) {
      if (r.result === 'dead' && r.cause) deaths[r.cause] = (deaths[r.cause] ?? 0) + 1;
      for (const c of r.cards) cards[c] = (cards[c] ?? 0) + 1;
      for (const s of r.stages) {
        for (const [k, v] of Object.entries(s.sources)) sources[k] = (sources[k] ?? 0) + v;
        if (!s.cleared) continue;
        const t = (stageTime[s.name] ??= { n: 0, secs: 0, taken: 0 });
        t.n++;
        t.secs += s.secs;
        t.taken += s.taken;
      }
    }
    const top = (o: Record<string, number>, n = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    return {
      runs: runs.length,
      wins: runs.filter((r) => r.result === 'win').length,
      deaths: top(deaths),
      sources: top(sources),
      cards: top(cards, 8),
      stages: Object.entries(stageTime).map(([name, t]) => ({ name, n: t.n, secs: Math.round(t.secs / t.n), taken: Math.round(t.taken / t.n) })),
    };
  }

  /** download all runs as JSON (the player clicks the button) */
  export() {
    const blob = new Blob([JSON.stringify(this.runs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neonduel-playtest-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}

export const tel = new Telemetry();
