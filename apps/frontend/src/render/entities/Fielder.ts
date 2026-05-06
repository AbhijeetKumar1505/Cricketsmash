import * as THREE from 'three';
import { SpriteCharacter } from '../doodle/SpriteCharacter.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';

export const FIELDER_POSITIONS: [number, number, number][] = [
  [ 0.6,   1.2,  Math.PI * 1.1],
  [ 3.5,   0.0,  Math.PI * 0.85],
  [ 9.0,  -2.5,  Math.PI * 0.6],
  [ 7.5,  -6.0,  Math.PI * 0.55],
  [ 4.5,  -8.5,  Math.PI * 0.5],
  [-4.5,  -8.5,  Math.PI * 0.5],
];

export class FielderEntity {
  readonly root: THREE.Group;
  private readonly sprite: SpriteCharacter;
  private readonly shadow: THREE.Mesh;
  private readonly _phaseOffset: number;
  private _time = 0;
  private readonly _baseY: number;

  constructor(
    worldX: number, worldZ: number, _facingY: number,
    assets: DoodleAssets, variant: number, isKeeper = false,
  ) {
    this.root = new THREE.Group();
    this.root.position.set(worldX, 0, worldZ);

    const shadowGeo = new THREE.PlaneGeometry(1.0, 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: assets.shadow,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.root.add(this.shadow);

    const scale = isKeeper ? 1.05 : 0.85 + (variant % 3) * 0.1;
    this.sprite = new SpriteCharacter(
      isKeeper ? 'keeper' : 'fielder',
      assets,
      1.35 * scale,
      1.35 * scale,
      variant,
    );
    this._baseY = 0.6 * scale;
    this.sprite.mesh.position.y = this._baseY;
    this.root.add(this.sprite.mesh);

    this._phaseOffset = variant * 1.7;
  }

  update(camera: THREE.Camera): void {
    this._time += 0.016;
    this.sprite.billboard(camera);
    this.sprite.mesh.position.y = this._baseY + Math.sin(this._time * 2.2 + this._phaseOffset) * 0.04;

    const s = 1.0 - (this.sprite.mesh.position.y - this._baseY) * 0.5;
    this.shadow.scale.set(s, s, s);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.2 * s;
  }

  dispose(): void {
    this.sprite.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
