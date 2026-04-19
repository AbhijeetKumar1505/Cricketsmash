import * as THREE from 'three';

const MAX = 400;

/**
 * Reused buffer for dust (bounce), sparks (hit), wicket debris — single draw call.
 */
export class ParticleField extends THREE.Points {
  private readonly velocities: Float32Array;
  private readonly lives: Float32Array;
  private write = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = new Float32Array(MAX * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    super(geo, mat);
    this.frustumCulled = false;
    this.velocities = new Float32Array(MAX * 3);
    this.lives = new Float32Array(MAX);
    this.lives.fill(0);
  }

  spawnBurst(origin: THREE.Vector3, count: number, kind: 'dust' | 'spark' | 'debris') {
    const pos = this.geometry.attributes.position.array as Float32Array;
    const col = this.geometry.attributes.color.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const j = this.write % MAX;
      this.write++;
      const j3 = j * 3;
      pos[j3] = origin.x + (Math.random() - 0.5) * 0.15;
      pos[j3 + 1] = origin.y + Math.random() * 0.1;
      pos[j3 + 2] = origin.z + (Math.random() - 0.5) * 0.15;

      if (kind === 'dust') {
        this.velocities[j3] = (Math.random() - 0.5) * 3.5;
        this.velocities[j3 + 1] = 1.2 + Math.random() * 2.2;
        this.velocities[j3 + 2] = (Math.random() - 0.5) * 2;
        col[j3] = 0.82;
        col[j3 + 1] = 0.74;
        col[j3 + 2] = 0.55;
      } else if (kind === 'spark') {
        this.velocities[j3] = (Math.random() - 0.5) * 8;
        this.velocities[j3 + 1] = 3 + Math.random() * 6;
        this.velocities[j3 + 2] = (Math.random() - 0.5) * 6;
        col[j3] = 1;
        col[j3 + 1] = 0.6 + Math.random() * 0.4;
        col[j3 + 2] = 0.2;
      } else {
        this.velocities[j3] = (Math.random() - 0.5) * 5;
        this.velocities[j3 + 1] = 4 + Math.random() * 5;
        this.velocities[j3 + 2] = (Math.random() - 0.5) * 5;
        col[j3] = 0.95;
        col[j3 + 1] = 0.9;
        col[j3 + 2] = 0.7;
      }
      this.lives[j] = 1;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  update(dt: number) {
    const pos = this.geometry.attributes.position.array as Float32Array;
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      const i3 = i * 3;
      if (this.lives[i] <= 0) {
        pos[i3 + 1] = -999;
        continue;
      }
      alive++;
      this.lives[i] -= dt * 1.8;
      this.velocities[i3 + 1] -= 9.8 * dt;
      pos[i3] += this.velocities[i3] * dt;
      pos[i3 + 1] += this.velocities[i3 + 1] * dt;
      pos[i3 + 2] += this.velocities[i3 + 2] * dt;
      this.velocities[i3] *= 1 - dt * 1.2;
      this.velocities[i3 + 2] *= 1 - dt * 1.2;
      if (this.lives[i] <= 0) this.lives[i] = 0;
    }
    this.visible = alive > 0;
    this.geometry.attributes.position.needsUpdate = true;
  }
}
