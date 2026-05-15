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
  // Broadcast: wider framing, elevated position, slightly higher target preserves sky-bonus visibility.
  broadcast: preset(0, 3.9, 11.5, 0, 1.5, -5.5),
} as const;

export class Camera {
  readonly three: THREE.PerspectiveCamera;
  private _pos = new THREE.Vector3();
  private _look = new THREE.Vector3();
  private _zoomPunch = 0;
  private _sessionPullZ = 0;
  private _mode: 'broadcast' | 'tracking' | 'orbital' = 'broadcast';
  private _orbitTheta = 0;

  constructor(aspect: number) {
    this.three = new THREE.PerspectiveCamera(CAMERA.FOV, aspect, CAMERA.NEAR, CAMERA.FAR);
    this.three.fov = 48; // Cinematic narrower FOV
    this.three.updateProjectionMatrix();
    this._pos.copy(PRESETS.broadcast.pos);
    this._look.copy(PRESETS.broadcast.lookAt);
  }

  update(snap: EngineSnapshot, shakeOffset: { x: number; y: number; z: number }, zoomPunch = 0): void {
    const t = performance.now() * 0.001;
    this._zoomPunch = THREE.MathUtils.lerp(this._zoomPunch, zoomPunch, 0.1);

    // Determine target mode based on snapshot phase
    if (snap.round.outcome === 'hit' && snap.phase === 'celebrate') {
      this._mode = 'orbital';
    } else if (snap.phase === 'BALL_TRAVEL' || snap.phase === 'HIT') {
      this._mode = 'tracking';
    } else {
      this._mode = 'broadcast';
    }

    if (this._mode === 'orbital') {
      this._orbitTheta += 0.01;
      const radius = 8;
      const targetX = Math.sin(this._orbitTheta) * radius;
      const targetZ = Math.cos(this._orbitTheta) * radius - 2;
      this.three.position.lerp(new THREE.Vector3(targetX, 4, targetZ), 0.05);
      this.three.lookAt(0, 1.2, -2);
    } else if (this._mode === 'tracking') {
      // Follow ball with a slight lag/offset
      const targetPos = new THREE.Vector3(
        snap.ball.x * 0.3, 
        3.5 + snap.ball.y * 0.1, 
        snap.ball.z + 8.5
      );
      this.three.position.lerp(targetPos, 0.08);
      this.three.lookAt(snap.ball.x, snap.ball.y, snap.ball.z);
    } else {
      // Return to broadcast
      const sway = Math.sin(t * 0.19) * 0.02;
      const bob  = Math.sin(t * 0.29) * 0.01;
      const targetZ = PRESETS.broadcast.pos.z - this._zoomPunch + this._sessionPullZ;
      
      this.three.position.lerp(new THREE.Vector3(
        PRESETS.broadcast.pos.x + sway,
        PRESETS.broadcast.pos.y + bob,
        targetZ
      ), 0.05);
      
      this._look.lerp(PRESETS.broadcast.lookAt, 0.05);
      this.three.lookAt(this._look);
    }

    // Apply shake at the end
    this.three.position.x += shakeOffset.x;
    this.three.position.y += shakeOffset.y;
    this.three.position.z += shakeOffset.z;
  }

  resize(aspect: number): void {
    this.three.aspect = aspect;
    this.three.updateProjectionMatrix();
  }

  setSessionPullZ(offset: number): void {
    this._sessionPullZ = Math.max(0, offset);
  }
}
