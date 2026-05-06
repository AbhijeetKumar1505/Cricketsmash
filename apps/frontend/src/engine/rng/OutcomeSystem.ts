import { HIT_TIMES } from '../constants.js';
import type { BowlerType } from '../events/EventBus.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeliveryOutcome {
  result:           'hit' | 'wicket';
  bowlerType:       BowlerType;
  /** Seconds for ball to reach batsman. Derived from bowlerType. */
  hitTime:          number;
  /**
   * Intended result multiplier for a hit.
   * 0 on a wicket.  GameController passes this from the server or SDK.
   */
  targetMultiplier: number;
}

// ── OutcomeSystem ─────────────────────────────────────────────────────────────
//
// In production the outcome comes from the server (Stake RGS or backend seed).
// This class wraps the conversion from raw server data into a typed DeliveryOutcome,
// and also provides a local RNG fallback for local/dev mode.

export class OutcomeSystem {
  /**
   * Convert server-supplied result data into a DeliveryOutcome.
   * Call this before triggering a new bowl.
   */
  fromServer(
    result:          'hit' | 'wicket',
    bowlerType:      BowlerType,
    targetMultiplier: number,
  ): DeliveryOutcome {
    return {
      result,
      bowlerType,
      hitTime:          HIT_TIMES[bowlerType],
      targetMultiplier: result === 'wicket' ? 0 : targetMultiplier,
    };
  }

  /**
   * Client-side RNG for local/demo mode.
   * Not used in Stake or realtime modes.
   */
  localRandom(): DeliveryOutcome {
    const types: BowlerType[] = ['fast', 'spin', 'swing'];
    const bowlerType          = types[Math.floor(Math.random() * 3)];
    const isWicket            = Math.random() < 0.28;   // 28% wicket rate
    const mult                = isWicket ? 0 : parseFloat((1.2 + Math.random() * 8).toFixed(2));

    return {
      result:           isWicket ? 'wicket' : 'hit',
      bowlerType,
      hitTime:          HIT_TIMES[bowlerType],
      targetMultiplier: mult,
    };
  }
}
