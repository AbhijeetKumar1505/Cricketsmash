/**
 * Spring secondary motion (L6) — lag follower for extremity bones.
 *
 * After the primary pose is applied (controller + head tracking), springs
 * push specific bones toward where they were "trying" to be N frames ago,
 * creating a lag that reads as weight. Per-bone parameters in BONE_SPRINGS.
 *
 * Implementation: store the previous frame's target rotation; this frame,
 * spring our current "follower" rotation toward the previous target with
 * critical damping. The visible lag is roughly `1 / (sqrt(stiffness) / 2π)`.
 */

import type { CharacterInstance } from '../CharacterManager.js';
import type { BoneAccumulator } from './BoneAccumulator.js';
import type { Personality } from './personality.js';

interface SpringParams {
  stiffness: number;
  damping:   number;
}

interface SpringState {
  // Last frame's target (the "true" pose, before spring lag)
  prevX: number; prevY: number; prevZ: number;
  // Our follower position
  curX: number; curY: number; curZ: number;
  // Velocity
  velX: number; velY: number; velZ: number;
  initialized: boolean;
}

const BONE_SPRINGS: Record<string, SpringParams> = {
  leftForeArm:  { stiffness: 350, damping: 30 },
  rightForeArm: { stiffness: 350, damping: 30 },
  leftHand:     { stiffness: 220, damping: 25 },
  rightHand:    { stiffness: 220, damping: 25 },
  head:         { stiffness: 140, damping: 22 },
};

const _stateMap = new WeakMap<CharacterInstance, Map<string, SpringState>>();

function stepSpring(s: SpringState, params: SpringParams, dt: number, dampingMult = 1): void {
  const d = params.damping * dampingMult;
  const k = params.stiffness;
  // Semi-implicit (implicit-damping) integration — UNCONDITIONALLY STABLE even when
  // d·dt ≫ 2 (the contact lock pushes dampingMult to 10×, giving d·dt ≈ 10).
  // Explicit Euler here multiplied velocity by (1 − d·dt) ≈ −9 per frame → exponential
  // blow-up that persisted in the spring state and collapsed the mesh over many
  // deliveries. The implicit form divides by (1 + d·dt), so high damping FREEZES
  // motion (the intended behaviour) instead of exploding.
  const denom = 1 + d * dt;
  s.velX = (s.velX + (s.prevX - s.curX) * k * dt) / denom;
  s.velY = (s.velY + (s.prevY - s.curY) * k * dt) / denom;
  s.velZ = (s.velZ + (s.prevZ - s.curZ) * k * dt) / denom;
  s.curX += s.velX * dt; s.curY += s.velY * dt; s.curZ += s.velZ * dt;
}

/**
 * Apply spring lag. Reads the CURRENT bone rotation (which has the pose
 * already applied this frame via accumulator) and pushes a small additive
 * delta back toward the lagged "previous" target. Net effect: the bone
 * trails behind sudden changes, smooths out fast motion.
 *
 * @param dampingMult  Multiplier on per-bone damping. >1 freezes motion,
 *                     <1 amplifies overshoot. Default 1 (normal).
 * @param personality  Optional per-character personality. Scales stiffness
 *                     by (0.8 + 0.4 * power) — stiffer for power hitters,
 *                     looser/more fluid for technical batsmen.
 */
export function applySprings(char: CharacterInstance, dt: number, acc: BoneAccumulator, dampingMult = 1, personality?: Personality): void {
  // Power 1.0 → stiffnessMult 1.2 (snappy), power 0.5 → 1.0 (default), power 0.0 → 0.8 (loose)
  const stiffnessMult = personality ? 0.8 + 0.4 * personality.power : 1.0;
  let states = _stateMap.get(char);
  if (!states) { states = new Map(); _stateMap.set(char, states); }

  for (const [boneName, params] of Object.entries(BONE_SPRINGS)) {
    const bone = char.bones.get(boneName);
    if (!bone) continue;

    let s = states.get(boneName);
    if (!s) {
      s = {
        prevX: bone.rotation.x, prevY: bone.rotation.y, prevZ: bone.rotation.z,
        curX:  bone.rotation.x, curY:  bone.rotation.y, curZ:  bone.rotation.z,
        velX: 0, velY: 0, velZ: 0,
        initialized: true,
      };
      states.set(boneName, s);
      continue;
    }

    // Step spring toward last frame's target
    const scaledParams: SpringParams = {
      stiffness: params.stiffness * stiffnessMult,
      damping:   params.damping,
    };
    stepSpring(s, scaledParams, Math.min(dt, 1 / 30), dampingMult);

    // Self-heal: if the follower ever goes non-finite or implausibly far from the
    // pose, snap it back. One bad frame can't then permanently corrupt the rig
    // (the lag is secondary motion — it should never exceed a fraction of a radian).
    const MAX_LAG = 1.5; // radians
    if (!Number.isFinite(s.curX) || !Number.isFinite(s.curY) || !Number.isFinite(s.curZ) ||
        Math.abs(s.curX - bone.rotation.x) > MAX_LAG ||
        Math.abs(s.curY - bone.rotation.y) > MAX_LAG ||
        Math.abs(s.curZ - bone.rotation.z) > MAX_LAG) {
      s.curX = bone.rotation.x; s.curY = bone.rotation.y; s.curZ = bone.rotation.z;
      s.velX = 0; s.velY = 0; s.velZ = 0;
    }

    const dx = s.curX - bone.rotation.x;
    const dy = s.curY - bone.rotation.y;
    const dz = s.curZ - bone.rotation.z;
    acc.addRot(boneName, dx * 1.0, dy * 1.0, dz * 1.0);

    s.prevX = bone.rotation.x; s.prevY = bone.rotation.y; s.prevZ = bone.rotation.z;
  }
}
