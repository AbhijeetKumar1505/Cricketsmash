import * as THREE from 'three';

export function createSkyBackground(): THREE.Mesh {
  const SIZE = 512;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, '#87CEEB'); // Sky Blue
  grad.addColorStop(1, '#BDE0FE'); // Pale Blue
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const tex = new THREE.CanvasTexture(c);
  const geo = new THREE.SphereGeometry(150, 32, 32);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

export class CartoonClouds extends THREE.Group {
  private clouds: { mesh: THREE.Group; speed: number }[] = [];

  constructor(count = 14) {
    super();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const parts = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < parts; j++) {
        const geo = new THREE.SphereGeometry(1, 12, 12);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(1.5 + Math.random(), 0.8 + Math.random() * 0.5, 1);
        mesh.position.set(j * 0.8 - parts * 0.4, Math.random() * 0.2, 0);
        cloud.add(mesh);
      }

      cloud.position.set(
        (Math.random() - 0.5) * 120,
        15 + Math.random() * 15,
        (Math.random() - 0.5) * 80 - 40
      );
      this.add(cloud);
      this.clouds.push({ mesh: cloud, speed: 0.2 + Math.random() * 0.3 });
    }
  }

  update(dt: number) {
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 70) {
        c.mesh.position.x = -70;
      }
    }
  }
}
