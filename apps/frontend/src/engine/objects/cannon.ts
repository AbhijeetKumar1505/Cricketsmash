import * as THREE from 'three';

/**
 * Ceramic/Golden Cannon — a high-fidelity 3D prop sitting near the pitch.
 * Used for ceremonial "shooting" effects during high-multiplier events.
 */
export class GoldenCannon {
  group: THREE.Group;
  private barrel: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();

    // Premium Textured Material
    const loader = new THREE.TextureLoader();
    const canonTex = loader.load('/canon.png');
    canonTex.colorSpace = THREE.SRGBColorSpace;

    const goldMat = new THREE.MeshStandardMaterial({
      map: canonTex,
      metalness: 0.8,
      roughness: 0.2,
      envMapIntensity: 1.2,
    });

    // Dark Wood / Iron Carriage
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, // Darker charcoal
      roughness: 0.7,
      map: canonTex, // Shared texture for mechanical consistency
    });

    // 1. The Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.2, 0.35, 2.2, 32);
    this.barrel = new THREE.Mesh(barrelGeo, goldMat);
    this.barrel.rotation.z = Math.PI / 2.8; // Cocked upwards
    this.barrel.position.y = 0.8;
    this.barrel.castShadow = true;
    this.group.add(this.barrel);

    // Muzzle ring
    const muzzleGeo = new THREE.TorusGeometry(0.24, 0.08, 16, 32);
    const muzzle = new THREE.Mesh(muzzleGeo, goldMat);
    muzzle.rotation.z = Math.PI / 2.8;
    muzzle.position.copy(this.barrel.position);
    muzzle.position.x += 1.0;
    muzzle.position.y += 0.55;
    this.group.add(muzzle);

    // 2. The Carriage (Base)
    const baseGeo = new THREE.BoxGeometry(1.2, 0.4, 0.8);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    base.castShadow = true;
    this.group.add(base);

    // 3. The Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 32);
    const wheel1 = new THREE.Mesh(wheelGeo, baseMat);
    wheel1.rotation.x = Math.PI / 2;
    wheel1.position.set(0, 0.5, 0.45);
    wheel1.castShadow = true;
    this.group.add(wheel1);

    const wheel2 = wheel1.clone();
    wheel2.position.z = -0.45;
    this.group.add(wheel2);

    // Initial world position (near the boundary)
    this.group.position.set(-15, 0, 10);
    this.group.lookAt(0, 0, 0);
  }

  update(time: number) {
    // Subtle idle breathing
    this.barrel.rotation.z = Math.PI / 2.8 + Math.sin(time * 0.5) * 0.02;
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}
