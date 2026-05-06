import * as THREE from 'three';
import { SpriteCharacter, type CharacterType } from '../../render/doodle/SpriteCharacter.js';
import type { DoodleAssets } from '../../render/doodle/DoodleAssets.js';
import type { CharacterAnimState } from '../systems/AnimationSystem.js';
import { getDepthScale, type DepthScaleOpts } from '../worldLayout.js';

export const CHARACTER_SCALE = {
  batsman: 1.2,
  bowler: 1.2,
  fielder: 0.8,
  keeper: 0.8,
} as const;

const SHADOW_OPACITY = 0.15;

type CharacterScaleKey = keyof typeof CHARACTER_SCALE;

/**
 * Flat doodle character: vertical sprite + ground shadow, XZ look-at toward
 * `lookTarget`, depth-based scale (no camera billboard).
 */
export abstract class BaseCharacter {
  readonly root = new THREE.Group();
  readonly anchorPosition = new THREE.Vector3();
  readonly lookTarget = new THREE.Vector3();

  protected readonly sprite: SpriteCharacter;
  protected readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  protected readonly scale: number;
  readonly role: CharacterType;
  protected readonly instanceScaleMul: number;
  protected _time = 0;

  constructor(
    role: CharacterType,
    assets: DoodleAssets,
    scaleKey: CharacterScaleKey,
    width: number,
    height: number,
    variant = 0,
    instanceScaleMul = 1,
  ) {
    this.role = role;
    this.scale = CHARACTER_SCALE[scaleKey];
    this.instanceScaleMul = instanceScaleMul;

    // Build grounded shadow (plain soft ellipse; no textured/shaded artifacts).
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: SHADOW_OPACITY,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.shadow.scale.setScalar(this.scale);
    this.root.add(this.shadow);

    this.sprite = new SpriteCharacter(role, assets, width * this.scale, height * this.scale, variant);
    this.root.add(this.sprite.mesh);

    // Slight per-instance tint for warmth/imperfection (keeps doodle feel).
    if (role === 'fielder' || role === 'keeper') {
      const tintAmtBase = role === 'keeper' ? 0.004 : 0.006;
      const tintAmt = (variant - 2) * tintAmtBase;
      const mat = this.sprite.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0xffffff);
      mat.color.offsetHSL(0, 0, tintAmt);
    }
  }

  /** Primary visual mesh (sprite quad). */
  get mesh(): THREE.Mesh {
    return this.sprite.mesh;
  }

  setAnchor(x: number, y: number, z: number): void {
    this.anchorPosition.set(x, y, z);
  }

  setLookTarget(x: number, y: number, z: number): void {
    this.lookTarget.set(x, y, z);
  }

  setLookTargetVec(target: THREE.Vector3): void {
    this.lookTarget.copy(target);
  }

  lookAtTarget(target: THREE.Vector3): void {
    this.lookTarget.copy(target);
  }

  update(anim: CharacterAnimState, camera: THREE.Camera, dt: number): void {
    this._time += dt;
    this.root.position.copy(this.anchorPosition);
    this.root.lookAt(this.lookTarget.x, this.anchorPosition.y, this.lookTarget.z);

    const depth = getDepthScale(this.anchorPosition.z, this.depthScaleOpts());
    const composedScale = depth * this.instanceScaleMul;
    this.sprite.mesh.scale.setScalar(composedScale);

    this.sprite.updateFromAnim(anim, camera);
    this.applySecondaryMotion(anim);
    this.updateShadow(composedScale);
  }

  dispose(): void {
    this.sprite.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }

  protected abstract applySecondaryMotion(anim: CharacterAnimState): void;

  protected setSpriteY(y: number): void {
    this.sprite.mesh.position.y = y;
  }

  protected depthScaleOpts(): DepthScaleOpts | undefined {
    return undefined;
  }

  private updateShadow(composedScale: number): void {
    this.shadow.position.y = 0.01;
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.setScalar(this.scale * composedScale);
    this.shadow.material.opacity = SHADOW_OPACITY;
  }
}

/** @deprecated Use `BaseCharacter` */
export { BaseCharacter as Character };
