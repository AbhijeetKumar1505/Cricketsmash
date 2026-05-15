import * as THREE from 'three';
import { HUMAN_PROPS, getRoleOverrides } from './proportions.js';
import type { CharacterRole } from './HumanBodyMesh.js';

// ── Humanoid bone hierarchy ────────────────────────────────────────────────────
// Natural athletic proportions (see proportions.ts):
//   Total height ≈ 1.85, 7.0 heads tall, shoulder width ≈ 0.528, leg ratio ≈ 0.54.
//
// Hierarchy (gameplay-first cricket rig):
//   root
//     pelvis
//       spine01 → spine02 → chest → neck → head
//                                       └ clavicleL/R → upperArmL/R
//                                                       → lowerArmL/R
//                                                         → wristL/R          (grip pivot)
//                                                           → handL/R         (palm)
//                                                             → thumb01_L/R → thumb02_L/R
//                                                             → index01_L/R → index02_L/R
//                                                             → palmFingersL/R
//       thighL/R → calfL/R → footL/R → toeL/R
//
// Y=0 is ground. Bone positions are local to parent.

export type BoneRefs = {
  // Spine
  root:      THREE.Bone;
  pelvis:    THREE.Bone;
  spine01:   THREE.Bone;
  spine02:   THREE.Bone;
  chest:     THREE.Bone;
  neck:      THREE.Bone;
  head:      THREE.Bone;
  // Left arm
  clavL:     THREE.Bone;
  upperArmL: THREE.Bone;
  lowerArmL: THREE.Bone;
  wristL:    THREE.Bone;
  handL:     THREE.Bone;
  thumb01L:  THREE.Bone;
  thumb02L:  THREE.Bone;
  index01L:  THREE.Bone;
  index02L:  THREE.Bone;
  palmFingersL: THREE.Bone;
  // Right arm
  clavR:     THREE.Bone;
  upperArmR: THREE.Bone;
  lowerArmR: THREE.Bone;
  wristR:    THREE.Bone;
  handR:     THREE.Bone;
  thumb01R:  THREE.Bone;
  thumb02R:  THREE.Bone;
  index01R:  THREE.Bone;
  index02R:  THREE.Bone;
  palmFingersR: THREE.Bone;
  // Left leg
  thighL:    THREE.Bone;
  calfL:     THREE.Bone;
  footL:     THREE.Bone;
  toeL:      THREE.Bone;
  // Right leg
  thighR:    THREE.Bone;
  calfR:     THREE.Bone;
  footR:     THREE.Bone;
  toeR:      THREE.Bone;
};

function bone(name: string, x = 0, y = 0, z = 0): THREE.Bone {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  return b;
}

export interface SkeletonBuild {
  bones:    BoneRefs;
  skeleton: THREE.Skeleton;
  root:     THREE.Bone;
  /** Flat list in bind order — used for SkinnedMesh skinIndex assignment in M2. */
  allBones: THREE.Bone[];
  /** Bone-name → index in `allBones` for skinIndex lookup. */
  boneIndex: Map<string, number>;
}

export function buildHumanSkeleton(role: CharacterRole = 'fielder'): SkeletonBuild {
  const P = HUMAN_PROPS;
  const ov = getRoleOverrides(role);

  // ── Spine column ──────────────────────────────────────────────────────────
  const root    = bone('root');
  const pelvis  = bone('pelvis',   0, P.hipHeight * ov.heightScale, 0);
  const spine01 = bone('spine01',  0, P.spineSegment, 0);
  const spine02 = bone('spine02',  0, P.spineSegment, 0);
  const chest   = bone('chest',    0, P.spineSegment, 0);
  const neck    = bone('neck',     0, P.spineSegment * 0.85, 0);
  const head    = bone('head',     0, P.headSize * 0.45, 0);

  // ── Arms (shoulder width 2.2 heads via clavicle + upper arm split) ───────
  const clavRootX = P.clavRootX * ov.shoulderScale;
  const clavTipX  = P.clavTipX  * ov.shoulderScale;

  const clavL     = bone('clavicle_l',  -clavRootX, -0.012,  0.012);
  const upperArmL = bone('upperarm_l',  -clavTipX,  -0.016,  0.000);
  const lowerArmL = bone('lowerarm_l',   0, -P.upperArm,     0.000);
  const wristL    = bone('wrist_l',      0, -P.forearm,      0.000);
  const handL     = bone('hand_l',       0, -P.wristOffset,  0.000);

  // L hand fingers
  const thumb01L  = bone('thumb01_l',  -P.thumbBaseX,  -P.fingerBaseDown * 0.55,  P.handLength * 0.10);
  const thumb02L  = bone('thumb02_l',   0,             -P.thumbPhalanx,           0);
  const index01L  = bone('index01_l',  -P.indexBaseX,  -P.fingerBaseDown,         P.handLength * 0.10);
  const index02L  = bone('index02_l',   0,             -P.indexPhalanx,           0);
  const palmFingersL = bone('palmFingers_l', 0.012,    -P.palmFingersDown,        0.000);

  const clavR     = bone('clavicle_r',   clavRootX, -0.012,  0.012);
  const upperArmR = bone('upperarm_r',   clavTipX,  -0.016,  0.000);
  const lowerArmR = bone('lowerarm_r',    0, -P.upperArm,     0.000);
  const wristR    = bone('wrist_r',       0, -P.forearm,      0.000);
  const handR     = bone('hand_r',        0, -P.wristOffset,  0.000);

  // R hand fingers
  const thumb01R  = bone('thumb01_r',   P.thumbBaseX,  -P.fingerBaseDown * 0.55,  P.handLength * 0.10);
  const thumb02R  = bone('thumb02_r',   0,             -P.thumbPhalanx,           0);
  const index01R  = bone('index01_r',   P.indexBaseX,  -P.fingerBaseDown,         P.handLength * 0.10);
  const index02R  = bone('index02_r',   0,             -P.indexPhalanx,           0);
  const palmFingersR = bone('palmFingers_r', -0.012,   -P.palmFingersDown,        0.000);

  // ── Legs (longer athletic legs, ankle + toe split for foot roll) ─────────
  const hipHalf = P.hipHalf * ov.hipScale;
  const thighL = bone('thigh_l',  -hipHalf, -0.018, 0);
  const calfL  = bone('calf_l',    0,       -P.thighLength, 0);
  const footL  = bone('foot_l',    0,       -P.calfLength,  0);
  const toeL   = bone('toe_l',     0,       -P.ankleHeight * 0.72, P.footForward);

  const thighR = bone('thigh_r',   hipHalf, -0.018, 0);
  const calfR  = bone('calf_r',    0,       -P.thighLength, 0);
  const footR  = bone('foot_r',    0,       -P.calfLength,  0);
  const toeR   = bone('toe_r',     0,       -P.ankleHeight * 0.72, P.footForward);

  // ── Wire hierarchy ───────────────────────────────────────────────────────
  root.add(pelvis);
  pelvis.add(spine01);
  spine01.add(spine02);
  spine02.add(chest);
  chest.add(neck);
  neck.add(head);

  chest.add(clavL);
  clavL.add(upperArmL);
  upperArmL.add(lowerArmL);
  lowerArmL.add(wristL);
  wristL.add(handL);
  handL.add(thumb01L);
  thumb01L.add(thumb02L);
  handL.add(index01L);
  index01L.add(index02L);
  handL.add(palmFingersL);

  chest.add(clavR);
  clavR.add(upperArmR);
  upperArmR.add(lowerArmR);
  lowerArmR.add(wristR);
  wristR.add(handR);
  handR.add(thumb01R);
  thumb01R.add(thumb02R);
  handR.add(index01R);
  index01R.add(index02R);
  handR.add(palmFingersR);

  pelvis.add(thighL);
  thighL.add(calfL);
  calfL.add(footL);
  footL.add(toeL);

  pelvis.add(thighR);
  thighR.add(calfR);
  calfR.add(footR);
  footR.add(toeR);

  root.updateMatrixWorld(true);

  const allBones: THREE.Bone[] = [
    root, pelvis, spine01, spine02, chest, neck, head,
    clavL, upperArmL, lowerArmL, wristL, handL,
    thumb01L, thumb02L, index01L, index02L, palmFingersL,
    clavR, upperArmR, lowerArmR, wristR, handR,
    thumb01R, thumb02R, index01R, index02R, palmFingersR,
    thighL, calfL, footL, toeL,
    thighR, calfR, footR, toeR,
  ];

  const skeleton = new THREE.Skeleton(allBones);
  const boneIndex = new Map<string, number>();
  for (let i = 0; i < allBones.length; i++) boneIndex.set(allBones[i].name, i);

  const bones: BoneRefs = {
    root, pelvis, spine01, spine02, chest, neck, head,
    clavL, upperArmL, lowerArmL, wristL, handL,
    thumb01L, thumb02L, index01L, index02L, palmFingersL,
    clavR, upperArmR, lowerArmR, wristR, handR,
    thumb01R, thumb02R, index01R, index02R, palmFingersR,
    thighL, calfL, footL, toeL,
    thighR, calfR, footR, toeR,
  };

  return { bones, skeleton, root, allBones, boneIndex };
}

/** Dev-only helper to render the bone hierarchy for proportion validation. */
export function buildSkeletonHelper(root: THREE.Object3D): THREE.SkeletonHelper {
  const h = new THREE.SkeletonHelper(root);
  (h.material as THREE.LineBasicMaterial).linewidth = 2;
  h.visible = false;
  return h;
}
