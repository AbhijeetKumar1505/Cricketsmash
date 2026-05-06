import * as THREE from 'three';
import type { DoodleAssets } from '../../render/doodle/DoodleAssets.js';
import type { CharacterAnimState } from '../systems/AnimationSystem.js';
import { makeCharacterAnim } from '../systems/AnimationSystem.js';
import type { DepthScaleOpts } from '../worldLayout.js';
import { ACTION_CENTER } from '../worldLayout.js';
import { BaseCharacter } from './BaseCharacter.js';

const FIELDER_Y = 0.52;

export class FielderCharacter extends BaseCharacter {
  readonly idleAnim: CharacterAnimState = makeCharacterAnim();
  private readonly home = new THREE.Vector3();
  private readonly isKeeper: boolean;

  constructor(anchor: THREE.Vector3, assets: DoodleAssets, variant: number, isKeeper = false, silhouetteScale = 1) {
    super(isKeeper ? 'keeper' : 'fielder', assets, isKeeper ? 'keeper' : 'fielder', 1.2, 1.2, variant, silhouetteScale);
    this.isKeeper = isKeeper;
    this.home.copy(anchor);
    this.anchorPosition.copy(anchor);
    this.lookTarget.copy(ACTION_CENTER);
    this.setSpriteY(FIELDER_Y);
  }

  updateFielder(camera: THREE.Camera, dt: number): void {
    this.idleAnim.breathPhase += dt * 1.2;
    this.anchorPosition.copy(this.home);
    this.lookTarget.copy(ACTION_CENTER);
    super.update(this.idleAnim, camera, dt);
  }

  protected applySecondaryMotion(_anim: CharacterAnimState): void {
    this.setSpriteY(FIELDER_Y);
    const phase = this.idleAnim.breathPhase;
    // Sway on XZ only — no vertical bob
    this.root.position.x = this.home.x + Math.sin(phase * 0.85 + (this.isKeeper ? 0.5 : 0.2)) * 0.04;
    this.root.position.z = this.home.z + Math.cos(phase * 0.72 + (this.isKeeper ? 0.3 : 0.1)) * 0.03;
    this.sprite.mesh.rotation.x = -0.04;
    this.sprite.mesh.rotation.z = Math.sin(phase * 0.88 + (this.isKeeper ? 0.6 : 0.2)) * 0.012;
  }

  protected depthScaleOpts(): DepthScaleOpts {
    return { outfield: true };
  }
}
