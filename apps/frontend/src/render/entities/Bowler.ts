import * as THREE from 'three';
import { WORLD } from '../../engine/constants.js';
import { SpriteCharacter } from '../doodle/SpriteCharacter.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';
import type { CharacterAnimState } from '../../engine/systems/AnimationSystem.js';

const RUN_START_Z = WORLD.STUMPS_FAR_Z - 6;
const RELEASE_Z   = WORLD.STUMPS_FAR_Z + 0.4;

export class BowlerEntity {
  readonly root: THREE.Group;
  private readonly sprite: SpriteCharacter;
  private readonly shadow: THREE.Mesh;
  private _time = 0;

  constructor(assets: DoodleAssets) {
    this.root = new THREE.Group();

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

    this.sprite = new SpriteCharacter('bowler', assets, 1.7, 2.55);
    this.sprite.mesh.position.y = 1.28;
    this.root.add(this.sprite.mesh);
    this.setPosition(0);
  }

  update(anim: CharacterAnimState, camera: THREE.Camera): void {
    this._time += 0.016;
    const t = Math.max(0, Math.min(1, anim.runT));
    this.setPosition(t);
    this.root.visible = anim.phase !== 'idle';
    this.sprite.updateFromAnim(anim, camera);

    if (anim.phase === 'run') {
      this.sprite.mesh.position.y = 1.28 + Math.abs(Math.sin(this._time * 12)) * 0.08;
    } else {
      this.sprite.mesh.position.y = 1.28;
    }

    const s = 1.0 - (this.sprite.mesh.position.y - 1.28) * 0.45;
    this.shadow.scale.set(s, s, s);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.22 * s;
  }

  dispose(): void {
    this.sprite.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }

  private setPosition(t: number): void {
    this.root.position.set(0, 0, THREE.MathUtils.lerp(RUN_START_Z, RELEASE_Z, t));
  }
}
