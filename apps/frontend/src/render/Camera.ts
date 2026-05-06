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
  broadcast: preset(0, 7.25, 11.5, 0, 0.55, -4.9),
  bowler: preset(0, 5.6, -10.2, 0, 0.9, -1.5),
  tracking: preset(0.55, 6.35, 10.2, -0.05, 0.5, -2.6),
} as const;

const IDLE_FREQ_X = 0.19;
const IDLE_FREQ_Y = 0.31;
const IDLE_AMP_X = 0.03;
const IDLE_AMP_Y = 0.01;

export class Camera {
  readonly three: THREE.PerspectiveCamera;

  private readonly _pos = new THREE.Vector3();
  private readonly _look = new THREE.Vector3();
  private readonly _final = new THREE.Vector3();

  private _targetPos = PRESETS.broadcast.pos.clone();
  private _targetLookAt = PRESETS.broadcast.lookAt.clone();

  private readonly _trackPos = new THREE.Vector3();
  private readonly _trackLook = new THREE.Vector3();

  private _idleTime = 0;
  private _lastNow = 0;

  constructor(aspect: number) {
    this.three = new THREE.PerspectiveCamera(CAMERA.FOV, aspect, CAMERA.NEAR, CAMERA.FAR);
    this.three.fov = 54;
    this.three.updateProjectionMatrix();
    this._pos.copy(PRESETS.broadcast.pos);
    this._look.copy(PRESETS.broadcast.lookAt);
    this.three.position.copy(this._pos);
    this.three.lookAt(this._look);
  }

  update(snap: EngineSnapshot, shakeOffset: { x: number; y: number; z: number }): void {
    const now = performance.now() * 0.001;
    const cdt = this._lastNow > 0 ? Math.min(now - this._lastNow, 0.05) : 0;
    this._lastNow = now;
    this._idleTime += cdt;

    this.chooseTarget(snap);

    const t = Math.min(CAMERA.FOLLOW_SPEED * cdt, 1);
    this._pos.lerp(this._targetPos, t);
    this._look.lerp(this._targetLookAt, t * 1.6);

    const shaking = Math.abs(shakeOffset.x) > 0.001;
    const idleX = shaking ? 0 : Math.sin(this._idleTime * IDLE_FREQ_X) * IDLE_AMP_X;
    const idleY = shaking ? 0 : Math.sin(this._idleTime * IDLE_FREQ_Y) * IDLE_AMP_Y;

    this._final.copy(this._pos);
    this._final.x += idleX + shakeOffset.x;
    this._final.y += idleY + shakeOffset.y;
    this._final.z += shakeOffset.z;

    this.three.position.copy(this._final);
    this.three.lookAt(this._look);
  }

  resize(aspect: number): void {
    this.three.aspect = aspect;
    this.three.updateProjectionMatrix();
  }

  private chooseTarget(snap: EngineSnapshot): void {
    const { phase, ball } = snap;

    if (phase === 'bowling') {
      const hitTime = ball.params?.hitTime ?? 1.5;
      if (ball.elapsed < hitTime * 0.35) {
        this._targetPos = PRESETS.bowler.pos;
        this._targetLookAt = PRESETS.bowler.lookAt;
      } else {
        this._targetPos = PRESETS.broadcast.pos;
        this._targetLookAt = PRESETS.broadcast.lookAt;
      }
      return;
    }

    if (phase === 'hit_window') {
      this._targetPos = PRESETS.tracking.pos;
      this._targetLookAt = PRESETS.tracking.lookAt;
      return;
    }

    if (phase === 'post_hit') {
      const bx = ball.x;
      this._trackPos.set(
        PRESETS.broadcast.pos.x + bx * 0.28,
        PRESETS.broadcast.pos.y + Math.max(0, ball.y - 1.2) * 0.18,
        PRESETS.broadcast.pos.z,
      );
      this._trackLook.set(
        PRESETS.broadcast.lookAt.x + bx * 0.14,
        PRESETS.broadcast.lookAt.y,
        PRESETS.broadcast.lookAt.z,
      );
      this._targetPos = this._trackPos;
      this._targetLookAt = this._trackLook;
      return;
    }

    this._targetPos = PRESETS.broadcast.pos;
    this._targetLookAt = PRESETS.broadcast.lookAt;
  }
}
