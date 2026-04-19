import type { CricketOutcome, CricketRuns } from '@cricket-crash/types';

/**
 * Deterministic mapping: RGS payoutMultiplier → cricket outcome for animation/UI.
 * Stake mode: no client RNG; this is display/integration only.
 * The `runs` field drives the 3D shot animation (six/four/neutral).
 * The `multiplier` field is the ACTUAL server payout — never a hardcoded bracket value.
 */
export function payoutMultiplierToCricketOutcome(payoutMultiplier: number): CricketOutcome {
  if (!Number.isFinite(payoutMultiplier) || payoutMultiplier <= 0) {
    return { kind: 'wicket', multiplier: 0 };
  }

  // Map to cricket shot animation: runs determines ball trajectory, not payout size
  let runs: CricketRuns;
  if (payoutMultiplier < 1) {
    runs = 0 as CricketRuns;       // dot ball (ball hits bat softly, no run)
  } else if (payoutMultiplier < 1.35) {
    runs = 1 as CricketRuns;       // single
  } else if (payoutMultiplier < 2.2) {
    runs = 2 as CricketRuns;       // two runs (neutral trajectory)
  } else if (payoutMultiplier < 4.5) {
    runs = 4 as CricketRuns;       // four (ground boundary)
  } else {
    runs = 6 as CricketRuns;       // six (over the rope)
  }

  return { kind: 'runs', runs, multiplier: payoutMultiplier };
}
