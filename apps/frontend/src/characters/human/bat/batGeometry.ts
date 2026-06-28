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

/**
 * Graphical clearance that lifts the rest / guard bat off the batsman's body, in
 * WORLD axes: +X pushes the bat away from the torso toward the off side, −Y drops
 * it down into a natural guard angle. Without it the guard pose seats the grip so
 * close to the chest that the blade reads as "buried in the body".
 *
 * Applied to BOTH the rendered bat (`Renderer._syncBatToHand`) AND the welded
 * top-hand target (`BatTargetIK.solveLeftGripPost`) via `batClearanceWeight`, so
 * the left hand tracks the lifted bat instead of detaching. Weighted to 0 through
 * SWING/CONTACT so it never perturbs the tuned contact geometry.
 *
 * Tune live (both bat + hand stay in sync) via `window.__batClear = [x, y, z]`.
 */
export const BAT_BODY_CLEARANCE = new THREE.Vector3(0.12, -0.08, 0);

/** Per-phase weight for BAT_BODY_CLEARANCE: full at rest, eased to 0 by contact. */
export function batClearanceWeight(phase: string, progress: number): number {
  switch (phase) {
    case 'BACKLIFT':       return Math.max(0, 1 - progress); // eases out as the bat lifts clear
    case 'SWING':
    case 'CONTACT':
    case 'FOLLOW_THROUGH': return 0;                          // tuned contact zone — untouched
    default:               return 1;                          // IDLE / pre-bowl: full clearance
  }
}

/**
 * Spacing of the top (left) hand above the bottom (right) hand on the handle
 * (metres up the handle toward the knob/+Y, measured from the bat origin/grip
 * seat where the right hand sits). A tight two-handed grip (baseball-style) sits
 * the hands close together. Live-tune via `window.__gripGap` (metres).
 */
export const LEFT_GRIP_GAP = -0.02;

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3();

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

/**
 * World-space grip point for the top (left) hand, computed from the right-hand
 * world pose. Mirrors how the Renderer seats the bat grip in the right palm
 * (`rhPos + BAT_GRIP_SEAT * batUp`) and then steps `LEFT_GRIP_GAP` further up
 * the handle so the left hand sits just above the right.
 */
export function leftGripWorld(
  rhPos:  THREE.Vector3,
  rhQuat: THREE.Quaternion,
  out:    THREE.Vector3,
): THREE.Vector3 {
  batUpWorld(rhQuat, _up);
  const gap = (typeof window !== 'undefined' && typeof (window as any).__gripGap === 'number')
    ? (window as any).__gripGap as number
    : LEFT_GRIP_GAP;
  return out.copy(rhPos).addScaledVector(_up, BAT_GRIP_SEAT + gap);
}
