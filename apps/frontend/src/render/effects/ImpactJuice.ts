import * as THREE from 'three';
import type { BonusType } from '../../engine/events/EventBus.js';

export class ImpactJuice {
  private _freeze = 0;
  private _zoom = 0;
  private _chromatic = 0;
  private _shake = new THREE.Vector3();

  triggerBonusImpact(_type: BonusType, _worldPos: { x: number; y: number; z: number }): void {
    this._freeze = 0.12;
    this._zoom = 0.85;
    this._chromatic = 1.0;
    this._shake.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.1, 0);
  }

  triggerHitImpact(): void {
    this._freeze = 0.08;
    this._zoom = 0.45;
    this._chromatic = 0.6;
    this._shake.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.06, 0);
  }

  update(dt: number): void {
    if (this._freeze > 0) this._freeze = Math.max(0, this._freeze - dt);
    this._zoom = Math.max(0, this._zoom - dt * 2.8);
    this._chromatic = Math.max(0, this._chromatic - dt * 3.5);
    this._shake.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 14));
  }

  get timeScale(): number {
    return this._freeze > 0 ? 0.22 : 1;
  }

  get zoomOffset(): number {
    return this._zoom * 0.8;
  }

  get chromaticIntensity(): number {
    return this._chromatic;
  }

  get shakeOffset(): { x: number; y: number; z: number } {
    return { x: this._shake.x, y: this._shake.y, z: this._shake.z };
  }
}
