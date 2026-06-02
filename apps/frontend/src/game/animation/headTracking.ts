/**
 * Head tracking layer (L5) — clamped lookAt(ball) with damping.
 *
 * Reads the character's head bone world position and computes a local-space
 * rotation toward the ball, clamped to ±20° yaw / ±15° pitch. Damped via
 * lerp so the head doesn't snap.
 *
 * Phase 2 polish; applied always-on to bowler + batsman + all fielders.
 */

import * as THREE from 'three';
import type { CharacterInstance } from '../CharacterManager.js';
import type { BoneAccumulator } from './BoneAccumulator.js';
import { clamp } from './poses.js';

const _headWorld = new THREE.Vector3();
const _parentRot = new THREE.Quaternion();
const _parentEul = new THREE.Euler();

const YAW_LIMIT   = Math.PI / 9;   // 20°
const PITCH_LIMIT = Math.PI / 12;  // 15°

interface TrackingState {
  yaw:   number;
  pitch: number;
}

const _state = new WeakMap<CharacterInstance, TrackingState>();

/**
 * Add head-tracking rotation deltas to the accumulator.
 * Skip when ball is inactive or when `enabled` is false (e.g. during follow-through).
 *
 * @param neckFraction  0..1 — fraction of the tracking rotation also applied to
 *                      the neck bone (batsman only; 0 = head-only, default).
 *                      Neck is ROLE-owned so the addRot stacks on the ROLE base
 *                      written by applyBPToRole each frame.
 */
export function updateHeadTracking(
  char: CharacterInstance,
  characterRoot: THREE.Object3D,
  ballWorld: THREE.Vector3,
  acc: BoneAccumulator,
  enabled: boolean,
  damping = 0.15,
  neckFraction = 0,
): void {
  if (!enabled) return;
  const head = char.bones.get('head');
  if (!head) return;

  head.getWorldPosition(_headWorld);

  // Compute world-space yaw/pitch from head to ball
  const dx = ballWorld.x - _headWorld.x;
  const dy = ballWorld.y - _headWorld.y;
  const dz = ballWorld.z - _headWorld.z;
  const worldYaw   = Math.atan2(dx, dz);
  const worldPitch = Math.atan2(dy, Math.hypot(dx, dz));

  // Subtract the character's root yaw to get local-space yaw
  characterRoot.getWorldQuaternion(_parentRot);
  _parentEul.setFromQuaternion(_parentRot, 'YXZ');
  const localYaw   = clamp(worldYaw - _parentEul.y, -YAW_LIMIT, YAW_LIMIT);
  const localPitch = clamp(worldPitch, -PITCH_LIMIT, PITCH_LIMIT);

  let st = _state.get(char);
  if (!st) { st = { yaw: 0, pitch: 0 }; _state.set(char, st); }
  st.yaw   += (localYaw   - st.yaw)   * damping;
  st.pitch += (localPitch - st.pitch) * damping;

  acc.addRot('head', st.pitch, st.yaw, 0);

  // Neck participates in tracking so the head turn reads as coming from the
  // whole neck rather than a pivot at the skull base.
  if (neckFraction > 0) {
    acc.addRot('neck', st.pitch * neckFraction, st.yaw * neckFraction, 0);
  }
}
