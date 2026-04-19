import * as THREE from 'three';
import { WORLD } from '../layout.js';
import { screenToWorld } from '../worldMapping.js';


export class CricketBall extends THREE.Group {
  readonly mesh: THREE.Mesh;
  readonly glow: THREE.PointLight;
  readonly seam: THREE.Group;
  private readonly highlight: THREE.Mesh;

  constructor() {
    super();
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xd42828,
      roughness: 0.42,
      metalness: 0.05,
    });
    const geo = new THREE.SphereGeometry(WORLD.ballRadius, 28, 28);
    this.mesh = new THREE.Mesh(geo, ballMat);
    this.mesh.castShadow = true;
    this.add(this.mesh);

    const hiMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
    });
    const hiGeo = new THREE.SphereGeometry(WORLD.ballRadius * 0.22, 12, 12);
    this.highlight = new THREE.Mesh(hiGeo, hiMat);
    this.highlight.position.set(-0.06, 0.08, 0.08);
    this.add(this.highlight);

    this.seam = new THREE.Group();
    const dotGeo = new THREE.SphereGeometry(0.028, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 5 - 0.5) * Math.PI * 0.85;
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(Math.cos(a) * WORLD.ballRadius * 0.85, Math.sin(a) * WORLD.ballRadius * 0.85, 0);
      this.seam.add(d);
    }
    this.mesh.add(this.seam);

    this.glow = new THREE.PointLight(0xff6644, 0, 6);
    this.glow.position.set(0, 0, 0);
    this.add(this.glow);
  }

  applyFrame(
    bx: number,
    by: number,
    _bScale: number,
    bAlpha: number,
    spinRate: number,
    dt: number,
    glowRgb: [number, number, number],
    glowStrength: number
  ) {
    const w = screenToWorld(bx, by);
    this.position.copy(w);
    // Do not apply bScale as a mesh scale — Three.js perspective projection already
    // makes the ball appear larger when closer. Manual scaling would double the effect.
    this.mesh.rotation.x += dt * spinRate * 0.9;
    this.mesh.rotation.z += dt * spinRate * 0.4;

    this.glow.color.setRGB(glowRgb[0], glowRgb[1], glowRgb[2]);
    this.glow.intensity = glowStrength * 3.5;
    this.glow.distance = 5 + glowStrength * 8;

    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.transparent = bAlpha < 0.999;
    mat.opacity = bAlpha;
    const hi = this.highlight.material as THREE.MeshBasicMaterial;
    hi.opacity = 0.45 * bAlpha;
  }
}
