import * as THREE from 'three';
import type { BonusType } from '../../engine/events/EventBus.js';

export class ImpactJuice {
  private _freeze = 0;
  private _freezeDuration = 0;
  private _zoom = 0;
  private _chromatic = 0;
  private _shake = new THREE.Vector3();

  triggerBonusImpact(_type: BonusType, _worldPos: { x: number; y: number; z: number }): void {
    this._freeze = 0.12;
    this._freezeDuration = 0.12;
    this._zoom = 2.0;
    this._chromatic = 1.0;
    this._shake.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.1, 0);
  }

  triggerHitImpact(): void {
    this._freeze = 0.10;
    this._freezeDuration = 0.10;
    this._zoom = 1.5;
    this._chromatic = 0.8;
    this._shake.set((Math.random() - 0.5) * 0.20, (Math.random() - 0.5) * 0.10, 0);
  }

  update(dt: number): void {
    if (this._freeze > 0) this._freeze = Math.max(0, this._freeze - dt);
    this._zoom = Math.max(0, this._zoom - dt * 2.8);
    this._chromatic = Math.max(0, this._chromatic - dt * 3.5);
    this._shake.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 14));
  }

  get timeScale(): number {
    if (this._freeze <= 0) return 1;
    const progress = 1 - this._freeze / this._freezeDuration;
    // First 70%: full freeze at 0.12× speed
    // Last 30%: ease-out recovery to 1.0× (cubic ease-out prevents pop-back)
    if (progress < 0.7) return 0.12;
    const recoveryT = (progress - 0.7) / 0.3;
    const eased = 1 - Math.pow(1 - recoveryT, 3);
    return 0.12 + (1 - 0.12) * eased;
  }

  get zoomOffset(): number {
    return this._zoom;
  }

  get chromaticIntensity(): number {
    return this._chromatic;
  }

  get shakeOffset(): { x: number; y: number; z: number } {
    return { x: this._shake.x, y: this._shake.y, z: this._shake.z };
  }
}
