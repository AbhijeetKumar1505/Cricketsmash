import type { HitQuality, RoundOutcome } from '../events/EventBus.js';

// ── Data ──────────────────────────────────────────────────────────────────────

export interface RoundData {
  ballNumber:   number;
  multiplier:   number;    // current delivery multiplier
  cumulative:   number;    // running product across balls in an over
  outcome:      RoundOutcome | null;
  targetMult:   number;    // server-supplied target (0 = wicket)
}

// ── RoundSystem ───────────────────────────────────────────────────────────────

export class RoundSystem {
  makeData(): RoundData {
    return {
      ballNumber: 0,
      multiplier: 1.0,
      cumulative: 1.0,
      outcome:    null,
      targetMult: 1.0,
    };
  }

  /**
   * Prepare for a new delivery.
   * @param targetMult  Server-determined outcome multiplier.
   *                    0 = pre-determined wicket.
   */
  startRound(data: RoundData, targetMult: number): void {
    data.ballNumber += 1;
    data.outcome    = null;
    data.targetMult = targetMult;
    data.multiplier = 1.0;
  }

  /**
   * Apply the result of a swing.
   * Mutates data.multiplier and data.outcome.
   */
  applyResult(data: RoundData, quality: HitQuality): void {
    if (quality === 'miss' || data.targetMult === 0) {
      data.outcome    = 'wicket';
      data.multiplier = 0;
      return;
    }

    data.outcome    = 'hit';
    data.multiplier = data.targetMult;
    data.cumulative = data.cumulative * data.multiplier;
  }

  resetOver(data: RoundData): void {
    data.cumulative = 1.0;
    data.ballNumber = 0;
  }
}
