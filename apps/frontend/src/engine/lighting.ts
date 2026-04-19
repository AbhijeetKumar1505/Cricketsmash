import * as THREE from 'three';

export interface LightingBundle {
  ambient: THREE.AmbientLight;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
}

export function setupLighting(scene: THREE.Scene): LightingBundle {
  scene.fog = new THREE.FogExp2(0x0a1218, 0.045);

  const ambient = new THREE.AmbientLight(0x6a7a88, 0.35);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xa8c4ff, 0x1a3020, 0.55);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e0, 1.25);
  key.position.set(-14, 22, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.bias = -0.00015;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
  fill.position.set(12, 12, -8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffddaa, 0.45);
  rim.position.set(0, 8, -18);
  scene.add(rim);

  return { ambient, hemi, key, fill, rim };
}
