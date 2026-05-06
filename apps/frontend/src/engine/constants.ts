/**
 * All magic numbers live here. Import from this file, never hardcode inline.
 *
 * Coordinate system
 *   Z axis — pitch length. Bowler end = negative Z. Batsman crease = Z=0.
 *   Y axis — height. Ground = 0.
 *   X axis — lateral (off-side positive, leg-side negative).
 *
 * Camera sits at positive Z (behind batsman), looking toward negative Z.
 * The ball travels from RELEASE_Z (negative) toward BATSMAN_Z (zero),
 * giving the classic broadcast angle where the ball appears to come at the viewer.
 */

// ── World geometry ────────────────────────────────────────────────────────────

export const WORLD = {
  RELEASE_Z:      -9.0,   // where ball leaves bowler's hand
  RELEASE_Y:       1.8,   // hand height at release
  BATSMAN_Z:       0.0,   // ball must reach this Z at hitTime (invariant)
  HIT_Y:           0.85,  // ball height at contact point
  STUMPS_NEAR_Z:   0.6,   // batting stumps (behind batsman)
  STUMPS_FAR_Z:  -10.5,   // bowling stumps
  PITCH_HALF_W:    0.23,  // half-width of pitch (metres)
  GROUND_Y:        0.0,
} as const;

// ── Ball physics ──────────────────────────────────────────────────────────────

export const BALL = {
  RADIUS:      0.036,  // real cricket ball ~7.2cm diameter
  GRAVITY:     9.8,    // m/s²
  RESTITUTION: 0.45,   // energy retained on ground bounce
  FRICTION:    0.80,   // speed retained along ground plane
  SPIN_RATE:   18,     // radians/s while in flight

  /** Post-hit velocity components by quality. Positive Z = toward boundary. */
  HIT_SPEEDS: {
    perfect: { forward: 24, vertical: 11,  lateral: 5   },  // lofted six arc
    good:    { forward: 16, vertical: 5,   lateral: 3   },  // driven four, ground level
    miss:    { forward: 2,  vertical: 0.2, lateral: 0.8 },  // feathered edge / missed swing
  },
} as const;

// ── Timing ────────────────────────────────────────────────────────────────────

export const TIMING = {
  /** Maximum dt before physics becomes unstable (tabs switching away, etc.) */
  MAX_DT:         0.05,   // 50 ms = ~20 FPS minimum simulated

  /** Perfect hit window: ±seconds around idealHitTime */
  PERFECT_WINDOW: 0.08,

  /** Good hit window: ±seconds around idealHitTime */
  GOOD_WINDOW:    0.18,

  /** Hit-pause: physics dt is zeroed for this many seconds after contact */
  HIT_PAUSE:      0.12,

  /** After ball passes BATSMAN_Z without a swing, auto-wicket after this grace */
  AUTO_WICKET_GRACE: 0.25,

  /** Phase durations */
  RESULT_DISPLAY:  2.5,   // seconds to hold result before returning to idle
  POST_HIT_MAX:    2.0,   // max seconds in post_hit before forcing result
} as const;

// ── Bowl speeds (seconds for ball to reach batsman) ───────────────────────────

export const HIT_TIMES: Record<'fast' | 'spin' | 'swing', number> = {
  fast:  1.1,
  spin:  2.0,
  swing: 1.5,
};

// ── Camera ────────────────────────────────────────────────────────────────────

export const CAMERA = {
  FOV:          65,
  NEAR:         0.1,
  FAR:          1000,

  /** Camera lerp speed toward target position (per second) */
  FOLLOW_SPEED: 4,

  /** Shake intensity decay (per second) */
  SHAKE_DECAY:  6,

  PRESETS: {
    broadcast:   { pos: [0,  5.5, 14] as const, lookAt: [0, 1,  -2] as const },
    bowler:      { pos: [0,  3,  -13] as const, lookAt: [0, 1,   2] as const },
    batsman:     { pos: [0,  3,   13] as const, lookAt: [0, 1,  -3] as const },
  },
} as const;
