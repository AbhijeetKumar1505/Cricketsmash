/**
 * Personality multipliers — Phase 5 polish that scales the canonical
 * bowling/batting/fielding motion per character. Same rig, different feel.
 *
 * Two principles:
 *   1. Same canonical motion always plays — personality only SCALES it.
 *      So adding a new character is one row in the table; no new poses to author.
 *   2. The differences must be VISIBLE — small (5-10%) deltas read as "same
 *      character" to the eye, even though they measure different. Real
 *      personality lives in 20-50% deltas on a few key dimensions, not 5%
 *      deltas on everything.
 *
 * Controllers read these via getPersonality(playerId).
 */

export interface Personality {
  // ── Action scaling (used in swing/bowl arcs) ──────────────────────────────
  /** Overall arm/spine rotation magnitude in the primary action. 1.0 = default. */
  power:          number;
  /** Post-contact arm extension multiplier. >1 = bigger finish, <1 = compact. */
  followThrough:  number;

  // ── Idle / locomotion ─────────────────────────────────────────────────────
  /** Breathing / sway amplitude. 1.0 = default. */
  bob:            number;
  /** Run-cycle frequency / chase speed (fielders). 1.0 = default. */
  speed:          number;

  // ── Stance shape (visible while idle and at backlift) ─────────────────────
  /** Leg spread — multiplies the Z-rotation on upper legs. >1 = wider stance. */
  stanceWidth:    number;
  /** Knee bend depth — multiplies the X-rotation crouch on upper legs/hips. */
  stanceCrouch:   number;

  // ── Swing-specific dynamics ───────────────────────────────────────────────
  /** How high the bat raises in backlift. >1 = bigger windup. */
  backliftHeight: number;
  /** Hip rotation magnitude through contact. >1 = bigger torso pivot. */
  hipRotation:    number;
  /** Swing tempo — multiplies the linear progress used by easings. >1 = snappier whip. */
  swingSpeed:     number;

  // ── Reaction expressivity ─────────────────────────────────────────────────
  /** Scales follow-through magnitude on top of outcome bucket. >1 = showy. */
  reactionFlair:  number;
}

const DEFAULT: Personality = {
  power:          1.0,
  followThrough:  1.0,
  bob:            1.0,
  speed:          1.0,
  stanceWidth:    1.0,
  stanceCrouch:   1.0,
  backliftHeight: 1.0,
  hipRotation:    1.0,
  swingSpeed:     1.0,
  reactionFlair:  1.0,
};

// ── Per-character overrides ──────────────────────────────────────────────────
//
// Design notes per character:
//   modi    — balanced, classical baseline (the reference point)
//   trump   — exaggerated, loud, wide stance, huge follow-through, snappy
//   putin   — compact, technical, low-key, tight stance, minimal flair
//   adeft   — athletic, fluid, slightly above baseline on everything
//   kimjong — controlled, deliberate, low bob, restrained follow-through
//   meloni  — disciplined bowler; affects bowl arm + run-up
//   ronaldo — athletic fielder; chase speed + power emphasis
//
const TABLE: Record<string, Partial<Personality>> = {
  // ── Batsmen ────────────────────────────────────────────────────────────────
  modi: {
    // V6 readability: classical reference — moderate crouch, moderate width
    stanceWidth:    1.15,
    stanceCrouch:   1.15,
    backliftHeight: 1.15,
    hipRotation:    1.10,
  },
  trump: {
    // V6 readability: huge silhouette — wide stance tells "power hitter" at
    // a glance; upright posture (0.95) creates tall, imposing profile
    power:          1.35,
    followThrough:  2.00,
    bob:            1.30,
    stanceWidth:    1.60,
    stanceCrouch:   0.95,
    backliftHeight: 1.60,
    hipRotation:    1.50,
    swingSpeed:     1.15,
    reactionFlair:  2.00,
  },
  putin: {
    // V6 readability: compact silhouette — tight stance + deep crouch creates
    // low, coiled, aggressive profile distinct from Modi's classical look
    power:          0.75,
    followThrough:  0.50,
    bob:            0.55,
    stanceWidth:    0.75,
    stanceCrouch:   1.40,
    backliftHeight: 0.75,
    hipRotation:    0.70,
    swingSpeed:     0.95,
    reactionFlair:  0.40,
  },
  adeft: {
    // V6 readability: explosive athlete — balanced width (not as wide as Trump),
    // naturally crouched (not as deep as Putin), biggest backlift for visible power
    power:          1.20,
    followThrough:  1.50,
    bob:            1.05,
    stanceWidth:    1.25,
    stanceCrouch:   1.10,
    backliftHeight: 1.40,
    hipRotation:    1.20,
    swingSpeed:     1.10,
    reactionFlair:  1.40,
  },
  kimjong: {
    power:          0.95,
    followThrough:  0.85,
    bob:            0.65,
    speed:          0.55,
    stanceWidth:    0.90,
    stanceCrouch:   1.10,
    backliftHeight: 0.85,
    hipRotation:    0.80,
    swingSpeed:     0.85,
    reactionFlair:  0.70,
  },

  // ── Bowler ─────────────────────────────────────────────────────────────────
  meloni: {
    power:          1.05,
    followThrough:  1.10,
    bob:            0.95,
    swingSpeed:     1.05,
  },

  // ── Fielder ────────────────────────────────────────────────────────────────
  ronaldo: {
    power:          1.30,
    speed:          1.50,
    bob:            0.85,
    stanceCrouch:   1.05,
    stanceWidth:    0.92,
  },
};

export function getPersonality(playerId: string | undefined): Personality {
  if (!playerId) return DEFAULT;
  const override = TABLE[playerId];
  if (!override) return DEFAULT;
  return { ...DEFAULT, ...override };
}
