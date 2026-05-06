import { TIMING } from '../constants.js';
import type { HitQuality } from '../events/EventBus.js';

// ── HitSystem ─────────────────────────────────────────────────────────────────
//
// Stateless, pure logic.  GameEngine owns timing state; HitSystem only
// evaluates it.  No references to Three.js, StateMachine, or EventBus.

export class HitSystem {
  /**
   * Evaluate timing quality.
   *
   * @param elapsedAtSwing  Ball's elapsed time (seconds) at the moment of input.
   * @param idealHitTime    Seconds from bowl-start when the ball reaches the bat.
   *
   * Timing error = |elapsedAtSwing − idealHitTime|
   *   ≤ PERFECT_WINDOW  → perfect
   *   ≤ GOOD_WINDOW     → good
   *   else              → miss
   */
  evaluate(elapsedAtSwing: number, idealHitTime: number): HitQuality {
    const error = Math.abs(elapsedAtSwing - idealHitTime);
    if (error <= TIMING.PERFECT_WINDOW) return 'perfect';
    if (error <= TIMING.GOOD_WINDOW)   return 'good';
    return 'miss';
  }

  /**
   * Whether the hit window is still open.
   * After hitTime + GOOD_WINDOW the ball has passed and no input can register.
   */
  isWindowOpen(elapsed: number, hitTime: number): boolean {
    return elapsed <= hitTime + TIMING.GOOD_WINDOW;
  }

  /**
   * Whether the ball has entered the zone where a swing can score.
   * Window opens GOOD_WINDOW seconds before idealHitTime.
   */
  isWindowEntering(elapsed: number, hitTime: number): boolean {
    return elapsed >= hitTime - TIMING.GOOD_WINDOW;
  }
}

// Re-export so consumers can import HitQuality from here as before.
export type { HitQuality };
