import { BONUS_ROAM } from './config.js';
import {
  bonusClampXZ,
  bonusInsidePitchStripe,
  bonusKickOutPitch,
  bonusRandomWaypoint,
} from './roamField.js';
import type { BonusDefinition, BonusSkillZone, BonusSnapshot, BonusRoamContext } from './types.js';

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export class BonusObject {
  readonly id: string;
  readonly def: BonusDefinition;
  readonly zone: BonusSkillZone;
  readonly spawnedAt: number;
  /** Session payout multiplier chunk (1 = none). From engine seed for moving/sky props. */
  readonly profitMultBoost: number;
  readonly collisionRadius: number;

  private _groundY: number;
  private _y: number;
  private _x: number;
  private _z: number;
  private _vx = 0;
  private _vz = 0;
  private _spinY = 0;
  private _phaseOffset: number;
  private _cooldownRemaining = 0;
  private _targetX = 0;
  private _targetZ = 0;
  private _retargetCd = 0;
  private _primed = false;
  private readonly _roamSpeed: number;
  /** Smoothed planar velocity for nicer dolly / rover motion. */
  private _smVx = 0;
  private _smVz = 0;

  constructor(
    id: string,
    def: BonusDefinition,
    zone: BonusSkillZone,
    now: number,
    phaseOffset: number,
    profitMultBoost = 1,
  ) {
    this.id = id;
    this.def = def;
    this.zone = zone;
    this.spawnedAt = now;
    this.profitMultBoost = profitMultBoost;
    this.collisionRadius = zone.hitRadius ?? def.radius;
    this._x = zone.x;
    this._z = zone.z;
    this._groundY = zone.role === 'movingMult' ? Math.max(0.09, zone.y) : zone.y;
    this._y = this._groundY;
    this._phaseOffset = phaseOffset;

    const t = hashId(id) % 997 / 997;
    this._roamSpeed = BONUS_ROAM.SPEED_MIN + t * (BONUS_ROAM.SPEED_MAX - BONUS_ROAM.SPEED_MIN);

    ({ x: this._targetX, z: this._targetZ } = bonusClampXZ(this._x, this._z));
    this._retargetCd = 0;
  }

  update(dt: number, elapsed: number, roam: BonusRoamContext | null, rng?: () => number): void {
    this._spinY += dt * this.def.spinSpeed;
    /** Only moving multiplier drones roam — sky + perimeter hoardings stay fixed. */
    const canRoam = roam && rng && this.zone.role === 'movingMult';
    if (canRoam) {
      if (!this._primed) {
        this.pickInitialWaypoint(rng, roam);
        this._primed = true;
      }
      if (dt > 1e-6) {
        this._roam(dt, roam, rng);
      }
    }
    const hoverAmp =
      this.zone.role === 'ballAdder' && this.zone.zone === 'stands' && this.zone.y > 3.2
        ? 0.052
        : this.zone.role === 'ballAdder'
          ? 0.036
          : this.zone.role === 'movingMult'
            ? Math.min(this.def.hoverAmp, 0.058)
            : 0;
    this._y = this._groundY + Math.sin(elapsed * 2.2 + this._phaseOffset) * hoverAmp;
    if (this._cooldownRemaining > 0) this._cooldownRemaining = Math.max(0, this._cooldownRemaining - dt);
  }

  /** Call after BonusSystem RNG is seeded (same frame as roam). */
  pickInitialWaypoint(rng: () => number, roam: BonusRoamContext): void {
    const avoid = this._obstacles(roam);
    const wp = bonusRandomWaypoint(rng, avoid, true);
    this._targetX = wp.x;
    this._targetZ = wp.z;
    ({ x: this._x, z: this._z } = bonusClampXZ(this._x, this._z));
    ({ x: this._x, z: this._z } = bonusKickOutPitch(this._x, this._z));
    this._retargetCd = BONUS_ROAM.RETARGET_IDLE * 0.5;
  }

  markHit(): void {
    this._cooldownRemaining = 2.1;
  }

  get isCoolingDown(): boolean {
    return this._cooldownRemaining > 0;
  }

  get spinY(): number {
    return this._spinY;
  }

  isColliding(ballPos: { x: number; y: number; z: number }, ballRadius: number, collisionPadding: number): boolean {
    if (this._cooldownRemaining > 0) return false;
    const dx = ballPos.x - this._x;
    const dy = ballPos.y - this._y;
    const dz = ballPos.z - this._z;
    const r = this.collisionRadius + ballRadius + collisionPadding;
    return dx * dx + dy * dy + dz * dz <= r * r;
  }

  toSnapshot(intensity = 1): BonusSnapshot {
    return {
      id: this.id,
      type: this.def.type,
      rarityTier: this.def.rarityTier,
      x: this._x,
      y: this._y,
      z: this._z,
      radius: this.collisionRadius,
      extraBalls: this.zone.role === 'ballAdder' ? (this.zone.ballAdderAmount ?? this.def.value) : 0,
      zone: this.zone.zone,
      visual: this.zone.visual,
      intensity: this._cooldownRemaining > 0 ? 0.4 : intensity,
      vx: this._vx,
      vz: this._vz,
    };
  }

  private _obstacles(roam: BonusRoamContext): Array<{ x: number; z: number; r: number }> {
    const br = this.def.radius;
    const pad = BONUS_ROAM.PLAYER_PAD;
    const o: Array<{ x: number; z: number; r: number }> = [];
    for (const f of roam.fielders) {
      o.push({ x: f.x, z: f.z, r: br + pad });
    }
    o.push({
      x: roam.bowlerX,
      z: roam.bowlerZ,
      r: br + BONUS_ROAM.BOWLER_EXTRA,
    });
    o.push({
      x: roam.batsmanX,
      z: roam.batsmanZ,
      r: br + BONUS_ROAM.BATSMAN_EXTRA,
    });
    if (roam.movingBonuses?.length) {
      for (const mb of roam.movingBonuses) {
        if (mb.id === this.id) continue;
        o.push({
          x: mb.x,
          z: mb.z,
          r: br + mb.r + BONUS_ROAM.BONUS_PAD,
        });
      }
    }
    return o;
  }

  private _roam(dt: number, roam: BonusRoamContext, rng: () => number): void {
    const avoid = this._obstacles(roam);
    const spd = this._roamSpeed;

    // If the current target would require crossing the pitch no-go stripe,
    // pick a same-side waypoint. Crossing attempts cause kick-out oscillation/jitter.
    if (this._pathCrossesPitch(this._x, this._z, this._targetX, this._targetZ)) {
      const wp = this._pickSameSideWaypoint(rng, avoid);
      this._targetX = wp.x;
      this._targetZ = wp.z;
      this._retargetCd = BONUS_ROAM.RETARGET_IDLE * 0.5;
    }

    this._retargetCd -= dt;
    let dx = this._targetX - this._x;
    let dz = this._targetZ - this._z;
    let dist = Math.hypot(dx, dz);
    const arrived = dist < BONUS_ROAM.RETARGET_NEAR;
    if (arrived && this._retargetCd <= 0) {
      const wp = bonusRandomWaypoint(rng, avoid, true);
      this._targetX = wp.x;
      this._targetZ = wp.z;
      dx = this._targetX - this._x;
      dz = this._targetZ - this._z;
      dist = Math.hypot(dx, dz);
      this._retargetCd = BONUS_ROAM.RETARGET_IDLE + rng() * BONUS_ROAM.RETARGET_JITTER;
    } else if (!arrived && this._retargetCd <= 0) {
      /** Still en route — soften instead of snapping a random new heading. */
      this._retargetCd = BONUS_ROAM.RETARGET_HOLD_FAR * (0.7 + rng() * 0.55);
    }

    let mx = 0;
    let mz = 0;
    if (dist > 1e-5) {
      const step = spd * dt;
      const k = Math.min(1, step / dist);
      mx = dx * k;
      mz = dz * k;
    }

    let rmx = 0;
    let rmz = 0;
    for (const o of avoid) {
      const ox = this._x - o.x;
      const oz = this._z - o.z;
      const d = Math.hypot(ox, oz);
      const pen = d < o.r ? o.r - d + 1e-3 : 0;
      if (pen > 0 && d > 1e-5) {
        let push = (pen / (d + 1e-6)) * BONUS_ROAM.REPEL_GAIN * dt;
        push = Math.min(push, BONUS_ROAM.MAX_REPEL_PUSH);
        rmx += (ox / d) * push;
        rmz += (oz / d) * push;
      }
    }

    mx += rmx;
    mz += rmz;

    /** Soft cap diagonal repel injection so overlaps never spike velocity. */
    const rmag = Math.hypot(mx, mz);
    const maxMove = spd * dt * 1.35 + BONUS_ROAM.MAX_REPEL_PUSH;
    if (rmag > maxMove && rmag > 1e-6) {
      const s = maxMove / rmag;
      mx *= s;
      mz *= s;
    }

    let nx = this._x + mx;
    let nz = this._z + mz;

    ({ x: nx, z: nz } = bonusClampXZ(nx, nz));
    const preKickX = nx;
    const preKickZ = nz;
    if (bonusInsidePitchStripe(nx, nz)) {
      ({ x: nx, z: nz } = bonusKickOutPitch(nx, nz));
      const kicked = Math.hypot(nx - preKickX, nz - preKickZ) > 0.04;
      if (kicked) {
        // Re-target immediately after forced displacement to avoid edge thrash.
        const wp = this._pickSameSideWaypoint(rng, avoid);
        this._targetX = wp.x;
        this._targetZ = wp.z;
        this._retargetCd = BONUS_ROAM.RETARGET_IDLE * 0.5;
      }
    }

    const dvx = dt > 1e-6 ? mx / dt : 0;
    const dvz = dt > 1e-6 ? mz / dt : 0;
    const smoothing = Math.min(1, BONUS_ROAM.VELOCITY_SMOOTH * dt);
    this._smVx += (dvx - this._smVx) * smoothing;
    this._smVz += (dvz - this._smVz) * smoothing;
    this._vx = this._smVx;
    this._vz = this._smVz;
    this._x = nx;
    this._z = nz;
  }

  private _pickSameSideWaypoint(
    rng: () => number,
    avoid: ReadonlyArray<{ x: number; z: number; r: number }>,
  ): { x: number; z: number } {
    const wp = bonusRandomWaypoint(rng, avoid, true);
    // Keep rover/spider on their current lateral side when close to pitch
    // so they don't repeatedly attempt cross-pitch routes.
    const side = Math.sign(this._x);
    if (side === 0) return wp;
    if (Math.sign(wp.x) === side) return wp;
    return bonusClampXZ(-wp.x, wp.z);
  }

  private _pathCrossesPitch(x0: number, z0: number, x1: number, z1: number): boolean {
    // Cheap segment sampling against pitch stripe.
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const sx = x0 + (x1 - x0) * t;
      const sz = z0 + (z1 - z0) * t;
      if (bonusInsidePitchStripe(sx, sz)) return true;
    }
    return false;
  }
}
