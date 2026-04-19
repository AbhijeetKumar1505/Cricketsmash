/** Canonical 2D simulation space (matches legacy Pixi layout). */
export const SIM = {
  W: 720,
  H: 400,
  GY: 274,
  PX1: 188,
  PX2: 532,
  PY1: 228,
  PY2: 272,
  CX_BOWL: 212,
  CX_BAT: 508,
  BOWLER_REST_X: 118,
  BAT_X: 488,
  get BALL_RELEASE_Y() {
    return SIM.GY - 60;
  },
  BALL_BOUNCE_X: 370,
  get BALL_BOUNCE_Y() {
    return SIM.PY2 - 1;
  },
  BALL_AT_BAT_X: 468,
  get BALL_AT_BAT_Y() {
    return SIM.GY - 40;
  },
} as const;

/** Scale: simulation pixels → Three.js world units (Y-up, metres-ish). */
export const WORLD = {
  /** Longitudinal extent of the playable strip on Z (total length 20). */
  pitchHalfLength: 10,
  /** Horizontal extent of the playable strip on X (total width 3). */
  pitchHalfWidth: 1.5,
  /** Ground plane Y. */
  groundY: 0,
  /** Ball radius in world units. */
  ballRadius: 0.11, // Standardized true 3D scale
  /** Height scale: screen pixels above ground line → world Y. */
  heightScale: 0.038,
  /** Depth variation/Spread for horizontal deviation. */
  widthScale: 0.012,
} as const;
