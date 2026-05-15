import * as THREE from 'three';
import type { BoneRefs } from '../HumanSkeleton.js';
import { HUMAN_PROPS } from '../proportions.js';

/**
 * Procedurally builds the human body as simplified natural anatomy primitives.
 *
 * Philosophy: simplified realistic human structure — believable body flow with
 * clean topology. NOT stylized superhero anatomy, NOT abstract mannequins.
 *
 * Torso uses tapered capsules + chest/pelvis ellipsoids; **trap** and **glute**
 * blend volumes bridge shoulder→chest and pelvis→thigh for smoother silhouettes.
 *
 * **Hands** — Wii Sports / Nintendo Sports style: rounded palm, grouped finger mass
 * on `palmFingers_*`, thenar thumb pad blended `thumb01_*`↔`hand_*` (no individual fingers).
 *
 * **Organic flow** — imperceptible L/R radius & offset biases, slightly asymmetric
 * trap/glute masses, and tiny chest pads at the clavicle line so the mesh never
 * reads as a perfectly mirrored CAD extrusion.
 *
 * Each primitive carries a `primaryBone` name for skin weights. Joints blend
 * between two bones for smooth bending.
 *
 * Target: ~7 heads tall, natural shoulder width, proper mass distribution,
 * grounded feet, believable torso structure.
 */

export type BodyPrimitive = {
  geometry:    THREE.BufferGeometry;
  primaryBone: string;
  /** When the primitive straddles two bones (e.g. elbow ring), provide both for blended weights. */
  secondaryBone?: string;
  /** Region tag — used by `computeVertexWeights` to apply joint-aware falloff. */
  region:      BodyRegion;
};

export type BodyRegion =
  | 'pelvis' | 'spine01' | 'spine02' | 'chest' | 'neck' | 'head'
  | 'clavL' | 'upperArmL' | 'lowerArmL' | 'handL'
  | 'clavR' | 'upperArmR' | 'lowerArmR' | 'handR'
  | 'thighL' | 'calfL' | 'footL' | 'toeL'
  | 'thighR' | 'calfR' | 'footR' | 'toeR'
  /** Chest–clavicle blend mass (2-bone skin blend in `computeVertexWeights`). */
  | 'trapL' | 'trapR'
  /** Pelvis–thigh transition volume. */
  | 'gluteL' | 'gluteR'
  | 'jointShoulderL' | 'jointShoulderR'
  | 'jointElbowL' | 'jointElbowR'
  | 'jointWristL' | 'jointWristR'
  | 'jointHipL' | 'jointHipR'
  | 'jointKneeL' | 'jointKneeR'
  | 'jointAnkleL' | 'jointAnkleR'
  | 'heelL'    | 'heelR'
  /** Grouped knuckle / finger mass (palmFingers bone) — Wii Sports–style, not individual digits. */
  | 'handFingerL' | 'handFingerR'
  /** Thenar thumb mass blended palm ↔ thumb01 for a soft, readable thumb. */
  | 'jointThumbL' | 'jointThumbR';

// ── Geometry helpers ──────────────────────────────────────────────────────────

const _tmpV1 = new THREE.Vector3();
const _tmpQ  = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

function getBoneWorld(b: THREE.Bone): THREE.Vector3 {
  return b.getWorldPosition(new THREE.Vector3());
}

/** Build a vertical Y-axis capsule (radius r, height h) and orient it along
 *  the world-space segment p0→p1, then return the geometry. */
type SegmentProfile = {
  bulge?: number;
  ovalX?: number;
  ovalZ?: number;
  flow?: number;
};

function smooth01(t: number): number {
  return t * t * (3 - 2 * t);
}

function segmentCapsule(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  r0: number,
  r1: number,
  segs = 12,
  profile: SegmentProfile = {},
): THREE.BufferGeometry {
  const dir = _tmpV1.subVectors(p1, p0);
  const h = dir.length();
  if (h < 1e-5) {
    return new THREE.SphereGeometry(Math.max(r0, r1), segs, segs >> 1);
  }
  dir.normalize();

  const geo = new THREE.CylinderGeometry(1, 1, h, segs, 6, false);
  const positions = geo.getAttribute('position') as THREE.BufferAttribute;
  const bulge = profile.bulge ?? 0.055;
  const ovalX = profile.ovalX ?? 1.0;
  const ovalZ = profile.ovalZ ?? 0.96;
  const flow = profile.flow ?? 0.008;

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const t = THREE.MathUtils.clamp(y / h + 0.5, 0, 1);
    const radius = THREE.MathUtils.lerp(r0, r1, smooth01(t));
    const muscle = 1 + Math.sin(Math.PI * t) * bulge;
    const jointSoftness = 1 - 0.018 * (Math.pow(1 - t, 6) + Math.pow(t, 6));
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const side = x >= 0 ? 1 : -1;

    positions.setX(i, x * radius * muscle * jointSoftness * ovalX + Math.sin(Math.PI * t) * flow * side);
    positions.setZ(i, z * radius * (1 + Math.sin(Math.PI * (t + 0.18)) * bulge * 0.32) * ovalZ);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  // Cylinder default along +Y; pivot at centre → translate so base sits at p0
  geo.translate(0, h * 0.5, 0);
  _tmpQ.setFromUnitVectors(_yAxis, dir);
  geo.applyQuaternion(_tmpQ);
  geo.translate(p0.x, p0.y, p0.z);
  return geo;
}

/** A short capsule centred at the joint position with radius r, oriented along its bone parent's down axis. */
function jointRing(centre: THREE.Vector3, r: number, half = 0.030, segs = 10): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, segs, segs >> 1);
  geo.scale(1.05, half / r, 1.05);
  geo.translate(centre.x, centre.y, centre.z);
  return geo;
}

function ellipsoidAt(centre: THREE.Vector3, rx: number, ry: number, rz: number, segs = 12): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, segs, segs);
  geo.scale(rx, ry, rz);
  const positions = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const yN = ry > 0 ? y / ry : 0;
    const xN = rx > 0 ? x / rx : 0;
    const zN = rz > 0 ? z / rz : 0;
    const flow = 1 + 0.010 * yN - 0.006 * zN;
    const breath = 1 + 0.006 * Math.sin((xN * 1.7 + yN * 1.1 - zN * 0.8) * Math.PI);

    positions.setX(i, x * flow * breath);
    positions.setZ(i, z * (1 - 0.006 * yN + 0.004 * xN) * breath);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(centre.x, centre.y, centre.z);
  return geo;
}

// ── Body primitives ───────────────────────────────────────────────────────────

export function buildBodyPrimitives(bones: BoneRefs): BodyPrimitive[] {
  // Ensure all bones have up-to-date world matrices for sampling positions.
  bones.root.updateMatrixWorld(true);

  const P = HUMAN_PROPS;
  const out: BodyPrimitive[] = [];

  // World positions of key bones (bind pose)
  const wPelvis   = getBoneWorld(bones.pelvis);
  const wSpine01  = getBoneWorld(bones.spine01);
  const wSpine02  = getBoneWorld(bones.spine02);
  const wChest    = getBoneWorld(bones.chest);
  const wNeck     = getBoneWorld(bones.neck);
  const wHead     = getBoneWorld(bones.head);

  const wUpperL   = getBoneWorld(bones.upperArmL);
  const wLowerL   = getBoneWorld(bones.lowerArmL);
  const wWristL   = getBoneWorld(bones.wristL);
  const wHandL    = getBoneWorld(bones.handL);
  const wThumb01L = getBoneWorld(bones.thumb01L);
  const wThumb02L = getBoneWorld(bones.thumb02L);
  const wPalmFingersL = getBoneWorld(bones.palmFingersL);

  const wUpperR   = getBoneWorld(bones.upperArmR);
  const wLowerR   = getBoneWorld(bones.lowerArmR);
  const wWristR   = getBoneWorld(bones.wristR);
  const wHandR    = getBoneWorld(bones.handR);
  const wThumb01R = getBoneWorld(bones.thumb01R);
  const wThumb02R = getBoneWorld(bones.thumb02R);
  const wPalmFingersR = getBoneWorld(bones.palmFingersR);

  const wThighL   = getBoneWorld(bones.thighL);
  const wCalfL    = getBoneWorld(bones.calfL);
  const wFootL    = getBoneWorld(bones.footL);
  const wToeL     = getBoneWorld(bones.toeL);

  const wThighR   = getBoneWorld(bones.thighR);
  const wCalfR    = getBoneWorld(bones.calfR);
  const wFootR    = getBoneWorld(bones.footR);
  const wToeR     = getBoneWorld(bones.toeR);

  /** Micro L/R & mass biases — breaks mirror-perfect CAD symmetry (not visible as “lopsided”). */
  const A = {
    armUpL: 1.011, armUpR: 0.991, armElL: 1.003, armElR: 0.997,
    faTL: 1.007, faTR: 0.993, faWL: 0.996, faWR: 1.004,
    thTL: 1.009, thTR: 0.992, thKL: 0.998, thKR: 1.006,
    caTL: 1.005, caTR: 0.994, caAL: 1.002, caAR: 0.998,
    jShL: 1.014, jShR: 0.987, jHiL: 1.008, jHiR: 0.992,
    trapRxL: 1.045, trapRxR: 0.955, glGxL: 1.028, glGxR: 0.972,
  };

  // ── Pelvis (natural athletic base) ─────────────────────────────────────
  {
    const c = wPelvis.clone();
    c.y -= 0.020;
    c.x += 0.0028;
    c.z -= 0.0012;
    out.push({
      geometry: ellipsoidAt(c, P.pelvisRx * 1.006, P.pelvisRy, P.pelvisRz * 0.994, 14),
      primaryBone: 'pelvis',
      region: 'pelvis',
    });
  }

  // ── Spine: natural torso flow (subtle taper, not V-shaped) ─────────────
  // Lumbar: pelvis → spine01
  out.push({
    geometry: segmentCapsule(
      wPelvis.clone().add(new THREE.Vector3(0, 0.032, 0)), wSpine01,
      P.lumbarRBot, P.lumbarRTop, 22, { bulge: 0.034, ovalX: 1.05, ovalZ: 0.94, flow: 0.003 },
    ),
    primaryBone: 'spine01',
    secondaryBone: 'pelvis',
    region: 'spine01',
  });
  // Waist: spine01 → spine02 — natural mid-section
  out.push({
    geometry: segmentCapsule(wSpine01, wSpine02, P.waistRBot, P.waistRTop, 22, { bulge: 0.026, ovalX: 1.03, ovalZ: 0.95, flow: 0.002 }),
    primaryBone: 'spine01',
    secondaryBone: 'spine02',
    region: 'spine01',
  });
  // Upper torso: spine02 → chest — natural rib cage
  out.push({
    geometry: segmentCapsule(wSpine02, wChest, P.waistRTop, P.chestRx * 0.88, 22, { bulge: 0.024, ovalX: 1.05, ovalZ: 0.96, flow: 0.002 }),
    primaryBone: 'spine02',
    secondaryBone: 'chest',
    region: 'spine02',
  });

  // ── Chest / rib cage (natural athletic upper torso) ────────────────────
  {
    const c = wChest.clone();
    c.z += 0.003;
    c.x -= 0.0022;
    out.push({
      geometry: ellipsoidAt(c, P.chestRx * 1.006, P.chestRy * 1.01, P.chestRz * 0.988, 18),
      primaryBone: 'chest',
      region: 'chest',
    });
  }

  // ── Trap / deltoid shelf — continuous shoulder–torso curvature ─────────
  {
    const rxL = P.chestRx * 0.44 * A.trapRxL;
    const rxR = P.chestRx * 0.44 * A.trapRxR;
    const ry = 0.078;
    const rz = 0.100;
    const cL = wChest.clone().lerp(wUpperL, 0.46);
    cL.x += 0.015;
    cL.y += 0.028;
    cL.z += 0.011;
    out.push({
      geometry: ellipsoidAt(cL, rxL, ry, rz, 16),
      primaryBone: 'chest',
      secondaryBone: 'clavicle_l',
      region: 'trapL',
    });
    const cR = wChest.clone().lerp(wUpperR, 0.46);
    cR.x -= 0.013;
    cR.y += 0.025;
    cR.z += 0.009;
    out.push({
      geometry: ellipsoidAt(cR, rxR, ry * 0.97, rz * 1.02, 16),
      primaryBone: 'chest',
      secondaryBone: 'clavicle_r',
      region: 'trapR',
    });
  }

  // ── Infraclavicular soft pads — clavicle / shirt-line continuity (chest skinned) ──
  {
    const pL = wChest.clone().lerp(wUpperL, 0.20);
    pL.add(new THREE.Vector3(0.018, 0.036, 0.012));
    out.push({
      geometry: ellipsoidAt(pL, 0.036, 0.026, 0.042, 10),
      primaryBone: 'chest',
      region: 'chest',
    });
    const pR = wChest.clone().lerp(wUpperR, 0.20);
    pR.add(new THREE.Vector3(-0.016, 0.034, 0.010));
    out.push({
      geometry: ellipsoidAt(pR, 0.034, 0.028, 0.040, 10),
      primaryBone: 'chest',
      region: 'chest',
    });
  }

  // ── Glute bridge — softer pelvis → thigh insertion ─────────────────────
  {
    const gxL = P.pelvisRx * 0.52 * A.glGxL;
    const gxR = P.pelvisRx * 0.52 * A.glGxR;
    const gy = 0.066;
    const gz = P.pelvisRz * 0.48;
    const cL = wPelvis.clone().lerp(wThighL, 0.38);
    cL.x -= 0.020;
    cL.y -= 0.032;
    cL.z += 0.006;
    out.push({
      geometry: ellipsoidAt(cL, gxL, gy, gz, 12),
      primaryBone: 'pelvis',
      secondaryBone: 'thigh_l',
      region: 'gluteL',
    });
    const cR = wPelvis.clone().lerp(wThighR, 0.38);
    cR.x += 0.020;
    cR.y -= 0.032;
    cR.z += 0.006;
    out.push({
      geometry: ellipsoidAt(cR, gxR, gy * 0.98, gz * 1.03, 12),
      primaryBone: 'pelvis',
      secondaryBone: 'thigh_r',
      region: 'gluteR',
    });
  }

  // ── Neck ───────────────────────────────────────────────────────────────
  out.push({
    geometry: segmentCapsule(wChest.clone().add(new THREE.Vector3(0, 0.024, 0)), wNeck, 0.056, 0.047, 14, { bulge: 0.018, ovalX: 1.04, ovalZ: 0.94, flow: 0.001 }),
    primaryBone: 'neck',
    secondaryBone: 'chest',
    region: 'neck',
  });

  // ── Head (natural proportion) ──────────────────────────────────────────
  {
    const c = wHead.clone();
    out.push({
      geometry: ellipsoidAt(c, P.headSize * 0.49, P.headSize * 0.535, P.headSize * 0.505, 14),
      primaryBone: 'head',
      region: 'head',
    });
  }

  // ── Shoulder joints — fuller ring softens clavicle → deltoid insertion ──
  out.push({ geometry: jointRing(wUpperL, 0.060 * A.jShL, 0.046, 12), primaryBone: 'clavicle_l', secondaryBone: 'upperarm_l', region: 'jointShoulderL' });
  out.push({ geometry: jointRing(wUpperR, 0.060 * A.jShR, 0.044, 12), primaryBone: 'clavicle_r', secondaryBone: 'upperarm_r', region: 'jointShoulderR' });

  // ── Arms ───────────────────────────────────────────────────────────────
  // Upper arm L/R — fuller shoulder, stronger taper into elbow compression
  out.push({
    geometry: segmentCapsule(wUpperL, wLowerL, P.upperArmRTop * A.armUpL, P.upperArmRElbow * A.armElL, 14, { bulge: 0.092, ovalX: 1.05, ovalZ: 0.92, flow: 0.007 }),
    primaryBone: 'upperarm_l',
    region: 'upperArmL',
  });
  out.push({
    geometry: segmentCapsule(wUpperR, wLowerR, P.upperArmRTop * A.armUpR, P.upperArmRElbow * A.armElR, 14, { bulge: 0.084, ovalX: 1.04, ovalZ: 0.93, flow: 0.006 }),
    primaryBone: 'upperarm_r',
    region: 'upperArmR',
  });

  // Elbow joints
  out.push({ geometry: jointRing(wLowerL, P.elbowR, 0.036, 12), primaryBone: 'upperarm_l', secondaryBone: 'lowerarm_l', region: 'jointElbowL' });
  out.push({ geometry: jointRing(wLowerR, P.elbowR, 0.036, 12), primaryBone: 'upperarm_r', secondaryBone: 'lowerarm_r', region: 'jointElbowR' });

  // Forearm L/R — forearm taper + wrist narrowing, soft belly toward elbow
  out.push({
    geometry: segmentCapsule(wLowerL, wWristL, P.forearmRTop * A.faTL, P.forearmRWrist * A.faWL, 14, { bulge: 0.078, ovalX: 1.03, ovalZ: 0.91, flow: 0.006 }),
    primaryBone: 'lowerarm_l',
    region: 'lowerArmL',
  });
  out.push({
    geometry: segmentCapsule(wLowerR, wWristR, P.forearmRTop * A.faTR, P.forearmRWrist * A.faWR, 14, { bulge: 0.072, ovalX: 1.03, ovalZ: 0.92, flow: 0.005 }),
    primaryBone: 'lowerarm_r',
    region: 'lowerArmR',
  });

  // Wrist joints — slightly fuller torus for softer forearm → hand transition
  out.push({ geometry: jointRing(wWristL, 0.041, 0.032, 12), primaryBone: 'lowerarm_l', secondaryBone: 'hand_l', region: 'jointWristL' });
  out.push({ geometry: jointRing(wWristR, 0.041, 0.032, 12), primaryBone: 'lowerarm_r', secondaryBone: 'hand_r', region: 'jointWristR' });

  // Hands — rounded palm + grouped finger mass + readable thumb (no individual fingers)
  {
    const h = P.handLength;
    // Palm: soft, weighted sphere-ellipsoid slightly palmar of wrist
    const palmCL = wHandL.clone().add(new THREE.Vector3(0.004, -h * 0.24, 0.018));
    out.push({
      geometry: ellipsoidAt(palmCL, 0.050, h * 0.44, 0.058, 14),
      primaryBone: 'hand_l',
      region: 'handL',
    });
    // Knuckle / finger row mass — follows palmFingers bone for grip animation
    const fingerCL = wHandL.clone().lerp(wPalmFingersL, 0.58);
    fingerCL.add(new THREE.Vector3(0.010, -0.012, 0.016));
    out.push({
      geometry: ellipsoidAt(fingerCL, 0.036, 0.032, 0.062, 12),
      primaryBone: 'palmFingers_l',
      region: 'handFingerL',
    });
    // Thenar thumb pad — blend keeps base soft while tip follows thumb chain
    const thumbCL = wThumb01L.clone().lerp(wThumb02L, 0.42);
    thumbCL.add(new THREE.Vector3(-0.006, 0.004, 0.010));
    out.push({
      geometry: ellipsoidAt(thumbCL, 0.028, 0.034, 0.040, 12),
      primaryBone: 'thumb01_l',
      secondaryBone: 'hand_l',
      region: 'jointThumbL',
    });

    const palmCR = wHandR.clone().add(new THREE.Vector3(-0.004, -h * 0.24, 0.018));
    out.push({
      geometry: ellipsoidAt(palmCR, 0.050, h * 0.44, 0.058, 14),
      primaryBone: 'hand_r',
      region: 'handR',
    });
    const fingerCR = wHandR.clone().lerp(wPalmFingersR, 0.58);
    fingerCR.add(new THREE.Vector3(-0.010, -0.012, 0.016));
    out.push({
      geometry: ellipsoidAt(fingerCR, 0.036, 0.032, 0.062, 12),
      primaryBone: 'palmFingers_r',
      region: 'handFingerR',
    });
    const thumbCR = wThumb01R.clone().lerp(wThumb02R, 0.42);
    thumbCR.add(new THREE.Vector3(0.006, 0.004, 0.010));
    out.push({
      geometry: ellipsoidAt(thumbCR, 0.028, 0.034, 0.040, 12),
      primaryBone: 'thumb01_r',
      secondaryBone: 'hand_r',
      region: 'jointThumbR',
    });
  }

  // ── Hip joints ─────────────────────────────────────────────────────────
  out.push({ geometry: jointRing(wThighL, 0.078 * A.jHiL, 0.063, 12), primaryBone: 'pelvis', secondaryBone: 'thigh_l', region: 'jointHipL' });
  out.push({ geometry: jointRing(wThighR, 0.078 * A.jHiR, 0.061, 12), primaryBone: 'pelvis', secondaryBone: 'thigh_r', region: 'jointHipR' });

  // ── Legs ───────────────────────────────────────────────────────────────
  // Thigh — hip fullness → gentle knee compression (narrower at joint)
  out.push({
    geometry: segmentCapsule(wThighL, wCalfL, P.thighRTop * A.thTL, P.thighRKnee * A.thKL, 16, { bulge: 0.082, ovalX: 1.06, ovalZ: 0.91, flow: 0.006 }),
    primaryBone: 'thigh_l',
    region: 'thighL',
  });
  out.push({
    geometry: segmentCapsule(wThighR, wCalfR, P.thighRTop * A.thTR, P.thighRKnee * A.thKR, 16, { bulge: 0.076, ovalX: 1.05, ovalZ: 0.92, flow: 0.005 }),
    primaryBone: 'thigh_r',
    region: 'thighR',
  });

  // Knee joints — slightly larger patella read without hard hinge
  out.push({ geometry: jointRing(wCalfL, P.kneeR * 1.04, 0.054, 12), primaryBone: 'thigh_l', secondaryBone: 'calf_l', region: 'jointKneeL' });
  out.push({ geometry: jointRing(wCalfR, P.kneeR * 1.04, 0.054, 12), primaryBone: 'thigh_r', secondaryBone: 'calf_r', region: 'jointKneeR' });

  // Calf — stronger upper belly, taper into ankle
  out.push({
    geometry: segmentCapsule(wCalfL, wFootL, P.calfRTop * A.caTL, P.calfRAnkle * A.caAL, 16, { bulge: 0.118, ovalX: 0.96, ovalZ: 0.89, flow: 0.005 }),
    primaryBone: 'calf_l',
    region: 'calfL',
  });
  out.push({
    geometry: segmentCapsule(wCalfR, wFootR, P.calfRTop * A.caTR, P.calfRAnkle * A.caAR, 16, { bulge: 0.110, ovalX: 0.97, ovalZ: 0.90, flow: 0.004 }),
    primaryBone: 'calf_r',
    region: 'calfR',
  });

  // Ankle joints — softer calf → foot transition
  out.push({ geometry: jointRing(wFootL, 0.050, 0.040, 12), primaryBone: 'calf_l', secondaryBone: 'foot_l', region: 'jointAnkleL' });
  out.push({ geometry: jointRing(wFootR, 0.050, 0.040, 12), primaryBone: 'calf_r', secondaryBone: 'foot_r', region: 'jointAnkleR' });

  // Heel — oversized stylized plant for weight read
  {
    const cL = wFootL.clone().add(new THREE.Vector3(0, -0.016, -0.042));
    out.push({
      geometry: ellipsoidAt(cL, 0.056, 0.044, 0.058, 12),
      primaryBone: 'foot_l',
      region: 'heelL',
    });
    const cR = wFootR.clone().add(new THREE.Vector3(0, -0.016, -0.042));
    out.push({
      geometry: ellipsoidAt(cR, 0.056, 0.044, 0.058, 12),
      primaryBone: 'foot_r',
      region: 'heelR',
    });
  }

  // Instep bridge — breaks “paper flat” sole, ties ankle to forefoot
  {
    const archL = wFootL.clone().add(new THREE.Vector3(0, 0.018, P.footForward * 0.22));
    out.push({
      geometry: ellipsoidAt(archL, 0.048, 0.028, 0.072, 10),
      primaryBone: 'foot_l',
      region: 'footL',
    });
    const archR = wFootR.clone().add(new THREE.Vector3(0, 0.018, P.footForward * 0.22));
    out.push({
      geometry: ellipsoidAt(archR, 0.048, 0.028, 0.072, 10),
      primaryBone: 'foot_r',
      region: 'footR',
    });
  }

  // Foot (forefoot) — slightly oversized cartoon plant, thicker sole volume
  {
    const cL = wFootL.clone().add(new THREE.Vector3(0, -0.026, P.footForward * 0.44));
    out.push({
      geometry: ellipsoidAt(cL, 0.080, 0.048, 0.132, 14),
      primaryBone: 'foot_l',
      region: 'footL',
    });
    const cR = wFootR.clone().add(new THREE.Vector3(0, -0.026, P.footForward * 0.44));
    out.push({
      geometry: ellipsoidAt(cR, 0.080, 0.048, 0.132, 14),
      primaryBone: 'foot_r',
      region: 'footR',
    });
  }

  // Toe — rounded cap, continuous with forefoot
  {
    const cL = wToeL.clone().add(new THREE.Vector3(0, -0.008, 0.012));
    out.push({
      geometry: ellipsoidAt(cL, 0.072, 0.036, 0.052, 12),
      primaryBone: 'toe_l',
      secondaryBone: 'foot_l',
      region: 'toeL',
    });
    const cR = wToeR.clone().add(new THREE.Vector3(0, -0.008, 0.012));
    out.push({
      geometry: ellipsoidAt(cR, 0.072, 0.036, 0.052, 12),
      primaryBone: 'toe_r',
      secondaryBone: 'foot_r',
      region: 'toeR',
    });
  }

  return out;
}

// ── Merging into one BufferGeometry (preserves position + normal, drops uvs) ──

/** Merge an array of indexed geometries into a single indexed BufferGeometry.
 *  Position + normal preserved; uv generated cylindrically per primitive.
 *  Returns metadata so the weighting pass can apply per-region rules. */
export type MergedBody = {
  geometry:    THREE.BufferGeometry;
  /** Per-vertex region tag (Uint8) for joint-aware weight rules. */
  regionTag:   Uint8Array;
  /** Region index → BodyRegion name (so weights pass can dispatch by region). */
  regionList:  BodyRegion[];
  /** Per-vertex (primaryBone, secondaryBone | -1) names list-indexed by primitive. */
  primaries:   Int32Array;
  /** Encoded as `primaryBone:secondaryBone|''` strings, one per primitive. */
  boneHintList: { primary: string; secondary?: string }[];
  /** Per-vertex index into `boneHintList`. */
  hintTag:     Uint32Array;
};

export function mergePrimitives(prims: BodyPrimitive[]): MergedBody {
  // Ensure each primitive is indexed and has normals.
  type Prepared = { geom: THREE.BufferGeometry; vertCount: number; indexCount: number };
  const prepared: Prepared[] = [];
  let totalVerts = 0;
  let totalIndices = 0;

  for (const prim of prims) {
    const g = prim.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const idx = g.getIndex();
    const vc  = g.getAttribute('position').count;
    const ic  = idx ? idx.count : vc;
    prepared.push({ geom: g, vertCount: vc, indexCount: ic });
    totalVerts += vc;
    totalIndices += ic;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals   = new Float32Array(totalVerts * 3);
  const indices   = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);
  const regionTag = new Uint8Array(totalVerts);
  const primaries = new Int32Array(totalVerts);
  const hintTag   = new Uint32Array(totalVerts);

  const regionList: BodyRegion[] = [];
  const regionIndex = new Map<BodyRegion, number>();
  const boneHintList: { primary: string; secondary?: string }[] = [];

  let vOffset = 0;
  let iOffset = 0;

  for (let pi = 0; pi < prims.length; pi++) {
    const prim = prims[pi];
    const { geom, vertCount, indexCount } = prepared[pi];
    const posArr = geom.getAttribute('position').array as Float32Array;
    const nrmArr = geom.getAttribute('normal').array as Float32Array;
    const idx    = geom.getIndex();

    let regId = regionIndex.get(prim.region);
    if (regId === undefined) {
      regId = regionList.length;
      regionList.push(prim.region);
      regionIndex.set(prim.region, regId);
    }
    const hintId = boneHintList.length;
    boneHintList.push({ primary: prim.primaryBone, secondary: prim.secondaryBone });

    for (let v = 0; v < vertCount; v++) {
      positions[(vOffset + v) * 3 + 0] = posArr[v * 3 + 0];
      positions[(vOffset + v) * 3 + 1] = posArr[v * 3 + 1];
      positions[(vOffset + v) * 3 + 2] = posArr[v * 3 + 2];
      normals[(vOffset + v) * 3 + 0]   = nrmArr[v * 3 + 0];
      normals[(vOffset + v) * 3 + 1]   = nrmArr[v * 3 + 1];
      normals[(vOffset + v) * 3 + 2]   = nrmArr[v * 3 + 2];
      regionTag[vOffset + v] = regId;
      primaries[vOffset + v] = pi;
      hintTag[vOffset + v]   = hintId;
    }

    if (idx) {
      const idxArr = idx.array as Uint16Array | Uint32Array;
      for (let i = 0; i < indexCount; i++) {
        indices[iOffset + i] = idxArr[i] + vOffset;
      }
    } else {
      for (let i = 0; i < indexCount; i++) {
        indices[iOffset + i] = i + vOffset;
      }
    }

    vOffset += vertCount;
    iOffset += indexCount;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));

  // Per-primitive normals are merged verbatim; recompute smooths within each
  // disconnected island (capsule hoops, ellipsoid latitude bands) for cleaner highlights.
  merged.computeVertexNormals();

  // Dispose primitive geometries — they're absorbed into the merged buffer.
  for (const p of prepared) p.geom.dispose();

  return { geometry: merged, regionTag, regionList, primaries, boneHintList, hintTag };
}
