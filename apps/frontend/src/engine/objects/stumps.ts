import * as THREE from 'three';

export class StumpsSide extends THREE.Group {
  readonly stumps: THREE.Mesh[];
  readonly bails: THREE.Mesh[];

  constructor(battingEnd: boolean) {
    super();
    const wood = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.65 });
    const bailMat = new THREE.MeshStandardMaterial({ color: 0xe8d090, roughness: 0.5 });

    this.stumps = [];
    for (let i = -1; i <= 1; i++) {
      const g = new THREE.CylinderGeometry(0.06, 0.07, 0.72, 8);
      const m = new THREE.Mesh(g, wood);
      // Crease line is across the pitch (X); length runs on Z.
      m.position.set(i * 0.22, 0.36, 0);
      m.castShadow = true;
      this.add(m);
      this.stumps.push(m);
    }

    this.bails = [];
    for (let i = 0; i < 2; i++) {
      // Length along X so each bail rests between adjacent stumps.
      const g = new THREE.BoxGeometry(0.22, 0.05, 0.05);
      const b = new THREE.Mesh(g, bailMat);
      // Y: stump top (0.72) + half bail height (0.025) = 0.745
      b.position.set((i - 0.5) * 0.22, 0.745, 0);
      b.castShadow = true;
      this.add(b);
      this.bails.push(b);
    }

    this.rotation.y = battingEnd ? 0 : Math.PI;
  }

  setWicketFly(progress: number) {
    const p = Math.min(1, progress);
    if (this.stumps[1]) {
      this.stumps[1]!.rotation.x = -p * 1.4; // Tumble backwards away from camera
      this.stumps[1]!.position.y = 0.36 + p * 0.6;
      this.stumps[1]!.position.z = -p * 1.8;
    }
    for (const b of this.bails) {
      b.position.y = 0.745 + p * 1.2;
      b.rotation.x = p * 2;
    }
  }

  resetWicket() {
    if (this.stumps[1]) {
      this.stumps[1]!.rotation.x = 0;
      this.stumps[1]!.position.set(0, 0.36, 0);
    }
    for (let i = 0; i < this.bails.length; i++) {
      this.bails[i]!.position.set((i - 0.5) * 0.22, 0.745, 0);
      this.bails[i]!.rotation.x = 0;
    }
  }
}
