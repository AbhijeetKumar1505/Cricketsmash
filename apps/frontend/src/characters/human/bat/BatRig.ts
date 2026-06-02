/**
 * BatRig — per-character bat socket calibration.
 *
 * The bat mesh sits in the hand bone's local space. Different Meshy AI rig models
 * have different hand proportions and bind-pose orientations, so a fixed offset
 * from the default parenting leaves the grip misaligned on some characters.
 *
 * BatRig wraps the bat Object3D and applies a configurable socketOffset /
 * socketRotation in local space each frame. getContactPoint() returns the
 * world-space "sweet spot" on the bat face (65% along bat length) — used by
 * BatTargetIK as the IK end-effector target.
 *
 * Usage: `new BatRig(batObject, 'trump')` — picks per-character defaults from
 * BAT_SOCKET_TABLE, with fallback to the generic default.
 */

import * as THREE from 'three';

export interface BatSocketConfig {
  /** Position offset in hand-bone local space (metres). */
  offset: THREE.Vector3;
  /** Euler rotation in hand-bone local space (radians, XYZ order). */
  rotation: THREE.Euler;
  /** Total bat length grip-to-toe (metres). Default 0.72. */
  length: number;
}

// ── Default socket — works for most Meshy AI biped rigs ─────────────────────
const DEFAULT_CONFIG: BatSocketConfig = {
  offset:   new THREE.Vector3(0, -0.04, 0.02),
  rotation: new THREE.Euler(0.10, 0, 0),
  length:   0.72,
};

// ── Per-character overrides ──────────────────────────────────────────────────
// Values are merged over DEFAULT_CONFIG, similar to personality.ts pattern.
// Tune these visually after seeing each character hold the bat in-game.
// 'offset' adjusts grip position; 'rotation' adjusts grip angle in palm.
const BAT_SOCKET_TABLE: Record<string, Partial<BatSocketConfig>> = {
  trump: {
    // Larger hand model — palm sits slightly lower and further forward
    offset:   new THREE.Vector3(0, -0.05, 0.03),
    rotation: new THREE.Euler(0.08, 0.04, 0),
  },
  putin: {
    // Compact build — shorter grip depth, slightly steeper angle
    offset:   new THREE.Vector3(0, -0.03, 0.01),
    rotation: new THREE.Euler(0.12, 0, 0),
  },
  meloni: {
    // Bowler character — if ever used as batsman, slight inward rotation
    rotation: new THREE.Euler(0.10, 0.02, 0),
  },
  adeft: {
    // Athletic build — moderate forward reach
    offset:   new THREE.Vector3(0, -0.04, 0.025),
  },
};

/**
 * Resolve the socket config for a given player ID.
 * Returns a new config object (safe to mutate).
 */
export function getBatSocketConfig(playerId?: string): BatSocketConfig {
  if (!playerId) return { ...DEFAULT_CONFIG };
  const override = BAT_SOCKET_TABLE[playerId];
  if (!override) return { ...DEFAULT_CONFIG };
  return {
    offset:   override.offset   ?? DEFAULT_CONFIG.offset.clone(),
    rotation: override.rotation ?? new THREE.Euler().copy(DEFAULT_CONFIG.rotation),
    length:   override.length   ?? DEFAULT_CONFIG.length,
  };
}

// ── BatRig class ──────────────────────────────────────────────────────────────

const _contactWorld = new THREE.Vector3();

export class BatRig {
  private readonly _bat: THREE.Object3D;
  readonly cfg: BatSocketConfig;

  private readonly _sweepSpot = new THREE.Object3D();

  /**
   * @param bat      The bat Object3D (parented to rightHand bone)
   * @param playerId Optional character ID — resolves per-character socket defaults
   */
  constructor(bat: THREE.Object3D, playerId?: string) {
    this._bat = bat;
    this.cfg  = getBatSocketConfig(playerId);
    // Sweet spot at 65% along bat length (Y axis in bat local space)
    this._sweepSpot.position.set(0, this.cfg.length * 0.65, 0);
    this._bat.add(this._sweepSpot);
  }

  /**
   * Apply socket calibration offsets. Call each frame after the hand bone
   * transform has been written by the animation layers.
   */
  update(): void {
    this._bat.position.copy(this.cfg.offset);
    this._bat.rotation.copy(this.cfg.rotation);
  }

  /**
   * World-space position of the bat's sweet spot.
   * Used by BatTargetIK as the IK end-effector position for the arm chain.
   * Call after update() so the world matrix is current.
   */
  getContactPoint(): THREE.Vector3 {
    this._sweepSpot.getWorldPosition(_contactWorld);
    return _contactWorld;
  }

  dispose(): void {
    this._bat.remove(this._sweepSpot);
  }
}
