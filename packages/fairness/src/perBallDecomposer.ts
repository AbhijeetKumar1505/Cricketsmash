/**
 * Deterministic per-ball decomposition for Stake-native rounds:
 * one Play() payoutMultiplier → planned balls matching spec distribution + reconciliation.
 */

import type { CricketRuns } from '@cricket-crash/types';
import {
  type GameModeName,
  GAME_MODES,
  STANDARD_PROFILE,
  type MathOutcomeKey,
  type SkyObjectType,
  CAP_OVER_TOTAL_MULTIPLIER,
  CAP_SINGLE_BALL_MULTIPLIER,
  STREAK_OVERRIDE_MULTIPLIERS,
  multiplierForSkyType,
  outcomeRuns,
  pickWeighted,
  profileForMode,
  profileForPositivePayout,
  weightedPickSkyType,
  computeRtp,
} from './economicModel.js';
import { mulberry32, seedFromString } from './rng.js';

export const DECOMPOSE_EPSILON = 1e-4;

export interface DecomposedBall {
  readonly index: number;
  readonly key: MathOutcomeKey;
  /** Factor applied in product chain for this ball (after overrides + reconciliation). */
  readonly factor: number;
  readonly runs: CricketRuns;
  readonly skyType?: SkyObjectType;
  readonly streakLength?: number;
  readonly flags: {
    readonly skyOverride: boolean;
    readonly streakOverride: boolean;
    readonly residualAdjusted: boolean;
    readonly capClamped: boolean;
  };
}

export interface DecomposeTelemetryEvent {
  readonly kind:
    | 'sky_override_applied'
    | 'streak_bonus_applied'
    | 'cap_clamped'
    | 'decomposer_residual_flagged';
  readonly payload: Record<string, unknown>;
}

export interface DecomposeResult {
  readonly payoutMultiplier: number;
  readonly mode: GameModeName;
  readonly balls: DecomposedBall[];
  /** Product of ball factors (should match payout within epsilon after success). */
  readonly product: number;
  readonly telemetry: DecomposeTelemetryEvent[];
}

function product(factors: readonly number[]): number {
  return factors.reduce((a, b) => a * b, 1);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Reconcile `factors` so their product equals `target`, adjusting index `adjustIdx` primarily.
 * Clamps each factor to [minFactor, CAP_SINGLE_BALL]. Sets flags if exact match impossible.
 */
function reconcileProduct(
  factors: number[],
  target: number,
  adjustIdx: number,
  telemetry: DecomposeTelemetryEvent[],
): { product: number; residualFlagged: boolean } {
  let p = product(factors);
  if (Math.abs(p - target) < DECOMPOSE_EPSILON) {
    return { product: p, residualFlagged: false };
  }

  if (p <= 0 || target <= 0) {
    telemetry.push({
      kind: 'decomposer_residual_flagged',
      payload: { reason: 'non_positive_product', p, target },
    });
    return { product: p, residualFlagged: true };
  }

  const ratio = target / p;
  factors[adjustIdx] *= ratio;

  if (factors[adjustIdx] > CAP_SINGLE_BALL_MULTIPLIER) {
    telemetry.push({ kind: 'cap_clamped', payload: { ball: adjustIdx, before: factors[adjustIdx] / ratio } });
    factors[adjustIdx] = CAP_SINGLE_BALL_MULTIPLIER;
    p = product(factors);
    // Second pass: spread remainder on previous balls, recomputing the ratio each
    // iteration so a prior adjustment doesn't overshoot and push the product
    // past the target in the wrong direction.
    if (Math.abs(p - target) > DECOMPOSE_EPSILON && adjustIdx > 0) {
      for (let j = adjustIdx - 1; j >= 0 && Math.abs(product(factors) - target) > DECOMPOSE_EPSILON; j--) {
        const curP = product(factors);
        const r2 = target / curP;
        factors[j] = clamp(factors[j]! * r2, 0.01, CAP_SINGLE_BALL_MULTIPLIER);
      }
    }
  }

  p = product(factors);
  const residualFlagged = Math.abs(p - target) > DECOMPOSE_EPSILON * 10;
  if (residualFlagged) {
    telemetry.push({
      kind: 'decomposer_residual_flagged',
      payload: { product: p, target, adjustIdx },
    });
  }
  return { product: p, residualFlagged };
}

export interface DecomposeOptions {
  readonly payoutMultiplier: number;
  readonly betID: number;
  readonly mode: GameModeName;
  /** When true, caps product at CAP_OVER_TOTAL_MULTIPLIER for planning (settlement still uses full Stake value). */
  readonly applyOverCap?: boolean;
  /** Dev/QA forcing: fixed keys for first N balls. */
  readonly forcedKeys?: readonly MathOutcomeKey[];
  /** Dev/QA forcing: force one sky type. */
  readonly forceSkyType?: SkyObjectType;
  /** Dev/QA forcing: force streak ladder value on this length (3..6). */
  readonly forceStreakLength?: 3 | 4 | 5 | 6;
}

export function decomposeRound(options: DecomposeOptions): DecomposeResult {
  const { payoutMultiplier, betID, mode } = options;
  const applyOverCap = options.applyOverCap ?? true;
  const telemetry: DecomposeTelemetryEvent[] = [];

  const targetMult =
    applyOverCap ? Math.min(payoutMultiplier, CAP_OVER_TOTAL_MULTIPLIER) : payoutMultiplier;

  if (
    applyOverCap
    && payoutMultiplier > CAP_OVER_TOTAL_MULTIPLIER
  ) {
    telemetry.push({
      kind: 'cap_clamped',
      payload: { scope: 'over_total', requested: payoutMultiplier, cappedTo: CAP_OVER_TOTAL_MULTIPLIER },
    });
  }

  // Wicket check must come BEFORE mode routing — a zero/negative payout is always
  // a wicket regardless of mode. The old order let POWERPLAY swallow payoutMultiplier=0
  // and route it to decomposePowerplay, which cannot reconcile to a zero target and
  // returned a bogus positive-factor ball instead of a catch_out.
  if (payoutMultiplier <= 0) {
    if (mode === GAME_MODES.POWERPLAY) {
      return decomposePowerplayWicket(betID, mode, telemetry);
    }
    return decomposeWicketOver(betID, mode, telemetry);
  }

  if (mode === GAME_MODES.POWERPLAY) {
    return decomposePowerplay(targetMult, betID, mode, telemetry, options);
  }

  return decomposePositiveOver(targetMult, betID, mode, telemetry, options);
}

function decomposePowerplayWicket(
  _betID: number,
  mode: GameModeName,
  telemetry: DecomposeTelemetryEvent[],
): DecomposeResult {
  return {
    payoutMultiplier: 0,
    mode,
    balls: [{
      index: 0,
      key: 'catch_out',
      factor: 0,
      runs: 0 as CricketRuns,
      flags: {
        skyOverride: false,
        streakOverride: false,
        residualAdjusted: false,
        capClamped: false,
      },
    }],
    product: 0,
    telemetry,
  };
}

function decomposePowerplay(
  targetMult: number,
  betID: number,
  mode: GameModeName,
  telemetry: DecomposeTelemetryEvent[],
  options: DecomposeOptions,
): DecomposeResult {
  const profile = profileForPositivePayout(profileForMode(mode));
  const rng = mulberry32(seedFromString(`pp:${betID}:${targetMult.toFixed(6)}`));
  const forced0 = options.forcedKeys?.[0];
  const pick = forced0
    ? profile.outcomes.find((o) => o.key === forced0) ?? pickWeighted(profile.outcomes, (o) => o.weight, rng)
    : pickWeighted(profile.outcomes, (o) => o.weight, rng);
  let factor = pick.multiplier;

  // Sky
  let skyType: SkyObjectType | undefined;
  if (options.forceSkyType || rng() < profile.sky.chance) {
    skyType = options.forceSkyType ?? weightedPickSkyType(rng);
    factor = multiplierForSkyType(skyType);
    telemetry.push({
      kind: 'sky_override_applied',
      payload: { ball: 0, type: skyType, factor },
    });
  }

  if (Math.abs(factor - targetMult) > DECOMPOSE_EPSILON) {
    const arr = [factor];
    reconcileProduct(arr, targetMult, 0, telemetry);
    factor = arr[0]!;
  }

  const capClamped = factor >= CAP_SINGLE_BALL_MULTIPLIER - 1e-6;
  if (capClamped) telemetry.push({ kind: 'cap_clamped', payload: { ball: 0, factor } });

  const runs = outcomeRuns(pick.key === 'catch_out' ? 'six' : pick.key) as CricketRuns;
  const ball: DecomposedBall = {
    index: 0,
    key: pick.key,
    factor,
    runs: skyType ? (6 as CricketRuns) : runs,
    skyType,
    flags: {
      skyOverride: !!skyType,
      streakOverride: false,
      residualAdjusted: true,
      capClamped,
    },
  };

  return {
    payoutMultiplier: targetMult,
    mode,
    balls: [ball],
    product: factor,
    telemetry,
  };
}

function decomposeWicketOver(
  betID: number,
  mode: GameModeName,
  telemetry: DecomposeTelemetryEvent[],
): DecomposeResult {
  const rng = mulberry32(seedFromString(`wk:${betID}`));
  const wicketBall = Math.floor(rng() * 6);
  const balls: DecomposedBall[] = [];
  for (let i = 0; i <= wicketBall; i++) {
    const isWk = i === wicketBall;
    balls.push({
      index: i,
      key: isWk ? 'catch_out' : 'dot',
      factor: isWk ? 0 : 1,
      runs: 0 as CricketRuns,
      flags: {
        skyOverride: false,
        streakOverride: false,
        residualAdjusted: false,
        capClamped: false,
      },
    });
  }
  return {
    payoutMultiplier: 0,
    mode,
    balls,
    product: 0,
    telemetry,
  };
}

function decomposePositiveOver(
  targetMult: number,
  betID: number,
  mode: GameModeName,
  telemetry: DecomposeTelemetryEvent[],
  options: DecomposeOptions,
): DecomposeResult {
  const profile = profileForPositivePayout(profileForMode(mode));
  const seedStr = `over:${betID}:${targetMult.toFixed(6)}:${mode}`;
  const rng = mulberry32(seedFromString(seedStr));

  const keys: MathOutcomeKey[] = [];
  const factors: number[] = [];
  for (let i = 0; i < 6; i++) {
    const forced = options.forcedKeys?.[i];
    const o = forced
      ? profile.outcomes.find((x) => x.key === forced) ?? pickWeighted(profile.outcomes, (x) => x.weight, rng)
      : pickWeighted(profile.outcomes, (x) => x.weight, rng);
    keys.push(o.key);
    factors.push(o.multiplier);
  }

  // Sky — one roll for whole over; if hits, pick ball index and override factor
  let skyBallIdx = -1;
  let skyType: SkyObjectType | undefined;
  if (options.forceSkyType || rng() < profile.sky.chance) {
    skyBallIdx = Math.floor(rng() * 6);
    skyType = options.forceSkyType ?? weightedPickSkyType(rng);
    const sm = multiplierForSkyType(skyType);
    factors[skyBallIdx] = sm;
    keys[skyBallIdx] = 'six';
    telemetry.push({
      kind: 'sky_override_applied',
      payload: { ball: skyBallIdx, type: skyType, factor: sm },
    });
  }

  // Boundary streak — last ball of a length>=3 boundary chain gets streak ladder multiplier.
  let streakOverrideIdx = -1;
  let streakLenAtApply = 0;
  let cur = 0;
  for (let i = 0; i < 6; i++) {
    const r = outcomeRuns(keys[i]!);
    const isB = r === 4 || r === 6;
    if (isB) {
      cur += 1;
      if (cur >= 3) {
        const mult = STREAK_OVERRIDE_MULTIPLIERS[Math.min(cur, 6)];
        if (mult !== undefined && factors[i]! < mult) {
          factors[i] = Math.max(factors[i]!, mult);
          streakOverrideIdx = i;
          streakLenAtApply = cur;
          telemetry.push({
            kind: 'streak_bonus_applied',
            payload: { ball: i, streakLength: cur, factor: mult },
          });
        }
      }
    } else {
      cur = 0;
    }
  }

  if (options.forceStreakLength) {
    const idx = Math.min(5, Math.max(2, options.forceStreakLength - 1));
    for (let i = 0; i <= idx; i++) keys[i] = i % 2 === 0 ? 'six' : 'four';
    const forcedMult = STREAK_OVERRIDE_MULTIPLIERS[options.forceStreakLength];
    factors[idx] = Math.max(factors[idx]!, forcedMult);
    streakOverrideIdx = idx;
    streakLenAtApply = options.forceStreakLength;
    telemetry.push({
      kind: 'streak_bonus_applied',
      payload: { ball: idx, streakLength: options.forceStreakLength, factor: forcedMult, forced: true },
    });
  }

  // Clamp factors before reconcile
  for (let i = 0; i < 6; i++) {
    if (factors[i]! > CAP_SINGLE_BALL_MULTIPLIER) {
      telemetry.push({ kind: 'cap_clamped', payload: { ball: i, before: factors[i] } });
      factors[i] = CAP_SINGLE_BALL_MULTIPLIER;
    }
  }

  const adjustIdx = 5;
  const fac = [...factors];
  const rec = reconcileProduct(fac, targetMult, adjustIdx, telemetry);

  const balls: DecomposedBall[] = keys.map((key, i) => ({
    index: i,
    key,
    factor: fac[i]!,
    runs: outcomeRuns(key) as CricketRuns,
    skyType: i === skyBallIdx ? skyType : undefined,
    streakLength: i === streakOverrideIdx ? streakLenAtApply : undefined,
    flags: {
      skyOverride: i === skyBallIdx,
      streakOverride: i === streakOverrideIdx,
      residualAdjusted: Math.abs(rec.product - targetMult) < DECOMPOSE_EPSILON * 100,
      capClamped: fac[i]! >= CAP_SINGLE_BALL_MULTIPLIER - 1e-6,
    },
  }));

  return {
    payoutMultiplier: targetMult,
    mode,
    balls,
    product: rec.product,
    telemetry,
  };
}

/** Analytical RTP from standard outcome table (single-ball, includes catch_out). */
export function analyticalRtpStandard(): number {
  return computeRtp(STANDARD_PROFILE.outcomes);
}
