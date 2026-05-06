import * as THREE from 'three';
import type { DoodleAssets } from '../../render/doodle/DoodleAssets.js';
import type { CharacterAnimState } from '../systems/AnimationSystem.js';
import { BATSMAN_CREASE_Z, BOWLER_RUN_START_Z } from '../worldLayout.js';
import { BaseCharacter } from './BaseCharacter.js';

const BATSMAN_ANCHOR = new THREE.Vector3(0, 0, BATSMAN_CREASE_Z);
const BATSMAN_DEFAULT_LOOK = new THREE.Vector3(0, 0, BOWLER_RUN_START_Z);
const BATSMAN_Y = 0.95;

export class BatsmanCharacter extends BaseCharacter {
  constructor(assets: DoodleAssets) {
    super('batsman', assets, 'batsman', 1.2, 1.8);
    this.anchorPosition.copy(BATSMAN_ANCHOR);
    this.lookTarget.copy(BATSMAN_DEFAULT_LOOK);
    this.setSpriteY(BATSMAN_Y);
  }

  update(
    anim: CharacterAnimState,
    camera: THREE.Camera,
    dt: number,
    bowlerLookTarget?: THREE.Vector3,
  ): void {
    this.anchorPosition.set(0, 0, BATSMAN_CREASE_Z);
    this.lookTarget.copy(bowlerLookTarget ?? BATSMAN_DEFAULT_LOOK);
    super.update(anim, camera, dt);
  }

  protected applySecondaryMotion(anim: CharacterAnimState): void {
    this.setSpriteY(BATSMAN_Y);
    // Horizontal sway only (no vertical bounce)
    this.sprite.mesh.rotation.x = Math.sin(this._time * 0.75 + 0.3) * 0.008;
    this.sprite.mesh.rotation.z = Math.sin(this._time * 1.05 + 0.4) * 0.014;
    if (anim.phase === 'celebrate') {
      this.sprite.mesh.rotation.z += Math.sin(this._time * 3.1) * 0.012;
    }
  }
}
