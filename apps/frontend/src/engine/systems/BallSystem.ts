import { WORLD, BALL } from '../constants.js';
import type { HitQuality, BowlerType } from '../events/EventBus.js';
import type { OutcomeBucket } from '../rng/OutcomeSystem.js';
import type { ShotResult } from '../rng/OutcomeSystem.js';

// ── Data types ────────────────────────────────────────────────────────────────

export interface BowlParams {
  bowlerType: BowlerType;
  /** Seconds for the ball to travel from RELEASE_Z to BATSMAN_Z. */
  hitTime: number;
  outcome: 'hit' | 'wicket';
  bucket: OutcomeBucket;
}

export interface BallData {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Seconds elapsed since bowl() was called. Updated only in pre-hit phase. */
  elapsed: number;
  /** Rotation angles accumulated from spin. */
  rx: number; ry: number; rz: number;
  params: BowlParams | null;
  active: boolean;
  predictedLanding: { x: number; z: number } | null;
  bounce: number;
  groundFriction: number;
}

// ── Pre-hit trajectory (deterministic Bezier) ─────────────────────────────────
//
// We use a quadratic Bezier curve so the endpoint (P2) is guaranteed:
//   B(n) = (1-n)²·P0 + 2(1-n)n·P1 + n²·P2
//
// At n = 1:  B(1) = P2  (batsman contact zone) ← the invariant
// At n = 0:  B(0) = P0  (release point)
//
// Z is interpolated linearly (no curve needed — determinism is all that matters).
// Y uses the Bezier arc so the ball rises and falls naturally.
// X encodes lateral swing / spin drift via a sine envelope on n.

function quadBezier(n: number, p0: number, p1: number, p2: number): number {
  const inv = 1 - n;
  return inv * inv * p0 + 2 * inv * n * p1 + n * n * p2;
}

function computePreHitPosition(
  elapsed: number,
  params: BowlParams,
): { x: number; y: number; z: number } {
  // n is normalised time: 0 at release, 1 exactly at hitTime (BATSMAN_Z)
  const n = Math.min(elapsed / params.hitTime, 1);

  // ── Z: linear lerp ensures ball == BATSMAN_Z when n == 1 ─────────────────
  const z = WORLD.RELEASE_Z + n * (WORLD.BATSMAN_Z - WORLD.RELEASE_Z);

  // ── Y: quadratic Bezier arc ───────────────────────────────────────────────
  const bounceExtra = params.bowlerType === 'spin'  ? 1.2
                    : params.bowlerType === 'swing' ? 0.8
                    : 0.5;                                   // fast
  const peakY  = Math.max(WORLD.RELEASE_Y, WORLD.HIT_Y) + bounceExtra;
  const y = quadBezier(n, WORLD.RELEASE_Y, peakY, WORLD.HIT_Y);

  // ── X: lateral movement ───────────────────────────────────────────────────
  // sin(n·π) gives a bell curve: 0 at release, peak at n=0.5, 0 at contact.
  // Swing bowlers move away from the batsman; spin breaks back.
  const amp = params.bowlerType === 'swing' ? 0.55
            : params.bowlerType === 'spin'  ? 0.35
            : 0.08;
  const dir = params.bowlerType === 'spin' ? -1 : 1;
  const x = dir * amp * Math.sin(n * Math.PI);

  return { x, y, z };
}

// ── BallSystem ────────────────────────────────────────────────────────────────

export class BallSystem {
  /** Initialise ball state at the start of a new delivery. */
  bowl(ball: BallData, params: BowlParams): void {
    ball.x       = 0;
    ball.y       = WORLD.RELEASE_Y;
    ball.z       = WORLD.RELEASE_Z;
    ball.vx      = 0;
    ball.vy      = 0;
    ball.vz      = 0;
    ball.rx      = 0;
    ball.ry      = 0;
    ball.rz      = 0;
    ball.elapsed = 0;
    ball.params  = params;
    ball.active  = true;
    ball.predictedLanding = null;
    ball.bounce = BALL.RESTITUTION;
    ball.groundFriction = BALL.FRICTION;
  }

  /**
   * Advance the deterministic pre-hit trajectory.
   * Called each frame while phase === 'bowling' | 'hit_window'.
   */
  updatePreHit(ball: BallData, dt: number): void {
    ball.elapsed += dt;
    const pos = computePreHitPosition(ball.elapsed, ball.params!);
    ball.x = pos.x;
    ball.y = pos.y;
    ball.z = pos.z;
    // Seam rotation accumulates with simulated speed
    ball.rx += BALL.SPIN_RATE * dt;
  }

  /**
   * Assign velocity vectors after a swing.
   * The ball's current position is preserved — physics integration
   * takes over from the next frame onward.
   */
  applyHitVelocity(
    ball: BallData,
    quality: HitQuality,
    bucket: OutcomeBucket,
    shot: ShotResult,
  ): void {
    const profile = BALL.OUTCOME_TRAJECTORIES[bucket];
    const qualityMult = quality === 'perfect' ? 1.08 : quality === 'good' ? 1.0 : 0.85;
    const speed = (10 + shot.power * 15) * qualityMult;
    ball.vx = Math.sin(shot.direction) * speed;
    ball.vy = shot.power * 8 * (quality === 'perfect' ? 1.06 : 1);
    ball.vz = Math.max(2.5, Math.cos(shot.direction) * speed);
    ball.bounce = profile.bounce;
    ball.groundFriction = profile.friction;
    ball.predictedLanding = this.predictLandingPoint(ball);
  }

  /**
   * Physics integration for post-hit phase.
   * Gravity, ground bounce, friction — no scripting.
   */
  updatePostHit(ball: BallData, dt: number): void {
    ball.vy -= BALL.GRAVITY * dt;
    ball.x  += ball.vx * dt;
    ball.y  += ball.vy * dt;
    ball.z  += ball.vz * dt;

    if (ball.y <= BALL.RADIUS) {
      ball.y   = BALL.RADIUS;
      ball.vy  = Math.abs(ball.vy) * ball.bounce;
      ball.vx *= ball.groundFriction;
      ball.vz *= ball.groundFriction;
    }

    // Spin from velocity magnitude
    const spd = Math.sqrt(ball.vx ** 2 + ball.vy ** 2 + ball.vz ** 2);
    ball.rx  += spd * dt * 4;
    ball.rz  -= spd * dt * 2;
  }

  /**
   * True when the ball has reached the batsman contact zone.
   * The small epsilon (0.15) absorbs one-frame dt overshoot.
   */
  isAtBatsman(ball: BallData): boolean {
    return ball.z >= WORLD.BATSMAN_Z - 0.15;
  }

  deactivate(ball: BallData): void {
    ball.active = false;
    ball.predictedLanding = null;
  }

  private predictLandingPoint(ball: BallData): { x: number; z: number } {
    const g = BALL.GRAVITY;
    const h = Math.max(0, ball.y - BALL.RADIUS);
    const vy = ball.vy;
    const disc = Math.max(0, vy * vy + 2 * g * h);
    const t = (vy + Math.sqrt(disc)) / g;
    return {
      x: ball.x + ball.vx * t,
      z: ball.z + ball.vz * t,
    };
  }
}
