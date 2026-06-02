import * as THREE from 'three';

export class CameraShake {
  private intensity = 0;
  private readonly decay = 7; // per second

  trigger(strength = 0.3): void {
    this.intensity = Math.max(this.intensity, strength);
  }

  /** Call in rAF loop. Offsets camera position and decays. */
  update(dt: number, camera: THREE.Camera, basePos: THREE.Vector3): void {
    if (this.intensity < 0.001) {
      this.intensity = 0;
      camera.position.copy(basePos);
      return;
    }
    camera.position.set(
      basePos.x + (Math.random() - 0.5) * this.intensity * 0.4,
      basePos.y + (Math.random() - 0.5) * this.intensity * 0.2,
      basePos.z + (Math.random() - 0.5) * this.intensity * 0.15,
    );
    this.intensity *= Math.exp(-this.decay * dt);
  }

  reset(): void {
    this.intensity = 0;
  }
}
