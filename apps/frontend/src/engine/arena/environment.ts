import * as THREE from 'three';

export interface ArenaEnvironment {
  group: THREE.Group;
  grassMat: THREE.MeshPhongMaterial;
  ambientDust: THREE.Points;
  update: (time: number) => void;
}

export function createEnvironment(): ArenaEnvironment {
  const group = new THREE.Group();

  // 1. Simple Flat Ground
  const grassGeo = new THREE.PlaneGeometry(160, 160);
  grassGeo.rotateX(-Math.PI / 2);
  const grassMat = new THREE.MeshPhongMaterial({ color: 0x4a9638 }); // Darker, less exposed green
  const grassNode = new THREE.Mesh(grassGeo, grassMat);
  grassNode.position.y = 0;
  group.add(grassNode);

  // 2. Dedicated Pitch Strip
  const pitchGeo = new THREE.PlaneGeometry(4, 30);
  pitchGeo.rotateX(-Math.PI / 2);
  const pitchMat = new THREE.MeshPhongMaterial({ color: 0xb59a72 }); // Darker, more natural beige pitch
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.position.y = 0.01; // Slightly above grass
  group.add(pitch);

  // 3. Boundary Rope (White Ring)
  const boundaryGeo = new THREE.TorusGeometry(55, 0.15, 8, 64);
  boundaryGeo.rotateX(Math.PI / 2);
  const boundaryMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundary.position.y = 0.05;
  group.add(boundary);

  // Return empty objects for compatibility with existing interfaces if needed
  const ambientDust = new THREE.Points();

  return {
    group,
    grassMat,
    ambientDust,
    update: (_time: number) => {
      // No shaders to drive
    }
  };
}
