import type { CharacterRole } from './HumanBodyMesh.js';

/**
 * Canonical proportions for the human pipeline.
 * Target: ~7-head stylized readability (not chibi, not realistic micro-anatomy).
 *
 *   Height           = 7.0 heads
 *   Shoulder width   = 2.0 head widths
 *   Leg ratio        = 0.54 of total height
 *   Hand scale       = 1.14× (mitten read + bat silhouette)
 *   Foot scale       = 1.32× (oversized stylized shoes, grounded plant)
 *
 * All units are world metres; Y=0 is ground; bones are in local parent space.
 */

const TOTAL_HEIGHT = 1.85;
const HEADS_TALL = 7.0;
const HEAD_SIZE = TOTAL_HEIGHT / HEADS_TALL;        // ≈ 0.264
const SHOULDER_WIDTH = HEAD_SIZE * 2.0;             // ≈ 0.528 (natural width)
const LEG_RATIO = 0.54;                             // hip height / total height
const HIP_HEIGHT = TOTAL_HEIGHT * LEG_RATIO;        // ≈ 1.00
const HAND_SCALE = 1.14;
const FOOT_SCALE = 1.32;

// ── Spine column heights (pelvis → spine01 → spine02 → chest → neck → head) ──
const SPINE_SEGMENT = (TOTAL_HEIGHT - HIP_HEIGHT - HEAD_SIZE * 0.5) / 4;

// ── Leg segment lengths (hip → knee → ankle → ball-of-foot → toe tip) ──
const ANKLE_HEIGHT = 0.08;                          // ankle pivot above ground
const FOOT_FORWARD = 0.135 * FOOT_SCALE;            // ankle to ball-of-foot Z (larger feet)
const THIGH_LENGTH = (HIP_HEIGHT - ANKLE_HEIGHT) * 0.52;
const CALF_LENGTH  = (HIP_HEIGHT - ANKLE_HEIGHT) * 0.48;

// ── Arm segment lengths ──
const ARM_TOTAL = TOTAL_HEIGHT * 0.40;              // shoulder to wrist
const UPPER_ARM = ARM_TOTAL * 0.48;
const FOREARM   = ARM_TOTAL * 0.48;
const WRIST_OFFSET = 0.020;                         // forearm tip to wrist pivot
const HAND_LENGTH = 0.180 * HAND_SCALE;             // palm centre depth

// ── Shoulder lateral geometry ──
// chest centre → clavicle root: small offset along the clavicle line
// clavicle root → upper arm head: remaining distance to hit the 2.0-head shoulder width
const CLAV_ROOT_X = 0.065;
const CLAV_TIP_X  = (SHOULDER_WIDTH * 0.5) - CLAV_ROOT_X;

// ── Torso volumes (simplified natural anatomy) ─────────────────────────────
// Chest: natural athletic rib cage — slightly deeper Y for readable rib mass
const CHEST_R_X     = SHOULDER_WIDTH * 0.45;
const CHEST_R_Y     = 0.122;
const CHEST_R_Z     = 0.128;

// ── Pelvis / hip lateral ──
const HIP_HALF = 0.112;        // slightly wider for clearer thigh spacing / hip flow

// ── Pelvis anatomy (simplified) ─────────────────────────────────────────────
const PELVIS_R_X    = HIP_HALF + 0.058;   // pelvis bowl — subtle widening vs thigh insert
const PELVIS_R_Y    = 0.095;
const PELVIS_R_Z    = 0.135;

// ── Leg volumes (natural athletic proportions) ──────────────────────────────
const THIGH_R_TOP    = 0.099;
const THIGH_R_KNEE   = 0.0575;   // narrower knee band — reads as gentle compression
const CALF_R_TOP     = 0.074;
const CALF_R_ANKLE   = 0.0405;   // ankle taper
const KNEE_R         = 0.071;

// ── Arm volumes (natural taper) ─────────────────────────────────────────────
const UPPER_ARM_R_TOP  = 0.0665;   // fuller shoulder cap
const UPPER_ARM_R_ELBOW = 0.0445;  // elbow pinch
const FOREARM_R_TOP    = 0.053;
const FOREARM_R_WRIST  = 0.0332;   // wrist narrowing before hand expansion
const ELBOW_R          = 0.051;

// ── Torso taper (natural waist, not V-shaped) ───────────────────────────────
const WAIST_R_TOP   = 0.093;   // narrower mid vs chest for readable taper
const WAIST_R_BOT   = 0.104;   // into lumbar
const LUMBAR_R_TOP  = 0.112;
const LUMBAR_R_BOT  = 0.122;

// ── Finger geometry (cheap but bat-aware) ──
// Wrist pivot is a small bone between forearm and hand to enable grip rotation
// independent of forearm twist. Hand rig: thumb (2 phalanges), index (2 phalanges),
// palm-fingers as a single bone (mid+ring+pinky combined).
const FINGER_BASE_DOWN = HAND_LENGTH * 0.62;        // palm centre to MCP knuckle
const THUMB_BASE_X = 0.052 * HAND_SCALE;            // thumb roots out to the side
const THUMB_PHALANX = 0.046 * HAND_SCALE;
const INDEX_BASE_X = 0.020 * HAND_SCALE;
const INDEX_PHALANX = 0.054 * HAND_SCALE;
const PALM_FINGERS_DOWN = HAND_LENGTH * 0.85;       // single bone for ring+mid+pinky

export type RoleScaleOverrides = {
  /** Multiplier on shoulder/chest width — bowlers a touch broader, fielders neutral. */
  shoulderScale: number;
  /** Multiplier on overall body height — keeper crouches by default. */
  heightScale:   number;
  /** Multiplier on hip lateral offset. */
  hipScale:      number;
};

const DEFAULT_OVERRIDES: RoleScaleOverrides = {
  shoulderScale: 1.00,
  heightScale:   1.00,
  hipScale:      1.00,
};

const ROLE_OVERRIDES: Readonly<Record<CharacterRole, RoleScaleOverrides>> = {
  batsman: { shoulderScale: 1.00, heightScale: 1.00, hipScale: 1.00 },
  bowler:  { shoulderScale: 1.02, heightScale: 1.00, hipScale: 1.00 },
  fielder: { shoulderScale: 1.00, heightScale: 1.00, hipScale: 1.00 },
  keeper:  { shoulderScale: 1.00, heightScale: 0.98, hipScale: 1.00 },
};

export const HUMAN_PROPS = {
  totalHeight:    TOTAL_HEIGHT,
  headSize:       HEAD_SIZE,
  shoulderWidth:  SHOULDER_WIDTH,
  legRatio:       LEG_RATIO,
  hipHeight:      HIP_HEIGHT,
  handScale:      HAND_SCALE,
  footScale:      FOOT_SCALE,

  spineSegment:   SPINE_SEGMENT,

  ankleHeight:    ANKLE_HEIGHT,
  footForward:    FOOT_FORWARD,
  thighLength:    THIGH_LENGTH,
  calfLength:     CALF_LENGTH,

  upperArm:       UPPER_ARM,
  forearm:        FOREARM,
  wristOffset:    WRIST_OFFSET,
  handLength:     HAND_LENGTH,

  clavRootX:      CLAV_ROOT_X,
  clavTipX:       CLAV_TIP_X,
  hipHalf:        HIP_HALF,

  // Torso anatomy (simplified)
  chestRx:        CHEST_R_X,
  chestRy:        CHEST_R_Y,
  chestRz:        CHEST_R_Z,

  // Pelvis anatomy (simplified)
  pelvisRx:       PELVIS_R_X,
  pelvisRy:       PELVIS_R_Y,
  pelvisRz:       PELVIS_R_Z,

  // Leg volumes
  thighRTop:      THIGH_R_TOP,
  thighRKnee:     THIGH_R_KNEE,
  calfRTop:       CALF_R_TOP,
  calfRAnkle:     CALF_R_ANKLE,
  kneeR:          KNEE_R,

  // Arm volumes
  upperArmRTop:    UPPER_ARM_R_TOP,
  upperArmRElbow:  UPPER_ARM_R_ELBOW,
  forearmRTop:     FOREARM_R_TOP,
  forearmRWrist:   FOREARM_R_WRIST,
  elbowR:          ELBOW_R,

  // Torso taper (natural)
  waistRTop:       WAIST_R_TOP,
  waistRBot:       WAIST_R_BOT,
  lumbarRTop:      LUMBAR_R_TOP,
  lumbarRBot:      LUMBAR_R_BOT,

  fingerBaseDown:    FINGER_BASE_DOWN,
  thumbBaseX:        THUMB_BASE_X,
  thumbPhalanx:      THUMB_PHALANX,
  indexBaseX:        INDEX_BASE_X,
  indexPhalanx:      INDEX_PHALANX,
  palmFingersDown:   PALM_FINGERS_DOWN,
} as const;

export type HumanProps = typeof HUMAN_PROPS;

export function getRoleOverrides(role: CharacterRole | undefined): RoleScaleOverrides {
  if (!role) return DEFAULT_OVERRIDES;
  return ROLE_OVERRIDES[role] ?? DEFAULT_OVERRIDES;
}
