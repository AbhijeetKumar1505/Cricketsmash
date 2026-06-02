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
