import * as THREE from 'three';

const MAX = 400;

/**
 * Doodle-style particle field.
 * Confetti (bright multi-color) for hits, tan dust for bounces.
 * Uses NormalBlending for flat opaque colors (not additive glow).
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
      size: 0.22,           // bigger for doodle visibility
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,   // flat colors, not additive glow
      sizeAttenuation: true,
    });
    super(geo, mat);
    this.frustumCulled = false;
    this.velocities = new Float32Array(MAX * 3);
    this.lives = new Float32Array(MAX);
    this.lives.fill(0);
  }

  // Confetti colors for doodle celebration
  private static CONFETTI = [
    [1.0, 0.2, 0.3],   // red
    [0.2, 0.7, 1.0],   // blue
    [1.0, 0.85, 0.1],  // yellow
    [0.3, 0.9, 0.4],   // green
    [0.9, 0.3, 0.8],   // pink
    [1.0, 0.5, 0.1],   // orange
  ];

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
        // Lighter tan dust
        col[j3] = 0.88; col[j3 + 1] = 0.82; col[j3 + 2] = 0.65;
      } else if (kind === 'spark') {
        // Confetti burst for 4s and 6s!
        this.velocities[j3] = (Math.random() - 0.5) * 8;
        this.velocities[j3 + 1] = 3 + Math.random() * 6;
        this.velocities[j3 + 2] = (Math.random() - 0.5) * 6;
        const cc = ParticleField.CONFETTI[Math.floor(Math.random() * ParticleField.CONFETTI.length)];
        col[j3] = cc[0]; col[j3 + 1] = cc[1]; col[j3 + 2] = cc[2];
      } else {
        this.velocities[j3] = (Math.random() - 0.5) * 5;
        this.velocities[j3 + 1] = 4 + Math.random() * 5;
        this.velocities[j3 + 2] = (Math.random() - 0.5) * 5;
        // Stump debris — wood brown
        col[j3] = 0.85; col[j3 + 1] = 0.72; col[j3 + 2] = 0.5;
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
