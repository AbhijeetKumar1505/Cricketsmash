import * as THREE from 'three';
import { CAMERA } from '../engine/constants.js';
import type { EngineSnapshot } from '../engine/GameEngine.js';

interface Preset { pos: THREE.Vector3; lookAt: THREE.Vector3; }

function preset(
  px: number, py: number, pz: number,
  lx: number, ly: number, lz: number,
): Preset {
  return { pos: new THREE.Vector3(px, py, pz), lookAt: new THREE.Vector3(lx, ly, lz) };
}

const PRESETS = {
  // Slightly elevated eye line vs the very-low rig, still tilted up-field so sky props read.
  broadcast: preset(0, 4.72, 13, 0, 4.2, -8.55),
} as const;

export class Camera {
  readonly three: THREE.PerspectiveCamera;

  private readonly _pos = new THREE.Vector3();
  private readonly _look = new THREE.Vector3();
  private _zoomPunch = 0;

  constructor(aspect: number) {
    this.three = new THREE.PerspectiveCamera(CAMERA.FOV, aspect, CAMERA.NEAR, CAMERA.FAR);
    this.three.fov = 56;
    this.three.updateProjectionMatrix();
    this._pos.copy(PRESETS.broadcast.pos);
    this._look.copy(PRESETS.broadcast.lookAt);
    this.three.position.copy(this._pos);
    this.three.lookAt(this._look);
  }

  update(_snap: EngineSnapshot, shakeOffset: { x: number; y: number; z: number }, zoomPunch = 0): void {
    // Keep camera fully static for consistent gameplay perspective.
    this._zoomPunch = zoomPunch;
    const z = this._pos.z - this._zoomPunch;
    this.three.position.set(this._pos.x + shakeOffset.x, this._pos.y + shakeOffset.y, z + shakeOffset.z);
    this.three.lookAt(this._look);
  }

  resize(aspect: number): void {
    this.three.aspect = aspect;
    this.three.updateProjectionMatrix();
  }
}
