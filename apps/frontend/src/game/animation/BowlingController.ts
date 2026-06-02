/**
 * BowlingController — drives all bowler bone motion from BowlerFSM signals.
 *
 * Simplified arcade bowling:
 *   RUN_UP         — leg cycle + arm pump
 *   GATHER         — arm cocks back only
 *   ARM_SWING      — simple overhead sweep with easeOutExpo
 *   RELEASE        — single sync frame; FX bus consumes ballReleaseId here
 *   FOLLOW_THROUGH — arm decelerates, very mild follow
 *
 * No torso lean, hip twisting, or forward collapsing — pure arm-drive arcade style.
 *
 * Personality `power` scales arm deltas. `bob` scales run-up bounce.
 */

import type { EngineSnapshot } from '../../engine/GameEngine.js';
import type { Personality } from './personality.js';
import type { BoneAccumulator } from './BoneAccumulator.js';
import { easeOutExpo, lerp, clamp } from './poses.js';

const PI = Math.PI;

export class BowlingController {
  private _runT = 0;  // accumulator for sin-based run-up motion

  /** Reset internal time accumulators (call on new delivery). */
  reset(): void { this._runT = 0; }

  update(snap: EngineSnapshot, dt: number, acc: BoneAccumulator, personality: Personality): void {
    const fsm = snap.bowlerFSM;
    this._runT += dt;

    const p = personality.power;
    const bobScale = personality.bob;
    const swingSpeed = personality.swingSpeed;

    switch (fsm.phase) {
      case 'IDLE':           return;
      case 'RUN_UP':         return this._runUp(fsm.eased.runUp, acc, bobScale);
      case 'GATHER':         return this._gather(fsm.eased.gather, acc, p);
      case 'ARM_SWING':      return this._armSwing(
        // Snappier whip for faster bowlers (swingSpeed > 1)
        clamp(fsm.progress * swingSpeed, 0, 1), acc, p,
      );
      case 'RELEASE':        return this._release(acc, p);
      case 'FOLLOW_THROUGH': return this._followThrough(
        fsm.eased.followThrough, acc, p, personality.followThrough,
      );
    }
  }

  // ── Phase 1: RUN_UP — leg cycle + arm pump only ──────────────────────────
  private _runUp(e: number, acc: BoneAccumulator, bobScale: number): void {
    const t = this._runT;
    const w = e * bobScale;

    // Hip bounce
    acc.addPos('hips', 0, Math.sin(t * 12) * 0.03 * w, 0);

    // Arm pump (opposite arm to leg)
    const armPump = Math.sin(t * 6) * 0.55 * e;
    acc.addRot('rightArm', -armPump, 0, 0);
    acc.addRot('leftArm',   armPump, 0, 0);

    // Leg cycle (opposite to arms)
    const legPump = Math.sin(t * 6 + PI) * 0.7 * e;
    acc.addRot('rightUpLeg', legPump,  0, 0);
    acc.addRot('leftUpLeg', -legPump,  0, 0);
    acc.addRot('rightLeg',  Math.max(0,  legPump) * 0.6, 0, 0);
    acc.addRot('leftLeg',   Math.max(0, -legPump) * 0.6, 0, 0);

    // Slight forward lean
    acc.addRot('spine', 0.10 * e, 0, 0);
  }

  // ── Phase 2: GATHER — arm cocks back only ────────────────────────────────
  private _gather(e: number, acc: BoneAccumulator, p: number): void {
    acc.addRot('rightArm', -1.2 * e * p, 0, lerp(-0.22, -1.5, e) * p);
    acc.addRot('leftArm', 0, 0, lerp(0.22, 1.0, e) * p);
  }

  // ── Phase 3: ARM_SWING — simple overhead sweep with easeOutExpo ───────────
  private _armSwing(progressLinear: number, acc: BoneAccumulator, p: number): void {
    const e = easeOutExpo(progressLinear);

    let armX: number;
    if (e < 0.7) armX = lerp(-1.2, -2.4, e / 0.7);
    else         armX = lerp(-2.4, -1.4, (e - 0.7) / 0.3);

    acc.addRot('rightArm', armX * p, 0, lerp(-1.5, -0.3, e) * p);

    if (e > 0.75) {
      const wrist = (e - 0.75) / 0.25;
      acc.addRot('rightHand', -0.3 * wrist, 0, 0);
    }

    acc.addRot('leftArm', 0.6 * e * p, 0, lerp(1.0, 0, e) * p);
  }

  // ── Phase 4: RELEASE — sync frame (FX bus fires here from snapshot diff) ──
  private _release(acc: BoneAccumulator, p: number): void {
    acc.addRot('rightArm', -1.4 * p, 0, -0.3 * p);
    acc.addRot('rightHand', -0.5, 0, 0);
    acc.addRot('leftArm', 0.6 * p, 0, 0);
  }

  // ── Phase 5: FOLLOW_THROUGH — arm decelerates, mild follow ───────────────
  private _followThrough(e: number, acc: BoneAccumulator, p: number, ftScale: number): void {
    const f = e * ftScale;
    acc.addRot('rightArm', lerp(-1.4, -0.60, f) * p, 0, lerp(-0.3, 0.6, f) * p);
    acc.addRot('leftArm', lerp(0.6, -0.2, f) * p, 0, 0);
    acc.addRot('rightForeArm', lerp(0.30, 0.80, f), 0, 0);
  }
}
