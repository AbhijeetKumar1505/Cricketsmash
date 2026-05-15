import * as THREE from 'three';
import type { HumanCharacter } from '../HumanCharacter.js';

export type LODTier = 0 | 1 | 2;

export class HumanLOD {
  private _tier: LODTier = 0;
  private _distance = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(public readonly char: HumanCharacter) {}

  get tier(): LODTier {
    return this._tier;
  }

  get distance(): number {
    return this._distance;
  }

  update(camera: THREE.Camera): LODTier {
    camera.getWorldPosition(this.tmp);
    const dx = this.tmp.x - this.char.root.position.x;
    const dz = this.tmp.z - this.char.root.position.z;
    this._distance = Math.sqrt(dx * dx + dz * dz);
    this._tier = this._distance < 10 ? 0 : this._distance < 28 ? 1 : 2;
    this.char.setFootSeparation(this._tier === 0 ? 0.42 : this._tier === 1 ? 0.34 : 0.24);
    return this._tier;
  }

  static shouldRun(tier: LODTier, feature: 'ik-bat' | 'ik-foot' | 'reactions' | 'mechanics' | 'aim' | 'kit'): boolean {
    if (tier === 0) return true;
    if (tier === 1) return feature !== 'ik-bat';
    return feature === 'aim' || feature === 'kit';
  }
}
