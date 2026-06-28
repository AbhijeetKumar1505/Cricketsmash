/**
 * FlyoverSystem — 3 independent aircraft lanes crossing the field.
 * Each lane flies at a different height, depth, and speed for parallax variety.
 * Collision with a high arcing ball emits skyObjectHit (10×).
 */

import type { SkyObjectSnapshot } from '../sky/types.js';

/** Half-width of the X sweep. Aircraft goes from -X_SPAN to +X_SPAN. */
const X_SPAN = 26;
/** Collision sphere radius (world units). */
const HIT_RADIUS = 2.0;
/** Multiplier awarded on ball contact. */
const FLYOVER_MULT = 10 as const;

interface LaneCfg {
  readonly y: number;
  readonly z: number;
  readonly duration: number;  // seconds to cross full width
  readonly gap: number;       // seconds between end of one pass and start of next
  readonly scale: number;     // snapshot scale (multiplied by baseScaleFor in renderer)
  readonly initialDelay: number; // stagger so all three don't appear simultaneously
}

const LANES: readonly LaneCfg[] = [
  { y: 9.0,  z: -14.0, duration: 8.0,  gap: 7.0,  scale: 0.22, initialDelay: 5.0  },
  { y: 11.5, z: -21.0, duration: 13.0, gap: 16.0, scale: 0.18, initialDelay: 12.0 },
  { y: 7.0,  z:  -9.0, duration: 5.5,  gap: 22.0, scale: 0.16, initialDelay: 20.0 },
] as const;

interface LaneState {
  gapTimer:   number;
  flyAge:     number;
  active:     boolean;
  dir:        number;  // +1 left→right, -1 right→left
  x:          number;
  y:          number;
  glowFlash:  number;
  impacted:   boolean;
  spawnCount: number;
  id:         string;
}

export interface FlyoverHit {
  type:       'SMALL_PLANE';
  multiplier: typeof FLYOVER_MULT;
  worldPos:   { x: number; y: number; z: number };
}

function makeLaneState(initialDelay: number): LaneState {
  return {
    gapTimer:   initialDelay,
    flyAge:     0,
    active:     false,
    dir:        1,
    x:          -X_SPAN,
    y:          0,
    glowFlash:  0,
    impacted:   false,
    spawnCount: 0,
    id:         '',
  };
}

export class FlyoverSystem {
  private _lanes: LaneState[] = LANES.map(cfg => makeLaneState(cfg.initialDelay));

  update(dt: number): void {
    for (let i = 0; i < this._lanes.length; i++) {
      this._updateLane(i, dt);
    }
  }

  /** Call every frame inside BALL_RESULT phase only. Returns the first hit found. */
  checkCollision(ball: { x: number; y: number; z: number }): FlyoverHit | null {
    for (let i = 0; i < this._lanes.length; i++) {
      const lane = this._lanes[i];
      const cfg  = LANES[i];
      if (!lane.active || lane.impacted) continue;
      const dx = ball.x - lane.x;
      const dy = ball.y - lane.y;
      const dz = ball.z - cfg.z;
      if (dx * dx + dy * dy + dz * dz > HIT_RADIUS * HIT_RADIUS) continue;
      lane.impacted  = true;
      lane.glowFlash = 1;
      return {
        type:       'SMALL_PLANE',
        multiplier: FLYOVER_MULT,
        worldPos:   { x: lane.x, y: lane.y, z: cfg.z },
      };
    }
    return null;
  }

  /** Returns one snapshot per lane (null when that lane is inactive). */
  get snapshots(): (SkyObjectSnapshot | null)[] {
    return this._lanes.map((lane, i) => {
      const cfg = LANES[i];
      if (!lane.active) return null;
      return {
        id:        lane.id,
        type:      'SMALL_PLANE' as const,
        phase:     lane.impacted ? 'impacted' : 'approaching',
        position:  { x: lane.x, y: lane.y, z: cfg.z },
        // headingY: 0 = fuselage along +X (nose right). π = flipped for right→left.
        headingY:  lane.dir > 0 ? 0 : Math.PI,
        scale:     cfg.scale,
        glowFlash: lane.glowFlash,
      };
    });
  }

  /** Backwards-compat single snapshot (first active lane, or null). */
  get snapshot(): SkyObjectSnapshot | null {
    return this.snapshots.find(s => s !== null) ?? null;
  }

  private _updateLane(i: number, dt: number): void {
    const lane = this._lanes[i];
    const cfg  = LANES[i];

    if (!lane.active) {
      lane.gapTimer -= dt;
      if (lane.gapTimer <= 0) this._spawn(i);
      return;
    }

    lane.flyAge += dt;
    const t = Math.min(1, lane.flyAge / cfg.duration);

    const xFrom = lane.dir > 0 ? -X_SPAN :  X_SPAN;
    const xTo   = lane.dir > 0 ?  X_SPAN : -X_SPAN;
    lane.x = xFrom + (xTo - xFrom) * t;
    lane.y = cfg.y + Math.sin(lane.flyAge * 0.9) * 0.25;

    if (lane.glowFlash > 0) {
      lane.glowFlash = Math.max(0, lane.glowFlash - dt * 2.5);
    }

    if (t >= 1) this._despawn(i);
  }

  private _spawn(i: number): void {
    const lane = this._lanes[i];
    lane.spawnCount += 1;
    lane.dir        = Math.random() < 0.5 ? 1 : -1;  // random direction each pass
    lane.x          = lane.dir > 0 ? -X_SPAN : X_SPAN;
    lane.y          = LANES[i].y;
    lane.flyAge     = 0;
    lane.impacted   = false;
    lane.glowFlash  = 0;
    lane.active     = true;
    lane.id         = `flyover_${i}_${lane.spawnCount}`;
  }

  private _despawn(i: number): void {
    const lane      = this._lanes[i];
    lane.active     = false;
    lane.gapTimer   = LANES[i].gap;
  }
}
