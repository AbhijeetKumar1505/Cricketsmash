import * as THREE from 'three';

export class SpectatorSystem {
  group: THREE.Group;
  private instances: THREE.InstancedMesh;
  private count = 4000;
  private time = 0;
  private excitementLevel = 0;
  private batch = 0;
  private readonly BATCH_SIZE: number;
  // Pre-computed angle of each instance around the stadium centre
  private angles: Float32Array;

  constructor() {
    this.group = new THREE.Group();
    this.BATCH_SIZE = Math.ceil(this.count / 3);

    const geo = new THREE.PlaneGeometry(0.15, 0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.instances = new THREE.InstancedMesh(geo, mat, this.count);
    this.angles = new Float32Array(this.count);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.angles[i] = angle;
      const radius = 58 + Math.random() * 44;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 5 + Math.random() * 28;

      dummy.position.set(x, y, z);
      dummy.lookAt(0, y, 0);
      dummy.updateMatrix();
      this.instances.setMatrixAt(i, dummy.matrix);

      const color = new THREE.Color();
      const rnd = Math.random();
      if (rnd > 0.96) color.setHex(0xf43f5e);
      else if (rnd > 0.91) color.setHex(0x10b981);
      else if (rnd > 0.86) color.setHex(0xfbbf24);
      else color.setHex(0xe0e7ff);
      this.instances.setColorAt(i, color);
    }

    this.instances.instanceMatrix.needsUpdate = true;
    if (this.instances.instanceColor) this.instances.instanceColor.needsUpdate = true;
    this.group.add(this.instances);
  }

  /** 0–1: drives crowd wave amplitude and speed */
  setExcitement(level: number) {
    this.excitementLevel = Math.max(0, Math.min(1, level));
  }

  update(dt: number) {
    this.time += dt;

    // When the crowd is calm, just do a very slow group drift
    if (this.excitementLevel < 0.05) {
      this.group.rotation.y += dt * 0.008;
      return;
    }

    // Batched update — 1/3 of instances per frame to stay under budget
    const dummy = new THREE.Object3D();
    const start = this.batch * this.BATCH_SIZE;
    const end = Math.min(this.count, start + this.BATCH_SIZE);

    const waveSpeed = 2.5 + this.excitementLevel * 5.5;
    const waveAmp = this.excitementLevel * 1.15;

    for (let i = start; i < end; i++) {
      this.instances.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      // Travelling wave ripple around the stadium ring
      const wave = (Math.sin(this.angles[i]! * 5 - this.time * waveSpeed) + 1) * 0.5;
      dummy.scale.y = 1 + wave * waveAmp;

      dummy.updateMatrix();
      this.instances.setMatrixAt(i, dummy.matrix);
    }

    this.instances.instanceMatrix.needsUpdate = true;
    this.batch = (this.batch + 1) % 3;
  }
}
