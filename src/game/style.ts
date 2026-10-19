/** Combo counter + style rank (D → SSS). Variety and risk raise it; getting hit drops it. */
import { sfx } from '../audio/audio';

export const RANKS = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
export const RANK_NAMES = ['Dull', 'Cool', 'Bravo', 'Awesome', 'Stylish', 'Savage', 'SENSEI'];
export const RANK_COLORS = ['#8a93b8', '#7ff6ff', '#6dff9e', '#ffe14d', '#ff9a3c', '#ff4d8a', '#ffffff'];
const THRESH = [0, 120, 300, 560, 900, 1350, 1900, 2600];

class Style {
  points = 0;
  rank = 0;
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;
  bump = 0; // UI pop animation
  private recent: string[] = [];

  reset() {
    this.points = 0;
    this.rank = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.recent = [];
  }

  /** progress inside current rank 0..1 */
  get progress() {
    const lo = THRESH[this.rank], hi = THRESH[this.rank + 1];
    return Math.min(1, (this.points - lo) / (hi - lo));
  }

  add(pts: number, tag: string) {
    // variety bonus: tag not seen in last 3 actions
    const fresh = !this.recent.includes(tag);
    this.recent.push(tag);
    if (this.recent.length > 3) this.recent.shift();
    const mul = fresh ? 1.5 : 0.7;
    this.points = Math.min(THRESH[THRESH.length - 1], this.points + pts * mul * (1 + this.rank * 0.05));
    this.refresh();
  }
  hit(tag: string, pts = 12) {
    this.combo++;
    this.comboTimer = 2.6;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.add(pts, tag);
  }
  hurt() {
    this.combo = 0;
    this.points = Math.max(0, this.points - 350 - this.points * 0.25);
    this.refresh();
  }
  private refresh() {
    let r = 0;
    while (r < RANKS.length - 1 && this.points >= THRESH[r + 1]) r++;
    if (r > this.rank) {
      this.bump = 1;
      sfx('rankUp');
    }
    this.rank = r;
  }
  update(dt: number) {
    this.bump = Math.max(0, this.bump - dt * 3);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    // decay faster at high ranks
    this.points = Math.max(0, this.points - dt * (14 + this.rank * 20));
    this.refresh();
  }
}

export const style = new Style();
