import * as THREE from 'three';

export class SpectatorSystem {
  group: THREE.Group;
  private imesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private count = 1000;
  private time = 0;
  private basePositions: Float32Array;
  private jumpOffsets: Float32Array;

  constructor() {
    this.group = new THREE.Group();
    
    // Simple blocky characters for the crowd (Google Doodle flat style)
    const geo = new THREE.BoxGeometry(0.8, 1.5, 0.8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.imesh = new THREE.InstancedMesh(geo, mat, this.count);
    
    this.basePositions = new Float32Array(this.count * 3);
    this.jumpOffsets = new Float32Array(this.count);
    
    const color = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      // Distribute randomly around the stadium boundary
      const angle = (Math.random() * Math.PI * 2);
      const radius = 62 + Math.random() * 25;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (radius - 62) * 0.4 + 0.75; // Stepped elevation

      this.basePositions[i * 3 + 0] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;
      
      this.dummy.position.set(x, y, z);
      this.dummy.lookAt(0, 0, 0); // Face the pitch
      this.dummy.updateMatrix();
      this.imesh.setMatrixAt(i, this.dummy.matrix);

      // Random bright, flat cartoon colors
      const section = Math.floor((angle / (Math.PI * 2)) * 6);
      const baseHue = (section / 6 + 0.04 * Math.random()) % 1;
      color.setHSL(baseHue, 0.62 + Math.random() * 0.24, 0.36 + Math.random() * 0.32);
      this.imesh.setColorAt(i, color);

      this.jumpOffsets[i] = Math.random() * Math.PI * 2;
    }

    this.imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.imesh);
  }

  update(dt: number, phase: string = 'idle') {
    this.time += dt;
    
    let jumpIntensity = 0.15;
    let speed = 3;
    
    // React to hits and wickets as per the exact game-feel specs
    if (phase === 'hit' || phase === 'celebrate') {
       jumpIntensity = 1.2;
       speed = 15;
    } else if (phase === 'wicket') {
       jumpIntensity = 0.05;
       speed = 1;
    }

    for (let i = 0; i < this.count; i++) {
      this.imesh.getMatrixAt(i, this.dummy.matrix);
      this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
      
      const baseX = this.basePositions[i * 3 + 0];
      const baseY = this.basePositions[i * 3 + 1];
      const baseZ = this.basePositions[i * 3 + 2];
      
      const bob = Math.sin(this.time * (speed * 0.33) + this.jumpOffsets[i]) * 0.1;
      const yOffset = Math.abs(Math.sin(this.time * speed + this.jumpOffsets[i])) * jumpIntensity + bob;
      
      this.dummy.position.set(baseX, baseY + yOffset, baseZ);
      
      // Squash & stretch scale effect
      const stretch = 1.0 + yOffset * 0.3;
      const squash = 1.0 - yOffset * 0.1;
      this.dummy.scale.set(squash, stretch, squash);
      
      this.dummy.updateMatrix();
      this.imesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.imesh.instanceMatrix.needsUpdate = true;
  }
}
