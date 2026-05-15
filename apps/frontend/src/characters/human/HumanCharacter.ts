import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterRole } from './HumanBodyMesh.js';
import { HUMAN_PROPS } from './proportions.js';
import { AVATARS, type AvatarProfile, type FaceProfile } from './AvatarGallery.js';

export type HumanBones = {
  root: THREE.Group;
  head: THREE.Group;
  neck: THREE.Group;
  chest: THREE.Group;
  pelvis: THREE.Group;
  upperArmL: THREE.Group;
  upperArmR: THREE.Group;
  lowerArmL: THREE.Group;
  lowerArmR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  calfL: THREE.Group;
  calfR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
};

type Palette = {
  skin: number;
  shirt: number;
  shorts: number;
  hair: number;
  shoe: number;
};

const PALETTES: Record<CharacterRole, Palette> = {
  batsman: { skin: 0xd49a73, shirt: 0x1f9b5a, shorts: 0x1a7f4b, hair: 0x2b1a12, shoe: 0x1b1d1c },
  bowler:  { skin: 0xc98862, shirt: 0xc83b3f, shorts: 0x9d2d34, hair: 0x24170f, shoe: 0x1b1d1c },
  fielder: { skin: 0xc98b68, shirt: 0x2f7fb1, shorts: 0x246693, hair: 0x2b1a12, shoe: 0x1b1d1c },
  keeper:  { skin: 0xd19670, shirt: 0x249b62, shorts: 0x1a7f4b, hair: 0x2b1a12, shoe: 0x1b1d1c },
};

const _down = new THREE.Vector3(0, -1, 0);
const _tmpCapsuleDir = new THREE.Vector3();

function mat(color: number, roughness = 0.82): THREE.MeshStandardMaterial {
  const c = new THREE.Color(color);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: c.clone().multiplyScalar(0.10),
    emissiveIntensity: 0.018,
  });
  return m;
}

function ellipsoid(name: string, material: THREE.Material, rx: number, ry: number, rz: number, segW = 18, segH = 12): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, segW, segH);
  geo.scale(rx, ry, rz);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const yN = ry > 0 ? y / ry : 0;
    const zN = rz > 0 ? z / rz : 0;
    const flow = 1 + yN * 0.006 - zN * 0.004;
    pos.setX(i, x * flow);
    pos.setZ(i, z * (1 - yN * 0.004));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function capsuleBetween(
  name: string,
  material: THREE.Material,
  start: THREE.Vector3,
  end: THREE.Vector3,
  rStart: number,
  rEnd: number,
  ovalX = 1,
  ovalZ = 0.92,
  /** Mid-segment radius bulge — higher on thighs/calves reads less “rod”. */
  midBulge = 0.055,
): THREE.Group {
  const dir = _tmpCapsuleDir.subVectors(end, start);
  const len = dir.length();
  const group = new THREE.Group();
  group.name = `${name}.pivot`;

  if (len < 1e-6) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(rStart, rEnd), 10, 8), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  const geo = new THREE.CylinderGeometry(1, 1, len, 16, 7, false);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(y / len + 0.5, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    const radius = THREE.MathUtils.lerp(rStart, rEnd, smooth);
    const organic = 1 + Math.sin(Math.PI * t) * midBulge;
    pos.setX(i, pos.getX(i) * radius * organic * ovalX);
    pos.setZ(i, pos.getZ(i) * radius * (1 + Math.sin(Math.PI * (t + 0.22)) * 0.018) * ovalZ);
  }
  pos.needsUpdate = true;
  // Single anchor: joint at local origin, mesh extends along −Y before orientation (no mesh.position hack).
  geo.translate(0, -len * 0.5, 0);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.position.set(0, 0, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  dir.normalize();
  group.quaternion.setFromUnitVectors(_down, dir);
  return group;
}

/** Reference head ratios: height 1.18, depth 0.95; width bumped for stylized cranium read. */
const HEAD_RATIO_X = 1.0;
const HEAD_RATIO_Y = 1.18;
const HEAD_RATIO_Z = 0.95;
/** Legacy placeholder half-width ~0.13 → clearer cranium ~0.155 (width only, not height). */
const HEAD_CRANIUM_X_SCALE = 0.155 / 0.13;

/**
 * One stylized skin volume: tapered vertical ellipsoid + subtle face plane + jaw taper +
 * tiny chin read + half-oval ears + button nose (merged). Readable at distance, not micro-anatomy.
 */
function buildStylizedHeadSkinGeometry(headSize: number, face?: FaceProfile): THREE.BufferGeometry {
  const unit = headSize * 0.51;
  const rx = unit * HEAD_RATIO_X * HEAD_CRANIUM_X_SCALE;
  const ry = unit * HEAD_RATIO_Y;
  const rz = unit * HEAD_RATIO_Z;

  const base = new THREE.SphereGeometry(1, 28, 22);
  const pos = base.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    x /= len;
    y /= len;
    z /= len;

    const chinT = THREE.MathUtils.clamp(-y, 0, 1);
    const jawNarrow = 1 - 0.09 * chinT * chinT;
    x *= jawNarrow;
    z *= jawNarrow;

    if (y < -0.15) {
      const t = THREE.MathUtils.smoothstep(y, -0.32, -0.15);
      x *= 1 - t * 0.18;
    }

    x *= rx;
    y *= ry;
    z *= rz;

    // ── Avatar-specific face shaping ────────────────────────────────────────
    if (face) {
      // Jaw / mid-face width — peaks at y=0, tapers off at crown and chin.
      const midT = Math.max(0, 1 - Math.abs(y / (ry * 0.65)));
      x *= 1 + (face.jawWidth - 1.0) * midT;

      // Cheek puffiness — the X bulge at cheekbone height (y ≈ −ry*0.05 to +ry*0.15).
      const cheekT =
        THREE.MathUtils.smoothstep(y, -ry * 0.42, ry * 0.02) *
        (1 - THREE.MathUtils.smoothstep(y, ry * 0.02, ry * 0.32));
      x *= 1 + face.cheekFull * 0.38 * cheekT;

      // Forehead height — scales the upper hemisphere only.
      if (y > 0) {
        const ftT = THREE.MathUtils.smoothstep(y, 0, ry * 0.9);
        y *= 1 + (face.foreheadH - 1.0) * ftT;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    if (z > 0.035) {
      const f = THREE.MathUtils.smoothstep(z, 0.035, rz * 0.95);
      const soften = 1 - Math.min(1, Math.abs(y) / (ry * 1.05)) * 0.22;
      z *= 1 - 0.042 * f * soften;
    }

    if (y < -ry * 0.58 && z > 0.015) {
      const t = THREE.MathUtils.clamp((-y - ry * 0.58) / (ry * 0.38), 0, 1);
      const m = 1 - Math.min(1, Math.abs(x) / (rx * 0.82));
      z += 0.013 * t * t * m;
    }

    if (z > 0) z *= 0.92;

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  base.computeVertexNormals();

  const earRx = rx * 0.2;
  const earRy = ry * 0.3;
  const earRz = rz * 0.1;
  const earY = ry * 0.025;
  const earX = rx * 0.94;
  const earZ = -rz * 0.07;

  const makeEar = (side: number): THREE.BufferGeometry => {
    const g = new THREE.SphereGeometry(1, 14, 12);
    g.scale(earRx, earRy, earRz);
    g.translate(side * earX, earY, earZ);
    return g;
  };

  const nW = face?.noseW ?? 1.0;
  const nL = face?.noseL ?? 1.0;
  const nose = new THREE.SphereGeometry(1, 14, 10);
  nose.scale(rx * 0.1 * nW, ry * 0.085 * nL, rz * 0.11 * nL);
  nose.translate(0, -ry * 0.07, rz * (0.83 + nL * 0.04));

  const earL = makeEar(-1);
  const earR = makeEar(1);
  const merged = mergeGeometries([base, earL, earR, nose], false);
  base.dispose();
  earL.dispose();
  earR.dispose();
  nose.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Single soft hair cap: front puff, tight sides, rounded rear (reference silhouette). */
function buildHairCapGeometry(headSize: number): THREE.BufferGeometry {
  const unit = headSize * 0.51;
  const rx = unit * HEAD_RATIO_X * HEAD_CRANIUM_X_SCALE;
  const ry = unit * HEAD_RATIO_Y;
  const rz = unit * HEAD_RATIO_Z;

  const geo = new THREE.SphereGeometry(1, 26, 20);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    x /= len;
    y /= len;
    z /= len;

    let px = x * rx * 1.12;
    let py = y * ry * 0.4;
    let pz = z * rz * 1.08;

    if (py < -ry * 0.12) {
      const u = THREE.MathUtils.clamp((-py - ry * 0.12) / (ry * 0.22), 0, 1);
      py = THREE.MathUtils.lerp(py, -ry * 0.11, u * 0.82);
    }

    if (pz > 0 && py > -ry * 0.1) {
      const puff =
        THREE.MathUtils.clamp((py + ry * 0.1) / (ry * 0.52), 0, 1)
        * THREE.MathUtils.clamp(pz / (rz * 0.92), 0, 1);
      // Keep crown puff without a low “visor” over the forehead (was hiding eyes).
      const foreheadGuard = THREE.MathUtils.smoothstep(py, -ry * 0.08, ry * 0.22);
      pz += rz * 0.095 * puff * foreheadGuard;
    }

    if (z > 0.02 && y > 0.04) {
      pz += 0.018;
    }

    const sideTaper = 1 - 0.22 * THREE.MathUtils.clamp(Math.abs(px) / (rx * 1.08), 0, 1);
    px *= sideTaper;

    pos.setXYZ(i, px, py, pz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeContactShadow(role: CharacterRole): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(role === 'batsman' ? 0.98 : 0.86, 0.40);
  const material = new THREE.MeshBasicMaterial({
    color: 0x061008,
    transparent: true,
    opacity: role === 'batsman' ? 0.34 : 0.28,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'human.contactShadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.006;
  return mesh;
}

function makeBat(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'simpleBat';
  const bladeMat = mat(0xd7bf82, 0.68);
  const gripMat = mat(0x1f1711, 0.8);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.46, 0.035), bladeMat);
  blade.position.y = -0.34;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.021, 0.22, 10), gripMat);
  grip.position.y = -0.05;
  g.add(blade, grip);
  return g;
}

export class HumanCharacter {
  readonly root = new THREE.Group();
  readonly scaleGroup = new THREE.Group();
  readonly bones: HumanBones;
  readonly role: CharacterRole;
  readonly bat: THREE.Group | null;

  idlePhase = 0;
  poseType = 0;
  fieldStanceClass: 0 | 1 | 2 | 3 = 0;
  fieldYawJitter = 0;
  fieldXJitter = 0;

  private readonly meshes: THREE.Mesh[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly base: Record<string, { position: THREE.Vector3; rotation: THREE.Euler }> = {};

  constructor(role: CharacterRole, avatarId?: string) {
    this.role = role;
    this.root.name = `human.${role}`;
    this.scaleGroup.name = 'human.scale';
    this.root.add(this.scaleGroup);

    // Apply avatar or default palette
    const avatar = avatarId ? AVATARS[avatarId] : null;
    const palette = avatar ? {
      skin: avatar.skinColor,
      shirt: avatar.shirtColor,
      shorts: avatar.shortsColor,
      hair: avatar.hairColor,
      shoe: avatar.shoeColor
    } : PALETTES[role];

    const skin = mat(palette.skin, 0.78);
    const shirt = mat(palette.shirt, 0.86);
    const shorts = mat(palette.shorts, 0.88);
    const hair = mat(palette.hair, 0.58);
    const shoe = mat(palette.shoe, 0.9);
    this.materials.push(skin, shirt, shorts, hair, shoe);

    if (avatar) {
      this.scaleGroup.scale.set(avatar.widthScale, avatar.heightScale, avatar.widthScale);
    }

    const rig = new THREE.Group();
    rig.name = 'human.neutralRig';
    rig.position.y = -0.015;
    this.scaleGroup.add(rig);

    const bones = this.makeBones();
    this.bones = bones;
    rig.add(bones.root);

    this.buildNeutralHuman(bones, { skin, shirt, shorts, hair, shoe }, avatar);
    this.captureBasePose();

    this.bat = role === 'batsman' ? makeBat() : null;
    if (this.bat) {
      this.bat.position.set(0.018, -0.055, 0.025);
      this.bat.rotation.set(0.18, 0.10, 0.42);
      bones.handR.add(this.bat);
    }

    this.root.add(makeContactShadow(role));
  }

  resetPose(): void {
    for (const [key, base] of Object.entries(this.base)) {
      const node = this.bones[key as keyof HumanBones];
      node.position.copy(base.position);
      node.rotation.copy(base.rotation);
    }
  }

  setDebugSkeletonVisible(_visible: boolean): void {}

  setFootSeparation(separation: number): void {
    const shadow = this.root.getObjectByName('human.contactShadow') as THREE.Mesh | undefined;
    if (shadow) shadow.scale.x = THREE.MathUtils.clamp(separation / 0.42, 0.72, 1.35);
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.geometry.dispose();
    for (const geo of this.geometries) geo.dispose();
    for (const material of this.materials) material.dispose();
    const shadow = this.root.getObjectByName('human.contactShadow') as THREE.Mesh | undefined;
    if (shadow) {
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
    }
  }

  private makeBones(): HumanBones {
    const root = new THREE.Group();
    root.name = 'root';

    const pelvis = new THREE.Group();
    pelvis.name = 'pelvis';
    pelvis.position.y = 0.88;
    root.add(pelvis);

    const chest = new THREE.Group();
    chest.name = 'chest';
    chest.position.y = 0.30;
    pelvis.add(chest);

    const neck = new THREE.Group();
    neck.name = 'neck';
    neck.position.set(0, 0.22, 0);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.set(0, 0.18, 0);

    chest.add(neck);
    neck.add(head);

    // =====================
    // SHOULDERS
    // =====================

    const shoulderX = 0.22;

    const upperArmL = new THREE.Group();
    upperArmL.name = 'upperArmL';
    upperArmL.position.set(-shoulderX, 0.12, 0);

    const upperArmR = new THREE.Group();
    upperArmR.name = 'upperArmR';
    upperArmR.position.set(shoulderX, 0.12, 0);

    chest.add(upperArmL, upperArmR);

    // =====================
    // LOWER ARMS
    // =====================

    const lowerArmL = new THREE.Group();
    lowerArmL.name = 'lowerArmL';
    lowerArmL.position.set(0, -0.24, 0);

    const lowerArmR = new THREE.Group();
    lowerArmR.name = 'lowerArmR';
    lowerArmR.position.set(0, -0.24, 0);

    upperArmL.add(lowerArmL);
    upperArmR.add(lowerArmR);

    // =====================
    // HANDS
    // =====================

    const handL = new THREE.Group();
    handL.name = 'handL';
    handL.position.set(0, -0.22, 0);

    const handR = new THREE.Group();
    handR.name = 'handR';
    handR.position.set(0, -0.22, 0);

    lowerArmL.add(handL);
    lowerArmR.add(handR);

    // =====================
    // HIPS
    // =====================

    const hipX = 0.125;

    const thighL = new THREE.Group();
    thighL.name = 'thighL';
    thighL.position.set(-hipX, -0.06, 0);

    const thighR = new THREE.Group();
    thighR.name = 'thighR';
    thighR.position.set(hipX, -0.06, 0);

    pelvis.add(thighL, thighR);

    // =====================
    // CALVES
    // =====================

    const calfL = new THREE.Group();
    calfL.name = 'calfL';
    calfL.position.set(0, -0.36, 0);

    const calfR = new THREE.Group();
    calfR.name = 'calfR';
    calfR.position.set(0, -0.36, 0);

    thighL.add(calfL);
    thighR.add(calfR);

    // =====================
    // FEET
    // =====================

    const footL = new THREE.Group();
    footL.name = 'footL';
    footL.position.set(0, -0.32, 0.04);

    const footR = new THREE.Group();
    footR.name = 'footR';
    footR.position.set(0, -0.32, 0.04);

    calfL.add(footL);
    calfR.add(footR);

    // =====================
    // NATURAL RELAXED STANCE
    // =====================

    upperArmL.rotation.z = 0.16;
    upperArmR.rotation.z = -0.16;

    lowerArmL.rotation.z = 0.04;
    lowerArmR.rotation.z = -0.04;

    thighL.rotation.z = -0.015;
    thighR.rotation.z = 0.015;

    return {
      root,
      head,
      neck,
      chest,
      pelvis,
      upperArmL,
      upperArmR,
      lowerArmL,
      lowerArmR,
      handL,
      handR,
      thighL,
      thighR,
      calfL,
      calfR,
      footL,
      footR,
    };
  }

  private buildNeutralHuman(
    bones: HumanBones,
    mats: {
      skin: THREE.Material;
      shirt: THREE.Material;
      shorts: THREE.Material;
      hair: THREE.Material;
      shoe: THREE.Material;
    },
    avatar?: AvatarProfile | null,
  ): void {
    const add = (
      parent: THREE.Object3D,
      node: THREE.Object3D,
      position?: THREE.Vector3,
    ) => {
      if (position) node.position.copy(position);

      parent.add(node);

      node.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) this.meshes.push(mesh);
      });
    };

    // =========================
    // TORSO
    // =========================

    add(
      bones.pelvis,
      ellipsoid(
        'pelvis',
        mats.shorts,
        0.22,
        0.15,
        0.16,
        18,
        12,
      ),
      new THREE.Vector3(0, 0.02, 0),
    );

    add(
      bones.chest,
      ellipsoid(
        'torso',
        mats.shirt,
        0.24,
        0.34,
        0.17,
        20,
        14,
      ),
      new THREE.Vector3(0, -0.04, 0),
    );

    add(
      bones.chest,
      ellipsoid(
        'shoulderCapL',
        mats.shirt,
        0.07,
        0.07,
        0.07,
        12,
        8,
      ),
      new THREE.Vector3(-0.22, 0.14, 0),
    );

    add(
      bones.chest,
      ellipsoid(
        'shoulderCapR',
        mats.shirt,
        0.07,
        0.07,
        0.07,
        12,
        8,
      ),
      new THREE.Vector3(0.22, 0.14, 0),
    );

    add(
      bones.chest,
      ellipsoid(
        'collar',
        mats.shirt,
        0.10,
        0.038,
        0.095,
        14,
        8,
      ),
      // Slight +Y / +Z so the collar ring sits outside the shirt torso (no neck swallowing).
      new THREE.Vector3(0, 0.202, 0.014),
    );

    // neckColumn: capsuleBetween anchors at parent origin — start must be (0,0,0) on the
    // neck joint so the segment extends toward the head (+Y after orientation). Small +Z
    // offset pulls skin clear of the shirt torso from rear / three-quarter views.

    add(
      bones.neck,
      capsuleBetween(
        'neckColumn',
        mats.skin,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.205, 0),
        0.095,
        0.066,
        0.94,
        0.9,
        0.022,
      ),
      new THREE.Vector3(0, 0.01, 0.042),
    );

    add(
      bones.neck,
      ellipsoid(
        'neckNape',
        mats.skin,
        0.075,
        0.11,
        0.075,
        10,
        8,
      ),
      new THREE.Vector3(0, 0.11, -0.022),
    );

    // =========================
    // HEAD — unified stylized volume + single hair cap + minimal face read
    // =========================

    const hs = HUMAN_PROPS.headSize;
    const hu = hs * 0.51;
    const hrx = hu * HEAD_RATIO_X;
    const hry = hu * HEAD_RATIO_Y;
    const hrz = hu * HEAD_RATIO_Z;

    const headGeo = buildStylizedHeadSkinGeometry(hs, avatar?.face);
    const headSkin = new THREE.Mesh(headGeo, mats.skin);
    headSkin.name = 'head';
    headSkin.castShadow = true;
    headSkin.receiveShadow = true;
    headSkin.position.set(0, 0.1, 0);
    add(bones.head, headSkin);

    // Hair Logic
    if (avatar?.hairType !== 'bald') {
      const hairGeo = buildHairCapGeometry(hs);
      const hairCap = new THREE.Mesh(hairGeo, mats.hair);
      hairCap.name = 'hairCap';
      hairCap.castShadow = true;
      hairCap.receiveShadow = true;
      hairCap.position.set(0, 0.194, -0.026);
      
      if (avatar?.hairType === 'spiky') {
        hairCap.scale.y *= 1.4;
        hairCap.position.y += 0.02;
      } else if (avatar?.hairType === 'side-part') {
        hairCap.rotation.z = 0.2;
      } else if (avatar?.hairType === 'pompadour') {
        // Trump: tall vertical fin swept to his right, narrow X, exaggerated Y
        hairCap.scale.set(0.78, 1.85, 0.92);
        hairCap.rotation.z = 0.40;
        hairCap.position.set(-0.018, 0.210, -0.018);
      } else if (avatar?.hairType === 'flat-top') {
        // Kim: wide squat base + hard flat disc on crown for the undercut silhouette
        hairCap.scale.set(1.28, 0.52, 1.04);
        hairCap.position.set(0, 0.186, -0.018);
        const flatDiscGeo = new THREE.CylinderGeometry(hu * 1.12, hu * 1.20, hu * 0.10, 20, 1);
        const flatDisc = new THREE.Mesh(flatDiscGeo, mats.hair);
        flatDisc.name = 'hairFlatDisc';
        flatDisc.castShadow = true;
        flatDisc.position.set(0, 0.262, -0.016);
        add(bones.head, flatDisc);
      }

      add(bones.head, hairCap);
    }

    // Beard Logic
    if (avatar?.beardType && avatar.beardType !== 'none') {
      const beardGeo = new THREE.SphereGeometry(hs * 0.45, 16, 12, 0, Math.PI, 0, Math.PI / 2);
      const beard = new THREE.Mesh(beardGeo, mats.hair);
      beard.rotation.x = Math.PI;
      beard.position.set(0, -hry * 0.2, hrz * 0.4);
      if (avatar.beardType === 'stubble') {
        beard.scale.set(1.1, 0.4, 0.8);
      } else {
        beard.scale.set(1.1, 1.2, 1.1);
      }
      add(headSkin, beard);
    }

    // ── Face features — all relative to headSkin origin (offset on bone) ──────
    const fp = avatar?.face;
    const eyeZ  = hrz * 1.076 + 0.003;
    const eyeY  = hry * 0.10;
    const eyeX  = hrx * 0.34 * (fp?.eyeSpacing ?? 1.0);
    const es    = fp?.eyeScale ?? 1.0;
    const eyeW  = 0.020 * es;
    const eyeH  = 0.030 * es;

    // Materials
    const irisMat = new THREE.MeshBasicMaterial({ color: avatar?.eyeColor ?? 0x2a1800, side: THREE.DoubleSide });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e8, side: THREE.DoubleSide });
    const hairStd = mats.hair as THREE.MeshStandardMaterial;
    const browMat = new THREE.MeshBasicMaterial({ color: hairStd.color.clone(), side: THREE.DoubleSide });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1a0808, side: THREE.DoubleSide });
    this.materials.push(irisMat, pupilMat, scleraMat, browMat, mouthMat);

    // Sclera (white of eye)
    const scleraGeo = new THREE.PlaneGeometry(eyeW * 1.55, eyeH * 1.15);
    const scleraL = new THREE.Mesh(scleraGeo, scleraMat);
    scleraL.name = 'scleraL';
    scleraL.position.set(-eyeX, eyeY, eyeZ - 0.001);
    add(headSkin, scleraL);
    const scleraR = new THREE.Mesh(scleraGeo.clone(), scleraMat);
    scleraR.name = 'scleraR';
    scleraR.position.set(eyeX, eyeY, eyeZ - 0.001);
    add(headSkin, scleraR);

    // Eyelash strip — thin dark bar across the top of each sclera for depth
    const lashH   = eyeH * 0.16;
    const lashGeo = new THREE.PlaneGeometry(eyeW * 1.62, lashH);
    const lashMat = new THREE.MeshBasicMaterial({ color: 0x080402, side: THREE.DoubleSide });
    this.materials.push(lashMat);
    const lashL = new THREE.Mesh(lashGeo, lashMat);
    lashL.name = 'lashL';
    lashL.position.set(-eyeX, eyeY + eyeH * 0.50 - lashH * 0.42, eyeZ + 0.0025);
    add(headSkin, lashL);
    const lashR = new THREE.Mesh(lashGeo.clone(), lashMat);
    lashR.name = 'lashR';
    lashR.position.set(eyeX, eyeY + eyeH * 0.50 - lashH * 0.42, eyeZ + 0.0025);
    add(headSkin, lashR);

    // Iris (avatar eye color)
    const irisGeo = new THREE.PlaneGeometry(eyeW, eyeH);
    const irisL = new THREE.Mesh(irisGeo, irisMat);
    irisL.name = 'eyeL';
    irisL.position.set(-eyeX, eyeY, eyeZ);
    add(headSkin, irisL);
    const irisR = new THREE.Mesh(irisGeo.clone(), irisMat);
    irisR.name = 'eyeR';
    irisR.position.set(eyeX, eyeY, eyeZ);
    add(headSkin, irisR);

    // Pupil (black disc)
    const pupilGeo = new THREE.PlaneGeometry(eyeW * 0.52, eyeH * 0.52);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.name = 'pupilL';
    pupilL.position.set(-eyeX, eyeY, eyeZ + 0.0008);
    add(headSkin, pupilL);
    const pupilR = new THREE.Mesh(pupilGeo.clone(), pupilMat);
    pupilR.name = 'pupilR';
    pupilR.position.set(eyeX, eyeY, eyeZ + 0.0008);
    add(headSkin, pupilR);

    // Iris highlight — tiny white specular dot that gives the eyes life
    const hlGeo = new THREE.PlaneGeometry(eyeW * 0.30, eyeH * 0.28);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.60, side: THREE.DoubleSide });
    this.materials.push(hlMat);
    const hlL = new THREE.Mesh(hlGeo, hlMat);
    hlL.name = 'irisHlL';
    hlL.position.set(-eyeX + eyeW * 0.18, eyeY + eyeH * 0.20, eyeZ + 0.0015);
    add(headSkin, hlL);
    const hlR = new THREE.Mesh(hlGeo.clone(), hlMat);
    hlR.name = 'irisHlR';
    hlR.position.set(eyeX + eyeW * 0.18, eyeY + eyeH * 0.20, eyeZ + 0.0015);
    add(headSkin, hlR);

    // Upper eyelid (adds squinting read for small-eye avatars — Kim, Trump, Putin)
    if (es < 0.92) {
      const lidH = eyeH * (0.92 - es) * 2.2;
      const lidGeo = new THREE.PlaneGeometry(eyeW * 1.55, lidH);
      const lidMat = new THREE.MeshBasicMaterial({ color: avatar?.skinColor ?? 0xffdbac });
      this.materials.push(lidMat);
      const lidL = new THREE.Mesh(lidGeo, lidMat);
      lidL.name = 'lidL';
      lidL.position.set(-eyeX, eyeY + eyeH * 0.50 - lidH * 0.28, eyeZ + 0.002);
      add(headSkin, lidL);
      const lidR = new THREE.Mesh(lidGeo.clone(), lidMat);
      lidR.name = 'lidR';
      lidR.position.set(eyeX, eyeY + eyeH * 0.50 - lidH * 0.28, eyeZ + 0.002);
      add(headSkin, lidR);
    }

    // ── Eyebrows ─────────────────────────────────────────────────────────────
    const bt    = fp?.browThick ?? 1.0;
    const bTilt = fp?.browTilt  ?? 0.0;
    const bHOff = fp?.browHeight ?? 0.0;
    const browZ = eyeZ - hrz * 0.005;
    const browY = eyeY + hry * (0.068 + bHOff);
    const browW = 0.050 * Math.min(1.0 + (bt - 1.0) * 0.4, 1.5);  // width grows slightly with thickness
    const browGeo = new THREE.BoxGeometry(browW, 0.009 * bt, 0.016 * Math.min(bt, 1.8));
    const tiltAngle = 0.28 - bTilt;                                 // base 0.28 rad tilt
    const browL = new THREE.Mesh(browGeo, browMat);
    browL.name = 'browL';
    browL.position.set(-hrx * 0.31, browY, browZ);
    browL.rotation.set(0.10, 0, tiltAngle);
    add(headSkin, browL);
    const browR = new THREE.Mesh(browGeo.clone(), browMat);
    browR.name = 'browR';
    browR.position.set(hrx * 0.31, browY, browZ);
    browR.rotation.set(0.10, 0, -tiltAngle);
    add(headSkin, browR);

    // ── Mouth — upper + lower lip pair ───────────────────────────────────────
    const mW      = fp?.mouthW    ?? 1.0;
    const mYShift = fp?.mouthYShift ?? 0.0;
    const mouthY  = -hry * (0.44 - mYShift * 0.06);
    // Upper lip: slightly narrower, sits higher
    const upperLipGeo = new THREE.BoxGeometry(hrx * 0.54 * mW, hry * 0.014, hrz * 0.048);
    const upperLip = new THREE.Mesh(upperLipGeo, mouthMat);
    upperLip.name = 'upperLip';
    upperLip.position.set(0, mouthY + hry * 0.010, hrz * 0.884);
    add(headSkin, upperLip);
    // Lower lip: slightly wider, protrudes fractionally more
    const lowerLipGeo = new THREE.BoxGeometry(hrx * 0.52 * mW, hry * 0.016, hrz * 0.052);
    const lowerLipMat = new THREE.MeshBasicMaterial({ color: 0x221010, side: THREE.DoubleSide });
    this.materials.push(lowerLipMat);
    const lowerLip = new THREE.Mesh(lowerLipGeo, lowerLipMat);
    lowerLip.name = 'lowerLip';
    lowerLip.position.set(0, mouthY - hry * 0.010, hrz * 0.888);
    add(headSkin, lowerLip);

    // Nostril dots — two small dark planes at nose base (noseW/noseL from FaceProfile)
    const nsW   = fp?.noseW ?? 1.0;
    const nsL   = fp?.noseL ?? 1.0;
    const nsDim = hrx * 0.032 * nsW;
    const nsGeo = new THREE.PlaneGeometry(nsDim, nsDim * 0.70);
    const nsMat = new THREE.MeshBasicMaterial({ color: 0x1a0a06, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
    this.materials.push(nsMat);
    const nsOff = hrx * 0.055 * nsW;
    const nsY   = -hry * 0.07 - hrx * 0.07;
    const nsZ   = hrz * (0.898 + nsL * 0.028);
    const nostrL = new THREE.Mesh(nsGeo, nsMat);
    nostrL.name = 'nostrL';
    nostrL.position.set(-nsOff, nsY, nsZ);
    add(headSkin, nostrL);
    const nostrR = new THREE.Mesh(nsGeo.clone(), nsMat);
    nostrR.name = 'nostrR';
    nostrR.position.set(nsOff, nsY, nsZ);
    add(headSkin, nostrR);
    // ─────────────────────────────────────────────────────────────────────────

    // =========================
    // ARMS
    // =========================

    add(
      bones.upperArmL,
      capsuleBetween(
        'upperArmL',
        mats.skin,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.28, 0),
        0.085,
        0.055,
        1.0,
        1.0,
        0.03,
      ),
    );

    add(
      bones.upperArmR,
      capsuleBetween(
        'upperArmR',
        mats.skin,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.28, 0),
        0.085,
        0.055,
        1.0,
        1.0,
        0.03,
      ),
    );

    add(
      bones.lowerArmL,
      capsuleBetween(
        'lowerArmL',
        mats.skin,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.24, 0),
        0.055,
        0.028,
        1.0,
        1.0,
        0.03,
      ),
    );

    add(
      bones.lowerArmR,
      capsuleBetween(
        'lowerArmR',
        mats.skin,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.24, 0),
        0.055,
        0.028,
        1.0,
        1.0,
        0.03,
      ),
    );

    add(
      bones.handL,
      ellipsoid(
        'handL',
        mats.skin,
        0.095,
        0.105,
        0.065,
        12,
        8,
      ),
      new THREE.Vector3(0, -0.045, 0.01),
    );

    add(
      bones.handR,
      ellipsoid(
        'handR',
        mats.skin,
        0.095,
        0.105,
        0.065,
        12,
        8,
      ),
      new THREE.Vector3(0, -0.045, 0.01),
    );

    add(
      bones.handL,
      ellipsoid(
        'thumbL',
        mats.skin,
        0.022,
        0.038,
        0.022,
        8,
        6,
      ),
      new THREE.Vector3(-0.055, 0.005, 0.03),
    );

    add(
      bones.handR,
      ellipsoid(
        'thumbR',
        mats.skin,
        0.022,
        0.038,
        0.022,
        8,
        6,
      ),
      new THREE.Vector3(0.055, 0.005, 0.03),
    );

    // =========================
    // LEGS
    // =========================

    add(
      bones.thighL,
      capsuleBetween(
        'thighL',
        mats.shorts,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.40, 0),
        0.095,
        0.050,
        1.0,
        1.0,
        0.06,
      ),
    );

    add(
      bones.thighR,
      capsuleBetween(
        'thighR',
        mats.shorts,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.40, 0),
        0.095,
        0.050,
        1.0,
        1.0,
        0.06,
      ),
    );

    add(
      bones.calfL,
      capsuleBetween(
        'calfL',
        mats.shorts,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.34, 0),
        0.082,
        0.032,
        1.0,
        1.0,
        0.05,
      ),
    );

    add(
      bones.calfR,
      capsuleBetween(
        'calfR',
        mats.shorts,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.34, 0),
        0.082,
        0.032,
        1.0,
        1.0,
        0.05,
      ),
    );

    add(
      bones.footL,
      ellipsoid(
        'footL',
        mats.shoe,
        0.115,
        0.05,
        0.19,
        12,
        8,
      ),
      new THREE.Vector3(0, -0.04, 0.08),
    );

    add(
      bones.footR,
      ellipsoid(
        'footR',
        mats.shoe,
        0.115,
        0.05,
        0.19,
        12,
        8,
      ),
      new THREE.Vector3(0, -0.04, 0.08),
    );
  }

  private captureBasePose(): void {
    for (const [key, node] of Object.entries(this.bones)) {
      this.base[key] = {
        position: node.position.clone(),
        rotation: node.rotation.clone(),
      };
    }
  }
}
