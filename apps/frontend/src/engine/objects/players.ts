import * as THREE from 'three';
import { SIM } from '../layout.js';
import { screenGroundPoint } from '../worldMapping.js';

/** 
 * Google Doodle Style Characters.
 * Simple primitives, expressive features, and easy to animate with Squash & Stretch.
 */

function createBlobShadow(radius: number = 0.5): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  return mesh;
}

export function createBowlerFigure(_kitColor: number): THREE.Group {
  const g = new THREE.Group();
  g.add(createBlobShadow(0.4));

  const mat = new THREE.MeshPhongMaterial({ color: 0x4ade80 }); // Vibrant cricket green
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const bodyGroup = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.7, 4, 8), mat);
  torso.position.y = 0.45;
  bodyGroup.add(torso);
  g.add(bodyGroup);

  const headGroup = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), mat);
  headGroup.add(head);
  headGroup.position.y = 1.35;
  g.add(headGroup);

  const eyePivots = new THREE.Group();
  for (let i = -1; i <= 1; i += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    eye.position.set(i * 0.16, 0.05, 0.18);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), pupilMat);
    pupil.position.set(i * 0.16, 0.05, 0.26);
    eyePivots.add(eye, pupil);
  }
  headGroup.add(eyePivots);

  const antMat = new THREE.MeshBasicMaterial({ color: 0x064e3b });
  for (let i = -1; i <= 1; i += 2) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), antMat);
    ant.position.set(i * 0.08, 0.28, 0.05);
    ant.rotation.z = i * -0.4;
    headGroup.add(ant);
  }

  const rArmPivot = new THREE.Group();
  rArmPivot.position.set(0.3, 1.1, 0);
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), mat);
  rArm.position.y = -0.4;
  rArmPivot.add(rArm);
  g.add(rArmPivot);

  // Added pivots for leg animation
  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.1, 0.35, 0);
  const rLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 4, 8), mat);
  rLeg.position.y = -0.2;
  rLegPivot.add(rLeg);
  g.add(rLegPivot);

  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.1, 0.35, 0);
  const lLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 4, 8), mat);
  lLeg.position.y = -0.2;
  lLegPivot.add(lLeg);
  g.add(lLegPivot);

  g.userData = { rArmPivot, torso: bodyGroup, headGroup, eyePivots, rLegPivot, lLegPivot };
  return g;
}

export function createBatsmanFigure(): THREE.Group {
  const g = new THREE.Group();
  g.add(createBlobShadow(0.6));

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffd93d }); // Specified Yellow
  const beakMat = new THREE.MeshPhongMaterial({ color: 0xff8c42 }); // Specified Orange
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const bodyGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), bodyMat);
  body.scale.set(1.1, 0.9, 1); 
  bodyGroup.add(body);
  bodyGroup.position.y = 0.65;
  g.add(bodyGroup);

  const headGroup = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), bodyMat);
  headGroup.add(head);
  headGroup.position.y = 1.3;
  g.add(headGroup);

  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.35), beakMat);
  beak.position.set(0, -0.05, 0.25);
  headGroup.add(beak);

  const eyePivots = new THREE.Group();
  for (let i = -1; i <= 1; i += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eye.position.set(i * 0.1, 0.1, 0.25);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), pupilMat);
    pupil.position.set(i * 0.1, 0.1, 0.3);
    eyePivots.add(eye, pupil);
  }
  headGroup.add(eyePivots);

  const batGroup = new THREE.Group();
  batGroup.position.set(0, 1.1, 0);
  const bat = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 1.3, 0.08),
    new THREE.MeshPhongMaterial({ color: 0xc68642 }) // Specified Wood
  );
  bat.position.set(0.5, -0.5, 0.3);
  bat.rotation.x = 0.5;
  batGroup.add(bat);
  g.add(batGroup);

  g.userData = { armsGroup: batGroup, torso: bodyGroup, headGroup, eyePivots };
  return g;
}

export function createFielderFigure(): THREE.Group {
  const g = new THREE.Group();
  g.add(createBlobShadow(0.4));

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xfef3c7 }); 
  const shellMat = new THREE.MeshPhongMaterial({ color: 0x92400e }); 

  const bodyGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.0, 4, 8), bodyMat);
  body.rotation.z = Math.PI / 2;
  bodyGroup.add(body);
  bodyGroup.position.y = 0.15;
  g.add(bodyGroup);

  const shell = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.15, 12, 24), shellMat);
  shell.rotation.y = Math.PI / 2;
  shell.position.set(-0.2, 0.55, 0);
  g.add(shell);

  const eyePivots = new THREE.Group();
  for (let i = -1; i <= 1; i += 2) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), bodyMat);
    stalk.position.set(0.3, 0.3, i * 0.08);
    stalk.rotation.z = -0.3;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(0.38, 0.48, i * 0.08);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pupil.position.set(0.42, 0.48, i * 0.08);
    eyePivots.add(stalk, eye, pupil);
  }
  g.add(eyePivots);

  g.userData = { torso: bodyGroup, eyePivots, shell };
  return g;
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

export function lookAtBall(fig: THREE.Group, ballPos: THREE.Vector3, isActive: boolean = true) {
  const ud = fig.userData;
  const localBall = fig.worldToLocal(ballPos.clone());
  
  if (ud.headGroup) {
    const targetY = isActive ? THREE.MathUtils.clamp(localBall.x * 0.4, -0.6, 0.6) : 0;
    const targetX = isActive ? THREE.MathUtils.clamp(-localBall.y * 0.3, -0.4, 0.4) : 0;
    ud.headGroup.rotation.y = THREE.MathUtils.lerp(ud.headGroup.rotation.y, targetY, 0.1);
    ud.headGroup.rotation.x = THREE.MathUtils.lerp(ud.headGroup.rotation.x, targetX, 0.1);
  }

  if (ud.eyePivots) {
    if (isActive) {
      const targetX = THREE.MathUtils.clamp(localBall.y * 0.6, -0.5, 0.5);
      const targetY = THREE.MathUtils.clamp(localBall.x * 0.7, -0.8, 0.8);
      ud.eyePivots.rotation.x = THREE.MathUtils.lerp(ud.eyePivots.rotation.x, -targetX, 0.2);
      ud.eyePivots.rotation.y = THREE.MathUtils.lerp(ud.eyePivots.rotation.y, targetY, 0.2);
    } else {
      // Idle circle logic handled by animator or keep current
    }
  }
}
