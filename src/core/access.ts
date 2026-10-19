/** Accessibility options shared by the renderer, HUD and controls (set from the Settings screen). */
export const access = {
  /** scale screen flashes (1 = full, 0.3 = reduced) */
  flash: 1,
  /** HUD size multiplier */
  hudScale: 1,
  /** colour-blind-safe telegraphs: unblockable = magenta, parryable = yellow */
  colorSafe: false,
  /** gamepad: aim at the nearest enemy when the right stick is idle */
  aimAssist: true,
  /** gamepad stick deadzone */
  deadzone: 0.22,
};

const RED = '#ff2d4a', ORANGE = '#ff9a3c';
/** telegraph colour after the colour-blind option */
export function teleCol(c: string) {
  if (!access.colorSafe) return c;
  if (c === RED) return '#e040fb';
  if (c === ORANGE) return '#ffd400';
  return c;
}
