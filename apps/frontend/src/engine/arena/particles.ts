import * as THREE from 'three';

const MAX_PARTICLES = 500;
const MAX_TRAIL = 200;

export class ArenaParticleSystem extends THREE.Group {
  private dustPoints: THREE.Points;
  private dustLives: Float32Array;
  private dustVel: Float32Array;
  private dustWrite = 0;

  private trailPoints: THREE.Points;
  private trailLives: Float32Array;
  private trailWrite = 0;

  constructor() {
    super();

    // 1. Core Physics Dust / Impact Sparks Node
    const dGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(MAX_PARTICLES * 3);
    const dCol = new Float32Array(MAX_PARTICLES * 3);
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
    const dMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.dustPoints = new THREE.Points(dGeo, dMat);
    this.dustPoints.frustumCulled = false;
    this.add(this.dustPoints);

    this.dustVel = new Float32Array(MAX_PARTICLES * 3);
    this.dustLives = new Float32Array(MAX_PARTICLES).fill(0);

    // 2. High-Speed Energy Trails (Boundaries)
    const tGeo = new THREE.BufferGeometry();
    const tPos = new Float32Array(MAX_TRAIL * 3);
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    const tMat = new THREE.PointsMaterial({
      color: 0xffd066,
      size: 0.28,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.trailPoints = new THREE.Points(tGeo, tMat);
    this.trailPoints.frustumCulled = false;
    this.add(this.trailPoints);
    
    this.trailLives = new Float32Array(MAX_TRAIL).fill(0);
  }

  spawnBurst(origin: THREE.Vector3, count: number, kind: 'dust' | 'spark' | 'debris') {
    const pos = this.dustPoints.geometry.attributes.position.array as Float32Array;
    const col = this.dustPoints.geometry.attributes.color.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const idx = this.dustWrite % MAX_PARTICLES;
      this.dustWrite++;
      const j3 = idx * 3;
      
      pos[j3] = origin.x + (Math.random() - 0.5) * 0.2;
      pos[j3 + 1] = origin.y + Math.random() * 0.15;
      pos[j3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;

      if (kind === 'dust') {
        this.dustVel[j3] = (Math.random() - 0.5) * 3.5;
        this.dustVel[j3 + 1] = 1.5 + Math.random() * 2.5;
        this.dustVel[j3 + 2] = (Math.random() - 0.5) * 2;
        col[j3] = 0.85; col[j3 + 1] = 0.78; col[j3 + 2] = 0.6;
      } else if (kind === 'spark') {
        this.dustVel[j3] = (Math.random() - 0.5) * 8;
        this.dustVel[j3 + 1] = 4 + Math.random() * 6;
        this.dustVel[j3 + 2] = (Math.random() - 0.5) * 6;
        col[j3] = 1; col[j3 + 1] = 0.7 + Math.random() * 0.3; col[j3 + 2] = 0.1;
      } else {
        this.dustVel[j3] = (Math.random() - 0.5) * 6;
        this.dustVel[j3 + 1] = 5 + Math.random() * 5;
        this.dustVel[j3 + 2] = (Math.random() - 0.5) * 6;
        col[j3] = 0.95; col[j3 + 1] = 0.2; col[j3 + 2] = 0.2; // Wicket red
      }
      this.dustLives[idx] = 1;
    }
    this.dustPoints.geometry.attributes.position.needsUpdate = true;
    this.dustPoints.geometry.attributes.color.needsUpdate = true;
  }

  emitTrail(pos3: THREE.Vector3) {
    const pos = this.trailPoints.geometry.attributes.position.array as Float32Array;
    const idx = this.trailWrite % MAX_TRAIL;
    this.trailWrite++;
    const j3 = idx * 3;
    
    pos[j3] = pos3.x + (Math.random() - 0.5) * 0.1;
    pos[j3+1] = pos3.y + (Math.random() - 0.5) * 0.1;
    pos[j3+2] = pos3.z + (Math.random() - 0.5) * 0.1;
    this.trailLives[idx] = 1.0;
    this.trailPoints.geometry.attributes.position.needsUpdate = true;
  }

  update(dt: number) {
    // Update Core Dust/Sparks
    const dPos = this.dustPoints.geometry.attributes.position.array as Float32Array;
    let dAlive = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.dustLives[i] <= 0) {
        dPos[i * 3 + 1] = -999;
        continue;
      }
      dAlive++;
      const i3 = i * 3;
      this.dustLives[i] -= dt * 1.6;
      this.dustVel[i3 + 1] -= 9.8 * dt; // gravity
      
      dPos[i3] += this.dustVel[i3] * dt;
      dPos[i3 + 1] += this.dustVel[i3 + 1] * dt;
      dPos[i3 + 2] += this.dustVel[i3 + 2] * dt;
      
      this.dustVel[i3] *= (1 - dt * 1.5); // drag
      this.dustVel[i3 + 2] *= (1 - dt * 1.5);
    }
    this.dustPoints.visible = dAlive > 0;
    this.dustPoints.geometry.attributes.position.needsUpdate = true;

    // Update Trail Fades
    const tPos = this.trailPoints.geometry.attributes.position.array as Float32Array;
    let tAlive = 0;
    for (let i = 0; i < MAX_TRAIL; i++) {
      if (this.trailLives[i] <= 0) {
        tPos[i * 3 + 1] = -999;
        continue;
      }
      tAlive++;
      this.trailLives[i] -= dt * 3.0; // Fast fade 300ms
      // Trails gently float up
      tPos[i * 3 + 1] += dt * 0.5;
    }
    this.trailPoints.visible = tAlive > 0;
    this.trailPoints.geometry.attributes.position.needsUpdate = true;
  }
}
