import * as THREE from 'three';

/**
 * HolographicBadge - as specified by the user, a floating, rotating holographic logo 
 * near the boundary or integrated into the scoring console.
 * We'll place it as a high-fidelity "TV Broadcast" floating element.
 */
export class HolographicBadge {
  group: THREE.Group;
  private mesh: THREE.Mesh;
  private glow: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();

    const loader = new THREE.TextureLoader();
    const badgeTex = loader.load('/badgelogo3D.png');
    badgeTex.colorSpace = THREE.SRGBColorSpace;

    this.mat = new THREE.MeshBasicMaterial({
      map: badgeTex,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
    });

    const geo = new THREE.PlaneGeometry(3, 3);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.group.add(this.mesh);

    // Add a pulsing glow behind it
    const glowGeo = new THREE.PlaneGeometry(4.5, 4.5);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.glow.position.z = -0.1;
    this.group.add(this.glow);

    // Blue Zone: Top Left broadcast framing
    this.group.position.set(-22, 20, -20);
    this.group.lookAt(0, 5, 0); // Aim slightly inward
    this.group.rotation.z = 0.15; // Tilted angle for dynamic look
  }

  update(time: number) {
    // Holographic rotation
    this.mesh.rotation.y = time * 0.5;
    this.glow.rotation.y = time * 0.5;

    // Floating bobbing
    this.group.position.y = 5 + Math.sin(time * 0.8) * 0.5;

    // Flickering opacity
    this.mat.opacity = 0.8 + Math.sin(time * 20) * 0.1;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(time * 5) * 0.05;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    (this.glow.material as THREE.Material).dispose();
    this.mat.map?.dispose();
  }
}
