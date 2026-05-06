import * as THREE from 'three';

// Stadium structure logic simplified for Google Doodle style

export interface StadiumStructure {
  group: THREE.Group;
  floodlightLights: THREE.SpotLight[];
  update: (time: number) => void;
  dispose: () => void;
}

export function createStadiumStructure(): StadiumStructure {
  const group = new THREE.Group();
  const toDispose: { dispose(): void }[] = [];

  // Add Cartoon Sky
  const skyGeo = new THREE.SphereGeometry(150, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87ceeb,
    side: THREE.BackSide,
    fog: false
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);

  // Simple Cloud Sprites
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 15; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 4, 8, 8), cloudMat);
    const angle = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 20;
    cloud.position.set(Math.cos(angle) * r, 40 + Math.random() * 30, Math.sin(angle) * r);
    cloud.scale.y = 0.4;
    group.add(cloud);
  }

  return {
    group,
    floodlightLights: [],
    update: (_time: number) => {
      // Empty
    },
    dispose: () => {
      for (const d of toDispose) d.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      cloudMat.dispose();
    }
  };
}
