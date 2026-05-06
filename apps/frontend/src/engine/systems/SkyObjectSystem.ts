/**
 * SkyObjectSystem — per-delivery sky bonus prop (max one active).
 * Independent from BonusSystem; no collision-based rewards.
 */

import { Vec3, GRAVITY } from '../physics/physics.js';
import type { SkyObjectPhase, SkyObjectSnapshot, SkyObjectType } from '../sky/types.js';
import {
  SKY_FLIGHT_TIME,
  SKY_HIT_RADIUS,
  multiplierForSkyType,
  spawnWorldPosition,
} from '../sky/config.js';

const SCALE_POP_DURATION = 0.28;

export class SkyObjectSystem {
  private _id: string | null = null;
  private _type: SkyObjectType | null = null;
  private _mult: 10 | 100 | null = null;
  private _phase: SkyObjectPhase = 'gone';
  private readonly _pos = new Vec3();
  private readonly _basePos = new Vec3();
  private _scale = 1;
  private _impactTriggered = false;
  private _impactPopElapsed = 0;
  private _glowFlash = 0;
  private _age = 0;

  spawn(type: SkyObjectType, ballId: number, rng: () => number): void {
    this.dispose();
    this._id = `sky_${ballId}_${type}`;
    this._type = type;
    this._mult = multiplierForSkyType(type);
    this._phase = 'approaching';
    const p = spawnWorldPosition(type, rng);
    this._pos.set(p.x, p.y, p.z);
    this._basePos.set(p.x, p.y, p.z);
    this._scale = 1;
    this._impactTriggered = false;
    this._impactPopElapsed = 0;
    this._glowFlash = 0;
    this._age = 0;
  }

  update(dt: number): void {
    if (!this._id || this._phase === 'gone') return;

    this._age += dt;
    if (this._phase === 'approaching' && this._type) {
      // Keep sky objects clearly visible with predictable camera-relative motion.
      if (this._type === 'JETPACK') {
        this._pos.x = this._basePos.x + Math.sin(this._age * 1.8) * 0.8;
        this._pos.y = this._basePos.y + Math.sin(this._age * 2.4) * 0.45;
        this._pos.z = this._basePos.z + Math.cos(this._age * 1.2) * 0.6;
      } else if (this._type === 'SMALL_PLANE') {
        this._pos.x = this._basePos.x + Math.sin(this._age * 0.9) * 4.5;
        this._pos.y = this._basePos.y + Math.sin(this._age * 1.8) * 0.25;
        this._pos.z = this._basePos.z + Math.cos(this._age * 0.65) * 0.9;
      } else {
        this._pos.x = this._basePos.x + Math.sin(this._age * 0.45) * 3.2;
        this._pos.y = this._basePos.y + Math.sin(this._age * 0.7) * 0.18;
        this._pos.z = this._basePos.z + Math.cos(this._age * 0.35) * 0.6;
      }
    }

    if (this._phase === 'impacted') {
      this._impactPopElapsed += dt;
      const t = Math.min(1, this._impactPopElapsed / SCALE_POP_DURATION);
      // Pop 1 → ~1.3 → 1 (held until dispose at delivery reset)
      this._scale = 1 + 0.3 * Math.sin(Math.PI * t);
      this._glowFlash = Math.max(0, 1 - t * 1.2);
    }
  }

  getTarget(): Vec3 | null {
    if (!this._id || this._phase === 'gone') return null;
    return this._pos.clone();
  }

  /**
   * Initial velocity so ballistic flight reaches current sky target at time T
   * (semi-implicit Euler: y' += -g*dt, then pos += vel*dt).
   */
  computeImpulse(launch: Readonly<Vec3>, flightTime: number): Vec3 {
    const target = this.getTarget();
    if (!target) return new Vec3(0, 12, -18);

    const T = flightTime;
    const dx = target.x - launch.x;
    const dy = target.y - launch.y;
    const dz = target.z - launch.z;
    const vx = dx / T;
    const vz = dz / T;
    const vy = dy / T + 0.5 * GRAVITY * T;
    return new Vec3(vx, vy, vz);
  }

  triggerImpact(): void {
    if (!this._id || this._impactTriggered) return;
    this._impactTriggered = true;
    this._phase = 'impacted';
    this._impactPopElapsed = 0;
    this._glowFlash = 1;
  }

  isReadyForImpact(ballPos: Readonly<Vec3>, elapsedSinceHit: number): boolean {
    if (!this._id || this._phase !== 'approaching' || this._impactTriggered) return false;
    const target = this.getTarget();
    if (!target) return false;

    const dx = ballPos.x - target.x;
    const dy = ballPos.y - target.y;
    const dz = ballPos.z - target.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < SKY_HIT_RADIUS) return true;
    if (elapsedSinceHit >= SKY_FLIGHT_TIME * 0.95) return true;
    return false;
  }

  dispose(): void {
    this._id = null;
    this._type = null;
    this._mult = null;
    this._phase = 'gone';
    this._impactTriggered = false;
    this._scale = 1;
    this._glowFlash = 0;
    this._age = 0;
  }

  get snapshot(): SkyObjectSnapshot | null {
    if (!this._id) return null;
    return {
      id: this._id,
      type: this._type!,
      phase: this._phase === 'impacted' ? 'impacted' : 'approaching',
      position: { x: this._pos.x, y: this._pos.y, z: this._pos.z },
      scale: this._scale,
      glowFlash: this._glowFlash,
    };
  }

  get type(): SkyObjectType | null {
    return this._type;
  }

  get multiplier(): 10 | 100 | null {
    return this._mult;
  }

  get flightTime(): number {
    return SKY_FLIGHT_TIME;
  }

  get impactAlreadyTriggered(): boolean {
    return this._impactTriggered;
  }
}
