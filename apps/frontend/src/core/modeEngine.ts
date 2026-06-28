import type { CricketOutcome, CricketRuns } from '@cricket-crash/types';
import {
  decomposeRound,
  mulberry32,
  seedFromString,
  type DecomposeTelemetryEvent,
} from '@cricket-crash/fairness';
import type { DecomposedBall } from '@cricket-crash/fairness';
import type { BowlerType } from '../engine/physics/ballTrajectory.js';
import type { SkyObjectMeta } from '../engine/sky/types.js';
import { GAME_MODES } from './stakeClient.js';

export type ShotType =
  | 'bowled'
  | 'defend'
  | 'miss'
  | 'quick_single'
  | 'pushed_two'
  | 'run_three'
  | 'cut'
  | 'pull'
  | 'drive'
  | 'loft';

export interface Delivery {
  outcome: CricketOutcome;
  startMultiplier: number;
  endMultiplier: number;
  bowlerType: BowlerType;
  shotType: ShotType;
  skyObject?: SkyObjectMeta | null;
}

export interface GenerateDeliveriesResult {
  deliveries: Delivery[];
  telemetry: DecomposeTelemetryEvent[];
}

function deriveShotType(runs: number, isWicket: boolean, salt: number): ShotType {
  if (isWicket) return 'bowled';
  if (runs === 0) return salt % 3 === 0 ? 'miss' : 'defend';
  if (runs === 1) return 'quick_single';
  if (runs === 2) return 'pushed_two';
  if (runs === 3) return 'run_three';
  if (runs === 4) return salt % 2 === 0 ? 'cut' : 'pull';
  return salt % 2 === 0 ? 'loft' : 'pull';
}

function ballRunCount(b: DecomposedBall): number {
  if (b.key === 'catch_out') return 0;
  return b.runs as number;
}

function pickBowler(rng: () => number): BowlerType {
  const r = rng();
  if (r < 0.35) return 'Fast';
  if (r < 0.65) return 'Spin';
  return 'Swing';
}

/**
 * God Mode: every hit becomes a six. Wickets pass through unchanged.
 */
export function applyGodModeOverrides(deliveries: Delivery[]): Delivery[] {
  return deliveries.map(d => {
    if (d.outcome.kind === 'wicket') return d;
    return {
      ...d,
      outcome: { kind: 'runs' as const, runs: 6 as CricketRuns, multiplier: d.outcome.multiplier },
      shotType: 'loft' as ShotType,
    };
  });
}

/**
 * Expand one Stake RGS `payoutMultiplier` into a single Delivery.
 * Always uses POWERPLAY (single-ball) decomposition.
 */
export function generateDeliveries(
  finalMultiplier: number,
  options: {
    betID?: number;
    forcedKeys?: Array<'six' | 'four' | 'triple' | 'double' | 'single' | 'dot' | 'good_fielding' | 'catch_out'>;
    forceSkyType?: 'JETPACK' | 'SMALL_PLANE' | 'BIG_PLANE';
  } = {},
): GenerateDeliveriesResult {
  const betID = options.betID ?? 0;
  const decoded = decomposeRound({
    payoutMultiplier: finalMultiplier,
    betID,
    mode: GAME_MODES.POWERPLAY,
    applyOverCap: true,
    forcedKeys: options.forcedKeys,
    forceSkyType: options.forceSkyType,
  });

  const ball = decoded.balls[0];
  if (!ball) {
    // Decomposer returned no balls (edge-case multiplier). Return a defend dot-ball
    // so _activeBowlDelivery is never null and the engine has a valid outcome to animate.
    return {
      deliveries: [{
        outcome: { kind: 'runs' as const, runs: 0 as CricketRuns, multiplier: 1 },
        startMultiplier: 1,
        endMultiplier: 1,
        bowlerType: 'Fast' as BowlerType,
        shotType: 'defend' as ShotType,
      }],
      telemetry: decoded.telemetry,
    };
  }

  const rng = mulberry32(seedFromString(`bowler:${betID}:${finalMultiplier.toFixed(6)}`));

  if (ball.key === 'catch_out') {
    return {
      deliveries: [{
        outcome: { kind: 'wicket', multiplier: 0 },
        startMultiplier: 1,
        endMultiplier: 0,
        bowlerType: pickBowler(rng),
        shotType: 'bowled',
      }],
      telemetry: decoded.telemetry,
    };
  }

  const runs = ballRunCount(ball) as CricketRuns;
  const skyObject: SkyObjectMeta | undefined = ball.skyType !== undefined
    ? { type: ball.skyType, multiplier: ball.skyType === 'BIG_PLANE' ? 100 : 10 }
    : undefined;

  return {
    deliveries: [{
      outcome: { kind: 'runs', runs, multiplier: finalMultiplier },
      startMultiplier: 1,
      endMultiplier: finalMultiplier,
      bowlerType: pickBowler(rng),
      shotType: deriveShotType(runs, false, Math.floor(ball.factor * 47)),
      skyObject,
    }],
    telemetry: decoded.telemetry,
  };
}
