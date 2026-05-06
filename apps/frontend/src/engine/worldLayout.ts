import * as THREE from 'three';
import { WORLD } from './constants.js';

/** Midpoint between bowling and batting stumps — fielders face here (XZ look-at). */
export const PITCH_MID_Z = (WORLD.STUMPS_FAR_Z + WORLD.STUMPS_NEAR_Z) * 0.5;

export const ACTION_CENTER = new THREE.Vector3(0, 0, PITCH_MID_Z);

/** Striker anchor Z: aligned with contact strip, slight +Z for foot/art clearance vs `BATSMAN_Z`. */
export const BATSMAN_CREASE_Z = 0.22;

export const BOWLER_RUN_START_Z = -17.5;
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

const FIELDER_SCALE_MIN = 0.52;

/**
 * Outfield character scale from distance along Z from the crease.
 * `max(0.45, 1 / (1 + 0.06 * |z - crease|))` — far fielders shrink but stay readable.
 */
export function getFielderDepthScale(z: number): number {
  // Stronger falloff so far fielders read clearly smaller than near ones.
  const d = Math.abs(z - BATSMAN_CREASE_Z);
  return Math.max(FIELDER_SCALE_MIN, 1 - d * 0.038);
}

export type FielderSlot = {
  name: string;
  /** World X position. */
  x: number;
  /** World Z position. */
  z: number;
  isKeeper: boolean;
  /** Per-slot silhouette tuning (renderer multiplies with depth scaling). */
  silhouetteScale: number;
};

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

function getFielderZ(depthT: number): number {
  // Non-linear depth distribution: denser near-mid, stretched toward deep field.
  return -(2.6 + Math.pow(depthT, 1.6) * 14.8);
}

function getFielderX(lateral: number, z: number): number {
  const depth = Math.abs(z - BATSMAN_CREASE_Z);
  const perspectiveFactor = 1 / (1 + depth * 0.08);
  let x = lateral * perspectiveFactor * 18;
  if (depth > 12) x *= 0.85; // Extra inward pull for far-field compression.
  return x;
}

type FielderTemplate = {
  name: string;
  isKeeper: boolean;
  depthT: number;
  lateral: number;
  silhouetteScale: number;
};

const FIELDER_TEMPLATES: ReadonlyArray<FielderTemplate> = [

  // 🔴 NEAR BAND (clean foreground)
  { name: 'wicketkeeper', isKeeper: true, depthT: 0.08, lateral: 0.22,  silhouetteScale: 1.04 }, // #1

  { name: 'slip',         isKeeper: false, depthT: 0.04, lateral: -0.42, silhouetteScale: 1.0 }, // #2
  { name: 'gully',        isKeeper: false, depthT: 0.24, lateral: 0.70,  silhouetteScale: 1.0 }, // #3

  // 🟡 MID BAND (core gameplay spacing)
  { name: 'point',        isKeeper: false, depthT: 0.36, lateral: -0.78, silhouetteScale: 0.97 }, // #4
  { name: 'cover',        isKeeper: false, depthT: 0.42, lateral: -0.55, silhouetteScale: 0.96 }, // #5
  { name: 'mid_off',      isKeeper: false, depthT: 0.42, lateral: -0.25, silhouetteScale: 0.95 }, // #6

  { name: 'mid_on',       isKeeper: false, depthT: 0.42, lateral: 0.25,  silhouetteScale: 0.95 }, // #7
  { name: 'square_leg',   isKeeper: false, depthT: 0.42, lateral: 0.62,  silhouetteScale: 0.97 }, // #8

  // 🔵 DEEP BAND (smooth arc, no clustering)
  { name: 'deep_point',        isKeeper: false, depthT: 0.68, lateral: -1.0,  silhouetteScale: 0.92 }, // #9
  { name: 'deep_cover',        isKeeper: false, depthT: 0.75, lateral: -0.7,  silhouetteScale: 0.9 },  // #10
  { name: 'long_off',          isKeeper: false, depthT: 0.9,  lateral: -0.3,  silhouetteScale: 0.88 }, // #11

  { name: 'long_on',           isKeeper: false, depthT: 0.9,  lateral: 0.3,   silhouetteScale: 0.88 }, // #12
  { name: 'deep_mid_wicket',   isKeeper: false, depthT: 0.75, lateral: 0.7,   silhouetteScale: 0.9 },  // #13
  { name: 'deep_square_leg',   isKeeper: false, depthT: 0.68, lateral: 1.0,   silhouetteScale: 0.92 }, // #14

];

const FIXED_FIELD_MAP: ReadonlyArray<FielderSlot> = FIELDER_TEMPLATES.map((slot) => {
  const z = getFielderZ(slot.depthT);
  return {
    name: slot.name,
    x: getFielderX(slot.lateral, z),
    z,
    isKeeper: slot.isKeeper,
    silhouetteScale: slot.silhouetteScale,
  };
});

/** Fixed named cricket-role positions (XZ); first slot is wicket-keeper. */
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
