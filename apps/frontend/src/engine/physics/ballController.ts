/**
 * ballController.ts — Ball state machine + fixed-step physics integration.
 *
 * Owns:
 *   • BallBody  (position, velocity, spin, state)
 *   • PhysicsAccumulator  (converts variable-dt frames → fixed FIXED_DT steps)
 *   • Bounce/ground collision (restitution + friction)
 *   • Landing prediction (updated after each bounce)
 *
 * Usage:
 *   const ball = new BallController(rng);
 *   ball.launch(launchPos, 22.0, Math.PI/5, forwardDir);
 *   // each frame:
 *   ball.updateFrame(realDt);
 *   // on hit:
 *   ball.applyImpulse(hitVelocity);
 */

import {
  Vec3,
  GRAVITY,
  PhysicsAccumulator,
  semiImplicitEuler,
} from './physics.js';
import { TrajectorySolver } from './trajectorySolver.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BallState = 'idle' | 'airborne' | 'bounced' | 'hit' | 'stopped';
export type BallTrajectoryMode = 'result_driven' | 'parabolic' | 'drag';

export interface BallBody {
  readonly position:    Vec3;
  readonly velocity:    Vec3;
  readonly spin:        Vec3;     // accumulated rotation (radians)
  readonly acceleration: Vec3;   // always (0, -g, 0) unless drag mode
  state:        BallState;
  bounceCount:  number;
  elapsedTime:  number;   // seconds since launch / applyImpulse
}

export interface BallPhysicsConfig {
  /** Coefficient of restitution on ground bounce. e = 0.75–0.85. */
  restitution:  number;
  /** Horizontal speed retention on ground contact. 0.85–0.95. */
  friction:     number;
  /** Ball radius (metres). Used for ground collision plane. */
  radius:       number;
  /** Linear drag coefficient. 0 = no drag (default). */
  dragK:        number;
  /** Which trajectory mode to use for launch(). */
  mode:         BallTrajectoryMode;
}

const DEFAULT_CFG: BallPhysicsConfig = {
  restitution: 0.80,
  friction:    0.90,
  radius:      0.036,
  dragK:       0.0,
  mode:        'result_driven',
};

/** vy below which bounce turns into roll (→ stopped eventually). */
const STOP_VY      = 0.5;
/** After MAX_BOUNCES, ball rolls flat. */
const MAX_BOUNCES  = 8;
/** Horizontal speed below which we consider ball stopped. */
const STOP_H_SPEED = 0.12;

// ── BallController ────────────────────────────────────────────────────────────

export class BallController {
  readonly body: BallBody;

  private readonly acc:     PhysicsAccumulator;
  private readonly solver:  TrajectorySolver;
  private          cfg:     BallPhysicsConfig;
  private          _rng:    () => number;
  private          _landing: Vec3 | null = null;

  constructor(rng: () => number, config: Partial<BallPhysicsConfig> = {}) {
    this._rng   = rng;
    this.cfg    = { ...DEFAULT_CFG, ...config };
    this.acc    = new PhysicsAccumulator();
    this.solver = new TrajectorySolver();

    this.body = {
      position:     new Vec3(0, 1.8, -9),
      velocity:     new Vec3(),
      spin:         new Vec3(),
      acceleration: new Vec3(0, -GRAVITY, 0),
      state:        'idle',
      bounceCount:  0,
      elapsedTime:  0,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Launch the ball from `launchPos` toward `forwardDir`.
   * Uses RESULT_DRIVEN mode by default — landing is guaranteed at targetRange.
   *
   * @param launchPos    World position of ball at release
   * @param targetRange  Intended landing distance (metres) — controls speed
   * @param angle        Launch elevation angle (radians, 0 = horizontal)
   * @param forwardDir   Unit vector in XZ toward target (normalised)
   * @param config       Optional per-shot physics overrides
   */
  launch(
    launchPos:   Readonly<Vec3>,
    targetRange: number,
    angle:       number,
    forwardDir:  Readonly<Vec3>,
    config?:     Partial<BallPhysicsConfig>,
  ): void {
    if (config) this.cfg = { ...this.cfg, ...config };

    this.body.position.copy(launchPos);
    this.body.spin.zero();
    this.body.bounceCount  = 0;
    this.body.elapsedTime  = 0;

    // Solve initial velocity using result-driven kinematics
    const result = this.solver.resultDriven(targetRange, angle, launchPos, forwardDir);
    this.body.velocity.copy(result.initialVelocity);

    // Deterministic lateral jitter (seeded, not random)
    const jitter = (this._rng() - 0.5) * 0.35;
    this.body.velocity.x += jitter;

    this.body.acceleration.set(0, this.cfg.dragK > 0 ? 0 : -GRAVITY, 0);
    this.body.state   = 'airborne';
    this._landing     = result.landingPoint;
    this.acc.reset();
  }

  /**
   * Apply a velocity impulse (e.g. bat contact).
   * Ball state → 'hit'; landing prediction recomputed.
   */
  applyImpulse(impulse: Readonly<Vec3>): void {
    this.body.velocity.add(impulse);
    this.body.state       = 'hit';
    this.body.elapsedTime = 0;
    this._landing = this.solver.predictLanding(this.body.position, this.body.velocity);
    this.acc.reset();
  }

  /**
   * Advance physics. Call once per render frame with real wall-clock dt.
   * Internally steps at FIXED_DT (1/60 s) via the accumulator.
   */
  updateFrame(realDt: number): void {
    if (this.body.state === 'idle' || this.body.state === 'stopped') return;
    this.acc.update(realDt, (dt) => this._physicsStep(dt));
  }

  /** Hard stop — zero velocity, mark stopped. */
  stop(): void {
    this.body.velocity.zero();
    this.body.state = 'stopped';
  }

  /** Reset to idle at given world position. */
  reset(startPos: Readonly<Vec3>): void {
    this.body.position.copy(startPos);
    this.body.velocity.zero();
    this.body.spin.zero();
    this.body.acceleration.set(0, -GRAVITY, 0);
    this.body.state       = 'idle';
    this.body.bounceCount = 0;
    this.body.elapsedTime = 0;
    this._landing         = null;
    this.acc.reset();
  }

  /** Swap the seeded RNG (called at start of each new ball). */
  setRNG(rng: () => number): void { this._rng = rng; }

  /** Update physics config without recreating the controller. */
  configure(config: Partial<BallPhysicsConfig>): void {
    this.cfg = { ...this.cfg, ...config };
  }

  /** Last computed landing prediction (updated after each bounce). */
  get predictedLanding(): Vec3 | null { return this._landing; }

  get isStopped():  boolean { return this.body.state === 'stopped'; }
  get isAirborne(): boolean { return this.body.state === 'airborne' || this.body.state === 'hit'; }

  // ── Private: fixed-step physics ──────────────────────────────────────────────

  private _physicsStep(dt: number): void {
    const { position: pos, velocity: vel, acceleration: acc } = this.body;

    this.body.elapsedTime += dt;

    if (this.cfg.dragK > 0) {
      // Drag mode: apply horizontal drag + gravity separately
      this.solver.applyDrag(vel, this.cfg.dragK, dt);
      // Semi-implicit: pos += vel*dt (vel already updated by applyDrag)
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;
    } else {
      // Standard: semi-implicit Euler (gravity via acceleration)
      acc.set(0, -GRAVITY, 0);
      semiImplicitEuler(pos, vel, acc, dt);
    }

    // Spin accumulates proportional to ball speed
    const spd = vel.length();
    this.body.spin.x += spd * dt * 4.0;
    this.body.spin.z -= spd * dt * 2.0;

    // Ground collision
    this._handleGround();
  }

  private _handleGround(): void {
    const floor = this.cfg.radius;
    if (this.body.position.y > floor) return;

    // Clamp to ground surface
    this.body.position.y = floor;

    const absVy   = Math.abs(this.body.velocity.y);
    const hSpeed  = this.body.velocity.lengthXZ();
    const tooMany = this.body.bounceCount >= MAX_BOUNCES;

    if (absVy < STOP_VY || tooMany) {
      // Energy exhausted — ball rolls/stops
      this.body.velocity.y   = 0;
      this.body.velocity.x  *= this.cfg.friction;
      this.body.velocity.z  *= this.cfg.friction;
      if (hSpeed * this.cfg.friction < STOP_H_SPEED) {
        this.stop();
      }
    } else {
      // Bounce: vy inverted with restitution, horizontal friction
      this.body.velocity.y   = Math.abs(this.body.velocity.y) * this.cfg.restitution;
      this.body.velocity.x  *= this.cfg.friction;
      this.body.velocity.z  *= this.cfg.friction;
      this.body.bounceCount += 1;
      this.body.state        = 'bounced';

      // Update landing prediction with post-bounce velocity
      this._landing = this.solver.predictLanding(this.body.position, this.body.velocity);
    }
  }
}

// ── Bounce-height helper (informational) ─────────────────────────────────────

/**
 * Compute the n-th bounce peak height given initial drop height and restitution.
 *   h_n = e^(2n) * h0
 * Matches the formula from the research report.
 */
export function bounceHeight(h0: number, e: number, n: number): number {
  return Math.pow(e, 2 * n) * h0;
}
