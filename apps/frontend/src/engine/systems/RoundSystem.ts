import type { HitQuality, RoundOutcome } from '../events/EventBus.js';

// ── Data ──────────────────────────────────────────────────────────────────────

export interface RoundData {
  ballNumber:   number;
  multiplier:   number;    // current delivery multiplier
  cumulative:   number;    // running product across balls in an over
  outcome:      RoundOutcome | null;
  targetMult:   number;    // server-supplied target (0 = wicket)
}

// ── Quality bonus modifiers ───────────────────────────────────────────────────
//
// On a hit, the result multiplier = targetMult × qualityBonus.
// The quality bonus rewards timing accuracy with up to 20% extra.
// A miss always resolves as a wicket regardless of the target.

const QUALITY_BONUS: Record<HitQuality, number> = {
  perfect: 1.20,
  good:    1.08,
  miss:    0,    // unused — miss is always a wicket
};

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
    data.multiplier = data.targetMult * QUALITY_BONUS[quality];
    data.cumulative = data.cumulative * data.multiplier;
  }

  resetOver(data: RoundData): void {
    data.cumulative = 1.0;
    data.ballNumber = 0;
  }
}
