import * as THREE from 'three';
import { SIM } from '../layout.js';
import { screenGroundPoint } from '../worldMapping.js';

/** 
 * Procedural stylized blocky characters (Voxel/Crossy Road style).
 * Easy to animate by rotating limb pivots without complex bone structures.
 */

export function createBowlerFigure(kitColor: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: kitColor, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b090, roughness: 0.6 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  torso.userData.kit = true;
  g.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
  head.position.y = 1.6;
  head.castShadow = true;
  g.add(head);

  // Right Arm (Bowling arm)
  const rArmPivot = new THREE.Group();
  rArmPivot.position.set(0.35, 1.3, 0); // Shoulder joint
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), mat);
  rArm.position.y = -0.25; // drop down from pivot
  rArm.castShadow = true;
  rArm.userData.kit = true;
  rArmPivot.add(rArm);
  g.add(rArmPivot);

  // Left Arm
  const lArmPivot = new THREE.Group();
  lArmPivot.position.set(-0.35, 1.3, 0);
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), mat);
  lArm.position.y = -0.25;
  lArm.castShadow = true;
  lArm.userData.kit = true;
  lArmPivot.add(lArm);
  g.add(lArmPivot);

  // Right Leg
  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.15, 0.7, 0);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  rLeg.position.y = -0.3;
  rLeg.castShadow = true;
  rLeg.userData.kit = true;
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.25), shoeMat);
  rShoe.position.set(0, -0.65, 0.05);
  rLegPivot.add(rLeg, rShoe);
  g.add(rLegPivot);

  // Left Leg
  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.15, 0.7, 0);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  lLeg.position.y = -0.3;
  lLeg.castShadow = true;
  lLeg.userData.kit = true;
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.25), shoeMat);
  lShoe.position.set(0, -0.65, 0.05);
  lLegPivot.add(lLeg, lShoe);
  g.add(lLegPivot);

  // Bowler pre-runup stance: slight forward lean, arms loose at sides
  torso.rotation.x = -0.12;
  lLegPivot.rotation.x = 0.1;  // back leg slightly behind
  lArmPivot.rotation.x = 0.18; // arms slightly back, ready

  g.userData = { rArmPivot, lArmPivot, rLegPivot, lLegPivot, torso };
  return g;
}

export function createBatsmanFigure(): THREE.Group {
  const g = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, roughness: 0.6 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xf2edd8, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b090, roughness: 0.6 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x112244, roughness: 0.3, metalness: 0.2 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), jersey);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);

  // Helmet / Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), skin);
  head.position.y = 1.55;
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), helmetMat);
  helmet.position.y = 1.7;
  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, wireframe: true }));
  grill.position.set(0, 1.55, 0.18);
  g.add(head, helmet, grill);

  // Arms holding bat — cricket guard position (bat backlift)
  const armsGroup = new THREE.Group();
  armsGroup.position.set(0, 1.3, 0);

  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.15), jersey);
  rArm.position.set(0.3, -0.2, 0.18);
  rArm.rotation.x = -0.5;
  armsGroup.add(rArm);

  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.15), jersey);
  lArm.position.set(-0.3, -0.2, 0.18);
  lArm.rotation.x = -0.5;
  armsGroup.add(lArm);

  // Bat
  const bat = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.0, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.6 })
  );
  bat.position.set(0.1, -0.55, 0.42);
  bat.rotation.x = 0.5;
  armsGroup.add(bat);

  // Set bat-backlift guard stance on arms group
  armsGroup.rotation.z = -0.55;
  armsGroup.rotation.x = -0.18;

  g.userData.armsGroup = armsGroup;
  g.userData.torso = torso;
  g.add(armsGroup);

  // Torso: forward lean + slight turn toward bowler
  torso.rotation.x = -0.12;
  torso.rotation.y = 0.08;

  // Pads (Legs) — slight knee bend, front foot advanced
  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.15, 0.7, 0);
  const rPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.24), padMat);
  rPad.position.y = -0.3;
  rLegPivot.add(rPad);
  rLegPivot.rotation.x = 0.08; // slight knee bend
  g.add(rLegPivot);

  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.15, 0.7, 0);
  const lPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.24), padMat);
  lPad.position.y = -0.3;
  lPad.position.z = 0.12; // front foot slightly forward
  lLegPivot.add(lPad);
  lLegPivot.rotation.x = -0.1; // front leg angled forward
  g.add(lLegPivot);

  g.rotation.y = -0.4;
  g.userData.rLegPivot = rLegPivot;
  g.userData.lLegPivot = lLegPivot;
  return g;
}

export function placeBowler(group: THREE.Group, bowlerX: number) {
  const p = screenGroundPoint(bowlerX + 14);
  // Only set X and Z — Y is managed by playerAnimator for jump animation
  group.position.x = p.x - 0.4;
  group.position.z = p.z;
  group.rotation.y = Math.PI;
}

export function placeBatsman(group: THREE.Group) {
  const p = screenGroundPoint(SIM.BAT_X);
  // Only set X and Z — Y is managed by playerAnimator for celebrate/wicket animation
  group.position.x = p.x + 0.35;
  group.position.z = p.z;
}
