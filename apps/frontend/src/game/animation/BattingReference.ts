/**
 * BattingReference — canonical motion curves for the batting rig migration.
 *
 * All bone rotation in BattingController is derived from these constants.
 * Changing a value here affects the whole batting system proportionally.
 * Pattern mirrors BowlingController's distribution approach.
 */

/** Total body rotation budget (radians) distributed across torso bones. */
export const MAX_SWING_RAD = 2.10;   // readability amplification (original 1.25 → 1.90 → 2.10 for more athletic rotation)

/**
 * Per-bone rotation shares — each × MAX_SWING_RAD gives the LOCAL bone Y rotation.
 * In THREE.js hierarchy, local rotations accumulate: world Y at arms =
 * hips + spine + chest + neck. Shares are tuned so the total accumulated
 * world rotation at the shoulders is ~72° (1.26 rad) — athletic cricket drive.
 *
 * V4 redistribution: pelvis (HIP) increased to lead the chain, spine/chest/neck
 * reduced proportionally so total world rotation at shoulders stays ~1.26 rad.
 * This makes the pelvis the clear initiator — 33% of the rotation budget vs 26%
 * in V3 — while following segments carry less rotational load.
 */
export const HIP_SHARE   = 0.26;   // 31° hip pivot — pelvis-led initiator (was 0.22)
export const SPINE_SHARE = 0.19;   // 23° local, world at spine ≈ 54° (was 0.20)
export const CHEST_SHARE = 0.15;   // 18° local, world at chest ≈ 72° (was 0.16)
export const NECK_SHARE  = 0.06;   // 7° local, world at neck  ≈ 79° (was 0.08)

/** Arm kinetic chain — elbow & wrist deltas relative to guard pose values. */
export const BACKLIFT_ELBOW_EXTRA = 1.30;  // right elbow bends beyond guard's 0.58 (original 0.70 → 1.10 → 1.30)
export const BACKLIFT_WRIST_EXTRA = 0.65;  // right wrist cocks back at top of backlift (original 0.35 → 0.55 → 0.65)

export const SWING_ELBOW_EXTEND   = 1.40;  // elbow straightens from cocked position (original 0.55 → 1.27 → 1.40)
export const SWING_WRIST_SNAP     = 0.80;  // wrist rotates through impact (original 0.30 → 0.68 → 0.80)

/**
 * Legacy HUGE_HIT arm/head targets — matched to AnimationManager BAT_HUGE_HIT.
 * Applied in _contact() for the biggest hits and as max targets for _swing().
 */
export const HUGE_HIT_RIGHT_ARM_Z    = -1.90;  // legacy rightArm.z (-109°) — increased from -1.80 for deeper wrap
export const HUGE_HIT_RIGHT_FORE_Z   = -0.90;  // legacy rightForeArm.z (-52°) — increased from -0.80
export const HUGE_HIT_RIGHT_HAND_Z   = -0.70;  // legacy rightHand.z (-40°) — increased from -0.60
export const HUGE_HIT_HEAD_Y         =  0.45;  // legacy head.y (26°) — increased from 0.40 for better shot tracking

/**
 * Kinetic chain lead offsets (normalised swing progress, 0..1).
 * Each segment starts its motion this many progress-units AFTER hips.
 * Produces:  hips → spine → chest → shoulder → forearm → wrist → bat
 * instead of all segments firing simultaneously.
 *
 * At 220ms swing duration, each 0.10 unit ≈ 22ms.
 * Each segment is delayed 33-55ms from the previous — well above the
 * ~50ms perceptual threshold for sequential motion. The energy travels
 * through the body visibly: hips lead, spine follows, chest unwinds,
 * shoulder fires, forearm whips, wrist snaps.
 *
 * Wrist uses its own compressed window below ARM_LEAD.
 */
export const HIP_LEAD   = 0.00;   // 0ms   — hips fire immediately
export const SPINE_LEAD = 0.25;   // 55ms  — spine follows hips
export const CHEST_LEAD = 0.40;   // 88ms  — chest follows spine
export const ARM_LEAD   = 0.55;   // 121ms — shoulder fires after chest
/** Forearm/wrist window: starts after ARM_LEAD + small gap. */
export const FOREARM_START = 0.62; // 136ms — forearm fires after shoulder
