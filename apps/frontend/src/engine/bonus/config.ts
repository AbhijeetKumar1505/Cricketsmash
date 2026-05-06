export const BONUS_CONFIG = {
  // Raised so bonus props are reliably visible during normal play sessions.
  spawnChanceBase: 0.7,
  maxActive: 1,
  cooldownBalls: 1,
  minSpawnBallNumber: 1,
  lifetimeSec: 8.0,
  collisionPadding: 0.08,
  rarityWeights: {
    plus1: 0.7,
    plus2: 0.25,
    plus3: 0.05,
    multiplier: 0.02,
  },
} as const;

export type BonusWeightKey = keyof typeof BONUS_CONFIG.rarityWeights;

/** Outfield roam: stay on grass, skip pitch & players. */
export const BONUS_ROAM = {
  X_MIN:       -11.5,
  X_MAX:        11.5,
  Z_MIN:       -17.2,
  Z_MAX:        -2.4,
  PITCH_MARGIN: 2.1,
  SPEED_MIN:    1.45,
  SPEED_MAX:    2.35,
  /**
   * New waypoint **only after** arriving within RETARGET_NEAR of the prior target —
   * avoids timer-driven retarget mid-path (main cause of jerking).
   */
  RETARGET_IDLE:  2.85,
  RETARGET_NEAR:  0.68,
  RETARGET_JITTER: 1.25,
  /** If timer lapses before arrival, extend wait instead of snapping a new bearing. */
  RETARGET_HOLD_FAR: 0.9,
  /** Exponential-ish blend for planar velocity reporting (lower = smoother starts/stops). */
  VELOCITY_SMOOTH: 4.6,
  /** Clear radius = playerR + bonusR + PAD */
  PLAYER_PAD:      1.28,
  BOWLER_EXTRA:    1.42,
  BATSMAN_EXTRA:   1.65,
  REPEL_GAIN:      3.2,
  /** Cap repulsion shove per frame (world metres) — prevents spikes near players. */
  MAX_REPEL_PUSH:   0.08,
  /** Extra clearance between moving bonuses (rover/spider) to avoid jittery overlap. */
  BONUS_PAD:        0.95,
} as const;
