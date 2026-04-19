import type { CricketOutcome, CricketRuns } from '@cricket-crash/types';
import type { BowlerType } from '../engine/physics/ballTrajectory.js';
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
}

function deriveShotType(runs: number, isWicket: boolean, seed: number): ShotType {
  if (isWicket) return 'bowled';
  if (runs === 0) return seed % 3 === 0 ? 'miss' : 'defend';
  if (runs === 1) return 'quick_single';
  if (runs === 2) return 'pushed_two';
  if (runs === 3) return 'run_three';
  if (runs === 4) return seed % 2 === 0 ? 'cut' : 'pull';
  return seed % 2 === 0 ? 'loft' : 'pull';
}

/**
 * generateDeliveries — Transforms a single Stake RGS result into a sequence of visuals.
 * Bonus Mode -> 1 delivery.
 * Regular Mode -> 6 deliveries (or fewer if a wicket occurs).
 */
export function generateDeliveries(finalMultiplier: number, mode: GameModeName): Delivery[] {
  const BOWLER_TYPES: BowlerType[] = ['Fast', 'Spin', 'Swing'];
  const getBowler = () => BOWLER_TYPES[Math.floor(Math.random() * BOWLER_TYPES.length)]!;

  if (mode === GAME_MODES.POWERPLAY) {
    // Bonus Mode: Single impactful ball
    const isWicket = finalMultiplier <= 0;
    const ppRuns = finalMultiplier >= 1.5 ? 6 : 4;
    return [{
      outcome: isWicket
        ? { kind: 'wicket', multiplier: 0 }
        : { kind: 'runs', runs: ppRuns, multiplier: finalMultiplier },
      startMultiplier: 1,
      endMultiplier: isWicket ? 1 : finalMultiplier,
      bowlerType: getBowler(),
      shotType: isWicket ? 'bowled' : (ppRuns === 6 ? 'loft' : 'drive'),
    }];
  }

  // Regular Mode (OVER): 6-ball sequence
  const deliveries: Delivery[] = [];
  let currentMult = 1;
  const ballCount = 6;

  if (finalMultiplier <= 0) {
    // Wicket happens at a random point in the over
    const wicketBall = Math.floor(Math.random() * ballCount);
    for (let i = 0; i <= wicketBall; i++) {
        const isWicket = i === wicketBall;
        deliveries.push({
            outcome: isWicket ? { kind: 'wicket', multiplier: 0 } : { kind: 'runs', runs: 0, multiplier: 1 },
            startMultiplier: 1,
            endMultiplier: 1,
            bowlerType: getBowler(),
            shotType: deriveShotType(0, isWicket, i * 3),
        });
    }
  } else {
    // Distribute finalMultiplier across 6 balls with stepwise jumps
    let remainingGrowth = finalMultiplier - 1;
    
    for (let i = 0; i < ballCount; i++) {
        const isLast = i === ballCount - 1;
        let bump = 0;
        let runs: CricketRuns = 0;

        if (remainingGrowth > 0) {
            // Allocate a portion of the growth to this ball
            // If it's a high multiplier, we want some big jumps (4s and 6s)
            const weight = isLast ? 1 : Math.random() * 0.4;
            bump = Math.max(0, Math.floor(remainingGrowth * weight * 100) / 100);
            remainingGrowth -= bump;
            
            // Map bump size to a realistic cricket shot based on new math
            if (bump >= 2.0) runs = 6;
            else if (bump >= 0.8) runs = 4;
            else if (bump >= 0.033) runs = 3;
            else if (bump >= 0.02) runs = 2;
            else if (bump >= 0.01) runs = 1;
            else runs = 0;
        }

        const start = currentMult;
        currentMult += bump;
        if (isLast) currentMult = finalMultiplier; // Canonical rounding

        deliveries.push({
            outcome: { kind: 'runs', runs, multiplier: currentMult },
            startMultiplier: start,
            endMultiplier: currentMult,
            bowlerType: getBowler(),
            shotType: deriveShotType(runs, false, i * 7 + Math.floor(bump * 100)),
        });
    }
  }

  return deliveries;
}
