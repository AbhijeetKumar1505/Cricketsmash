import * as THREE from 'three';
import { WORLD } from './constants.js';

/** Midpoint between bowling and batting stumps — fielders face here (XZ look-at). */
export const PITCH_MID_Z = (WORLD.STUMPS_FAR_Z + WORLD.STUMPS_NEAR_Z) * 0.5;

export const ACTION_CENTER = new THREE.Vector3(0, 0, PITCH_MID_Z);

/** Striker anchor Z: aligned with contact strip, slight +Z for foot/art clearance vs `BATSMAN_Z`. */
export const BATSMAN_CREASE_Z = 0.22;

/** Bowler run-up anchor: far down the lane (same depth curve as deep field) so the corridor reads clean on broadcast. */
export const BOWLER_RUN_START_Z = -(2.6 + Math.pow(0.92, 1.6) * 14.8) - 0.55;
export const BOWLER_RELEASE_Z = WORLD.RELEASE_Z;

const Z_REF_DEPTH = BATSMAN_CREASE_Z;
const DEPTH_K_PITCH = 0.015;
const DEPTH_K_OUTFIELD = 0.036;

export type DepthScaleOpts = { outfield?: boolean };

/** Stronger outfield compression so far boundary fielders read smaller. */
export function getDepthScale(z: number, opts?: DepthScaleOpts): number {
  const k = opts?.outfield ? DEPTH_K_OUTFIELD : DEPTH_K_PITCH;
  const lo = opts?.outfield ? 0.52 : 0.76;
  const hi = opts?.outfield ? 1.04 : 1.1;
  return THREE.MathUtils.clamp(1 + (z - Z_REF_DEPTH) * k, lo, hi);
}

const FIELDER_SCALE_MIN = 0.82;

export function getFielderDepthScale(z: number): number {
  const d = Math.abs(z - BATSMAN_CREASE_Z);
  return Math.max(FIELDER_SCALE_MIN, 1 - d * 0.015);
}

export type FielderSlot = {
  name: string;
  /** World X position. */
  x: number;
  /** World Z position. */
  z: number;
  /** Per-slot silhouette tuning (renderer multiplies with depth scaling). */
  silhouetteScale: number;
};

/**
 * Idle pose family for 3D fielders (set from slot name in Renderer).
 * A=crouch close, B=infield athletic, C=deep relaxed, D=leg-side anticipation lean.
 */
export type FielderStanceClass = 0 | 1 | 2 | 3;

/**
 * Stylized broadcast hierarchy: close infielders read largest among fielders,
 * mid ring slightly smaller, boundary pack tightest — multiplied in `Renderer` with depth falloff.
 */
export function broadcastHierarchyFielderScale(name: string): number {
  switch (name) {
    case 'slip':
    case 'gully':
    case 'short_leg':
      return 1.0;
    case 'point':
    case 'cover':
    case 'mid_on':
    case 'square_leg':
      return 0.95;
    case 'deep_mid_wicket':
    case 'deep_third_man':
    case 'deep_fine_leg':
      return 0.97;
    default:
      return 0.95;
  }
}

export function fielderStanceClassForName(name: string): FielderStanceClass {
  switch (name) {
    case 'slip':
    case 'gully':
    case 'short_leg':
      return 0;
    case 'point':
    case 'cover':
      return 1;
    case 'deep_mid_wicket':
    case 'deep_third_man':
    case 'deep_fine_leg':
      return 2;
    case 'mid_on':
    case 'square_leg':
      return 3;
    default:
      return 2;
  }
}

/**
 * Idle attention point in world space — blends striker vs pitch interior so
 * infielders don’t all parallel-face the camera; leg-side mids face the striker aggressively;
 * deep fielders bias toward the hitting lane.
 */
export function sampleFielderIdleLookPoint(
  roleName: string,
  batX: number,
  batY: number,
  batZ: number,
  out: THREE.Vector3,
): void {
  const px = 0;
  const py = 0.42;
  const pz = PITCH_MID_Z;
  switch (roleName) {
    case 'slip':
    case 'gully':
    case 'short_leg':
      out.set(batX, batY, batZ);
      return;
    case 'point':
    case 'cover':
      out.set(
        THREE.MathUtils.lerp(batX, px, 0.40),
        py,
        THREE.MathUtils.lerp(batZ, pz, 0.40),
      );
      return;
    case 'mid_on':
    case 'square_leg':
      out.set(
        THREE.MathUtils.lerp(batX, px, 0.1),
        py,
        THREE.MathUtils.lerp(batZ, pz, 0.1),
      );
      return;
    case 'deep_mid_wicket':
    case 'deep_third_man':
    case 'deep_fine_leg':
      out.set(
        THREE.MathUtils.lerp(batX, px, 0.6),
        py + 0.08,
        THREE.MathUtils.lerp(batZ, pz, 0.6),
      );
      return;
    default:
      out.set(batX, batY, batZ);
  }
}

/** What scoring effect this prop applies when the ball intersects it. */
export type BonusPropRole = 'ballAdder' | 'profitMult' | 'movingMult';

/** Visual mesh set in `BonusObject3D` (decoupled from stadium sponsor boards). */
export type BonusPropVisual = 'hoarding' | 'rover' | 'spider';

export type BonusSkillZone = {
  id: string;
  x: number;
  y: number;
  z: number;
  zone: 'ground' | 'stands' | 'boundary';
  placementWeight: number;
  role: BonusPropRole;
  visual: BonusPropVisual;
  /** Extra legal deliveries (same stake) — `ballAdder` only. */
  ballAdderAmount?: 1 | 2 | 3;
  /** World-space collision radius (metres); falls back to definition default when omitted. */
  hitRadius?: number;
};

/** Bowler-ward depth → world Z (negative Z toward bowling end). */
function pitchDepthToWorldZ(depthT: number): number {
  const t = Math.max(0, depthT);
  return -(2.6 + Math.pow(t, 1.6) * 14.8);
}

function getFielderX(lateral: number, z: number): number {
  const depth = Math.abs(z - BATSMAN_CREASE_Z);
  const perspectiveFactor = 1 / (1 + depth * 0.085);
  // Slightly tighter lateral spread than raw `lateral * 18` — keeps deep field inside the stadium read.
  let x = lateral * perspectiveFactor * 15.2;
  if (depth > 8.5) x *= 0.92;
  if (depth > 12) x *= 0.88;
  return THREE.MathUtils.clamp(x, -19, 19);
}

type FielderTemplate = {
  name: string;
  depthT: number;
  lateral: number;
  silhouetteScale: number;
};

/**
 * Broadcast composition: keep a clear bowler→pitch→batsman visual corridor, slight off-side weight,
 * depth rhythm (close tight, boundary arcing wider), and silhouette hierarchy (close ≈1, mid ~0.93–0.98, deep 0.82–0.88).
 */
const FIELDER_TEMPLATES: ReadonlyArray<FielderTemplate> = [
  { name: 'slip',            depthT: 0.28, lateral: -0.36, silhouetteScale: 1.0 },
  { name: 'gully',           depthT: 0.04, lateral: -0.74, silhouetteScale: 0.98 },
  { name: 'point',           depthT: 0.56, lateral: -0.98, silhouetteScale: 0.94 },
  { name: 'cover',           depthT: 0.66, lateral: -0.42, silhouetteScale: 0.93 },
  { name: 'deep_third_man',  depthT: 0.84, lateral: -0.74, silhouetteScale: 0.91 },
  { name: 'mid_on',          depthT: 0.28, lateral:  0.36, silhouetteScale: 0.95 },
  { name: 'square_leg',      depthT: 0.04, lateral:  0.74, silhouetteScale: 0.92 },
  { name: 'short_leg',       depthT: 0.56, lateral:  0.98, silhouetteScale: 0.96 },
  { name: 'deep_mid_wicket', depthT: 0.66, lateral:  0.42, silhouetteScale: 0.94 },
  { name: 'deep_fine_leg',   depthT: 0.84, lateral:  0.74, silhouetteScale: 0.92 },
];

const FIXED_FIELD_MAP: ReadonlyArray<FielderSlot> = FIELDER_TEMPLATES.map((slot) => {
  const z = pitchDepthToWorldZ(slot.depthT);
  return {
    name: slot.name,
    x: getFielderX(slot.lateral, z),
    z,
    silhouetteScale: slot.silhouetteScale,
  };
});

/** Fixed cricket-role XZ slots (length 10). */
export const FIELDER_SLOTS: ReadonlyArray<FielderSlot> = FIXED_FIELD_MAP;

/**
 * Curated bonus props — Y/Z chosen to sit on **stand tiers** (not rope-level boundary ads).
 * Boundary sponsor meshes in `Stadium.ts` use ~1.2 / ~2.0 m (aligned to fence poles); bonuses sit above
 * on the white stand fascia, then a second skyline row for six-eligible arcs.
 *
 * - **Mid-stand hoardings**: readable from play, still physics-reachable off big hits where applicable.
 * - **Skyline row**: tallest +balls targets.
 * - **Rover / spider (`movingMult`)**: turf patrol only.
 */
export const BONUS_SKILL_ZONES: ReadonlyArray<BonusSkillZone> = [
  // Skyline floodlight anchors around the scoreboard band (blue-marked positions).
  { id: 'sky_bonus_far_l', x: -35.4, y: 7.25, z: -28.1, zone: 'stands', placementWeight: 0.5, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 3, hitRadius: 1.92 },
  { id: 'sky_bonus_mid_l', x: -22.9, y: 6.58, z: -27.2, zone: 'stands', placementWeight: 0.52, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 2, hitRadius: 1.82 },
  { id: 'sky_bonus_far_r', x: -15.4, y: 6.35, z: -28.1, zone: 'stands', placementWeight: 0.5, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 2, hitRadius: 1.92 },
  { id: 'sky_bonus_mid_r', x: -8.9, y: 6.28, z: -27.2, zone: 'stands', placementWeight: 0.52, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 3, hitRadius: 1.82 },

  /** Former “field” bonuses — mid-stand fascia; minor Y tweaks vs stadium tiers. */
  { id: 'field_bonus_arc_l', x: 35.6, y: 7.02, z: -23.0, zone: 'stands', placementWeight: 1, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 2, hitRadius: 1.18 },
  { id: 'field_bonus_arc_r', x: 25.6, y: 7.00, z: -23.0, zone: 'stands', placementWeight: 1, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 2, hitRadius: 1.18 },
  { id: 'field_bonus_deep_l', x: 17.8, y: 6.52, z: -22.7, zone: 'stands', placementWeight: 0.9, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 1, hitRadius: 1.08 },
  { id: 'field_bonus_deep_r', x: 10.8, y: 6.72, z: -22.7, zone: 'stands', placementWeight: 0.9, role: 'ballAdder', visual: 'hoarding', ballAdderAmount: 3, hitRadius: 1.08 },

  { id: 'bonus_rover_alpha', x: -6.4, y: 0.1, z: -11.6, zone: 'ground', placementWeight: 0.7, role: 'movingMult', visual: 'rover', hitRadius: 0.44 },
  { id: 'bonus_spider_beta', x: 6.55, y: 0.1, z: -13.5, zone: 'ground', placementWeight: 0.7, role: 'movingMult', visual: 'spider', hitRadius: 0.44 },
];
