import * as THREE from 'three';
import { BALL } from '../../engine/constants.js';
import type { BallData } from '../../engine/systems/BallSystem.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';

const TRAIL_LENGTH = 10;

export class BallEntity {
  readonly root: THREE.Group;

  private readonly mesh: THREE.Mesh;
  private readonly shadow: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly trail: THREE.Line;
  private readonly trailPositions: THREE.Vector3[];
  private trailIdx = 0;

  constructor(assets: DoodleAssets) {
    this.root = new THREE.Group();

    const geo = new THREE.SphereGeometry(BALL.RADIUS * 1.4, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe53935 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.root.add(this.mesh);

    const glowMat = new THREE.SpriteMaterial({
      map: assets.ballGlow,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.6,
    });
    this.glow = new THREE.Sprite(glowMat);
    this.glow.scale.set(0.6, 0.6, 0.6);
    this.mesh.add(this.glow);

    const seamGeo = new THREE.TorusGeometry(BALL.RADIUS * 1.42, 0.004, 4, 24);
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const seam = new THREE.Mesh(seamGeo, seamMat);
    this.mesh.add(seam);

    const shadowGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: assets.shadow,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.shadow);

    this.trailPositions = Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3(0, -100, 0));
    const trailGeo = new THREE.BufferGeometry().setFromPoints(this.trailPositions);
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xffcdd2,
      transparent: true,
      opacity: 0.5,
      linewidth: 1,
    });
    this.trail = new THREE.Line(trailGeo, trailMat);
    this.trail.frustumCulled = false;
    this.root.add(this.trail);
  }

  update(ball: BallData): void {
    const visible = ball.active;
    this.root.visible = visible;
    if (!visible) return;

    this.mesh.position.set(ball.x, ball.y, ball.z);
    this.mesh.rotation.x = ball.rx * 0.5;
    this.mesh.rotation.z = ball.rz * 0.5;

    if (ball.y < 0.08) this.mesh.scale.set(1.3, 0.7, 1.3);
    else if (Math.abs(ball.vy) > 4) this.mesh.scale.set(0.85, 1.2, 0.85);
    else this.mesh.scale.set(1, 1, 1);

    this.shadow.position.set(ball.x, 0.005, ball.z);
    const shadowScale = Math.max(0.3, 1 - ball.y * 0.15);
    this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.18 * shadowScale;

    this.trailPositions[this.trailIdx % TRAIL_LENGTH].set(ball.x, ball.y, ball.z);
    this.trailIdx++;
    const posAttr = this.trail.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const idx = (this.trailIdx - TRAIL_LENGTH + i + TRAIL_LENGTH * 100) % TRAIL_LENGTH;
      const p = this.trailPositions[idx];
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
  }
}
