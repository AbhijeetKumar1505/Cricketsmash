/**
 * FieldingController — per-fielder layered procedural motion.
 *
 * Phase pipeline (derived from engine snapshot + game events):
 *
 *   idle      → role-specific stance (stanceClass 0–3) + breathing sway + stochastic micro-events
 *   alert     → additive overlay during bowler run-up: deeper crouch, forward lean, hands ready
 *   chase     → run cycle with direction-aware lateral lean + speed ramp-up
 *   gather    → progressive spine bend, both hands reach ground
 *   throw     → sub-phases after gather: wind → release → follow (purely visual — engine moves the ball)
 *   celebrate → arms up, chest back — fires on wicket (triggerCelebrate)
 *   react     → mild forward slump — fires on big hit (triggerReact)
 *
 * Rig rules (Meshy AI GLB, feedback.md):
 *   - Only addRot, never setRot — AnimationBrain writes bind-pose base via setRot before calling here.
 *   - Never freeze() / pose() / setRate.
 *   - Neck excluded from head-tracking fraction (local Y ≠ world yaw).
 *
 * stanceClass mapping (from worldLayout.fielderStanceClassForName):
 *   0 = close/crouch   (slip, gully, short_leg)
 *   1 = athletic        (point, cover)
 *   2 = deep/relaxed    (deep fielders)
 *   3 = lean            (mid-on, square_leg)
 */

import type { EngineSnapshot } from '../../engine/GameEngine.js';
import type { Personality } from './personality.js';
import type { BoneAccumulator } from './BoneAccumulator.js';
import { lerp } from './poses.js';

const PI = Math.PI;

// ── Phase timing constants ────────────────────────────────────────────────────
const GATHER_DUR       = 0.30;   // seconds to complete the gather bend
const DIVE_BLEND       = 0.10;   // blend from chase → dive
const THROW_WIND_DUR   = 0.28;   // wind-up duration after gather
const THROW_REL_DUR    = 0.14;   // throw release burst
const THROW_FOLLOW_DUR = 0.35;   // follow-through decay

const ALERT_IN_TAU     = 0.55;   // seconds to reach full alert blend from idle
const ALERT_OUT_TAU    = 0.80;   // seconds to decay back to idle
const CHASE_RAMP_DUR   = 0.30;   // seconds from idle to full chase intensity

const CELEBRATE_DUR    = 1.50;   // seconds to hold celebration pose
const REACT_DUR        = 0.85;   // seconds to hold boundary-reaction pose

// ── Context passed from AnimationBrain each frame ─────────────────────────────
export interface FieldingContext {
  /** 0=close/crouch 1=athletic 2=deep/relaxed 3=lean — from worldLayout */
  stanceClass:  number;
  /** BowlerFSM phase string — drives alert blend */
  bowlerPhase:  string;
}

export class FieldingController {
  // Per-fielder timers — each fielder has its own elapsed time to avoid N×dt-per-frame bug
  private readonly _times     = new Map<number, number>();
  private readonly _prevPhase = new Map<number, string>();
  private readonly _gatherAt  = new Map<number, number>();
  private readonly _diveAt    = new Map<number, number>();
  private readonly _chaseAt   = new Map<number, number>();  // for ramp-up
  private readonly _alertBlend = new Map<number, number>(); // 0→1 blend into alert

  // Celebration / react state
  private readonly _celebrateAt = new Map<number, number>();
  private readonly _reactAt     = new Map<number, number>();
  private _celebratePending = false;
  private _reactPending     = false;

  // Stochastic micro-event per-fielder next-fire times
  private readonly _microNextAt = new Map<number, number>();
  private readonly _microKind   = new Map<number, number>(); // 0=weightShift 1=glance

  reset(): void {
    this._times.clear();
    this._prevPhase.clear();
    this._gatherAt.clear();
    this._diveAt.clear();
    this._chaseAt.clear();
    this._alertBlend.clear();
    this._celebrateAt.clear();
    this._reactAt.clear();
    this._celebratePending = false;
    this._reactPending     = false;
    this._microNextAt.clear();
    this._microKind.clear();
  }

  /** Called from AnimationBrain when a wicket is detected. Sets celebrate for all active fielders. */
  triggerCelebrate(): void {
    this._celebratePending = true;
    this._reactPending     = false;
    for (const [idx, t] of this._times) {
      this._celebrateAt.set(idx, t);
      this._reactAt.delete(idx);
    }
  }

  /** Called from AnimationBrain when a clean hit/boundary is detected. */
  triggerReact(): void {
    this._reactPending     = true;
    this._celebratePending = false;
    for (const [idx, t] of this._times) {
      this._reactAt.set(idx, t);
      this._celebrateAt.delete(idx);
    }
  }

  update(
    fielderIdx: number,
    snap: EngineSnapshot,
    dt: number,
    acc: BoneAccumulator,
    fielderX: number,
    fielderZ: number,
    ballX: number,
    ballZ: number,
    personality: Personality,
    ctx: FieldingContext,
  ): void {
    const t = (this._times.get(fielderIdx) ?? 0) + dt;
    this._times.set(fielderIdx, t);

    const fState = snap.fielders[fielderIdx];
    const currentPhase = fState?.phase ?? 'idle';
    const prev = this._prevPhase.get(fielderIdx) ?? '';
    this._prevPhase.set(fielderIdx, currentPhase);

    // Pending celebrate/react — latch start time for fielders not yet seen
    if (this._celebratePending && !this._celebrateAt.has(fielderIdx)) {
      this._celebrateAt.set(fielderIdx, t);
    }
    if (this._reactPending && !this._reactAt.has(fielderIdx)) {
      this._reactAt.set(fielderIdx, t);
    }

    if (!fState) return;

    // ── Alert blend — ramps up when bowler is in active delivery phases ───────
    const isAlert = ctx.bowlerPhase === 'RUN_UP'
      || ctx.bowlerPhase === 'GATHER'
      || ctx.bowlerPhase === 'ARM_SWING';
    let alertBlend = this._alertBlend.get(fielderIdx) ?? 0;
    alertBlend = isAlert
      ? Math.min(1, alertBlend + dt / ALERT_IN_TAU)
      : Math.max(0, alertBlend - dt / ALERT_OUT_TAU);
    this._alertBlend.set(fielderIdx, alertBlend);

    // ── Celebrate / react override ────────────────────────────────────────────
    const celebStart = this._celebrateAt.get(fielderIdx);
    const reactStart  = this._reactAt.get(fielderIdx);
    const celebElapsed = celebStart !== undefined ? t - celebStart : 999;
    const reactElapsed  = reactStart  !== undefined ? t - reactStart  : 999;

    if (celebElapsed < CELEBRATE_DUR) {
      this._celebrate(acc, fielderIdx, t, celebElapsed, personality);
      return;
    }
    if (reactElapsed < REACT_DUR) {
      this._react(acc, reactElapsed, personality);
      return;
    }

    // ── Phase dispatch ────────────────────────────────────────────────────────
    switch (currentPhase) {
      case 'idle':
        this._idle(acc, fielderIdx, t, personality, ctx.stanceClass);
        if (alertBlend > 0.01) this._applyAlert(acc, fielderIdx, t, alertBlend, ctx.stanceClass, personality);
        break;

      case 'chase': {
        if (prev !== 'chase') this._chaseAt.set(fielderIdx, t);
        const chaseDur = t - (this._chaseAt.get(fielderIdx) ?? t);
        const ramp = Math.min(1, chaseDur / CHASE_RAMP_DUR);
        const dx = ballX - fielderX;
        const dz = ballZ - fielderZ;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.5) {
          if (prev !== 'chase') this._diveAt.set(fielderIdx, t);
          this._dive(acc, fielderIdx, t, personality, prev);
        } else {
          this._chase(acc, fielderIdx, t, dx, dz, dist, ramp, personality);
        }
        break;
      }

      case 'gather': {
        if (prev !== 'gather') this._gatherAt.set(fielderIdx, t);
        const gatherT = t - (this._gatherAt.get(fielderIdx) ?? t);
        this._dispatchGather(acc, gatherT, personality);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IDLE — straight standing idle, arms at bind pose (no arm addRot)
  // Body: breathing sway on hips/chest + minimal leg stance.
  // Arms: intentionally zero — bind pose defines the rest position.
  // ─────────────────────────────────────────────────────────────────────────────

  private _idle(
    acc: BoneAccumulator,
    idx: number,
    t: number,
    pers: Personality,
    _stanceClass: number,
  ): void {
    const phase  = t + idx * 0.83;
    const bob    = pers.bob;
    const sway   = Math.sin(phase * 1.5) * 0.04 * bob;
    const breath = Math.sin(phase * 1.3) * 0.012 * bob;

    // Subtle hip sway + breathing chest rise
    acc.addRot('hips',  0, 0, sway);
    acc.addRot('chest', breath, 0, 0);
    acc.addRot('spine', breath * 0.5, 0, 0);

    // Small root bob (vertical)
    acc.addPos('hips', 0, -Math.abs(Math.sin(phase * 1.1)) * 0.008 * bob, 0);

    // Stochastic micro-events: weight-shift or head-glance
    this._microEvent(acc, idx, t, pers);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MICRO-EVENTS — stochastic weight-shift / head-glance during idle
  // ─────────────────────────────────────────────────────────────────────────────

  private _microEvent(acc: BoneAccumulator, idx: number, t: number, pers: Personality): void {
    const nextAt = this._microNextAt.get(idx);
    if (nextAt === undefined) {
      // Schedule first event with a fielder-specific offset so they don't all fire at once
      this._microNextAt.set(idx, t + 4 + (idx * 0.77) % 5);
      return;
    }
    if (t < nextAt) return;

    // Decide kind (0 = weight-shift, 1 = glance) and next fire time
    const kind = this._microKind.get(idx) ?? (idx % 2);
    this._microKind.set(idx, 1 - kind);  // alternate
    const nextInterval = 3.5 + (idx * 1.31 + t * 0.17) % 4.5;  // 3.5–8s
    this._microNextAt.set(idx, t + nextInterval);

    const microT = (t - nextAt);  // time since event started
    const microDur = kind === 0 ? 0.50 : 0.40;
    if (microT > microDur) return;  // event finished, wait for next

    const p = Math.min(1, microT / microDur);
    const bump = Math.sin(p * PI);  // bell curve 0→0

    if (kind === 0) {
      // Weight-shift: hip tilt side to side
      const side = (idx % 2 === 0) ? 1 : -1;
      acc.addRot('hips', 0, 0, side * 0.10 * bump * pers.bob);
      acc.addRot('spine', 0, 0, -side * 0.06 * bump);
    } else {
      // Head glance: turn head left or right briefly
      const side = (Math.floor(t * 0.3 + idx) % 2 === 0) ? 1 : -1;
      acc.addRot('head', 0, side * 0.30 * bump, 0);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ALERT — additive overlay during bowler run-up
  // Deeper crouch, forward lean, arms lowered ready
  // ─────────────────────────────────────────────────────────────────────────────

  private _applyAlert(
    acc: BoneAccumulator,
    _idx: number,
    _t: number,
    blend: number,
    stanceClass: number,
    _pers: Personality,
  ): void {
    const e = blend * blend * (3 - 2 * blend);  // smoothstep

    // Additional forward lean from hips + spine
    const crouchExtra = stanceClass === 0 ? 0.08 : 0.14;  // close fielders already crouched
    acc.addRot('hips',  -crouchExtra * e, 0, 0);
    acc.addRot('spine',  0.10 * e, 0, 0);
    acc.addRot('chest',  0.06 * e, 0, 0);

    // Arms drop slightly (hands lower, more "ready")
    acc.addRot('rightArm', 0.10 * e, 0, 0);
    acc.addRot('leftArm',  0.10 * e, 0, 0);
    acc.addRot('rightForeArm', 0.08 * e, 0, 0);
    acc.addRot('leftForeArm',  0.08 * e, 0, 0);

    // Slight weight-forward knee bend
    const kb = stanceClass === 0 ? 0.04 : 0.08;
    acc.addRot('leftUpLeg',  -kb * e, 0, 0);
    acc.addRot('rightUpLeg', -kb * e, 0, 0);
    acc.addRot('leftLeg',     kb * 1.4 * e, 0, 0);
    acc.addRot('rightLeg',    kb * 1.4 * e, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHASE — run cycle with direction-aware lean and intensity ramp
  // ─────────────────────────────────────────────────────────────────────────────

  private _chase(
    acc: BoneAccumulator,
    idx: number,
    t: number,
    dx: number,
    dz: number,
    dist: number,
    ramp: number,        // 0→1 over first CHASE_RAMP_DUR seconds
    pers: Personality,
  ): void {
    // Slow down within 2.5m of the ball
    const distIntensity = dist < 2.5 ? Math.max(0.35, dist / 2.5) : 1.0;
    const intensity = ramp * distIntensity;

    const runFreq  = 6.0 * pers.speed;
    const phase    = t * runFreq + idx * 0.31;
    const armSwing = Math.sin(phase) * 0.65 * intensity * pers.power;
    const legSwing = Math.sin(phase + PI) * 0.85 * intensity;

    // Direction-aware lateral lean — lean body in the run direction
    // (dx,dz) is the vector toward the ball; normalise and apply a lateral spine tilt.
    const dirLen = Math.hypot(dx, dz);
    const lateralLean = dirLen > 0.01 ? (dx / dirLen) * 0.14 * intensity : 0;

    // Forward lean + lateral lean
    acc.addRot('hips',  0.10 * intensity, 0, lateralLean * 0.5);
    acc.addRot('spine', 0.20 * intensity, 0, lateralLean);
    acc.addRot('chest', 0.08 * intensity, 0, lateralLean * 0.5);

    // Arms swing opposite to legs
    acc.addRot('rightArm', -armSwing, 0, 0);
    acc.addRot('leftArm',   armSwing, 0, 0);
    acc.addRot('rightForeArm', Math.abs(armSwing) * 0.45, 0, 0);
    acc.addRot('leftForeArm',  Math.abs(armSwing) * 0.45, 0, 0);

    // Leg alternation
    acc.addRot('rightUpLeg',  legSwing, 0, 0);
    acc.addRot('leftUpLeg',  -legSwing, 0, 0);
    acc.addRot('rightLeg', Math.max(0,  legSwing) * 0.85, 0, 0);
    acc.addRot('leftLeg',  Math.max(0, -legSwing) * 0.85, 0, 0);

    // Vertical hip bounce
    acc.addPos('hips', 0, Math.abs(Math.sin(phase)) * 0.04 * intensity, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DIVE — asymmetric lunge when fielder reaches ball
  // ─────────────────────────────────────────────────────────────────────────────

  private _dive(
    acc: BoneAccumulator,
    idx: number,
    t: number,
    pers: Personality,
    prevPhase: string,
  ): void {
    const blendT = prevPhase === 'chase'
      ? Math.min((t - (this._diveAt.get(idx) ?? t)) / DIVE_BLEND, 1)
      : 1;
    const easeB = blendT * (2 - blendT);

    acc.addRot('hips',  0.30 * easeB, 0, 0.40 * easeB);
    acc.addRot('spine', 0.35 * easeB, 0, 0.20 * easeB);
    acc.addRot('chest', 0.25 * easeB, 0, 0.10 * easeB);
    const p = pers.power;
    acc.addRot('rightArm', -1.50 * p * easeB, 0, -0.30 * easeB);
    acc.addRot('leftArm',  -1.50 * p * easeB, 0,  0.30 * easeB);
    acc.addRot('rightForeArm', 0.40 * easeB, 0, 0);
    acc.addRot('leftForeArm',  0.40 * easeB, 0, 0);
    acc.addRot('leftUpLeg',  -0.40 * easeB, 0,  0.25 * easeB);
    acc.addRot('rightUpLeg',  0.60 * easeB, 0, -0.10 * easeB);
    acc.addRot('rightLeg',    0.45 * easeB, 0, 0);
    acc.addRot('head', 0.10 * easeB, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GATHER sub-phases — bend down → throw wind → release → follow-through
  // ─────────────────────────────────────────────────────────────────────────────

  private _dispatchGather(acc: BoneAccumulator, gatherElapsed: number, pers: Personality): void {
    if (gatherElapsed < GATHER_DUR) {
      this._gather(acc, gatherElapsed / GATHER_DUR, pers);
    } else if (gatherElapsed < GATHER_DUR + THROW_WIND_DUR) {
      this._throwWind(acc, (gatherElapsed - GATHER_DUR) / THROW_WIND_DUR, pers);
    } else if (gatherElapsed < GATHER_DUR + THROW_WIND_DUR + THROW_REL_DUR) {
      this._throwRelease(acc, (gatherElapsed - GATHER_DUR - THROW_WIND_DUR) / THROW_REL_DUR, pers);
    } else {
      const followT = Math.min(1, (gatherElapsed - GATHER_DUR - THROW_WIND_DUR - THROW_REL_DUR) / THROW_FOLLOW_DUR);
      this._throwFollow(acc, followT, pers);
    }
  }

  /** Gather: bend down, both hands reach ground, head down. */
  private _gather(acc: BoneAccumulator, t: number, pers: Personality): void {
    const crouch = pers.stanceCrouch;
    const p      = pers.power;
    acc.addRot('hips',  0.30 * crouch * t, 0, 0);
    acc.addRot('spine', lerp(0.06, 0.55, t) * crouch, 0, 0);
    acc.addRot('chest', 0.20 * crouch * t, 0, 0);
    const armReach = lerp(0.80, 1.20, t);
    acc.addRot('rightArm', -armReach * p, 0, -0.04 * t);
    acc.addRot('leftArm',  -armReach * p, 0,  0.04 * t);
    acc.addRot('rightForeArm', 0.35 * t, 0,  0.08 * t);
    acc.addRot('leftForeArm',  0.35 * t, 0, -0.08 * t);
    acc.addRot('rightHand', 0.20 * t, 0,  0.12 * t);
    acc.addRot('leftHand',  0.20 * t, 0, -0.12 * t);
    acc.addRot('rightUpLeg', -0.40 * crouch * t, 0, 0);
    acc.addRot('leftUpLeg',  -0.40 * crouch * t, 0, 0);
    acc.addRot('rightLeg',    0.75 * crouch * t, 0, 0);
    acc.addRot('leftLeg',     0.75 * crouch * t, 0, 0);
    acc.addRot('head', 0.40 * t, 0, 0);
  }

  /**
   * Throw wind-up: right arm sweeps back and up (high elbow), left arm
   * counter-balances forward. Body coils — hip rotates away from throw side.
   */
  private _throwWind(acc: BoneAccumulator, t: number, pers: Personality): void {
    const e = t * t * (3 - 2 * t);  // smoothstep
    const p = pers.power;

    // Body straightens from gather, coils into throw
    acc.addRot('hips',   0.10 * e, 0.25 * e, 0);   // slight hip rotation (coil)
    acc.addRot('spine',  0.18 * e, 0.20 * e, 0);   // torso rotates with hips
    acc.addRot('chest',  0.10 * e, 0.15 * e, 0);

    // Right arm: sweep back behind the head — shoulder up and back
    acc.addRot('rightArm',     -1.10 * p * e, 0.30 * e, -0.20 * e);
    acc.addRot('rightForeArm',  0.80 * e, 0, 0);    // elbow flexed high
    acc.addRot('rightHand',     0.10 * e, 0, 0);

    // Left arm: extends forward for balance
    acc.addRot('leftArm',       0.60 * p * e, 0, 0.25 * e);
    acc.addRot('leftForeArm',   0.20 * e, 0, 0);
    acc.addRot('leftHand',     -0.10 * e, 0, 0);

    // Legs adjust weight
    acc.addRot('rightUpLeg',   -0.15 * e, 0, 0);
    acc.addRot('leftUpLeg',    -0.08 * e, 0, 0);
  }

  /**
   * Throw release: explosive forward arm sweep, hip/spine uncoil.
   * This is the fastest sub-phase — t=0 is wind-up peak, t=1 is arm at release.
   */
  private _throwRelease(acc: BoneAccumulator, t: number, pers: Personality): void {
    // Use 1-t so we go from wind-up (t=0) back through neutral toward follow
    const e = t * t;  // ease-in so release is snappy
    const p = pers.power;

    // Uncoil: hip and spine rotate hard through
    acc.addRot('hips',  0.10 * (1 - e) + (-0.05 * e), 0.25 * (1 - e) + (-0.15 * e), 0);
    acc.addRot('spine', 0.18 * (1 - e) + (-0.10 * e), 0.20 * (1 - e) + (-0.20 * e), 0);
    acc.addRot('chest', 0.10 * (1 - e) + (-0.05 * e), 0.15 * (1 - e) + (-0.15 * e), 0);

    // Right arm: sweeps forward and down through release
    acc.addRot('rightArm',     -1.10 * p * (1 - e) + 0.60 * p * e, 0.30 * (1 - e), -0.20 * (1 - e));
    acc.addRot('rightForeArm',  0.80 * (1 - e) + (-0.10 * e), 0, 0);
    acc.addRot('rightHand',     0.10 * (1 - e) + (-0.20 * e), 0, 0);

    // Left arm: pulls back as right arm fires
    acc.addRot('leftArm',  0.60 * p * (1 - e) + (-0.40 * p * e), 0, 0.25 * (1 - e));
    acc.addRot('leftForeArm', 0.20 * (1 - e), 0, 0);
  }

  /**
   * Throw follow-through: arm swings across body and decays back toward idle.
   */
  private _throwFollow(acc: BoneAccumulator, t: number, pers: Personality): void {
    // t=0 = post-release, t=1 = returning to idle
    const decay = 1 - t * t;  // quadratic ease-out back to zero
    const p = pers.power;

    // Hip/spine return to neutral
    acc.addRot('hips',  -0.05 * decay, -0.15 * decay, 0);
    acc.addRot('spine', -0.10 * decay, -0.20 * decay, 0);
    acc.addRot('chest', -0.05 * decay, -0.15 * decay, 0);

    // Right arm sweeps down and across body
    acc.addRot('rightArm',    0.60 * p * decay, 0, 0.35 * decay);  // across body
    acc.addRot('rightForeArm', -0.10 * decay, 0, 0);
    acc.addRot('rightHand',    -0.20 * decay, 0, 0);

    // Left arm settles back
    acc.addRot('leftArm',     -0.40 * p * decay, 0, 0);
    acc.addRot('leftForeArm',  0.10 * decay, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CELEBRATE — arms up, chest back, light bounce. Fires on wicket.
  // ─────────────────────────────────────────────────────────────────────────────

  private _celebrate(
    acc: BoneAccumulator,
    _idx: number,
    _t: number,
    elapsed: number,
    pers: Personality,
  ): void {
    const p = pers.reactionFlair;

    // Phases: rise (0–0.20s), hold (0.20–1.10s), decay (1.10–1.50s)
    const RISE  = 0.20;
    const HOLD  = 1.10;

    let weight: number;
    if (elapsed < RISE) {
      weight = elapsed / RISE;
    } else if (elapsed < HOLD) {
      weight = 1.0;
    } else {
      weight = 1 - (elapsed - HOLD) / (CELEBRATE_DUR - HOLD);
    }
    weight = Math.max(0, Math.min(1, weight));
    const e = weight * weight * (3 - 2 * weight);  // smoothstep

    // Arms shoot up and spread wide
    acc.addRot('rightArm', -1.35 * p * e, 0, -0.55 * e);
    acc.addRot('leftArm',  -1.35 * p * e, 0,  0.55 * e);
    acc.addRot('rightForeArm', -0.20 * e, 0, 0);
    acc.addRot('leftForeArm',  -0.20 * e, 0, 0);

    // Chest extends back (triumphant arch)
    acc.addRot('chest', -0.20 * e, 0, 0);
    acc.addRot('spine', -0.10 * e, 0, 0);
    acc.addRot('hips',   0.05 * e, 0, 0);

    // Head tilts back slightly
    acc.addRot('head', -0.15 * e, 0, 0);

    // Excited bounce during hold phase (lighter than chest-pumping)
    if (elapsed >= RISE && elapsed < HOLD) {
      const holdPhase = (elapsed - RISE) / (HOLD - RISE);
      const bounce = Math.sin(holdPhase * PI * 4) * 0.05 * p;
      acc.addPos('hips', 0, bounce, 0);
      // Small side-to-side sway while arms are up
      acc.addRot('spine', 0, 0, Math.sin(holdPhase * PI * 3) * 0.06 * p);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REACT — mild slump forward after a boundary. Fires on clean hit.
  // ─────────────────────────────────────────────────────────────────────────────

  private _react(acc: BoneAccumulator, elapsed: number, _pers: Personality): void {
    const RISE  = 0.15;
    const HOLD  = 0.55;

    let weight: number;
    if (elapsed < RISE) {
      weight = elapsed / RISE;
    } else if (elapsed < HOLD) {
      weight = 1.0;
    } else {
      weight = 1 - (elapsed - HOLD) / (REACT_DUR - HOLD);
    }
    weight = Math.max(0, Math.min(1, weight));
    const e = weight;

    // Mild forward slump
    acc.addRot('spine', 0.15 * e, 0, 0);
    acc.addRot('chest', 0.10 * e, 0, 0);
    acc.addRot('hips',  0.06 * e, 0, 0);

    // Arms hang loose (slightly forward, down)
    acc.addRot('rightArm', 0.12 * e, 0, 0);
    acc.addRot('leftArm',  0.12 * e, 0, 0);

    // Head slightly down
    acc.addRot('head', 0.12 * e, 0, 0);
  }
}
