import * as THREE from 'three';

export function createStarfield(count = 600): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    pos[i3] = (Math.random() - 0.5) * 120;
    pos[i3 + 1] = 8 + Math.random() * 40;
    pos[i3 + 2] = (Math.random() - 0.5) * 80;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}
