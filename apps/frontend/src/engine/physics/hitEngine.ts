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
  four:   0.28,   // ~16° — driven, medium height
  six:    0.92,   // ~53° — taller arc for skyline / hoarding targets (still result-driven range)
  wicket: 0.08,   // near-flat
};

/**
 * Max half-spread of lateral direction per bucket (radians).
 * Seeded RNG picks uniformly within ±spread, so the ball can reach
 * different fielder zones each delivery.
 *
 *   dot    ≈ ±14°  — blocked roughly straight
 *   single ≈ ±60°  — any inner fielder (mid-on, point, cover …)
 *   double ≈ ±57°  — through the gap to deep fielders
 *   triple ≈ ±49°  — near deep fielders / boundary edge
 *   four   ≈ ±43°  — driven through the ring to boundary
 *   six    ≈ ±69°  — anywhere over the boundary rope
 *   wicket ≈ ±11°  — deflects near-straight behind batsman
 */
const BUCKET_LATERAL: Record<OutcomeBucket, number> = {
  dot:    0.24,
  single: 1.05,
  double: 1.00,
  triple: 0.85,
  four:   0.75,
  six:    1.20,
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
    const baseAngle  = BUCKET_ANGLE[input.targetBucket];

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

    // Lateral spread: bucket spread determines which field zone; timing adds minor bias
    const lateralRad = this._lateralAngle(input.timingError, input.rng, input.targetBucket);

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
   * Lateral angle (radians): seeded direction within the bucket's field zone.
   *
   * The main spread comes from BUCKET_LATERAL so every delivery goes to a
   * different part of the field (fielder positions match the bucket ranges).
   * Timing error adds a small directional bias (early = off-side, late = leg).
   */
  private _lateralAngle(timingError: number, rng: () => number, bucket: OutcomeBucket): number {
    const spread = BUCKET_LATERAL[bucket];
    const base   = clamp(timingError * 0.6, -0.20, 0.20);  // timing bias, minor
    const jitter = (rng() - 0.5) * 2 * spread;              // seeded ±spread
    return clamp(base + jitter, -Math.PI * 0.5, Math.PI * 0.5);
  }
}
