/**
 * batGeometry — single source of truth for how the cricket bat sits relative to
 * the rightHand bone. Used by BOTH the Renderer (positions the visible bat mesh)
 * and BatTargetIK (must drive the bat BLADE — not the wrist — onto the contact
 * point). Keeping these in one place prevents the two systems from disagreeing
 * about where the blade is.
 *
 * `_createCricketBat()` builds the bat with local +Y = knob, −Y = blade/toe; the
 * blade mesh sits at local −0.50. So the sweet-spot offset is NEGATIVE.
 */

import * as THREE from 'three';

/** Maps the rightHand bone's GLB orientation to the bat's visual orientation. */
export const BAT_QUAT_OFFSET = new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, Math.PI / 2));

/** Bat origin (grip) sits this far up the handle from the wrist joint (metres). */
export const BAT_GRIP_SEAT = 0.085;

/** Sweet-spot offset from the bat origin along its local axis (negative = blade). */
export const BAT_SWEET_OFFSET = -0.50;

const _q = new THREE.Quaternion();

/**
 * World-space bat up-axis (bat local +Y → world), given the rightHand world
 * quaternion. (Direction only — unit length.)
 */
export function batUpWorld(handWorldQuat: THREE.Quaternion, out: THREE.Vector3): THREE.Vector3 {
  _q.copy(handWorldQuat).multiply(BAT_QUAT_OFFSET);
  return out.set(0, 1, 0).applyQuaternion(_q);
}

/**
 * World-space vector FROM the rightHand bone TO the blade sweet spot.
 * = batUp · (grip seating + sweet-spot offset). Add this to the hand world
 * position to get the blade; subtract from a target to aim the blade at it.
 */
export function bladeOffsetFromHand(handWorldQuat: THREE.Quaternion, out: THREE.Vector3): THREE.Vector3 {
  return batUpWorld(handWorldQuat, out).multiplyScalar(BAT_GRIP_SEAT + BAT_SWEET_OFFSET);
}
