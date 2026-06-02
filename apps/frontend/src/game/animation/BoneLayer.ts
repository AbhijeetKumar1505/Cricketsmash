/**
 * BoneLayer — layer enum, per-bone ownership map, and layer pipeline types.
 *
 * Each layer has a priority. Higher-priority layers can override setRot on
 * bones they own. Bones not explicitly owned by a layer inherit from the
 * lowest-priority layer that touched them (typically LOCOMOTION).
 *
 * Layer order (highest priority last — overwrites earlier layers):
 *   0. LOCOMOTION — mixer-driven walk/run/idle clips (legs, hips, full-body base)
 *   1. ROLE       — batting/bowling/fielding controller (arms, spine, torso)
 *   2. REACTION   — hit recoil, anticipation, impact (additive on spine/arms)
 *   3. HEAD       — ball tracking, look-at (head bone only)
 *   4. SPRING     — secondary motion lag (extremities only)
 *   5. IK         — foot grounding, bat targeting, hand convergence
 *
 * The BoneResolver applies layers in priority order. setRot in a higher layer
 * OVERRIDES setRot from lower layers. addRot always stacks across all layers.
 */

export enum LayerId {
  LOCOMOTION = 0,
  ROLE       = 1,
  REACTION   = 2,
  HEAD       = 3,
  SPRING     = 4,
  IK         = 5,
}

export const LAYER_COUNT = 6;

export const LAYER_NAMES: string[] = [
  'locomotion',
  'role',
  'reaction',
  'head',
  'spring',
  'ik',
];

/**
 * Per-bone layer ownership.
 *
 * Each canonical bone name maps to the layer that OWNS its setRot authority.
 * addRot from any layer always stacks.
 *
 * Convention:
 *   LOCOMOTION — pelvis + full legs (clip-driven base)
 *   ROLE       — torso + arms (controller drives cricket action)
 *   REACTION   — (no setRot bones — always additive)
 *   HEAD       — head bone (head tracking owns the setRot)
 *   SPRING     — (no setRot bones — always additive)
 *   IK         — (no setRot bones — always additive)
 *
 * Bones not listed here fall through to LOCOMOTION (mixer drives them).
 */
export const BONE_OWNERSHIP: Record<string, LayerId> = {
  // ── Locomotion layer owns pelvis + full legs ─────────────────────────────
  hips:          LayerId.LOCOMOTION,
  leftUpLeg:     LayerId.LOCOMOTION,
  rightUpLeg:    LayerId.LOCOMOTION,
  leftLeg:       LayerId.LOCOMOTION,
  rightLeg:      LayerId.LOCOMOTION,
  leftFoot:      LayerId.LOCOMOTION,
  rightFoot:     LayerId.LOCOMOTION,

  // ── Role layer owns torso + arms (cricket action) ────────────────────────
  spine:         LayerId.ROLE,
  chest:         LayerId.ROLE,
  upperChest:    LayerId.ROLE,
  neck:          LayerId.ROLE,
  leftShoulder:  LayerId.ROLE,
  rightShoulder: LayerId.ROLE,
  leftArm:       LayerId.ROLE,
  rightArm:      LayerId.ROLE,
  leftForeArm:   LayerId.ROLE,
  rightForeArm:  LayerId.ROLE,
  leftHand:      LayerId.ROLE,
  rightHand:     LayerId.ROLE,

  // ── Head layer owns head bone (ball tracking) ────────────────────────────
  head:          LayerId.HEAD,
};

/**
 * Return true if `owner` may use setRot on `boneName`.
 * If a higher-priority layer also claims this bone, the higher priority wins.
 */
export function canSetRot(layer: LayerId, boneName: string): boolean {
  const owner = BONE_OWNERSHIP[boneName];
  if (owner === undefined) return layer === LayerId.LOCOMOTION;
  return layer === owner;
}

/**
 * Return true if `owner` may add additive rotation to `boneName`.
 * All layers may addRot to any bone.
 */
export function canAddRot(_layer: LayerId, _boneName: string): boolean {
  return true;
}
