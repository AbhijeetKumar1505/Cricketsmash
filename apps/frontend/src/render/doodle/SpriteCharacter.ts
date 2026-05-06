import * as THREE from 'three';
import type { DoodleAssets, BatsmanState, BowlerState } from './DoodleAssets.js';
import type { CharacterAnimState } from '../../engine/systems/AnimationSystem.js';

export type CharacterType = 'batsman' | 'bowler' | 'fielder' | 'keeper';

export class SpriteCharacter {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private currentKey = '';

  constructor(
    private readonly type: CharacterType,
    private readonly assets: DoodleAssets,
    width: number,
    height: number,
    private readonly variant = 0,
  ) {
    const geo = new THREE.PlaneGeometry(width, height);
    const tex = this.pickTexture('idle');

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    this.currentKey = 'idle';
  }

  updateFromAnim(anim: CharacterAnimState, _camera: THREE.Camera): void {
    let key: string;
    if (this.type === 'batsman') key = this.mapBatsmanState(anim);
    else if (this.type === 'bowler') key = this.mapBowlerState(anim);
    else key = 'idle';

    if (key !== this.currentKey) {
      this.currentKey = key;
      this.mesh.material.map = this.pickTexture(key);
      this.mesh.material.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private mapBatsmanState(anim: CharacterAnimState): BatsmanState {
    switch (anim.phase) {
      case 'celebrate': return 'celebrate';
      case 'stumped': return 'stumped';
      case 'swing': return anim.swingAngle > 1.0 ? 'swing2' : 'swing1';
      default: return 'idle';
    }
  }

  private mapBowlerState(anim: CharacterAnimState): BowlerState {
    if (anim.phase === 'idle') return 'idle';
    if (anim.phase !== 'run') return 'idle';
    const t = anim.runT;
    if (t < 0.7) return 'run';
    if (t < 0.85) return 'bowl';
    return 'release';
  }

  private pickTexture(key: string): THREE.CanvasTexture {
    switch (this.type) {
      case 'batsman':
        return this.assets.batsman[key as BatsmanState] ?? this.assets.batsman.idle;
      case 'bowler':
        return this.assets.bowler[key as BowlerState] ?? this.assets.bowler.idle;
      case 'fielder':
        return this.assets.fielders[Math.max(0, this.variant - 1) % this.assets.fielders.length];
      case 'keeper':
        return this.assets.keeper;
      default:
        return this.assets.batsman.idle;
    }
  }
}
