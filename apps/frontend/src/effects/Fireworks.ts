import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: number;
}

const COLORS = [0xffc800, 0xff4fd8, 0x00ffcc, 0xff2244, 0x44aaff];

export class Fireworks {
  private particles: Particle[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly pts: THREE.Points;
  private readonly colArr: Float32Array;
  private readonly posArr: Float32Array;
  private readonly maxPts = 400;

  constructor(scene: THREE.Scene) {
    this.posArr = new Float32Array(this.maxPts * 3);
    this.colArr = new Float32Array(this.maxPts * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3));
    this.geo.setDrawRange(0, 0);
    this.pts = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 1 }),
    );
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  }

  burst(origin: THREE.Vector3, count = 80): void {
    const c = new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const spd = 3 + Math.random() * 7;
      this.particles.push({
        pos: origin.clone(),
        vel: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.cos(phi) * spd * 0.6 + spd * 0.4,
          Math.sin(phi) * Math.sin(theta) * spd,
        ),
        life: 0,
        maxLife: 1.2 + Math.random() * 0.8,
        color: c.getHex(),
      });
    }
    if (this.particles.length > this.maxPts) {
      this.particles = this.particles.slice(-this.maxPts);
    }
  }

  update(dt: number): void {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life < p.maxLife) {
        p.vel.y -= 9.8 * dt;
        p.pos.addScaledVector(p.vel, dt);
        alive.push(p);
      }
    }
    this.particles = alive;

    const col = new THREE.Color();
    for (let i = 0; i < alive.length; i++) {
      const p = alive[i];
      const t = p.life / p.maxLife;
      this.posArr[i * 3]     = p.pos.x;
      this.posArr[i * 3 + 1] = p.pos.y;
      this.posArr[i * 3 + 2] = p.pos.z;
      col.setHex(p.color);
      this.colArr[i * 3]     = col.r * (1 - t);
      this.colArr[i * 3 + 1] = col.g * (1 - t);
      this.colArr[i * 3 + 2] = col.b * (1 - t);
    }
    const count = alive.length;
    this.geo.setDrawRange(0, count);
    if (count > 0) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  get active(): boolean {
    return this.particles.length > 0;
  }

  dispose(): void {
    this.pts.removeFromParent();
    this.geo.dispose();
    (this.pts.material as THREE.Material).dispose();
  }
}
