/**
 * BatContact — spring-deflection impact response on hand/bat at contact.
 *
 * On `trigger(power)`, imparts an impulse on the rightHand local-Z axis (bat twist).
 * The spring decays with stiffness=280, damping=26. Applied as addRot via the
 * post-step accumulator in AnimationBrain (same path as secondary springs), so
 * it stacks on the final composite pose without conflicting with ROLE layer ownership.
 *
 * Power range 0..1 controls kick magnitude — fed from personality.power so
 * power hitters have a sharper, more visible bat vibration.
 */

const STIFFNESS  = 280;
const DAMPING    = 26;
const BASE_KICK  = 0.18;  // radians at power=1
const SETTLE_THR = 0.0005; // offset threshold below which spring is considered settled

/** Scale factor for impact kick by shot type — aggressive shots produce bigger bat vibration. */
const SHOT_KICK_SCALE: Record<string, number> = {
  pull:        1.35,
  loft:        1.25,
  drive:       1.10,
  cut:         1.10,
  pushed_two:  0.85,
  quick_single:0.80,
  defend:      0.60,
  miss:        0.40,
  bowled:      0.00,
};

export class BatContact {
  private _active  = false;
  private _offset  = 0;
  private _vel     = 0;

  /** Impart a contact impulse. Safe to call multiple times (re-energises spring). */
  trigger(power: number, shotType?: string): void {
    const shotScale = shotType !== undefined ? (SHOT_KICK_SCALE[shotType] ?? 1.0) : 1.0;
    const kick    = BASE_KICK * Math.min(Math.max(power, 0.1), 1.0) * shotScale;
    if (kick <= 0) return;
    this._vel     = kick * 12;
    this._offset  = kick * 0.2;
    this._active  = true;
  }

  /**
   * Step the spring by `dt` seconds. Returns addRot deltas for rightHand.
   * Returns zeros when inactive to avoid unnecessary accumulator writes.
   */
  update(dt: number): { x: number; y: number; z: number } {
    if (!this._active) return { x: 0, y: 0, z: 0 };

    // Clamped, semi-implicit (implicit-damping) step — stable under dt spikes
    // (autoplay catch-up frames) where explicit Euler would explode and stick.
    const h = Math.min(dt, 1 / 60);
    this._vel    = (this._vel - STIFFNESS * this._offset * h) / (1 + DAMPING * h);
    this._offset += this._vel * h;

    // Self-heal: a diverged/non-finite spring deactivates instead of corrupting the hand.
    const settled = Math.abs(this._offset) < SETTLE_THR && Math.abs(this._vel) < 0.005;
    const diverged = !Number.isFinite(this._offset) || Math.abs(this._offset) > 1.0;
    if (settled || diverged) {
      this._active  = false;
      this._offset  = 0;
      this._vel     = 0;
      return { x: 0, y: 0, z: 0 };
    }

    return { x: 0, y: 0, z: this._offset };
  }

  get isActive(): boolean { return this._active; }

  reset(): void {
    this._active  = false;
    this._offset  = 0;
    this._vel     = 0;
  }
}
