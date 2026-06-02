/**
 * BatTargetIK — guides the right-arm chain toward the incoming ball.
 *
 * Two active zones:
 *
 *   SWING (last 35%)  — soft reach toward live ball position (max weight 0.30).
 *                        Makes the arm visibly track the approaching ball before
 *                        the full contact correction fires.
 *
 *   CONTACT           — full correction toward contactSolution.contactPointWorld
 *                        (max weight 1.0, ramps up over 3 frames).
 *
 *   FOLLOW_THROUGH    — smooth release back to procedural arc (6 frames).
 *
 * Torso compensation (anti-rubber-arm):
 *   When the IK correction magnitude on rightArm.Y exceeds 0.08 rad, a
 *   proportional addRot is applied to chest (15%) and spine (8%) so the
 *   shoulder appears to turn with the arm rather than detaching from the body.
 *
 * Contact error metric (dev-only):
 *   On each CONTACT frame, `window.__anim.lastContactError` is set to the
 *   distance (metres) between the right-hand world position and the IK target.
 */

import * as THREE from 'three';
import type { EngineSnapshot } from '../../../engine/GameEngine.js';
import type { CharacterInstance } from '../../../game/CharacterManager.js';
import type { BoneAccumulator } from '../../../game/animation/BoneAccumulator.js';
import { solveTwoBone } from './TwoBoneIK.js';
import { bladeOffsetFromHand } from '../bat/batGeometry.js';

// CONTACT blend: 3 frames in, 6 frames out
const CONTACT_IN_RATE  = 1 / (0.05 * 60);
const CONTACT_OUT_RATE = 1 / (0.10 * 60);

// Swing-reach zone: last 35% of SWING progress → max weight 0.30
const SWING_REACH_START  = 0.65;
const SWING_REACH_MAX    = 0.30;

// Torso compensation: apply when |rootDeltaY| exceeds this threshold
const TORSO_THRESHOLD    = 0.08;  // radians
const CHEST_COMP_RATIO   = 0.15;
const SPINE_COMP_RATIO   = 0.08;

const _target   = new THREE.Vector3();
const _handQuat = new THREE.Quaternion();
const _bladeVec = new THREE.Vector3();

export class BatTargetIK {
  private _contactWeight = 0;

  /**
   * Each frame: compute IK correction and write addRot deltas to `acc`.
   * Call BEFORE layerSet.applyAll() so the IK layer is included in the composite.
   *
   * @param snap      Current engine snapshot (FSM phase + contact solution)
   * @param char      Character whose bones to correct
   * @param acc       IK-layer accumulator (LayerId.IK)
   * @param ballWorld Live ball world position — used for swing-reach zone
   */
  solve(
    snap:      EngineSnapshot,
    char:      CharacterInstance,
    acc:       BoneAccumulator,
    ballWorld?: THREE.Vector3,
  ): void {
    const phase    = snap.batsmanFSM.phase;
    const progress = snap.batsmanFSM.progress;
    const cs       = snap.contactSolution;

    const rightArm     = char.bones.get('rightArm');
    const rightForeArm = char.bones.get('rightForeArm');
    const rightHand    = char.bones.get('rightHand');
    if (!rightArm || !rightForeArm || !rightHand) return;

    // ── Swing-reach zone (soft, live ball) ───────────────────────────────────
    if (phase === 'SWING' && progress > SWING_REACH_START && ballWorld) {
      const t = (progress - SWING_REACH_START) / (1 - SWING_REACH_START); // 0→1
      const w = t * SWING_REACH_MAX;
      _target.copy(ballWorld);
      // Aim the BLADE (not the wrist) at the ball: pull the hand goal back along
      // the bat by the hand→blade vector so the sweet spot lands on the target.
      rightHand.getWorldQuaternion(_handQuat);
      _target.sub(bladeOffsetFromHand(_handQuat, _bladeVec));
      const d = solveTwoBone(rightArm, rightHand, _target, w);
      acc.addRot('rightArm',     d.rootDeltaX, d.rootDeltaY, d.rootDeltaZ);
      acc.addRot('rightForeArm', d.midDeltaX,  d.midDeltaY,  d.midDeltaZ);
      // Torso compensation for swing-reach (lighter fraction)
      this._applyTorsoComp(acc, d.rootDeltaY * 0.5);
    }

    // ── Contact-phase zone (full correction, contact point) ──────────────────
    if (phase === 'CONTACT' && cs) {
      this._contactWeight = Math.min(1, this._contactWeight + CONTACT_IN_RATE);
    } else if (phase === 'FOLLOW_THROUGH') {
      this._contactWeight = Math.max(0, this._contactWeight - CONTACT_OUT_RATE);
    } else if (phase !== 'SWING') {
      this._contactWeight = 0;
    }

    const cw = this._contactWeight;
    if (cw > 0.001 && cs) {
      _target.set(cs.contactPointWorld.x, cs.contactPointWorld.y, cs.contactPointWorld.z);
      // Offset the hand goal back along the bat so the BLADE sweet spot — not the
      // wrist — lands on contactPointWorld. Iterative: uses this frame's hand
      // orientation, converges across the CONTACT window.
      rightHand.getWorldQuaternion(_handQuat);
      _target.sub(bladeOffsetFromHand(_handQuat, _bladeVec));
      const d = solveTwoBone(rightArm, rightHand, _target, cw);
      acc.addRot('rightArm',     d.rootDeltaX, d.rootDeltaY, d.rootDeltaZ);
      acc.addRot('rightForeArm', d.midDeltaX,  d.midDeltaY,  d.midDeltaZ);
      this._applyTorsoComp(acc, d.rootDeltaY);
      // NOTE: the contact-error metric is NOT measured here. The wrist bone is
      // ~0.4m from the bat sweet spot, so a hand→target distance is meaningless
      // as "contact accuracy". The Renderer measures the real bat sweet spot.
    }
  }

  /** Propagate a fraction of the IK Y-delta up the torso chain. */
  private _applyTorsoComp(acc: BoneAccumulator, rootDeltaY: number): void {
    const mag = Math.abs(rootDeltaY);
    if (mag < TORSO_THRESHOLD) return;
    const sign = rootDeltaY < 0 ? -1 : 1;
    acc.addRot('chest', 0, sign * mag * CHEST_COMP_RATIO, 0);
    acc.addRot('spine', 0, sign * mag * SPINE_COMP_RATIO, 0);
  }

  /** Reset on batsman rebind or game reset. */
  reset(): void { this._contactWeight = 0; }
}
