/**
 * trajectorySolver.ts — Three trajectory modes + analytical helpers.
 *
 * Mode 1  PARABOLIC     — closed-form arc, no drag
 * Mode 2  RESULT_DRIVEN — inverse kinematics from target range (PRIMARY)
 * Mode 3  DRAG          — per-step linear drag applied to velocity
 *
 * Default: RESULT_DRIVEN (landing point is exact — required for determinism).
 *
 * THREE.js-free (pure math). Uses Vec3 from physics.ts.
 */

import { Vec3, GRAVITY, FIXED_DT } from './physics.js';

export type TrajectoryMode = 'parabolic' | 'result_driven' | 'drag';

// ── Launch I/O ─────────────────────────────────────────────────────────────────

export interface LaunchResult {
  /** Initial world-space velocity vector. */
  initialVelocity: Vec3;
  /** Analytical air time (seconds until y = 0). */
  flightTime: number;
  /** Predicted landing point (y = 0). */
  landingPoint: Vec3;
}

// ── TrajectorySolver ──────────────────────────────────────────────────────────

export class TrajectorySolver {

  // ── Mode 1: PARABOLIC ───────────────────────────────────────────────────────

  /**
   * Classic projectile formula (no drag):
   *   y = y0 + tan(θ)·x − g·x² / (2·v0²·cos²θ)
   *
   * @param v0         Initial speed (m/s)
   * @param angle      Launch angle θ (radians, elevation from horizontal)
   * @param launchPos  World position of launch
   * @param forwardDir Unit vector in XZ plane pointing toward target
   */
  parabolic(
    v0:         number,
    angle:      number,
    launchPos:  Readonly<Vec3>,
    forwardDir: Readonly<Vec3>,
  ): LaunchResult {
    const cosA  = Math.cos(angle);
    const sinA  = Math.sin(angle);
    const speedH = v0 * cosA;
    const speedV = v0 * sinA;

    // Analytical flight time from launchPos.y to ground (y = 0)
    const disc = speedV * speedV + 2 * GRAVITY * launchPos.y;
    const t    = disc >= 0
      ? (speedV + Math.sqrt(disc)) / GRAVITY
      : (2 * speedV) / GRAVITY;   // fallback: level ground

    const dist = speedH * t;

    return {
      initialVelocity: new Vec3(
        forwardDir.x * speedH,
        speedV,
        forwardDir.z * speedH,
      ),
      flightTime: t,
      landingPoint: new Vec3(
        launchPos.x + forwardDir.x * dist,
        0,
        launchPos.z + forwardDir.z * dist,
      ),
    };
  }

  // ── Mode 2: RESULT-DRIVEN (PRIMARY) ─────────────────────────────────────────

  /**
   * Inverse-solve v0 so the ball lands exactly at `targetRange` metres.
   *
   * Formula:  v0 = √( R·g / sin(2θ) )
   *
   * Guarantees determinism: same seed → same targetRange → identical landing.
   *
   * @param targetRange  Desired landing distance (metres) from launchPos XZ
   * @param angle        Launch angle θ (radians)
   * @param launchPos    World launch position
   * @param forwardDir   Unit vector toward target in XZ plane
   */
  resultDriven(
    targetRange: number,
    angle:       number,
    launchPos:   Readonly<Vec3>,
    forwardDir:  Readonly<Vec3>,
  ): LaunchResult {
    // Guard degenerate angles (0 or π/2 give sin(2θ) → 0)
    const sin2θ  = Math.max(Math.abs(Math.sin(2 * angle)), 0.04);
    const v0     = Math.sqrt((Math.max(targetRange, 0.5) * GRAVITY) / sin2θ);

    const cosA   = Math.cos(angle);
    const sinA   = Math.sin(angle);
    const speedH = v0 * cosA;
    const speedV = v0 * sinA;

    const disc   = speedV * speedV + 2 * GRAVITY * launchPos.y;
    const t      = disc >= 0
      ? (speedV + Math.sqrt(disc)) / GRAVITY
      : (2 * speedV) / GRAVITY;

    return {
      initialVelocity: new Vec3(
        forwardDir.x * speedH,
        speedV,
        forwardDir.z * speedH,
      ),
      flightTime: t,
      landingPoint: new Vec3(
        launchPos.x + forwardDir.x * speedH * t,
        0,
        launchPos.z + forwardDir.z * speedH * t,
      ),
    };
  }

  // ── Mode 3: DRAG ────────────────────────────────────────────────────────────

  /**
   * Apply one fixed step of linear drag + gravity.
   * Call inside your physics step instead of the plain gravity integrator.
   *
   *   vx *= (1 − k·dt)     (horizontal drag)
   *   vz *= (1 − k·dt)
   *   vy −= g·dt            (gravity — no drag on Y by default)
   *
   * @param vel    Ball velocity (mutated in-place)
   * @param dragK  Drag coefficient (≈ 0.05–0.12 for cricket ball at 30 m/s)
   * @param dt     Fixed timestep
   */
  applyDrag(vel: Vec3, dragK: number, dt: number): void {
    const decay = 1 - dragK * dt;
    vel.x *= decay;
    vel.z *= decay;
    vel.y -= GRAVITY * dt;
  }

  // ── Analytical helpers ───────────────────────────────────────────────────────

  /**
   * Predict where the ball will next cross y = 0, given current pos + vel.
   * Uses gravity-only model (no drag). Called by FielderAI for intercept.
   *
   * Solves: 0 = y + vy·t − ½·g·t²
   */
  predictLanding(pos: Readonly<Vec3>, vel: Readonly<Vec3>): Vec3 {
    if (pos.y <= 0 && vel.y <= 0) {
      return new Vec3(pos.x, 0, pos.z);
    }
    const disc = vel.y * vel.y + 2 * GRAVITY * Math.max(0, pos.y);
    if (disc < 0) return new Vec3(pos.x, 0, pos.z);
    const t = (vel.y + Math.sqrt(disc)) / GRAVITY;
    return new Vec3(
      pos.x + vel.x * t,
      0,
      pos.z + vel.z * t,
    );
  }

  /**
   * Analytical air time: seconds until ball at (pos, vel) hits y = 0.
   * Returns 0 if already on ground.
   */
  flightTime(pos: Readonly<Vec3>, vel: Readonly<Vec3>): number {
    if (pos.y <= 0 && vel.y <= 0) return 0;
    const disc = vel.y * vel.y + 2 * GRAVITY * Math.max(0, pos.y);
    if (disc < 0) return 0;
    return (vel.y + Math.sqrt(disc)) / GRAVITY;
  }

  /**
   * Compute Y height at horizontal distance `x` using the parabola formula.
   * Useful for drawing the trajectory arc analytically.
   *
   *   y(x) = y0 + tan(θ)·x − g·x² / (2·v0²·cos²θ)
   */
  heightAtDistance(x: number, v0: number, angle: number, y0: number): number {
    const cosA = Math.cos(angle);
    const tanA = Math.tan(angle);
    return y0 + tanA * x - (GRAVITY * x * x) / (2 * v0 * v0 * cosA * cosA);
  }

  /**
   * Sample N points along a ballistic arc for debug line drawing.
   * Simulates forward using fixed-step gravity (no drag).
   *
   * @param steps  Number of sample points (default 90)
   */
  sampleArc(
    pos:   Readonly<Vec3>,
    vel:   Readonly<Vec3>,
    steps = 90,
    dt    = FIXED_DT,
  ): Vec3[] {
    const pts: Vec3[] = [];
    let x  = pos.x, y  = pos.y, z  = pos.z;
    let vx = vel.x, vy = vel.y, vz = vel.z;

    for (let i = 0; i < steps; i++) {
      pts.push(new Vec3(x, Math.max(0, y), z));
      if (y <= 0 && vy <= 0) break;
      // Semi-implicit Euler (gravity only)
      vy -= GRAVITY * dt;
      x  += vx * dt;
      y  += vy * dt;
      z  += vz * dt;
    }
    return pts;
  }

  /**
   * Find optimal launch angle for maximum range from a given height.
   * For level ground: 45°. Adjusts empirically for elevated launch.
   */
  optimalAngle(launchY: number, targetRange: number): number {
    if (launchY <= 0) return Math.PI / 4;
    let best = Math.PI / 4;
    let bestRange = 0;
    // Scan 10°–70° in 1° steps
    for (let deg = 10; deg <= 70; deg += 1) {
      const a  = deg * (Math.PI / 180);
      const r  = this.resultDriven(targetRange, a, new Vec3(0, launchY, 0), new Vec3(0, 0, 1));
      if (r.flightTime > bestRange) { bestRange = r.flightTime; best = a; }
    }
    return best;
  }
}
