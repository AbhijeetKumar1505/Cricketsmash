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
import { GAME_MODES, type GameModeName } from './stakeClient.js';

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
  const BOWLER_TYPES: BowlerType[] = ['Fast', 'Spin', 'Swing'];
  return BOWLER_TYPES[Math.floor(rng() * BOWLER_TYPES.length)]!;
}

/**
 * Stake RGS: one `payoutMultiplier` per Play() — expanded to deliveries
 * via deterministic `decomposeRound` in `@cricket-crash/fairness`.
 */
export function generateDeliveries(
  finalMultiplier: number,
  mode: GameModeName,
  options: {
    betID?: number;
    forcedKeys?: Array<'six' | 'four' | 'triple' | 'double' | 'single' | 'dot' | 'good_fielding' | 'catch_out'>;
    forceSkyType?: 'JETPACK' | 'SMALL_PLANE' | 'BIG_PLANE';
    forceStreakLength?: 3 | 4 | 5 | 6;
  } = {},
): GenerateDeliveriesResult {
  const betID = options.betID ?? 0;
  const decoded = decomposeRound({
    payoutMultiplier: finalMultiplier,
    betID,
    mode,
    applyOverCap: true,
    forcedKeys: options.forcedKeys,
    forceSkyType: options.forceSkyType,
    forceStreakLength: options.forceStreakLength,
  });

  const deliveries: Delivery[] = [];
  let cumulative = 1;

  for (let i = 0; i < decoded.balls.length; i++) {
    const ball = decoded.balls[i]!;
    const rng = mulberry32(seedFromString(`bowler:${betID}:${mode}:${i}:${finalMultiplier.toFixed(6)}`));

    const startMultiplier = cumulative;

    if (ball.key === 'catch_out' && finalMultiplier <= 0) {
      deliveries.push({
        outcome: { kind: 'wicket', multiplier: 0 },
        startMultiplier,
        endMultiplier: 0,
        bowlerType: pickBowler(rng),
        shotType: deriveShotType(0, true, i * 3),
      });
      break;
    }

    const runs = ballRunCount(ball) as CricketRuns;
    cumulative *= ball.factor;
    const endMultiplier = cumulative;

    const skyObject: SkyObjectMeta | undefined =
      ball.skyType !== undefined
        ? {
            type: ball.skyType,
            multiplier: ball.skyType === 'BIG_PLANE' ? 100 : 10,
          }
        : undefined;

    deliveries.push({
      outcome: { kind: 'runs', runs, multiplier: endMultiplier },
      startMultiplier,
      endMultiplier,
      bowlerType: pickBowler(rng),
      shotType: deriveShotType(runs, false, i * 7 + Math.floor(ball.factor * 47)),
      skyObject,
    });
  }

  if (
    mode === GAME_MODES.OVER
    && finalMultiplier > 0
    && deliveries.length === 6
  ) {
    const snap = decoded.payoutMultiplier;
    const lastIdx = 5;
    const last = deliveries[lastIdx]!;
    if (last.outcome.kind === 'runs') {
      deliveries[lastIdx] = {
        ...last,
        endMultiplier: snap,
        outcome: { ...last.outcome, multiplier: snap },
      };
    }
  }

  if (mode === GAME_MODES.POWERPLAY && deliveries.length === 1 && finalMultiplier > 0) {
    const d0 = deliveries[0]!;
    deliveries[0] = {
      ...d0,
      outcome:
        d0.outcome.kind === 'runs'
          ? { ...d0.outcome, multiplier: finalMultiplier }
          : d0.outcome,
      endMultiplier: finalMultiplier,
    };
  }

  return { deliveries, telemetry: decoded.telemetry };
}
