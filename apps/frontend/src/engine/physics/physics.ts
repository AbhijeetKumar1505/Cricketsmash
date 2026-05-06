/**
 * physics.ts — Core math primitives, fixed-timestep accumulator,
 * semi-implicit Euler integrator, and seeded PRNG.
 *
 * Rules:
 *   • THREE.js-free (pure math only)
 *   • Fixed dt = 1/60 s — no variable timestep
 *   • Semi-implicit Euler: vel += acc*dt first, then pos += vel*dt
 *   • All randomness via Mulberry32 seeded RNG — no Math.random()
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const FIXED_DT = 1 / 60;   // physics timestep (seconds)
export const GRAVITY  = 9.81;     // m/s²

// ── Vec3 ──────────────────────────────────────────────────────────────────────

export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}

  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }

  copy(v: Readonly<Vec3>): this {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }

  zero(): this { this.x = 0; this.y = 0; this.z = 0; return this; }

  add(v: Readonly<Vec3>): this {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }

  /** this += v * s */
  addScaled(v: Readonly<Vec3>, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }

  sub(v: Readonly<Vec3>): this {
    this.x -= v.x; this.y -= v.y; this.z -= v.z;
    return this;
  }

  scale(s: number): this {
    this.x *= s; this.y *= s; this.z *= s;
    return this;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /** Length in XZ plane only (ignore Y). */
  lengthXZ(): number {
    return Math.sqrt(this.x * this.x + this.z * this.z);
  }

  normalize(): this {
    const l = this.length();
    if (l > 1e-8) this.scale(1 / l);
    return this;
  }

  dot(v: Readonly<Vec3>): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  distanceTo(v: Readonly<Vec3>): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /** Distance in XZ plane only. */
  distanceXZ(v: Readonly<Vec3>): number {
    const dx = this.x - v.x;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** Convert to a plain object (compatible with THREE.Vector3.set). */
  toPlain(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  toString(): string {
    return `Vec3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
}

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────

/**
 * Returns a deterministic PRNG function seeded by `seed`.
 * Output: [0, 1) float, same sequence for same seed.
 * Usage: const rng = mulberry32(seed); const r = rng();
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Combine ball index and match seed into a single deterministic seed.
 * Use: makeSeed(ballId, matchSeed) → pass to mulberry32()
 */
export function makeSeed(ballId: number, matchSeed: number): number {
  return (Math.imul(ballId, 2654435761) ^ matchSeed) >>> 0;
}

// ── Semi-Implicit Euler Integrator ────────────────────────────────────────────

/**
 * Advance position and velocity by one fixed step.
 *
 * STRICT order (semi-implicit Euler):
 *   1. velocity += acceleration * dt   ← velocity first
 *   2. position += velocity * dt       ← then position with updated velocity
 *
 * This is more stable than explicit Euler and preserves energy better.
 */
export function semiImplicitEuler(
  pos: Vec3,
  vel: Vec3,
  acc: Readonly<Vec3>,
  dt: number,
): void {
  // Step 1 — update velocity
  vel.x += acc.x * dt;
  vel.y += acc.y * dt;
  vel.z += acc.z * dt;
  // Step 2 — update position using the *new* velocity
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;
}

// ── Fixed-Timestep Accumulator ────────────────────────────────────────────────

/**
 * Decouples the physics update rate from the render rate.
 *
 * Usage (inside GameEngine.update(realDt)):
 *   this.accumulator.update(realDt, (dt) => physicsStep(dt));
 *
 * The callback is called N times per frame such that N * FIXED_DT ≈ realDt.
 * Any leftover time carries over to the next frame (no drift accumulation).
 */
export class PhysicsAccumulator {
  private _acc   = 0;
  private _alpha = 0;   // fractional step for render interpolation

  /**
   * Advance physics by one or more fixed steps.
   * @param realDt   Wall-clock delta since last frame (seconds).
   * @param step     Fixed-step callback; always receives exactly FIXED_DT.
   */
  update(realDt: number, step: (fixedDt: number) => void): void {
    // Cap to prevent spiral of death on stalled tabs.
    this._acc += Math.min(realDt, 4 * FIXED_DT);

    while (this._acc >= FIXED_DT) {
      step(FIXED_DT);
      this._acc -= FIXED_DT;
    }

    this._alpha = this._acc / FIXED_DT;
  }

  /**
   * Fractional progress [0,1) into the next fixed step.
   * Multiply by (newPos - oldPos) to interpolate render positions.
   */
  get alpha(): number { return this._alpha; }

  reset(): void {
    this._acc   = 0;
    this._alpha = 0;
  }
}

// ── Misc math helpers ─────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
