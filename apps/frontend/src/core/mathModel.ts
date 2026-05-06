/**
 * Re-exports canonical economic model from `@cricket-crash/fairness`.
 * Prefer importing from `@cricket-crash/fairness` for new code.
 */
export type {
  MathOutcomeKey,
  OutcomeSpec,
  SkyModel,
  MathProfile,
  SkyObjectType,
  GameModeName,
} from '@cricket-crash/fairness';

export {
  GAME_MODES,
  STANDARD_PROFILE,
  BONUS_BUY_PROFILE,
  STREAK_OVERRIDE_MULTIPLIERS,
  profileForMode,
  computeRtp,
  houseEdge,
  pickWeighted,
  isBoundaryOutcome,
  outcomeRuns,
  multiplierForSkyType,
  weightedPickSkyType,
  skyObjectChanceForMode,
  profileForPositivePayout,
  CAP_SINGLE_BALL_MULTIPLIER,
  CAP_OVER_TOTAL_MULTIPLIER,
} from '@cricket-crash/fairness';
