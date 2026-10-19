/** Tiny registry the main loop checks: when an online CLIENT session is active it replaces the local simulation. */
export interface ClientLoop {
  frame(realDt: number): void;
  drawWorld(ctx: CanvasRenderingContext2D): void;
  readonly showHud: boolean;
}
export const session = { client: null as ClientLoop | null };
