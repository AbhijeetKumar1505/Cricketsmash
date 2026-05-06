import * as THREE from 'three';
import { SIM } from '../layout.js';
import { screenGroundPoint } from '../worldMapping.js';

/**
 * Google Doodle Style Characters.
 * Simple primitives, expressive features, and easy to animate with Squash & Stretch.
 */

const OUTLINE_SCALE = 1.055;
const PLAYER_MIN_Y = 0;

/** Shared backface outline material (one draw style for all player outlines). */
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

function stdMat(
  color: THREE.ColorRepresentation,
  opts?: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number; roughness?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.82,
    metalness: 0,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0.08,
  });
}

/** Add a slightly larger backface duplicate before the source mesh (drawn behind). */
function addOutlinedMesh(parent: THREE.Object3D, mesh: THREE.Mesh, scale = OUTLINE_SCALE): void {
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(scale);
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  parent.add(outline);
  parent.add(mesh);
}

function createBlobShadow(radius: number = 0.5): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  return mesh;
}

type BaseFigure = {
  root: THREE.Group;
  scalePivot: THREE.Group;
  bodyRoot: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  eyePivots: THREE.Group;
  rArmPivot: THREE.Group;
  lArmPivot: THREE.Group;
  rElbow: THREE.Group;
  rWrist: THREE.Group;
  rLegPivot: THREE.Group;
  lLegPivot: THREE.Group;
};

function createBaseFigure(color: number): BaseFigure {
  const root = new THREE.Group();
  const scalePivot = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(scalePivot);
  scalePivot.add(bodyRoot);
  const shadow = createBlobShadow(0.6);
  shadow.scale.y = 0.5;
  const shadowMat = shadow.material as THREE.MeshBasicMaterial;
  shadowMat.opacity = 0.22;
  root.add(shadow);

  const bodyMat = stdMat(color, { emissive: 0x102010, emissiveIntensity: 0.08 });
  const limbMat = bodyMat;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45, metalness: 0 });
  const antennaMat = new THREE.MeshLambertMaterial({ color: 0x2a6f3b });
  const faceFeatureMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const handMat = stdMat(0xf2c59a, { roughness: 0.70, emissive: 0x221408, emissiveIntensity: 0.05 });

  const torso = new THREE.Group();

  const bodyGeo = new THREE.SphereGeometry(0.5, 20, 20);
  bodyGeo.scale(1, 1.4, 0.85);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.82;
  addOutlinedMesh(torso, body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), limbMat);
  neck.position.y = 1.42;
  addOutlinedMesh(torso, neck);

  const headGroup = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), bodyMat);
  head.position.y = 1.72;
  addOutlinedMesh(headGroup, head);
  headGroup.position.y = 0;

  const eyePivots = new THREE.Group();
  eyePivots.position.set(0, 0, 0);
  const eyeOffsetX = 0.11;
  const eyeY = 1.82;
  const eyeZ = 0.26;
  for (let i = -1; i <= 1; i += 2) {
    const eyePivot = new THREE.Group();
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), eyeMat);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), pupilMat);
    pupil.position.set(0, 0, 0.085);
    eye.add(pupil);
    eyePivot.add(eye);
    eyePivot.position.set(i * eyeOffsetX, eyeY, eyeZ);
    eyePivots.add(eyePivot);
  }
  headGroup.add(eyePivots);

  // Static doodle nose: tiny front-facing bump centered below eyes.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), faceFeatureMat);
  nose.position.set(0, 1.75, 0.295);
  headGroup.add(nose);

  // Static doodle smile: shallow lower-half arc, slightly forward to avoid z-fighting.
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.008, 8, 20, Math.PI),
    faceFeatureMat,
  );
  smile.position.set(0, 1.70, 0.293);
  smile.rotation.z = Math.PI;
  headGroup.add(smile);

  for (let i = -1; i <= 1; i += 2) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), antennaMat);
    ant.position.set(i * 0.07, 2.0, 0);
    ant.rotation.z = i * 0.18;
    headGroup.add(ant);
  }

  torso.add(headGroup);

  // shoulder → upper arm → elbow → lower arm → wrist → hand
  function createArm() {
    const pivot = new THREE.Group();

    // Upper arm — slightly wider cylinder for readable silhouette.
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8), limbMat);
    upper.position.y = -0.21;
    addOutlinedMesh(pivot, upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.42;

    // Lower arm — tapers to wrist.
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.38, 8), limbMat);
    lower.position.y = -0.20;
    addOutlinedMesh(elbow, lower);

    // Wrist — separate joint so bat (and hand sphere) can rotate independently.
    // Children of wrist move when animated, keeping bat + hand in sync.
    const wrist = new THREE.Group();
    wrist.position.set(0, -0.39, 0);  // exactly at forearm bottom, no z-float

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), handMat);
    hand.scale.set(1.2, 0.94, 1.08);
    hand.position.set(0, 0, 0);
    addOutlinedMesh(wrist, hand);

    elbow.add(wrist);
    pivot.add(elbow);
    return { pivot, elbow, wrist };
  }

  // Shoulder anchors: slightly narrower + a touch forward so hands read attached to torso.
  const leftArmRig = createArm();
  const lArmPivot = leftArmRig.pivot;
  lArmPivot.position.set(-0.14, 1.50, 0.05);
  lArmPivot.rotation.z = 0.28;
  lArmPivot.rotation.x = -0.10;
  leftArmRig.elbow.rotation.z = 0.06;

  const rightArmRig = createArm();
  const rArmPivot = rightArmRig.pivot;
  rArmPivot.position.set(0.14, 1.50, 0.05);
  rArmPivot.rotation.z = -0.28;
  rArmPivot.rotation.x = -0.10;
  rightArmRig.elbow.rotation.z = -0.06;

  torso.add(lArmPivot, rArmPivot);

  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.18, 0.35, 0);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.6, 6), limbMat);
  leftLeg.position.y = -0.3;
  lLegPivot.add(leftLeg);

  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.18, 0.35, 0);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.6, 6), limbMat);
  rightLeg.position.y = -0.3;
  rLegPivot.add(rightLeg);
  torso.add(lLegPivot, rLegPivot);

  bodyRoot.add(torso);

  return {
    root, scalePivot, bodyRoot, torso, headGroup, eyePivots,
    rArmPivot, lArmPivot,
    rElbow: rightArmRig.elbow,
    rWrist: rightArmRig.wrist,
    rLegPivot, lLegPivot,
  };
}

// Bat is parented to the right wrist so it follows wrist rotation exactly.
function attachBat(base: BaseFigure): THREE.Group {
  const batGroup = new THREE.Group();
  batGroup.position.set(0, 0, 0);

  const batMat = stdMat(0xd2a679, { emissive: 0x201308, emissiveIntensity: 0.04 });
  // Blade in wrist/hand space; group rotation is driven by swing — mesh offset is ready stance.
  const bat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, 0.22), batMat);
  bat.position.set(0, -0.25, 0.15);
  bat.rotation.set(-0.5, 0.1, 0.2);
  addOutlinedMesh(batGroup, bat);

  base.rWrist.add(batGroup);
  return batGroup;
}

export function createBowlerFigure(_kitColor: number): THREE.Group {
  const base = createBaseFigure(0xe86a3d);
  base.root.userData = {
    scalePivot: base.scalePivot,
    bodyRoot: base.bodyRoot,
    rArmPivot: base.rArmPivot,
    lArmPivot: base.lArmPivot,
    torso: base.torso,
    headGroup: base.headGroup,
    eyePivots: base.eyePivots,
    rLegPivot: base.rLegPivot,
    lLegPivot: base.lLegPivot,
    lockMinY: PLAYER_MIN_Y,
  };
  return base.root;
}

export function createBatsmanFigure(): THREE.Group {
  const base = createBaseFigure(0x2e7d32);
  const batGroup = attachBat(base);
  base.root.userData = {
    scalePivot: base.scalePivot,
    bodyRoot:   base.bodyRoot,
    armsGroup:  batGroup,        // bat group in rWrist space; animator drives rotation
    rArmPivot:  base.rArmPivot,  // whole right arm pivot (shoulder)
    lArmPivot:  base.lArmPivot,  // whole left arm pivot (front/support)
    rElbow:     base.rElbow,     // right elbow bend joint
    rWrist:     base.rWrist,     // right wrist joint (drives hand + bat together)
    torso:      base.torso,
    headGroup:  base.headGroup,
    eyePivots:  base.eyePivots,
    lockMinY:   PLAYER_MIN_Y,
  };
  return base.root;
}

export function createFielderFigure(_variant: number = 0): THREE.Group {
  const base = createBaseFigure(0x2e7d32);
  base.root.userData = {
    scalePivot: base.scalePivot,
    bodyRoot:   base.bodyRoot,
    torso:      base.torso,
    headGroup:  base.headGroup,
    eyePivots:  base.eyePivots,
    rArmPivot:  base.rArmPivot,
    lArmPivot:  base.lArmPivot,
    rLegPivot:  base.rLegPivot,
    lLegPivot:  base.lLegPivot,
    lockMinY:   PLAYER_MIN_Y,
  };
  return base.root;
}

export function placeBowler(group: THREE.Group, bowlerX: number) {
  const p = screenGroundPoint(bowlerX + 14);
  group.position.x = p.x - 0.4;
  group.position.z = p.z;
  group.rotation.y = Math.PI;
}

export function placeBatsman(group: THREE.Group) {
  const p = screenGroundPoint(SIM.BAT_X);
  group.position.x = p.x + 0.35;
  group.position.z = p.z;
}

export function applySquash(base: { scalePivot?: THREE.Group }, intensity: number): void {
  if (!base.scalePivot) return;
  const sp = base.scalePivot;
  const s = 1 + intensity;
  // sp.scale.x is the uniform depth scale written by Renderer this frame — preserve it.
  const d = sp.scale.x;
  sp.scale.set(d / s, d * s, d / s);
}
