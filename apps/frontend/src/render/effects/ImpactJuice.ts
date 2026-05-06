import * as THREE from 'three';
import type { BonusType } from '../../engine/events/EventBus.js';

export class ImpactJuice {
  private _freeze = 0;
  private _zoom = 0;
  private _shake = new THREE.Vector3();

  triggerBonusImpact(_type: BonusType, _worldPos: { x: number; y: number; z: number }): void {
    this._freeze = 0.09;
    this._zoom = 0.7;
    this._shake.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.06, 0);
  }

  update(dt: number): void {
    if (this._freeze > 0) this._freeze = Math.max(0, this._freeze - dt);
    this._zoom = Math.max(0, this._zoom - dt * 2.5);
    this._shake.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 12));
  }

  get timeScale(): number {
    return this._freeze > 0 ? 0.28 : 1;
  }

  get zoomOffset(): number {
    return this._zoom * 0.75;
  }

  get shakeOffset(): { x: number; y: number; z: number } {
    return { x: this._shake.x, y: this._shake.y, z: this._shake.z };
  }
}
