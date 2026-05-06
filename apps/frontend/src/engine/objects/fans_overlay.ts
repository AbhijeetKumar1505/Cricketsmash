import * as THREE from 'three';

/**
 * FansOverlay System - poster-style foreground crowd placards and silhouettes.
 * These are intentionally flatter and more graphic than the earlier caricature
 * version so they can echo the reference's foreground crowd energy.
 */
export class FansOverlaySystem {
  group: THREE.Group;
  private meshes: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    const texLeft = loader.load('/AudienceOverlayLeft.png');
    texLeft.colorSpace = THREE.SRGBColorSpace;
    const texRight = loader.load('/AudienceOverlayRight.png');
    texRight.colorSpace = THREE.SRGBColorSpace;

    const FAN_POSITIONS = [
      // Green Zone: Bottom Left foreground framing
      { x: -11, y: -2.0, z: 18, tex: texLeft,  scale: 6.2 },
      { x: -16, y: -0.5, z: 20, tex: texLeft,  scale: 7.5 },
      // White Zone: Bottom Right foreground framing
      { x: 11,  y: -2.0, z: 18, tex: texRight, scale: 6.2 },
      { x: 16,  y: -0.5, z: 20, tex: texRight, scale: 7.5 },
    ] as const;

    for (const pos of FAN_POSITIONS) {
      const geo = new THREE.PlaneGeometry(1.6 * pos.scale, 2.2 * pos.scale);
      const mat = new THREE.MeshBasicMaterial({
        map: pos.tex,
        transparent: true,
        side: THREE.FrontSide, // Optimized for broadcast view
        depthTest: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.lookAt(0, pos.y, 0);

      this.group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  update(time: number) {
    this.meshes.forEach((mesh, i) => {
      // Subtle organic bobbing
      mesh.position.y += Math.sin(time * 1.5 + i) * 0.0012;
    });
  }

  dispose() {
    this.meshes.forEach(m => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      (m.material as any).map?.dispose();
    });
  }
}
