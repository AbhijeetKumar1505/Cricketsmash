import * as THREE from 'three';

export class BallTrail {
  private readonly geo: THREE.BufferGeometry;
  private readonly line: THREE.Line;
  private readonly posArr: Float32Array;
  private count = 0;
  private readonly maxLen: number;

  constructor(scene: THREE.Scene, maxLen = 20) {
    this.maxLen = maxLen;
    this.posArr = new Float32Array(maxLen * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    this.geo.setDrawRange(0, 0);

    this.line = new THREE.Line(
      this.geo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  /** Call each frame with the ball's current world position. */
  update(p: THREE.Vector3): void {
    const n = Math.min(this.count, this.maxLen - 1);
    // Shift older points toward end of array
    for (let i = n; i > 0; i--) {
      const s = (i - 1) * 3;
      const d = i * 3;
      this.posArr[d]     = this.posArr[s];
      this.posArr[d + 1] = this.posArr[s + 1];
      this.posArr[d + 2] = this.posArr[s + 2];
    }
    this.posArr[0] = p.x;
    this.posArr[1] = p.y;
    this.posArr[2] = p.z;
    this.count = Math.min(this.count + 1, this.maxLen);
    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.position.needsUpdate = true;
  }

  clear(): void {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }

  /** 0xffffff = weak, 0x4488ff = medium, 0xffc800 = huge */
  setColor(hex: number): void {
    (this.line.material as THREE.LineBasicMaterial).color.setHex(hex);
  }

  dispose(): void {
    this.line.removeFromParent();
    this.geo.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}
