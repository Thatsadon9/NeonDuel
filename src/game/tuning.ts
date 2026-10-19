/**
 * BALANCE KNOBS — every number that decides how hard the game is lives here.
 * See docs/BALANCE_PLAN.md for the reasoning; re-check with Debug Mode → Balance Bench after changing anything.
 */
export const T = {
  // ---------------------------------------------------------------- Focus economy
  focus: {
    /** per basic (non-skill) hit: perHit × clamp(dmg/14, min, max) */
    perHit: 2.2, gMin: 0.5, gMax: 1.8,
    /** skill hits give no Focus — skills are spent, not farmed */
    perSkillHit: 0,
    kill: 4,
    parry: 25,
    perfect: 10,
    execute: 15,
  },
  /** slot costs (Q / E / R) and cooldowns in seconds */
  skill: { costQ: 40, costE: 60, costR: 100, cdQ: 5, cdE: 9, cdR: 25 },
  /** after a red (unblockable) move bosses stay winded: damage / posture taken multipliers */
  punish: { dur: 1.1, damage: 1.2, posture: 1.6 },
  /** parry depth */
  parry: { late: 0.1, lateDamage: 0.5, chainNeed: 3, chainWindow: 4, chainPosture: 0.3 },
  /** style rank bonuses per rank step (D=0 … SSS=6) */
  style: { focus: 0.06, res: 0.08 },
  /** team attacks: how many minions may attack at once (per pool, +1 per extra player) */
  team: { melee: 2, ranged: 2, swarm: 3 },
  /** two skills inside this window wake a boss's SUPER ARMOR */
  superArmor: { casts: 2, window: 3, dur: 2, cooldown: 6, postureMul: 0.25 },

  // ---------------------------------------------------------------- Dash / Perfect Dodge
  dash: {
    stamina: 22,
    recharge: 1.05,
    iframe: 0.2,
    /** Perfect only in the first part of the dash */
    perfectWindow: 0.1,
    perfectCooldown: 1.5,
    perfectStamina: 22,
    perfectIframe: 0.1,
    perfectSlow: 0.3,
    /** dashing more than `tiredAfter` times within `tiredWindow` → that dash has no i-frames */
    tiredAfter: 2, tiredWindow: 1.5,
  },

  // ---------------------------------------------------------------- damage
  /** weapon damage per tier T0..T4 */
  tierDmg: [1, 1.1, 1.22, 1.36, 1.5],
  /** bosses take reduced damage from skills (minions take it in full) */
  bossSkillTaken: 0.75,
  /** execution on a staggered boss: % of max HP */
  bossExecute: 0.07,
  overdriveDmg: 1.2,

  // ---------------------------------------------------------------- health pools (NORMAL; HARD ×1.2)
  bossHp: {
    vanguard: 2000, hex: 1800, kael: 1250, vex: 1050, colossus: 3300, mirror: 2600,
    nyxara: 3400, tempus: 3400, voltaris: 3800, kagutsuchi: 3900, hollow: 6000, sentinel: 850,
  },
  /** boss posture multiplier (stagger has to be earned) */
  bossPosture: 1.5,
  minionHp: {
    rusher: 60, gunner: 45, bulwark: 110, bomber: 30, swarmling: 14, wraith: 60, lancer: 90, acolyte: 70,
    sentry: 140, broodmother: 170, brute: 330, mirror_shard: 45,
  },
  hardHp: 1.2,
  /** difficulty tables, indexed NORMAL / HARD / NIGHTMARE */
  diffHp: [1, 1.2, 1.45],
  diffMinionHp: [1, 1.15, 1.35],
  diffDmg: [1, 1.25, 1.55],
  diffSpeed: [1, 1.12, 1.22],
  /** chance a boss chains straight into another move (combo strings) */
  diffChain: [0, 0.3, 0.55],
  /** NIGHTMARE: phase 2 starts earlier, elites appear in the campaign, your parry window shrinks */
  nightmare: { phase2At: 0.6, elites: 0.12, parryWindow: 0.85 },
  /** enemy damage multiplier in Act II */
  act2Dmg: 1.2,
  /** co-op: boss HP added per extra player */
  coopBossHp: 0.9,

  // ---------------------------------------------------------------- healing
  heal: { stageClear: 0.15, bossClear: 0.25, endlessWave: 0.12, endlessBoss: 0.3, soul: 1, soulCd: 1 },
  /** Hollow King: falling off the islands (flat damage) */
  hollowFall: 15,
};
