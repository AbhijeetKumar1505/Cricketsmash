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
import { solveTwoBone, reachTwoBoneInPlace } from './TwoBoneIK.js';
import { bladeOffsetFromHand, leftGripWorld, BAT_BODY_CLEARANCE, batClearanceWeight } from '../bat/batGeometry.js';

// CONTACT blend: 3 frames in, 6 frames out
const CONTACT_IN_RATE  = 1 / (0.05 * 60);
const CONTACT_OUT_RATE = 1 / (0.10 * 60);

// Swing-reach zone: last 35% of SWING progress
const SWING_REACH_START  = 0.65;
const SWING_REACH_MAX    = 0.30;  // default; modulated per shot type below

/** Lateral X-bias on the swing-reach IK target: arm pre-positions toward shot sector. */
const SWING_REACH_X_BIAS: Record<string, number> = {
  pull: -0.30,   // bat reaches toward leg side (−X)
  cut:  +0.30,   // bat reaches toward off side (+X)
};
/** Max swing-reach weight per shot type — aggressive shots reach harder. */
const SWING_REACH_WEIGHT: Record<string, number> = {
  pull:  0.38,
  loft:  0.38,
  drive: 0.38,
  cut:   0.34,
  defend:0.18,
  miss:  0.10,
};

// Torso compensation: apply when |rootDeltaY| exceeds this threshold
const TORSO_THRESHOLD    = 0.08;  // radians
const CHEST_COMP_RATIO   = 0.15;
const SPINE_COMP_RATIO   = 0.08;

const _target   = new THREE.Vector3();
const _handQuat = new THREE.Quaternion();
const _bladeVec = new THREE.Vector3();

// Left-grip (top hand) scratch
const _lTarget  = new THREE.Vector3();
const _rhPos    = new THREE.Vector3();
const _rhQuat   = new THREE.Quaternion();
const _lShld    = new THREE.Vector3();
const _lPole    = new THREE.Vector3();
const _lHandPos = new THREE.Vector3();
// Left-hand orientation-mirror scratch (palm wraps the handle like the right hand)
const _lhTargetQ = new THREE.Quaternion();   // desired left-hand WORLD quat
const _lhParentQ = new THREE.Quaternion();   // left-hand parent WORLD quat
const _lhOffsetQ = new THREE.Quaternion();   // corrective offset (mesh is the other hand)
const _lhEuler   = new THREE.Euler();

// Right-grip (bottom hand) body-clearance scratch
const _rTarget  = new THREE.Vector3();
const _rShld    = new THREE.Vector3();
const _rPole    = new THREE.Vector3();

// Top hand welds to the handle every frame; ease off slightly on release.
const LEFT_GRIP_WEIGHT       = 1.0;
const LEFT_GRIP_RELEASE_MULT = 0.6;  // FOLLOW_THROUGH

// Closed-loop two-handed grip: a reaching IK (reachTwoBoneInPlace) drives the
// left hand onto the live handle point in a POST-PASS (after the layer stack +
// springs), so the top hand stays welded to a fast-moving bat with no lag. Only
// small STATIC wrap niceties remain:
//   • clavicle lift pulls the left shoulder in toward the bat (applied upstream)
//   • wrist wrap curls the left hand around the handle (applied to the end bone)
// Stronger left-shoulder pull-in (was [0,-0.10,0]) so the top-hand reach actually
// LANDS on the handle in the down-bat guard — without it the left arm clamps at max
// extension and the hand floats ~6cm short. Dialed live (`window.__lgTune.clav`).
const LEFT_CLAV_LIFT: readonly [number, number, number] = [0, -0.38, 0];
// Corrective euler (radians) applied on top of the RIGHT-hand world orientation to
// derive the LEFT hand's orientation, so the top palm wraps the handle the same way
// the bottom hand does (the right hand is the bat's parent, so it is the reference).
// The left mesh is the mirror hand, so a corrective offset is needed — found
// EMPIRICALLY against the close-up (feedback.md: never guess rig axes). Live-tune via
// `window.__lgTune.handRot = [x,y,z]`.
const LEFT_HAND_MIRROR_OFFSET: readonly [number, number, number] = [0, 0, 0];
// Pole hint (relative to the left shoulder) — elbow breaks down & slightly inward.
const LEFT_POLE_OFFSET: readonly [number, number, number] = [-0.25, -0.5, 0.05];
// World-space nudge applied to the top-hand grip target AFTER it is derived from
// the bat handle — lets the top hand sit a touch stretched away/down the line
// rather than tucked against the bottom hand. Graphical (+Y up, −X), metres.
// Live-tunable via `window.__lgTune = { off:[x,y,z] }`.
// Tightened toward zero so the top hand sits CLOSE to the bottom hand (baseball
// grip) instead of stretched down the line. Live-tune via `window.__lgTune.off`.
const LEFT_GRIP_WORLD_OFFSET: readonly [number, number, number] = [-0.02, 0.01, 0];
// Pole hint for the RIGHT (bottom-hand) body-clearance reach — elbow breaks down
// & slightly out. Only matters in the near-straight degenerate (the reach is small).
const RIGHT_POLE_OFFSET: readonly [number, number, number] = [0.25, -0.5, 0.05];

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
      const shotType = snap.batsman.shotType;
      const maxW = shotType ? (SWING_REACH_WEIGHT[shotType] ?? SWING_REACH_MAX) : SWING_REACH_MAX;
      const w = t * maxW;
      _target.copy(ballWorld);
      // Aim the BLADE (not the wrist) at the ball: pull the hand goal back along
      // the bat by the hand→blade vector so the sweet spot lands on the target.
      rightHand.getWorldQuaternion(_handQuat);
      _target.sub(bladeOffsetFromHand(_handQuat, _bladeVec));
      // Shot-type lateral bias: pre-position arm toward the sector the ball will travel.
      // Weight-scaled so the bias fades in with the reach (0 at reach start, full at contact).
      const xBias = shotType ? (SWING_REACH_X_BIAS[shotType] ?? 0) : 0;
      _target.x += xBias * w;
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

    // NOTE: the left (top) hand grip is NOT solved here. Driving it before
    // applyAll reads last-frame matrices, so during a fast swing the hand chases
    // a stale target and floats off the bat. It is welded in `solveLeftGripPost`,
    // a post-pass that runs after the layer stack + springs (current matrices).
  }

  /**
   * POST-PASS — body clearance. Nudges the RIGHT (bottom) hand off the torso in
   * world +X/−Y so the bat — rigidly parented to `rightHand` — clears the body in
   * the rest/guard pose instead of reading as buried in it. Because the bat AND
   * the left-hand weld are both derived from the right-hand pose, moving the hand
   * (rather than the bat mesh) keeps BOTH hands on the handle and leaves the tuned
   * contact geometry untouched (weight is 0 through SWING/CONTACT).
   *
   * MUST run BEFORE `solveLeftGripPost` so the top-hand weld derives its handle
   * point from the already-lifted bat. Reaches the hand imperatively (same single-
   * frame reach as the top hand); bones reset to bind next frame so nothing
   * accumulates. Tune live via `window.__batClear = [x, y, z]`.
   */
  solveRightGripPost(char: CharacterInstance, snap: EngineSnapshot): void {
    const cw = batClearanceWeight(snap.batsmanFSM.phase, snap.batsmanFSM.progress);
    if (cw <= 0.001) return;

    const rightArm     = char.bones.get('rightArm');
    const rightForeArm = char.bones.get('rightForeArm');
    const rightHand    = char.bones.get('rightHand');
    if (!rightArm || !rightForeArm || !rightHand) return;

    char.root.updateMatrixWorld(true);

    // Target = current right-hand world position pushed off the body. The offset
    // already carries the phase weight, so the reach itself runs at full weight.
    rightHand.getWorldPosition(_rTarget);
    const ov = (typeof window !== 'undefined' && (window as any).__batClear) as number[] | undefined;
    _rTarget.set(
      _rTarget.x + (ov?.[0] ?? BAT_BODY_CLEARANCE.x) * cw,
      _rTarget.y + (ov?.[1] ?? BAT_BODY_CLEARANCE.y) * cw,
      _rTarget.z + (ov?.[2] ?? BAT_BODY_CLEARANCE.z) * cw,
    );

    rightArm.getWorldPosition(_rShld);
    _rPole.set(
      _rShld.x + RIGHT_POLE_OFFSET[0],
      _rShld.y + RIGHT_POLE_OFFSET[1],
      _rShld.z + RIGHT_POLE_OFFSET[2],
    );

    reachTwoBoneInPlace(rightArm, rightForeArm, rightHand, _rTarget, _rPole, 1);
  }

  /**
   * POST-PASS — weld the left (top) hand to the bat handle. Runs AFTER the layer
   * stack and springs have written this frame's pose, so it reads CURRENT world
   * matrices (no one-frame lag) and the top hand stays on a fast-moving bat.
   *
   * The bat is rigidly attached to `rightHand` (see Renderer), so the handle's
   * top-hand point is fully determined by the live right-hand pose — we just IK
   * the left arm onto it. Writes directly to the left-arm bones (which reset to
   * bind next frame, so nothing accumulates) and leaves their matrices updated so
   * the render reflects the final grip.
   *
   * @param char whose left arm to weld
   * @param snap current engine snapshot (FSM phase for the follow-through ease)
   */
  solveLeftGripPost(char: CharacterInstance, snap: EngineSnapshot): void {
    const phase       = snap.batsmanFSM.phase;
    const leftArm     = char.bones.get('leftArm');
    const leftForeArm = char.bones.get('leftForeArm');
    const leftHand    = char.bones.get('leftHand');
    const rightHand   = char.bones.get('rightHand');
    if (!leftArm || !leftForeArm || !leftHand || !rightHand) {
      if (typeof window !== 'undefined') {
        (window as any).__leftGripDbg = { missingBones: {
          leftArm: !!leftArm, leftForeArm: !!leftForeArm, leftHand: !!leftHand, rightHand: !!rightHand,
        } };
      }
      return;
    }

    // Refresh matrices so reads reflect THIS frame's composited + sprung pose.
    char.root.updateMatrixWorld(true);

    // Both hands stay welded through stance, backlift, swing and contact. The top
    // hand only eases off during the LARGE follow-through of a big/huge shot — a
    // one-handed flourish — never on ordinary/defensive finishes or misses.
    // (big/huge mirrors hitPersonalityFor: lofted, or target multiplier ≥ 2×.)
    const isBigFinish = phase === 'FOLLOW_THROUGH'
      && snap.round.outcome !== 'wicket'
      && (snap.batsman.shotType === 'loft' || (snap.round.targetMult ?? 1) >= 2);
    const lw = isBigFinish
      ? LEFT_GRIP_WEIGHT * LEFT_GRIP_RELEASE_MULT
      : LEFT_GRIP_WEIGHT;

    const T = (typeof window !== 'undefined' && (window as any).__lgTune) || {};

    // Clavicle lift is UPSTREAM of the arm — apply it first, then let the reach
    // compensate so the hand still lands on the handle.
    const clav = (T.clav ?? LEFT_CLAV_LIFT) as readonly [number, number, number];
    const leftShoulder = char.bones.get('leftShoulder');
    if (leftShoulder && (clav[0] || clav[1] || clav[2])) {
      leftShoulder.rotation.set(
        leftShoulder.rotation.x + clav[0] * lw,
        leftShoulder.rotation.y + clav[1] * lw,
        leftShoulder.rotation.z + clav[2] * lw,
      );
      leftShoulder.updateMatrixWorld(true);
    }

    // Live top-hand point on the handle, from the CURRENT right-hand/bat pose.
    rightHand.getWorldPosition(_rhPos);
    rightHand.getWorldQuaternion(_rhQuat);
    leftGripWorld(_rhPos, _rhQuat, _lTarget);

    // Graphical world-space nudge: stretch the top hand a bit away/down the line
    // (default +Y, −X). Tune live via `window.__lgTune = { off:[x,y,z] }`.
    const off = (T.off ?? LEFT_GRIP_WORLD_OFFSET) as readonly [number, number, number];
    _lTarget.set(_lTarget.x + off[0], _lTarget.y + off[1], _lTarget.z + off[2]);
    // NB: body clearance is NOT re-applied here — `solveRightGripPost` (which runs
    // first) has already moved the right hand, so `leftGripWorld` above derives the
    // handle point from the ALREADY-lifted bat and the top hand tracks it for free.

    // Pole keeps the elbow breaking down/inward in the near-straight degenerate.
    leftArm.getWorldPosition(_lShld);
    _lPole.set(
      _lShld.x + LEFT_POLE_OFFSET[0],
      _lShld.y + LEFT_POLE_OFFSET[1],
      _lShld.z + LEFT_POLE_OFFSET[2],
    );

    // Single-frame analytic reach (elbow distance + shoulder aim). Leaves the
    // left-arm subtree matrices updated.
    reachTwoBoneInPlace(leftArm, leftForeArm, leftHand, _lTarget, _lPole, lw);

    // Orientation MIRROR: align the top hand to the handle the same way the bottom
    // hand is (the right hand is the bat's parent → its world quat defines the grip).
    // Target left-hand world quat = rightHandWorldQuat · cornerOffset; then convert to
    // local (inv(parentWorld) · target) so the END bone orients without moving the
    // wrist off the grip point. Replaces the old static additive wrap, which left the
    // palm facing the wrong way. Offset is live-tunable via `window.__lgTune.handRot`.
    const hr = (T.handRot ?? LEFT_HAND_MIRROR_OFFSET) as readonly [number, number, number];
    _lhOffsetQ.setFromEuler(_lhEuler.set(hr[0], hr[1], hr[2]));
    _lhTargetQ.copy(_rhQuat).multiply(_lhOffsetQ);          // _rhQuat = right-hand world quat (read above)
    if (leftHand.parent) leftHand.parent.getWorldQuaternion(_lhParentQ);
    else _lhParentQ.identity();
    leftHand.quaternion.copy(_lhParentQ.invert()).multiply(_lhTargetQ);
    leftHand.updateMatrixWorld(true);

    // Dev probe: residual left-hand → handle distance (should be a few cm).
    if (typeof window !== 'undefined') {
      leftHand.getWorldPosition(_lHandPos);
      (window as any).__leftGripDbg = {
        phase,
        dist_m: +_lHandPos.distanceTo(_lTarget).toFixed(3),
        weight: +lw.toFixed(2),
      };
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
