/**
 * hitEngine.ts — Hit window detection + post-contact velocity computation.
 *
 * Responsibilities:
 *   1. Evaluate timing quality (perfect / good / miss) from elapsed vs idealHitTime
 *   2. Map (timingError, shotPower, targetBucket) → post-hit velocity Vec3
 *   3. Provide window-open guards consumed by GameEngine
 *
 * Uses RESULT-DRIVEN kinematics (same as TrajectorySolver.resultDriven) so
 * the ball always lands at the bucket's intended range regardless of timing error.
 * Timing error only affects direction, angle variation, and a ±15% power scale.
 *
 * THREE.js-free — pure math + Vec3.
 */

import { Vec3, GRAVITY, clamp } from './physics.js';
import type { OutcomeBucket } from '../rng/OutcomeSystem.js';

/** Local mirror of modeEngine ShotType — avoids cross-module import. */
type ShotTypeName = 'pull' | 'cut' | 'loft' | 'drive' | 'quick_single' | 'pushed_two' | 'run_three' | 'defend' | 'miss' | 'bowled';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HitQuality   = 'perfect' | 'good' | 'miss';
export type HitDirection = 'straight_drive' | 'loft_pull' | 'edge_weak';

export interface HitInput {
  /**
   * Signed timing error in seconds.
   *   Negative  = early swing
   *   Zero      = perfect timing
   *   Positive  = late swing
   */
  timingError:   number;
  /**
   * Normalised shot power [0, 1].
   * From UI hold-duration or auto-set from game config.
   */
  shotPower:     number;
  /** Intended outcome bucket from the game server (controls range). */
  targetBucket:  OutcomeBucket;
  /** Seeded RNG — for deterministic lateral spread. */
  rng:           () => number;
  /** Shot type from the delivery intent — biases the lateral sector. */
  shotType?:     ShotTypeName;
}

export interface HitOutput {
  quality:      HitQuality;
  direction:    HitDirection;
  /** World-space velocity to assign to BallController.applyImpulse(). */
  velocity:     Vec3;
  /** Computed launch angle (radians). Exposed for debug overlay. */
  launchAngle:  number;
  /** Predicted landing range (metres). Exposed for fielder AI + debug. */
  range:        number;
}

// ── Per-bucket defaults ───────────────────────────────────────────────────────

/** Base landing range (metres) for each outcome bucket. */
const BUCKET_RANGE: Record<OutcomeBucket, number> = {
  dot:    3.5,
  single: 8.0,
  double: 12.0,
  triple: 16.0,
  four:   22.0,
  six:    38.0,
  wicket: 0.5,
};

/**
 * Base launch angle (radians) for each outcome.
 * Higher angles = more airborne (six > four > single > dot).
 */
const BUCKET_ANGLE: Record<OutcomeBucket, number> = {
  dot:    0.18,   // ~10° — low dribble
  single: 0.24,   // ~14°
  double: 0.32,   // ~18°
  triple: 0.38,   // ~22°
  four:   0.34,   // ~19° — firmer drive arc
  six:    0.92,   // ~53° — taller arc for skyline / hoarding targets (still result-driven range)
  wicket: 0.08,   // near-flat
};

/**
 * Lateral sector bias per shot type (radians).
 * Shifts the centre of the lateral distribution so the ball goes to the
 * correct cricket field sector regardless of the RNG spread.
 *   Negative = leg side (−X),  Positive = off side (+X)
 */
const SHOT_BIAS: Partial<Record<ShotTypeName, number>> = {
  pull:        -0.22,  // hook/pull to square leg (reduced: compressed world keeps ball in frame)
  cut:         +0.22,  // backward point / cover (reduced from 0.55)
  loft:         0.00,  // straight, over mid-on or mid-off
  drive:        0.00,  // straight drive
  quick_single: 0.00,  // angled — RNG handles the spread
  pushed_two:   0.00,
  run_three:    0.00,
  defend:       0.00,
  miss:         0.00,
  bowled:       0.00,
};

/**
 * Max half-spread of lateral direction per bucket (radians).
 * Seeded RNG picks uniformly within ±spread, so the ball can reach
 * different fielder zones each delivery.
 *
 * four/six values are tuned so the ball crosses the boundary rope
 * (radius 14 from origin) within the broadcast camera's 46° FOV.
 * Wider values cause the ball to exit the frame before reaching the rope.
 */
const BUCKET_LATERAL: Record<OutcomeBucket, number> = {
  dot:    0.24,
  single: 1.05,
  double: 1.00,
  triple: 0.85,
  four:   0.30,   // ±17° — keeps cut/pull fours visible at the boundary rope
  six:    0.50,   // ±29° — sixes stay in frame while still covering wide arc
  wicket: 0.20,
};

// ── HitEngine ─────────────────────────────────────────────────────────────────

export class HitEngine {
  /** ±seconds for perfect timing (green zone). */
  readonly PERFECT_WINDOW = 0.08;
  /** ±seconds for good timing (yellow zone). */
  readonly GOOD_WINDOW    = 0.20;

  // ── Timing evaluation ──────────────────────────────────────────────────────

  /**
   * Classify timing quality from the error magnitude.
   *
   * @param timingError  |elapsed − idealHitTime| (unsigned OK; sign used below)
   */
  evaluate(timingError: number): HitQuality {
    const abs = Math.abs(timingError);
    if (abs <= this.PERFECT_WINDOW) return 'perfect';
    if (abs <= this.GOOD_WINDOW)    return 'good';
    return 'miss';
  }

  /** True while the hit window is still open (ball hasn't passed by too long). */
  isWindowOpen(elapsed: number, idealHitTime: number): boolean {
    return elapsed <= idealHitTime + this.GOOD_WINDOW;
  }

  /** True once the ball has entered the batsman scoring zone. */
  isWindowEntering(elapsed: number, idealHitTime: number): boolean {
    return elapsed >= idealHitTime - this.GOOD_WINDOW;
  }

  // ── Full hit resolution ────────────────────────────────────────────────────

  /**
   * Resolve a swing into a world-space velocity.
   *
   * Algorithm:
   *   1. Evaluate timing quality
   *   2. Look up base range + angle for the target bucket
   *   3. Apply quality multiplier (±8%)
   *   4. Apply power scaling (0.85–1.15)
   *   5. Compute v0 via result-driven formula: v0 = √(R·g / sin(2θ))
   *   6. Add seeded lateral spread from timing error
   *   7. Return velocity Vec3 + metadata
   */
  resolve(input: HitInput): HitOutput {
    const quality   = this.evaluate(input.timingError);
    const direction = this._mapDirection(input.timingError);

    // Miss / wicket → ball deflects behind the batsman toward the stumps (+Z, toward camera)
    if (quality === 'miss' || input.targetBucket === 'wicket') {
      return {
        quality:     'miss',
        direction:   'edge_weak',
        velocity:    new Vec3(
          (input.rng() - 0.5) * 1.2,
          0.3 + input.rng() * 0.5,
          0.8 + input.rng() * 0.7,   // +Z = behind batsman, past stumps, toward camera
        ),
        launchAngle: 0.06,
        range:       1.0,
      };
    }

    // Base range + angle from bucket
    const baseRange  = BUCKET_RANGE[input.targetBucket];
    let   baseAngle  = BUCKET_ANGLE[input.targetBucket];

    // Pull shots hit the ball at a higher trajectory (towering hook over square leg)
    if (input.targetBucket === 'six' && input.shotType === 'pull') baseAngle += 0.15;

    // Quality + power modulate range within ±15%
    const qMult      = quality === 'perfect' ? 1.08 : 1.0;
    const pMult      = 0.85 + clamp(input.shotPower, 0, 1) * 0.30;
    const range      = baseRange * qMult * pMult;

    // Perfect hit gets a slightly elevated angle for satisfying arc
    const angle      = baseAngle + (quality === 'perfect' ? 0.03 : 0);

    // Result-driven v0: v0 = √(R·g / sin(2θ))
    const sin2θ      = Math.max(Math.abs(Math.sin(2 * angle)), 0.04);
    const v0         = Math.sqrt((range * GRAVITY) / sin2θ);
    const speedH     = v0 * Math.cos(angle);
    const speedV     = v0 * Math.sin(angle);

    // Lateral spread: bucket spread + shot-type sector bias determines field zone
    const lateralRad = this._lateralAngle(input.timingError, input.rng, input.targetBucket, input.shotType);

    const velocity = new Vec3(
      Math.sin(lateralRad) * speedH,
      speedV,
      -Math.cos(lateralRad) * speedH,  // -Z = toward outfield (camera is behind batsman at +Z)
    );

    return { quality, direction, velocity, launchAngle: angle, range };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Map timing error to shot direction archetype.
   *
   *   Early (timingError < −0.06)  → loft / pull shot (bat comes through early)
   *   Late  (timingError > +0.06)  → edge / weak deflection
   *   Near-zero                    → straight drive
   */
  private _mapDirection(timingError: number): HitDirection {
    if (timingError < -0.06) return 'loft_pull';
    if (timingError >  0.06) return 'edge_weak';
    return 'straight_drive';
  }

  /**
   * Lateral angle (radians): sector-biased direction within the bucket's field zone.
   *
   * Centre of the distribution is shifted by SHOT_BIAS so a pull goes to leg side,
   * a cut goes to off side, etc. RNG jitter within BUCKET_LATERAL then spreads the
   * ball naturally around that sector. Clamp extended to ±130° to allow
   * proper behind-square shots (pull/sweep) without clipping the distribution.
   */
  private _lateralAngle(timingError: number, rng: () => number, bucket: OutcomeBucket, shotType?: ShotTypeName): number {
    const spread    = BUCKET_LATERAL[bucket];
    const timingBias = clamp(timingError * 0.6, -0.20, 0.20);
    const sectorBias = shotType ? (SHOT_BIAS[shotType] ?? 0) : 0;
    const jitter     = (rng() - 0.5) * 2 * spread;
    return clamp(sectorBias + timingBias + jitter, -Math.PI * 0.72, Math.PI * 0.72);
  }
}
