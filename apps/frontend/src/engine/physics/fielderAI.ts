/**
 * fielderAI.ts — Fielder interception + chase logic.
 *
 * Algorithm per the spec:
 *   1. Predict ball landing point (TrajectorySolver.predictLanding)
 *   2. Find nearest fielder to landing point
 *   3. Compute fielder travel time vs ball flight time
 *      • fielder_time < ball_time  → attempt catch
 *      • otherwise                → chase ball
 *   4. Compute deterministic catch probability (seeded RNG)
 *
 * All movement is direct-path (straight line to intercept).
 * THREE.js-free.
 */

import { Vec3 } from './physics.js';
import { TrajectorySolver }        from './trajectorySolver.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FielderAgent {
  id:           number;
  position:     Vec3;
  /** Sprint speed (m/s). Default ≈ 6 m/s. */
  speed:        number;
  /** Catch success radius (metres). Ball within this radius → can attempt. */
  catchRadius:  number;
  /** True while actively moving toward intercept/ball. */
  chasing:      boolean;
  /** Current movement target. Null when idle. */
  target:       Vec3 | null;
}

export interface InterceptionResult {
  fielderId:    number;
  /** World XZ landing prediction. */
  interceptAt:  Vec3;
  /** True if the fielder can reach before the ball lands. */
  canCatch:     boolean;
  /** Fielder travel time to landing point (seconds). */
  fielderTime:  number;
  /** Ball flight time remaining (seconds). */
  ballTime:     number;
  /** Probability [0, 1] of a successful catch (seeded). */
  catchProb:    number;
}

const DEFAULT_SPEED       = 6.0;    // m/s
const DEFAULT_CATCH_RADIUS = 2.5;   // metres

// ── FielderAI ─────────────────────────────────────────────────────────────────

export class FielderAI {
  private readonly solver = new TrajectorySolver();

  /**
   * Assign the best fielder to the ball's landing point.
   *
   * @param ballPos   Current ball world position
   * @param ballVel   Current ball velocity
   * @param fielders  Array of all fielder agents
   * @param rng       Seeded RNG for catch probability
   * @returns         Interception plan, or null if no fielders
   */
  assignInterception(
    ballPos:  Readonly<Vec3>,
    ballVel:  Readonly<Vec3>,
    fielders: FielderAgent[],
    rng:      () => number,
  ): InterceptionResult | null {
    if (fielders.length === 0) return null;

    // Step 1 — predict landing
    const landing = this.solver.predictLanding(ballPos, ballVel);

    // Step 2 — nearest fielder
    let best: FielderAgent | null = null;
    let bestDist = Infinity;
    for (const f of fielders) {
      const d = f.position.distanceXZ(landing);
      if (d < bestDist) { bestDist = d; best = f; }
    }
    if (!best) return null;

    // Step 3 — intercept feasibility
    const fielderTime = bestDist / (best.speed || DEFAULT_SPEED);
    const ballTime    = this.solver.flightTime(ballPos, ballVel);
    const canCatch    = fielderTime < ballTime || bestDist < best.catchRadius;

    // Step 4 — catch probability (seeded)
    const catchProb = this._catchProb(bestDist, canCatch, rng);

    return {
      fielderId:   best.id,
      interceptAt: landing,
      canCatch,
      fielderTime,
      ballTime,
      catchProb,
    };
  }

  /**
   * Move a fielder one fixed step toward their intercept target.
   * Call inside the physics accumulator step.
   *
   * @param fielder  Agent to move (position mutated in-place)
   * @param target   World XZ destination
   * @param dt       Fixed physics step (FIXED_DT)
   */
  stepFielderToward(fielder: FielderAgent, target: Readonly<Vec3>, dt: number): void {
    fielder.target  = target instanceof Vec3 ? target : new Vec3(target.x, target.y, target.z);
    fielder.chasing = true;

    const dx   = target.x - fielder.position.x;
    const dz   = target.z - fielder.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.08) return;   // already there

    const step  = (fielder.speed || DEFAULT_SPEED) * dt;
    const ratio = Math.min(step / dist, 1);
    fielder.position.x += dx * ratio;
    fielder.position.z += dz * ratio;
  }

  /**
   * Move ALL fielders in the array toward the ball's current position
   * (used after ball has stopped and fielders retrieve it).
   */
  chasingUpdate(
    fielders: FielderAgent[],
    _ballPos: Readonly<Vec3>,
    dt:       number,
  ): void {
    for (const f of fielders) {
      if (f.chasing && f.target) {
        this.stepFielderToward(f, f.target, dt);
      }
    }
  }

  /** Stop a fielder — clears chase state. */
  stopFielder(fielder: FielderAgent): void {
    fielder.chasing = false;
    fielder.target  = null;
  }

  /** Stop all fielders. */
  resetAll(fielders: FielderAgent[]): void {
    for (const f of fielders) this.stopFielder(f);
  }

  /**
   * Build FielderAgent entries from world slot positions.
   * Call once at scene construction.
   */
  static buildAgents(
    slots: ReadonlyArray<{ x: number; z: number; name: string }>,
    speed       = DEFAULT_SPEED,
    catchRadius = DEFAULT_CATCH_RADIUS,
  ): FielderAgent[] {
    return slots.map((s, i) => ({
      id:          i,
      position:    new Vec3(s.x, 0, s.z),
      speed,
      catchRadius,
      chasing:     false,
      target:      null,
    }));
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Deterministic catch probability from distance + feasibility.
   *
   *   < 2 m from landing → 92%
   *   < 5 m              → 70%
   *   ≥ 5 m              → 35%
   *   Not feasible       →  0%
   *
   * Seeded RNG adds ±7.5% variance so adjacent deliveries differ slightly.
   */
  private _catchProb(
    dist:        number,
    canIntercept: boolean,
    rng:          () => number,
  ): number {
    if (!canIntercept) return 0;
    const base = dist < 2 ? 0.92 : dist < 5 ? 0.70 : 0.35;
    const noise = (rng() - 0.5) * 0.15;
    return Math.min(1, Math.max(0, base + noise));
  }
}
