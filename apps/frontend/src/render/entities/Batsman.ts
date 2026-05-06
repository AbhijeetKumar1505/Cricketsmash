import * as THREE from 'three';
import { SpriteCharacter } from '../doodle/SpriteCharacter.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';
import type { CharacterAnimState } from '../../engine/systems/AnimationSystem.js';

export class BatsmanEntity {
  readonly root: THREE.Group;
  private readonly sprite: SpriteCharacter;
  private readonly shadow: THREE.Mesh;
  private _time = 0;

  constructor(assets: DoodleAssets) {
    this.root = new THREE.Group();
    this.root.position.set(0, 0, 0);

    const shadowGeo = new THREE.PlaneGeometry(1.2, 0.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: assets.shadow,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.root.add(this.shadow);

    this.sprite = new SpriteCharacter('batsman', assets, 1.8, 2.7);
    this.sprite.mesh.position.y = 1.35;
    this.root.add(this.sprite.mesh);
  }

  update(anim: CharacterAnimState, camera: THREE.Camera): void {
    this._time += 0.016;
    this.sprite.updateFromAnim(anim, camera);

    if (anim.phase === 'idle') {
      this.sprite.mesh.position.y = 1.35 + Math.sin(this._time * 2.8) * 0.04;
    } else if (anim.phase === 'celebrate') {
      this.sprite.mesh.position.y = 1.35 + Math.abs(Math.sin(this._time * 5)) * 0.25;
    } else {
      this.sprite.mesh.position.y = 1.35;
    }

    const s = 1.0 - (this.sprite.mesh.position.y - 1.35) * 0.45;
    this.shadow.scale.set(s, s, s);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.22 * s;
  }

  dispose(): void {
    this.sprite.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
