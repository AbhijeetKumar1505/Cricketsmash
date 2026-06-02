/**
 * BowlingProtoController — rig migration of the old sprite-based bowling system.
 *
 * The old system drove the bowler with two scalars:
 *   bodyLean   (max 0.15 rad at swing)   — whole-body forward pitch
 *   swingAngle (−1.1 gather → +2.7 FT)  — whole-sprite arm rotation
 *
 * Migration rules:
 *   1. bodyLean distributes across the bone chain, never accumulates:
 *        hips 20%  spine 35%  chest 35%  neck 10%
 *      Max budget (additive on top of staging): hips 8° spine 12° chest 15°
 *      staging already provides the upright base — delivery adds a SMALL delta.
 *
 *   2. swingAngle arc (3.8 rad total) distributes across the arm chain:
 *        shoulder 15%  upper-arm 55%  forearm 30%
 *      The arm does the heavy work; the torso barely moves.
 *
 *   3. No addPos on hips — moves torso off legs on non-standard rigs.
 *
 *   4. addRot only — setRot breaks Meshy AI GLBs whose bone local axes
 *      differ from the procedural HumanCharacter rig.
 *
 * Timing: BowlerFSM from animationFSM.ts — same phases/durations as the game.
 * An IDLE_PAUSE separates deliveries so each cycle is clearly readable.
 */

import { BowlerFSM }        from '../../engine/physics/animationFSM.js';
import { easeOutExpo, lerp } from './poses.js';
import type { BoneAccumulator } from './BoneAccumulator.js';

const IDLE_PAUSE = 1.5;
const PI = Math.PI;

// Old system reference — these were the source-of-truth scalars:
const LEAN_MAX    = 0.15;  // bodyLean peak at swing (rad)
const ARM_GATHER  = -1.1;  // swingAngle at gather (rad)
const ARM_RELEASE =  1.2;  // swingAngle at release (rad)  — midpoint of old arc
const ARM_FT      =  2.7;  // swingAngle at full follow-through (rad)

// Lean distribution weights (must sum to 1)
const W_HIPS  = 0.20;
const W_SPINE = 0.35;
const W_CHEST = 0.35;
const W_NECK  = 0.10;

// Arm chain distribution weights (must sum to 1)
const W_SHOULDER = 0.15;
const W_UPPER    = 0.55;
const W_FORE     = 0.30;

// ── Public types ──────────────────────────────────────────────────────────────

export type BowlPhaseName =
  'RUN-UP' | 'GATHER' | 'ARM-SWING' | 'RELEASE' | 'FOLLOW-THROUGH' | 'IDLE';

export const BOWL_CYCLE_S = 0; // kept for import compatibility

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Apply a body-lean scalar to the bone chain using the distribution weights. */
function applyLean(acc: BoneAccumulator, lean: number): void {
  acc.addRot('hips',  lean * W_HIPS,  0, 0);
  acc.addRot('spine', lean * W_SPINE, 0, 0);
  acc.addRot('chest', lean * W_CHEST, 0, 0);
  acc.addRot('head',  lean * W_NECK,  0, 0);
}

/** Apply a single swingAngle value across the arm chain. */
function applyArmAngle(acc: BoneAccumulator, angle: number, armZ: number): void {
  acc.addRot('rightShoulder', angle * W_SHOULDER, 0, 0);
  acc.addRot('rightArm',      angle * W_UPPER,    0, armZ);
  acc.addRot('rightForeArm',  angle * W_FORE,     0, 0);
}

// ── Controller ────────────────────────────────────────────────────────────────

export class BowlingProtoController {
  private readonly _fsm = new BowlerFSM();
  private _runT  = 0;
  private _idleT = 0;

  constructor() {
    this._fsm.onComplete = () => { this._idleT = 0; };
  }

  // ── Debug accessors ───────────────────────────────────────────────────────

  get bowlT(): number { return this._fsm.snapshot.runT; }

  get phaseName(): BowlPhaseName {
    switch (this._fsm.phase) {
      case 'IDLE':           return 'IDLE';
      case 'RUN_UP':         return 'RUN-UP';
      case 'GATHER':         return 'GATHER';
      case 'ARM_SWING':      return 'ARM-SWING';
      case 'RELEASE':        return 'RELEASE';
      case 'FOLLOW_THROUGH': return 'FOLLOW-THROUGH';
    }
  }

  get isAtRelease(): boolean { return this._fsm.phase === 'RELEASE'; }

  // ── FSM proxy — exposes internal FSM state for optional external use ───────

  tickFSM(dt: number): void {
    if (this._fsm.phase === 'IDLE') {
      this._idleT += dt;
      if (this._idleT >= IDLE_PAUSE) { this._runT = 0; this._fsm.start(); }
      return;
    }
    this._runT += dt;
    this._fsm.update(dt);
  }

  buildFSMSnap(): {
    phase: string; progress: number; runT: number;
    eased: { runUp: number; gather: number; armSwing: number; followThrough: number };
  } {
    const s = this._fsm.snapshot;
    return {
      phase: s.phase, progress: s.progress, runT: s.runT,
      eased: {
        runUp: this._fsm.runUpEased, gather: this._fsm.gatherEased,
        armSwing: this._fsm.armSwingEased, followThrough: this._fsm.followThroughEased,
      },
    };
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  // ── Game-loop path: driven by EngineSnapshot.bowlerFSM ──────────────────
  // t = AnimationBrain._t (continuously incrementing) — used for RUN_UP sin waves.

  updateFromGameSnap(
    fsmSnap: {
      phase:    string;
      progress: number;
      eased: { runUp: number; gather: number; armSwing: number; followThrough: number };
    },
    t: number,
    acc: BoneAccumulator,
  ): void {
    switch (fsmSnap.phase) {
      case 'IDLE':           break;
      case 'RUN_UP':         this._runUp(fsmSnap.eased.runUp, t, acc);              break;
      case 'GATHER':         this._gather(fsmSnap.eased.gather, acc);               break;
      case 'ARM_SWING':      this._armSwing(fsmSnap.progress, acc);                 break;
      case 'RELEASE':        this._release(acc);                                    break;
      case 'FOLLOW_THROUGH': this._followThrough(fsmSnap.eased.followThrough, acc); break;
    }
  }

  // ── Standalone test-loop path: driven by internal BowlerFSM ─────────────

  update(dt: number, acc: BoneAccumulator): void {
    if (this._fsm.phase === 'IDLE') {
      this._idleT += dt;
      if (this._idleT >= IDLE_PAUSE) {
        this._runT = 0;
        this._fsm.start();
      } else {
        return;
      }
    }
    this._runT += dt;
    this._fsm.update(dt);
    this._dispatchPhase(acc);
  }

  private _dispatchPhase(acc: BoneAccumulator): void {
    switch (this._fsm.phase) {
      case 'IDLE':           break;
      case 'RUN_UP':         this._runUp(this._fsm.runUpEased, this._runT, acc);    break;
      case 'GATHER':         this._gather(this._fsm.gatherEased, acc);              break;
      case 'ARM_SWING':      this._armSwing(this._fsm.snapshot.progress, acc);      break;
      case 'RELEASE':        this._release(acc);                                    break;
      case 'FOLLOW_THROUGH': this._followThrough(this._fsm.followThroughEased, acc); break;
    }
  }

  // ── Phase 1: RUN_UP ───────────────────────────────────────────────────────
  // Old system: bodyLean = 0 during 'run'. No body lean — leg cycle and arm
  // pump only. Arm stays at gather position (old swingAngle ≈ ARM_GATHER).

  private _runUp(e: number, t: number, acc: BoneAccumulator): void {

    // Arm held at gather angle throughout approach (arm naturally swings a bit)
    const naturalPump = Math.sin(t * 6) * 0.25 * e;
    applyArmAngle(acc, ARM_GATHER * e + naturalPump, -0.50 * e);

    // Guide arm swings opposite
    acc.addRot('leftArm', -naturalPump * 0.6, 0, 0.30 * e);

    // Leg cycle — hip sway via hips Z only (no forward lean added)
    acc.addRot('hips', 0, 0, Math.sin(t * 6) * 0.03 * e);
    const leg = Math.sin(t * 6 + PI) * 0.55 * e;
    acc.addRot('rightUpLeg', leg,  0, 0);
    acc.addRot('leftUpLeg', -leg,  0, 0);
    acc.addRot('rightLeg',  Math.max(0,  leg) * 0.45, 0, 0);
    acc.addRot('leftLeg',   Math.max(0, -leg) * 0.45, 0, 0);
  }

  // ── Phase 2: GATHER ───────────────────────────────────────────────────────
  // Side-on coil. Old system had no explicit gather — this is the implicit
  // spring-loading moment. Hips yaw side-on (key cricket visual); arm at
  // ARM_GATHER; body lean starts but stays minimal (old bodyLean < 0.05 here).

  private _gather(e: number, acc: BoneAccumulator): void {
    // Hip yaw side-on — NOT lean, so not counted in lean budget
    acc.addRot('hips', 0, 0.20 * e, -0.03 * e);

    // Spine / chest twist (yaw) to follow hips — small, pure Y
    acc.addRot('spine', 0, -0.10 * e, 0);
    acc.addRot('chest', 0, -0.08 * e, 0);

    // Body lean: just starting — old bodyLean was 0 during run, so begin ramp from 0
    const lean = LEAN_MAX * 0.30 * e; // ramp to 30% of peak
    applyLean(acc, lean);

    // Bowling arm: at ARM_GATHER position (pulled back and to the side)
    applyArmAngle(acc, ARM_GATHER, -0.70 * e);

    // Guide arm rises
    acc.addRot('leftArm', -0.10 * e, 0, 0.50 * e);
  }

  // ── Phase 3: ARM_SWING ────────────────────────────────────────────────────
  // The arm sweeps from ARM_GATHER through overhead to ARM_RELEASE.
  // Old swingAngle: spring jump from -1.1 → +2.7 (we use easeOutExpo for snap).
  // Body lean peaks at LEAN_MAX at the moment of release.

  private _armSwing(progressLinear: number, acc: BoneAccumulator): void {
    const e = easeOutExpo(Math.max(0, Math.min(1, progressLinear)));

    // Body lean ramps from 30% (gather) to 100% (release)
    const lean = LEAN_MAX * lerp(0.30, 1.00, e);
    applyLean(acc, lean);

    // Hips: side-on reduces as body squares up through delivery
    acc.addRot('hips', 0, lerp(0.20, 0.08, e), 0);

    // Spine/chest yaw unwinds
    acc.addRot('spine', 0, lerp(-0.10, 0, e), 0);
    acc.addRot('chest', 0, lerp(-0.08, 0, e), 0);

    // Arm arc: ARM_GATHER → overhead (e=0→0.7) → ARM_RELEASE (e=0.7→1)
    let armAngle: number, armZ: number;
    if (e < 0.7) {
      // Gather to overhead: arm.x goes from -1.1 to -2.0 (past vertical)
      armAngle = lerp(ARM_GATHER, -2.0, e / 0.7);
      armZ     = lerp(-0.70, -0.20, e / 0.7);
    } else {
      // Overhead to release: arm.x comes forward to ARM_RELEASE
      armAngle = lerp(-2.0, ARM_RELEASE, (e - 0.7) / 0.3);
      armZ     = lerp(-0.20,  0.05,      (e - 0.7) / 0.3);
    }
    applyArmAngle(acc, armAngle, armZ);

    // Guide arm counter-balances
    acc.addRot('leftArm', lerp(-0.10, 0.25, e), 0, lerp(0.50, -0.10, e));
  }

  // ── Phase 4: RELEASE ──────────────────────────────────────────────────────
  // Body at peak lean. Arm at ARM_RELEASE. Old system: swingAngle ≈ 1.2.
  // Leg drive creates the classic bowling stride — front leg braces, back leg
  // drives through. Matches legacy BOWL pose leg values.

  private _release(acc: BoneAccumulator): void {
    applyLean(acc, LEAN_MAX); // full 0.15 rad distributed

    acc.addRot('hips', 0, 0.08, 0); // small remaining side-on
    applyArmAngle(acc, ARM_RELEASE, 0.05);

    acc.addRot('leftArm', 0.25, 0, -0.10);

    // Leg drive: front leg braces, back leg drives through
    acc.addRot('leftUpLeg',  -0.60, 0, 0);  // front leg extends (braces)
    acc.addRot('rightUpLeg',  0.40, 0, 0);  // back leg drives forward
    acc.addRot('rightLeg',    0.50, 0, 0);  // back knee bends through
  }

  // ── Phase 5: FOLLOW_THROUGH ───────────────────────────────────────────────
  // Old system: swingAngle springs from ARM_RELEASE → ARM_FT then → -0.3.
  // bodyLean decays back to 0. We mirror this decay and arm travel.

  private _followThrough(e: number, acc: BoneAccumulator): void {
    // Body lean decays back to 0 (old: bodyLean → 0 on followThrough)
    applyLean(acc, lerp(LEAN_MAX, 0, e));

    // Hips continue rotating through then settle
    acc.addRot('hips', 0, lerp(0.08, 0.35, e), lerp(0, 0.06, e));

    // Arm travels from ARM_RELEASE toward ARM_FT distribution
    // Old: 1.2 → 2.7 (continues swinging), then spring would decay
    const armAngle = lerp(ARM_RELEASE, ARM_FT * 0.65, e); // don't go full 2.7 on rig
    applyArmAngle(acc, armAngle, lerp(0.05, 0.40, e));

    // Back leg drives through (no old equivalent, but essential for realism)
    acc.addRot('rightUpLeg', 0.30 * e, 0, 0);
    acc.addRot('rightLeg',   0.22 * e, 0, 0);

    // Guide arm settles
    acc.addRot('leftArm', lerp(0.25, -0.10, e), 0, lerp(-0.10, -0.20, e));
  }
}
