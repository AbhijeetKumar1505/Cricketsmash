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
  broadcast: preset(
    CAMERA.PRESETS.broadcast.pos[0],
    CAMERA.PRESETS.broadcast.pos[1],
    CAMERA.PRESETS.broadcast.pos[2],
    CAMERA.PRESETS.broadcast.lookAt[0],
    CAMERA.PRESETS.broadcast.lookAt[1],
    CAMERA.PRESETS.broadcast.lookAt[2],
  ),
} as const;

export class Camera {
  readonly three: THREE.PerspectiveCamera;
  private _pos = new THREE.Vector3();
  private _look = new THREE.Vector3();
  private _zoomPunch = 0;
  private _sessionPullZ = 0;
  private _mode: 'broadcast' | 'tracking' | 'orbital' = 'broadcast';
  private _orbitTheta = 0;

  // Wicket zoom state
  private _wicketTimer = -1;
  private _wicketPhase: 'in' | 'hold' | 'out' = 'in';

  // Multi-axis shake state
  private _shakeT = -1;
  private _shakeFrames: Array<{ x: number; y: number; z: number }> = [];
  private _shakeFrameIdx = 0;

  // Impact camera system — instant punch-in with slow recovery
  private _contactZoom = 0;
  // Directional impulse toward shot direction at contact
  private _dirX = 0;
  // Cinematic swing tighten — gradual Z-approach during backlift/swing
  private _swingTighten = 0;

  constructor(aspect: number) {
    this.three = new THREE.PerspectiveCamera(CAMERA.FOV, aspect, CAMERA.NEAR, CAMERA.FAR);
    this.three.updateProjectionMatrix();
    this._pos.copy(PRESETS.broadcast.pos);
    this._look.copy(PRESETS.broadcast.lookAt);
  }

  triggerWicketZoom(): void {
    this._wicketTimer = 0;
    this._wicketPhase = 'in';
  }

  triggerShake(strength = 1): void {
    const amp = 0.12 * strength;
    this._shakeFrames = [];
    for (let i = 0; i < 5; i++) {
      this._shakeFrames.push({
        x: (Math.random() - 0.5) * amp,
        y: (Math.random() - 0.5) * amp * 0.6,
        z: (Math.random() - 0.5) * amp * 0.4,
      });
    }
    this._shakeT = 0;
    this._shakeFrameIdx = 0;
  }

  /** Trigger immediate contact zoom + directional impulse toward shot */
  triggerContactImpact(shotDirX: number): void {
    this._contactZoom = 1.8;
    this._dirX = THREE.MathUtils.clamp(shotDirX * 0.15, -0.4, 0.4);
  }

  update(snap: EngineSnapshot, shakeOffset: { x: number; y: number; z: number }, zoomPunch = 0): void {
    const t = performance.now() * 0.001;
    const dt = 1 / 60;

    // Asymmetric zoom: instant punch-in for big values, slow lerp recovery
    if (zoomPunch > this._zoomPunch) {
      this._zoomPunch = zoomPunch;
    } else {
      this._zoomPunch = THREE.MathUtils.lerp(this._zoomPunch, zoomPunch, 0.04);
    }

    // Contact zoom decays independently over ~260ms
    if (this._contactZoom > 0) {
      this._contactZoom = Math.max(0, this._contactZoom - dt * 7);
    }

    // Directional impulse decays over ~300ms
    if (Math.abs(this._dirX) > 0.001) {
      this._dirX = THREE.MathUtils.lerp(this._dirX, 0, 0.08);
    }

    // Cinematic swing tighten: gradually zoom in during backlift/swing,
    // decay during follow-through
    const bf = snap.batsmanFSM;
    if (bf.phase === 'SWING' || bf.phase === 'BACKLIFT') {
      this._swingTighten = Math.min(this._swingTighten + dt * 4, 0.8);
    } else if (bf.phase === 'FOLLOW_THROUGH') {
      this._swingTighten = Math.max(0, this._swingTighten - dt * 2);
    } else {
      this._swingTighten = Math.max(0, this._swingTighten - dt * 0.5);
    }

    const totalZoom = this._zoomPunch + this._contactZoom + this._swingTighten;

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
      const targetPos = new THREE.Vector3(
        snap.ball.x * 0.3,
        3.5 + snap.ball.y * 0.1,
        snap.ball.z + 8.5,
      );
      this.three.position.lerp(targetPos, 0.08);
      this.three.lookAt(snap.ball.x, snap.ball.y, snap.ball.z);
    } else {
      if (this._wicketTimer >= 0) {
        this._updateWicketZoom(dt);
      } else {
        const sway = Math.sin(t * 0.19) * 0.02;
        const bob  = Math.sin(t * 0.29) * 0.01;
        const targetZ = PRESETS.broadcast.pos.z - totalZoom + this._sessionPullZ;
        const targetX = PRESETS.broadcast.pos.x + sway + this._dirX;
        this.three.position.lerp(new THREE.Vector3(targetX, PRESETS.broadcast.pos.y + bob, targetZ), 0.05);
        this._look.lerp(PRESETS.broadcast.lookAt, 0.05);
        this.three.lookAt(this._look);
      }
    }

    this._applyShake();
    this.three.position.x += shakeOffset.x;
    this.three.position.y += shakeOffset.y;
    this.three.position.z += shakeOffset.z;
  }

  private _updateWicketZoom(dt: number): void {
    this._wicketTimer += dt;

    if (this._wicketPhase === 'in' && this._wicketTimer > 0.45) {
      this._wicketPhase = 'hold';
    }
    if (this._wicketPhase === 'hold' && this._wicketTimer > 1.65) {
      this._wicketPhase = 'out';
    }

    if (this._wicketPhase === 'in') {
      const easeIn = (this._wicketTimer / 0.45) ** 2;
      const totalZoom = this._zoomPunch + this._contactZoom;
      const targetPos = new THREE.Vector3(
        PRESETS.broadcast.pos.x * (1 - easeIn * 0.28),
        PRESETS.broadcast.pos.y * (1 - easeIn * 0.12),
        PRESETS.broadcast.pos.z * (1 - easeIn * 0.22) - totalZoom + this._sessionPullZ,
      );
      this.three.position.lerp(targetPos, 0.12);
      this.three.lookAt(0, 0.9, -10);
    } else if (this._wicketPhase === 'out') {
      const resetT = (this._wicketTimer - 1.65) / 0.7;
      if (resetT >= 1) {
        this._wicketTimer = -1;
        this._wicketPhase = 'in';
      } else {
        this.three.position.lerp(PRESETS.broadcast.pos, 0.08);
        this._look.lerp(PRESETS.broadcast.lookAt, 0.08);
        this.three.lookAt(this._look);
      }
    } else {
      this.three.lookAt(0, 0.9, -10);
    }
  }

  private _applyShake(): void {
    if (this._shakeT < 0 || this._shakeFrames.length === 0) return;
    this._shakeT += 1;
    const idx = Math.min(this._shakeFrameIdx, this._shakeFrames.length - 1);
    const f = this._shakeFrames[idx];
    if (f) {
      this.three.position.x += f.x;
      this.three.position.y += f.y;
      this.three.position.z += f.z;
    }
    this._shakeFrameIdx++;
    if (this._shakeFrameIdx >= this._shakeFrames.length) {
      this._shakeT = -1;
      this._shakeFrameIdx = 0;
      this._shakeFrames = [];
    }
  }

  resize(aspect: number): void {
    this.three.aspect = aspect;
    this.three.updateProjectionMatrix();
  }

  setSessionPullZ(offset: number): void {
    this._sessionPullZ = Math.max(0, offset);
  }
}
