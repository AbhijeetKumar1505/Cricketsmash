/**
 * TwoBoneIK — analytic two-bone IK solver.
 *
 * Given a two-bone chain (root → mid → end bones) and a target world position,
 * computes LOCAL-SPACE Euler rotation deltas for root and mid bones by
 * redirecting the chain toward the target in world space, then converting the
 * world correction back to parent-local Euler angles.
 *
 * Pure math — no scene mutations. Apply the returned deltas via acc.addRot.
 *
 * The 60/40 root/mid split is a pragmatic approximation for a cricket arm
 * (shoulder → elbow → hand) where the shoulder has more range of motion.
 */

import * as THREE from 'three';

export interface TwoBoneResult {
  rootDeltaX: number; rootDeltaY: number; rootDeltaZ: number;
  midDeltaX:  number; midDeltaY:  number; midDeltaZ:  number;
}

const _ZERO: TwoBoneResult = { rootDeltaX: 0, rootDeltaY: 0, rootDeltaZ: 0, midDeltaX: 0, midDeltaY: 0, midDeltaZ: 0 };

// Module-level scratch objects — avoids per-call allocation
const _rootWorld  = new THREE.Vector3();
const _endWorld   = new THREE.Vector3();
const _currentDir = new THREE.Vector3();
const _targetDir  = new THREE.Vector3();
const _rotQ       = new THREE.Quaternion();
const _parentQ    = new THREE.Quaternion();
const _invParentQ = new THREE.Quaternion();
const _localQ     = new THREE.Quaternion();
const _euler      = new THREE.Euler();

/**
 * Solve: return local-space addRot deltas that bring `end` toward `target`.
 *
 * @param root   shoulder / upper arm bone (root of chain)
 * @param end    wrist/hand / bat-tip bone (end-effector)
 * @param target target world position
 * @param weight blend weight 0..1 (0 = no IK, 1 = full correction)
 */
export function solveTwoBone(
  root:   THREE.Bone,
  end:    THREE.Bone,
  target: THREE.Vector3,
  weight: number,
): TwoBoneResult {
  if (weight < 0.001) return _ZERO;

  root.getWorldPosition(_rootWorld);
  end.getWorldPosition(_endWorld);

  _currentDir.subVectors(_endWorld, _rootWorld).normalize();
  _targetDir.subVectors(target, _rootWorld).normalize();

  // Skip if already nearly aligned (prevents NaN in setFromUnitVectors)
  if (_currentDir.dot(_targetDir) > 0.9998) return _ZERO;

  // World-space quaternion: rotates currentDir → targetDir
  _rotQ.setFromUnitVectors(_currentDir, _targetDir);

  // Convert world correction to root's parent local space:
  //   localDelta = inv(parentWorld) * worldDelta * parentWorld
  if (root.parent) {
    root.parent.getWorldQuaternion(_parentQ);
  } else {
    _parentQ.identity();
  }
  _invParentQ.copy(_parentQ).invert();
  _localQ.copy(_invParentQ).multiply(_rotQ).multiply(_parentQ);

  _euler.setFromQuaternion(_localQ, root.rotation.order);

  // Distribute: shoulder (root) takes 60%, elbow (mid) takes 40%
  const dx = _euler.x * weight;
  const dy = _euler.y * weight;
  const dz = _euler.z * weight;

  return {
    rootDeltaX: dx * 0.6, rootDeltaY: dy * 0.6, rootDeltaZ: dz * 0.6,
    midDeltaX:  dx * 0.4, midDeltaY:  dy * 0.4, midDeltaZ:  dz * 0.4,
  };
}

// ── Reaching solver scratch (distinct from the direction-only solver above) ────
const _rR        = new THREE.Vector3();
const _rM        = new THREE.Vector3();
const _rE        = new THREE.Vector3();
const _segRM     = new THREE.Vector3();
const _segME     = new THREE.Vector3();
const _negRM     = new THREE.Vector3();
const _bendAxis  = new THREE.Vector3();
const _aimCur    = new THREE.Vector3();
const _aimTgt    = new THREE.Vector3();
const _qElbow    = new THREE.Quaternion();
const _qAim      = new THREE.Quaternion();
const _qWeighted = new THREE.Quaternion();
const _pQ        = new THREE.Quaternion();
const _pInvQ     = new THREE.Quaternion();
const _localDelta = new THREE.Quaternion();
const _poleDir   = new THREE.Vector3();

function _clampN(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Rotate `bone`'s WORLD orientation by `qWorld` (optionally eased by `weight`),
 * applied IN PLACE to `bone.quaternion`. Solving for the new local rotation:
 *   bone.world_new = qWorld · bone.world_old
 *   ⇒ bone.local_new = inv(parentWorld) · qWorld · parentWorld · bone.local_old
 * The caller is responsible for `updateMatrixWorld` afterwards.
 */
function _rotateBoneWorld(bone: THREE.Bone, qWorld: THREE.Quaternion, weight: number): void {
  if (weight < 1) {
    _qWeighted.identity().slerp(qWorld, weight);
    qWorld = _qWeighted;
  }
  if (bone.parent) bone.parent.getWorldQuaternion(_pQ); else _pQ.identity();
  _pInvQ.copy(_pQ).invert();
  _localDelta.copy(_pInvQ).multiply(qWorld).multiply(_pQ);
  bone.quaternion.premultiply(_localDelta);   // local_new = localDelta · local_old
}

/**
 * Reaching two-bone IK, applied IMPERATIVELY in place. Unlike `solveTwoBone`
 * (direction only, deferred deltas) this drives `end` to actually REACH `target`
 * in both direction AND distance, mutating the bones and refreshing world
 * matrices between the two steps so it converges in a SINGLE frame:
 *
 *   1. Elbow — law of cosines on the live segment lengths gives the interior
 *      angle that puts `end` at `|root→target|`; the delta from the current angle
 *      is a rotation of `mid` about the arm-plane normal. Refresh matrices.
 *   2. Shoulder — aim the (now correctly-bent) chain `root→end` onto `root→target`.
 *
 * Designed to run as a POST-PASS (after the layer stack + springs have set this
 * frame's pose and matrices reflect it), so there is no one-frame lag — essential
 * for welding the top hand to a fast-moving bat. Caller should `updateMatrixWorld`
 * on the chain before calling and may rely on this fn leaving the chain updated.
 *
 * @param root   shoulder / upper-arm bone
 * @param mid    elbow / forearm bone
 * @param end    hand bone (end-effector)
 * @param target world position the hand should reach
 * @param pole   world hint point the elbow breaks toward (only used when the arm
 *               is near-straight and the bend plane is otherwise undefined)
 * @param weight blend weight 0..1 (1 = full reach this frame)
 */
export function reachTwoBoneInPlace(
  root:   THREE.Bone,
  mid:    THREE.Bone,
  end:    THREE.Bone,
  target: THREE.Vector3,
  pole:   THREE.Vector3 | null,
  weight: number,
): void {
  if (weight < 0.001) return;

  root.getWorldPosition(_rR);
  mid.getWorldPosition(_rM);
  end.getWorldPosition(_rE);

  _segRM.subVectors(_rM, _rR);     // root → mid
  _segME.subVectors(_rE, _rM);     // mid  → end
  const L1 = _segRM.length();
  const L2 = _segME.length();
  if (L1 < 1e-5 || L2 < 1e-5) return;

  const minD = Math.abs(L1 - L2) + 1e-3;
  const maxD = L1 + L2 - 1e-3;
  const tgtDist = _clampN(_rR.distanceTo(target), minD, maxD);
  const curDist = _clampN(_rR.distanceTo(_rE),    minD, maxD);

  // ── Step 1: elbow (law of cosines → interior angle at the mid joint) ─────────
  const cosCur = _clampN((L1 * L1 + L2 * L2 - curDist * curDist) / (2 * L1 * L2), -1, 1);
  const cosTgt = _clampN((L1 * L1 + L2 * L2 - tgtDist * tgtDist) / (2 * L1 * L2), -1, 1);
  const dElbow = Math.acos(cosTgt) - Math.acos(cosCur);   // + straightens, − bends

  // Bend axis = arm-plane normal (M→R × M→E). Rotating M→E about it by +dElbow
  // opens the joint (larger interior angle = straighter = end farther).
  _negRM.copy(_segRM).negate();
  _bendAxis.crossVectors(_negRM, _segME);  // (M→R) × (M→E)
  if (_bendAxis.lengthSq() < 1e-8) {
    if (pole) _poleDir.subVectors(pole, _rM); else _poleDir.set(0, -1, 0);
    _bendAxis.crossVectors(_segME, _poleDir);
    if (_bendAxis.lengthSq() < 1e-8) return;
  }
  _bendAxis.normalize();
  if (Math.abs(dElbow) > 1e-4) {
    _qElbow.setFromAxisAngle(_bendAxis, dElbow);
    _rotateBoneWorld(mid, _qElbow, weight);
    mid.updateMatrixWorld(true);   // refresh so `end` reflects the new elbow
  }

  // ── Step 2: shoulder (aim the bent chain root→end onto root→target) ──────────
  end.getWorldPosition(_rE);       // re-read after the elbow change
  _aimCur.subVectors(_rE, _rR).normalize();
  _aimTgt.subVectors(target, _rR).normalize();
  if (_aimCur.dot(_aimTgt) <= 0.9998) {
    _qAim.setFromUnitVectors(_aimCur, _aimTgt);
    _rotateBoneWorld(root, _qAim, weight);
    root.updateMatrixWorld(true);  // refresh the whole arm subtree
  }
}
