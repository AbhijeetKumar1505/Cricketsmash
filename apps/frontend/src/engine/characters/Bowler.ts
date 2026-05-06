import * as THREE from 'three';
import type { DoodleAssets } from '../../render/doodle/DoodleAssets.js';
import type { CharacterAnimState } from '../systems/AnimationSystem.js';
import { BATSMAN_CREASE_Z, BOWLER_RELEASE_Z, BOWLER_RUN_START_Z } from '../worldLayout.js';
import { BaseCharacter } from './BaseCharacter.js';

const BOWLER_X = 0;
const BATSMAN_LOOK_TARGET = new THREE.Vector3(0, 0, BATSMAN_CREASE_Z);
const BOWLER_Y = 1.12;

export class BowlerCharacter extends BaseCharacter {
  constructor(assets: DoodleAssets) {
    super('bowler', assets, 'bowler', 1.2, 1.8);
    this.anchorPosition.set(BOWLER_X, 0, BOWLER_RUN_START_Z);
    this.lookTarget.copy(BATSMAN_LOOK_TARGET);
    this.setSpriteY(BOWLER_Y);
  }

  update(
    anim: CharacterAnimState,
    camera: THREE.Camera,
    dt: number,
    batsmanAnchor?: THREE.Vector3,
  ): void {
    const t = THREE.MathUtils.clamp(anim.runT, 0, 1);
    const z = THREE.MathUtils.lerp(BOWLER_RUN_START_Z, BOWLER_RELEASE_Z, t);
    this.anchorPosition.set(BOWLER_X, 0, z);
    this.lookTarget.copy(batsmanAnchor ?? BATSMAN_LOOK_TARGET);
    this.root.visible = anim.phase !== 'idle';
    super.update(anim, camera, dt);
  }

  protected applySecondaryMotion(anim: CharacterAnimState): void {
    this.setSpriteY(BOWLER_Y);
    this.sprite.mesh.rotation.x = Math.sin(this._time * 0.65 + 0.1) * 0.007;
    this.sprite.mesh.rotation.z = Math.sin(this._time * 0.95 + 0.6) * 0.014;
    if (anim.phase === 'run') {
      this.sprite.mesh.rotation.z += Math.sin(this._time * 2.8) * 0.008;
    }
  }
}
