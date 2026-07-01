/**
 * Canonical Cricket Crash economic profiles (spec sections 6–8, 10–14).
 * Single source of truth for RTP tables, sky weights, and streak ladder.
 */

/** Stake RGS mode names — duplicated here so fairness stays frontend-agnostic. */
export const GAME_MODES = {
  OVER: 'OVER',
  POWERPLAY: 'POWERPLAY',
} as const;

export type GameModeName = (typeof GAME_MODES)[keyof typeof GAME_MODES];

export type MathOutcomeKey =
  | 'six'
  | 'four'
  | 'triple'
  | 'double'
  | 'single'
  | 'dot'
  | 'good_fielding'
  | 'catch_out';

/** Sky object IDs aligned with engine `SkyObjectType`. */
export type SkyObjectType = 'JETPACK' | 'SMALL_PLANE' | 'BIG_PLANE';

export interface OutcomeSpec {
  key: MathOutcomeKey;
  multiplier: number;
  weight: number;
}

export interface SkyModel {
  chance: number;
  weights: {
    jetpack: number;
    smallPlane: number;
    bigPlane: number;
  };
  multipliers: {
    jetpack: 10;
    smallPlane: 10;
    bigPlane: 100;
  };
}

export interface MathProfile {
  outcomes: OutcomeSpec[];
  sky: SkyModel;
}

/** Standard mode — spec section 6–7. */
/** Weights sum to 1. RTP ≈ 0.95 (spec target 94–96%). */
export const STANDARD_PROFILE: MathProfile = {
  outcomes: [
    { key: 'six', multiplier: 4.5, weight: 0.05 },
    { key: 'four', multiplier: 3.0, weight: 0.07 },
    { key: 'triple', multiplier: 1.8, weight: 0.09 },
    { key: 'double', multiplier: 1.5, weight: 0.13 },
    { key: 'single', multiplier: 1.1, weight: 0.15 },
    { key: 'dot', multiplier: 0.9, weight: 0.2 },
    { key: 'good_fielding', multiplier: 0.7, weight: 0.16 },
    { key: 'catch_out', multiplier: 0, weight: 0.15 },
  ],
  sky: {
    chance: 0.02,
    weights: { jetpack: 0.75, smallPlane: 0.22, bigPlane: 0.03 },
    multipliers: { jetpack: 10, smallPlane: 10, bigPlane: 100 },
  },
};

/** Bonus buy / Powerplay profile — spec section 11 (table illustration). */
export const BONUS_BUY_PROFILE: MathProfile = {
  outcomes: [
    { key: 'six', multiplier: 5.0, weight: 0.11 },
    { key: 'four', multiplier: 3.5, weight: 0.15 },
    { key: 'triple', multiplier: 2.0, weight: 0.11 },
    { key: 'double', multiplier: 1.6, weight: 0.16 },
    { key: 'single', multiplier: 1.1, weight: 0.2 },
    { key: 'dot', multiplier: 0.9, weight: 0.15 },
    { key: 'good_fielding', multiplier: 0.7, weight: 0.03 },
    { key: 'catch_out', multiplier: 0, weight: 0.09 },
  ],
  sky: {
    chance: 0.25,  // was 0.12; bonus buy gets 25% sky object contact probability
    weights: { jetpack: 0.70, smallPlane: 0.25, bigPlane: 0.05 },  // slightly more planes
    multipliers: { jetpack: 10, smallPlane: 10, bigPlane: 100 },
  },
};

/** Boundary streak ladder — hat-trick bonus for 3+ consecutive 4s or 6s. */
export const STREAK_OVERRIDE_MULTIPLIERS: Record<number, number> = {
  3: 10,
  4: 12,
  5: 15,
  6: 20,
};

/** Hard caps — risk operations (plan Phase 2). */
export const CAP_SINGLE_BALL_MULTIPLIER = 100;
export const CAP_OVER_TOTAL_MULTIPLIER = 200;

export function profileForMode(mode: GameModeName): MathProfile {
  return mode === GAME_MODES.POWERPLAY ? BONUS_BUY_PROFILE : STANDARD_PROFILE;
}

export function computeRtp(outcomes: OutcomeSpec[]): number {
  return outcomes.reduce((acc, o) => acc + o.weight * o.multiplier, 0);
}

export function houseEdge(rtp: number): number {
  return 1 - rtp;
}

export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: () => number): T {
  const total = items.reduce((acc, item) => acc + weightOf(item), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1] as T;
}

export function isBoundaryOutcome(key: MathOutcomeKey): boolean {
  return key === 'four' || key === 'six';
}

export function outcomeRuns(key: MathOutcomeKey): 0 | 1 | 2 | 3 | 4 | 6 {
  if (key === 'single') return 1;
  if (key === 'double') return 2;
  if (key === 'triple') return 3;
  if (key === 'four') return 4;
  if (key === 'six') return 6;
  return 0;
}

/**
 * Map a final per-ball factor (the actual multiplier applied after overrides +
 * reconciliation) back to the cricket runs that should be VISUALISED for it.
 *
 * The visual shot must reflect the payout, not the originally-sampled outcome key:
 * after reconciliation a ball's factor is adjusted to hit the Stake target, while
 * its sampled key is unchanged. Deriving runs from the key (the old behaviour) lets
 * the 3D shot diverge from the multiplier (e.g. a "six" animation paying ~0.9×).
 *
 * Thresholds mirror `OutcomeSystem.bucketFromMultiplier` in the frontend engine and
 * map the standard outcome multipliers (0.9/1.1/1.5/1.8/3.0/4.5) onto their own buckets.
 */
export function runsFromMultiplier(factor: number): 0 | 1 | 2 | 3 | 4 | 6 {
  if (!Number.isFinite(factor) || factor <= 0) return 0;
  if (factor < 1.05) return 0;
  if (factor < 1.3) return 1;
  if (factor < 1.65) return 2;
  if (factor < 2.4) return 3;
  if (factor < 3.75) return 4;
  return 6;
}

const SKY_TYPE_WEIGHTS: Record<SkyObjectType, number> = {
  JETPACK: 0.75,
  SMALL_PLANE: 0.22,
  BIG_PLANE: 0.03,
};

export function multiplierForSkyType(type: SkyObjectType): 10 | 100 {
  return type === 'BIG_PLANE' ? 100 : 10;
}

/** Weighted sky type — spec section 14 distribution. */
export function weightedPickSkyType(rng: () => number): SkyObjectType {
  const entries = Object.entries(SKY_TYPE_WEIGHTS) as [SkyObjectType, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let roll = rng() * total;
  for (const [type, w] of entries) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return 'JETPACK';
}

/** Payout-impact sky chance (not cinematic-only frequency). */
export function skyObjectChanceForMode(mode: GameModeName): number {
  return profileForMode(mode).sky.chance;
}

/**
 * When Stake returns a positive payout, per-ball samples must not include wicket-outcomes
 * that zero the product. Redistribute `catch_out` weight across non-zero outcomes.
 */
export function profileForPositivePayout(profile: MathProfile): MathProfile {
  const zeroKeys = new Set<MathOutcomeKey>(['catch_out']);
  const filtered = profile.outcomes.filter((o) => !zeroKeys.has(o.key));
  const removedWt = profile.outcomes.filter((o) => zeroKeys.has(o.key)).reduce((a, o) => a + o.weight, 0);
  const keptTotal = filtered.reduce((a, o) => a + o.weight, 0);
  const scale = keptTotal > 0 ? (keptTotal + removedWt) / keptTotal : 1;
  return {
    ...profile,
    outcomes: filtered.map((o) => ({ ...o, weight: o.weight * scale })),
  };
}
