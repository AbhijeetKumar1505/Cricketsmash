/**
 * Shared pose data + easing utilities for the animation brain.
 *
 * All pose values are absolute target rotations (Euler radians) per canonical
 * bone name. The accumulator writes these to bones directly (setRot), not as
 * deltas — matching how the legacy AnimationManager.POSES worked.
 *
 * Bone names match the canonical aliases in CharacterManager.buildBoneMap
 * (hips, spine, chest, leftArm, rightArm, ...).
 */

import * as THREE from 'three';

export const E = (x: number, y: number, z: number): THREE.Euler => new THREE.Euler(x, y, z);

export type PoseMap = Partial<Record<string, THREE.Euler>>;

// ── Base poses ────────────────────────────────────────────────────────────────

/** Generic alive idle — covers all canonical bones so no bone falls to the raw walk-clip rest pose. */
export const IDLE_POSE: PoseMap = {
  hips:          E(0, 0, 0),
  spine:         E(0.06, 0, 0),
  chest:         E(0.04, 0, 0),
  upperChest:    E(0.02, 0, 0),
  neck:          E(0, 0, 0),
  head:          E(0, 0, 0),
  leftShoulder:  E(0, 0,  0.05),
  rightShoulder: E(0, 0, -0.05),
  rightArm:      E(0.12, 0, -0.22),
  leftArm:       E(0.12, 0,  0.22),
  rightForeArm:  E(0.18, 0, 0),
  leftForeArm:   E(0.18, 0, 0),
  rightHand:     E(0, 0, 0),
  leftHand:      E(0, 0, 0),
  leftUpLeg:     E(-0.04, 0,  0.04),
  rightUpLeg:    E(-0.04, 0, -0.04),
  leftLeg:       E(0.06, 0, 0),
  rightLeg:      E(0.06, 0, 0),
  leftFoot:      E(0, 0, 0),
  rightFoot:     E(0, 0, 0),
};

/** Cricket guard stance — covers all canonical bones so no bone falls to the raw walk-clip rest pose. */
export const GUARD_POSE: PoseMap = {
  hips:          E(-0.15, 0,    0),    // athletic hip hinge (was -0.07)
  spine:         E(0.25,  0,    0),    // clear forward lean (was 0.12)
  chest:         E(0.18,  0,    0),    // torso over hips (was 0.07)
  upperChest:    E(0.08,  0,    0),    // was 0.04
  neck:          E(0,     0,    0),
  head:          E(0.15,  0,    0),    // head toward bowler (was 0)
  rightShoulder: E(0.05,  0,    0),
  rightArm:      E(-0.32, 0,  -0.58),
  rightForeArm:  E(0.58,  0,  -0.22),
  rightHand:     E(0.06,  0,  -0.14),
  leftShoulder:  E(0.05,  0,    0),
  leftArm:       E(-0.28, 0,   0.68),
  leftForeArm:   E(0.52,  0,   0.18),
  leftHand:      E(0.06,  0,   0.11),
  leftUpLeg:     E(-0.38, 0,   0.10),  // visible knee bend (was -0.20)
  rightUpLeg:    E(-0.38, 0,  -0.10),  // was -0.20
  leftLeg:       E(0.28,  0,    0),    // was 0.16
  rightLeg:      E(0.28,  0,    0),    // was 0.16
  leftFoot:      E(0,     0,    0),
  rightFoot:     E(0,     0,    0),
};

// ── Easings ──────────────────────────────────────────────────────────────────

export const easeLinear     = (t: number): number => t;
export const easeOutQuad    = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeInQuad     = (t: number): number => t * t;
export const easeInOutQuad  = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOutCubic   = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic    = (t: number): number => t * t * t;
export const easeOutExpo    = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Swing acceleration easing — pure acceleration through contact.
 * easeInQuad: bat starts slow, accelerates continuously, reaches peak
 * velocity exactly at contact (t=1.0). This creates the heavy bat feel
 * and powerful impact perception that easeOutQuad (decelerating into
 * contact) cannot deliver.
 */
export const easeSwingAccel = (t: number): number => t * t;

/** Strong acceleration — for arm/whip segments that need late pop. */
export const easeWhip = (t: number): number => t * t * t;

export const easeOutBack    = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Map x from [a,b] into [c,d], clamped at both ends. */
export const remap = (x: number, a: number, b: number, c: number, d: number): number =>
  c + ((clamp(x, a, b) - a) / (b - a)) * (d - c);
