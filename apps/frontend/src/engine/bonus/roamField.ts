import { WORLD } from '../constants.js';
import { BONUS_ROAM } from './config.js';

export function bonusInsidePitchStripe(x: number, z: number): boolean {
  const m = BONUS_ROAM.PITCH_MARGIN;
  if (Math.abs(x) > WORLD.PITCH_HALF_W + m) return false;
  return z >= WORLD.STUMPS_FAR_Z - m && z <= WORLD.STUMPS_NEAR_Z + m;
}

export function bonusClampXZ(x: number, z: number): { x: number; z: number } {
  let cx = Math.min(BONUS_ROAM.X_MAX, Math.max(BONUS_ROAM.X_MIN, x));
  let cz = Math.min(BONUS_ROAM.Z_MAX, Math.max(BONUS_ROAM.Z_MIN, z));
  ({ x: cx, z: cz } = bonusKickOutPitch(cx, cz));
  return { x: cx, z: cz };
}

/** Slide off the wicket strip sideways if overlapping. */
export function bonusKickOutPitch(x: number, z: number): { x: number; z: number } {
  if (!bonusInsidePitchStripe(x, z)) return { x, z };
  const left = -(WORLD.PITCH_HALF_W + BONUS_ROAM.PITCH_MARGIN + 0.45);
  const right = WORLD.PITCH_HALF_W + BONUS_ROAM.PITCH_MARGIN + 0.45;
  const nx = Math.abs(x - left) < Math.abs(x - right) ? left : right;
  let ox = nx;
  let oz = z;
  if (bonusInsidePitchStripe(ox, oz)) {
    ox = x < 0 ? left : right;
  }
  return bonusClampBox(ox, oz);
}

function bonusClampBox(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.min(BONUS_ROAM.X_MAX, Math.max(BONUS_ROAM.X_MIN, x)),
    z: Math.min(BONUS_ROAM.Z_MAX, Math.max(BONUS_ROAM.Z_MIN, z)),
  };
}

export function bonusRandomWaypoint(
  rng: () => number,
  avoid: ReadonlyArray<{ x: number; z: number; r: number }>,
  preferDeep = false,
): { x: number; z: number } {
  const span = BONUS_ROAM.Z_MAX - BONUS_ROAM.Z_MIN;
  const deepLo = BONUS_ROAM.Z_MIN + span * 0.52;
  const deepHi = BONUS_ROAM.Z_MAX - span * 0.02;
  for (let k = 0; k < 48; k++) {
    const x = BONUS_ROAM.X_MIN + rng() * (BONUS_ROAM.X_MAX - BONUS_ROAM.X_MIN);
    const z = preferDeep && k % 3 !== 0
      ? deepLo + rng() * Math.max(0.15, deepHi - deepLo)
      : BONUS_ROAM.Z_MIN + rng() * span;
    const c = bonusClampXZ(x, z);
    if (bonusInsidePitchStripe(c.x, c.z)) continue;
    let bad = false;
    for (const o of avoid) {
      const dx = c.x - o.x;
      const dz = c.z - o.z;
      if (dx * dx + dz * dz < (o.r * o.r)) {
        bad = true;
        break;
      }
    }
    if (!bad) return c;
  }
  return bonusClampXZ(
    BONUS_ROAM.X_MIN + rng() * (BONUS_ROAM.X_MAX - BONUS_ROAM.X_MIN),
    BONUS_ROAM.Z_MIN + rng() * (BONUS_ROAM.Z_MAX - BONUS_ROAM.Z_MIN),
  );
}
