/**
 * Tiny coroutine runner. Generators `yield seconds` to wait; `yield 0` waits one tick.
 * Used to script boss attacks and multi-step player skills.
 */
export type Co = Generator<number | undefined, void, unknown>;

export class Runner {
  private g: Co | null = null;
  private wait = 0;

  get running() {
    return this.g !== null;
  }
  run(g: Co) {
    this.g = g;
    this.wait = 0;
  }
  stop() {
    this.g = null;
    this.wait = 0;
  }
  step(dt: number) {
    if (!this.g) return false;
    this.wait -= dt;
    let guard = 0;
    while (this.g && this.wait <= 0 && guard++ < 64) {
      const r = this.g.next();
      if (r.done) {
        this.g = null;
        break;
      }
      const v = r.value ?? 0;
      if (v <= 0) {
        this.wait = 0;
        break;
      }
      this.wait += v;
    }
    return this.g !== null;
  }
}
