/**
 * StagingController — lightweight cricket character staging poses.
 *
 * Provides cricket-ready stances, breathing, and weight shift for all
 * characters when STAGING_ENABLED is true and ANIM_PROCEDURAL_ENABLED is false.
 * Does NOT touch bowling/batting/fielding gameplay logic.
 *
 * All rotations are Euler radians applied via BoneAccumulator:
 *   setRot  = absolute (overrides rest pose)
 *   addRot  = additive (stacks on top of setRot targets)
 *   addPos  = additive position delta
 */

import type { BoneAccumulator } from './BoneAccumulator.js';
import type { Personality } from './personality.js';

// ── Slot-class lookup ─────────────────────────────────────────────────────────
// Maps fielder slot index → stance class
//   0 = close (slip, gully, short_leg)       — deep crouch, hands low
//   1 = infield (point, cover, mid_on, etc.) — athletic ready
//   2 = deep (deep_third_man, deep_fine_leg) — relaxed

const SLOT_CLASS: Record<number, 0 | 1 | 2> = {
  0: 0, 1: 0, 7: 0,
  2: 1, 3: 1, 5: 1, 6: 1,
  4: 2, 8: 2, 9: 2,
};

// ── Pose applicators ──────────────────────────────────────────────────────────

function applyBatsmanReady(acc: BoneAccumulator, p: Personality): void {
  const c = p.stanceCrouch, w = p.stanceWidth;
  acc.addRot('hips',         -0.05 * c, 0, 0);
  acc.addRot('spine',         0.08,     0, 0);
  acc.addRot('chest',         0.05,     0, 0);
  acc.addRot('upperChest',    0.02,     0, 0);
  acc.addRot('leftUpLeg',    -0.12 * c, 0,  0.06 * w);
  acc.addRot('rightUpLeg',   -0.12 * c, 0, -0.06 * w);
  acc.addRot('leftLeg',       0.10 * c, 0, 0);
  acc.addRot('rightLeg',      0.10 * c, 0, 0);
  acc.addRot('leftArm',       0.14,     0,  0.26);
  acc.addRot('rightArm',      0.14,     0, -0.26);
  acc.addRot('leftForeArm',   0.22,     0, 0);
  acc.addRot('rightForeArm',  0.22,     0, 0);
}

function applyBowlerIdle(acc: BoneAccumulator, p: Personality): void {
  const c = p.stanceCrouch, w = p.stanceWidth;
  acc.addRot('hips',         -0.04 * c, 0, 0);
  acc.addRot('spine',         0.10,     0, 0);
  acc.addRot('chest',         0.06,     0, 0);
  acc.addRot('upperChest',    0.03,     0, 0);
  acc.addRot('leftUpLeg',    -0.09 * c, 0,  0.05 * w);
  acc.addRot('rightUpLeg',   -0.09 * c, 0, -0.05 * w);
  acc.addRot('leftLeg',       0.08 * c, 0, 0);
  acc.addRot('rightLeg',      0.08 * c, 0, 0);
  acc.addRot('leftArm',       0.12,     0,  0.24);
  acc.addRot('rightArm',      0.12,     0, -0.24);
  acc.addRot('leftForeArm',   0.20,     0, 0);
  acc.addRot('rightForeArm',  0.20,     0, 0);
}

function applyFielderClose(acc: BoneAccumulator, p: Personality): void {
  const c = p.stanceCrouch, w = p.stanceWidth;
  acc.addRot('hips',         -0.18 * c, 0, 0);
  acc.addRot('spine',         0.20,     0, 0);
  acc.addRot('chest',         0.10,     0, 0);
  acc.addRot('upperChest',    0.05,     0, 0);
  acc.addRot('leftUpLeg',    -0.28 * c, 0,  0.10 * w);
  acc.addRot('rightUpLeg',   -0.28 * c, 0, -0.10 * w);
  acc.addRot('leftLeg',       0.25 * c, 0, 0);
  acc.addRot('rightLeg',      0.25 * c, 0, 0);
  acc.addRot('leftArm',       0.10,     0,  0.30);
  acc.addRot('rightArm',      0.10,     0, -0.30);
  acc.addRot('leftForeArm',   0.35,     0, 0);
  acc.addRot('rightForeArm',  0.35,     0, 0);
}

function applyFielderInfield(acc: BoneAccumulator, p: Personality): void {
  const c = p.stanceCrouch, w = p.stanceWidth;
  acc.addRot('hips',         -0.09 * c, 0, 0);
  acc.addRot('spine',         0.12,     0, 0);
  acc.addRot('chest',         0.06,     0, 0);
  acc.addRot('upperChest',    0.03,     0, 0);
  acc.addRot('leftUpLeg',    -0.16 * c, 0,  0.07 * w);
  acc.addRot('rightUpLeg',   -0.16 * c, 0, -0.07 * w);
  acc.addRot('leftLeg',       0.13 * c, 0, 0);
  acc.addRot('rightLeg',      0.13 * c, 0, 0);
  acc.addRot('leftArm',       0.13,     0,  0.27);
  acc.addRot('rightArm',      0.13,     0, -0.27);
  acc.addRot('leftForeArm',   0.24,     0, 0);
  acc.addRot('rightForeArm',  0.24,     0, 0);
}

function applyFielderDeep(acc: BoneAccumulator, p: Personality): void {
  const w = p.stanceWidth;
  acc.addRot('hips',        -0.04, 0, 0);
  acc.addRot('spine',        0.06, 0, 0);
  acc.addRot('chest',        0.03, 0, 0);
  acc.addRot('upperChest',   0.02, 0, 0);
  acc.addRot('leftUpLeg',   -0.07, 0,  0.04 * w);
  acc.addRot('rightUpLeg',  -0.07, 0, -0.04 * w);
  acc.addRot('leftLeg',      0.06, 0, 0);
  acc.addRot('rightLeg',     0.06, 0, 0);
  acc.addRot('leftArm',      0.12, 0,  0.22);
  acc.addRot('rightArm',     0.12, 0, -0.22);
  acc.addRot('leftForeArm',  0.18, 0, 0);
  acc.addRot('rightForeArm', 0.18, 0, 0);
}

function applyBreathing(acc: BoneAccumulator, t: number, phase: number, p: Personality): void {
  const b = Math.sin(t * 1.4 + phase) * 0.018 * p.bob;
  acc.addRot('chest', b,         0, 0);
  acc.addRot('spine', b * 0.5,   0, 0);
  acc.addRot('head',  -b * 0.25, 0, 0);
}

function applyWeightShift(acc: BoneAccumulator, t: number, phase: number, p: Personality): void {
  const dy = Math.abs(Math.sin(t * 0.5 + phase * 0.7)) * 0.007 * p.bob;
  acc.addPos('hips', 0, dy, 0);
}

// ── Public API ────────────────────────────────────────────────────────────────

export class StagingController {
  update(
    role: 'batsman' | 'bowler' | 'fielder',
    fielderIdx: number,
    t: number,
    _dt: number,
    acc: BoneAccumulator,
    personality: Personality,
  ): void {
    const phase = role === 'fielder' ? fielderIdx * 0.83 : (role === 'bowler' ? 1.57 : 0);

    if (role === 'batsman') {
      applyBatsmanReady(acc, personality);
      applyBreathing(acc, t, phase, personality);
    } else if (role === 'bowler') {
      applyBowlerIdle(acc, personality);
      applyBreathing(acc, t, phase, personality);
    } else {
      const cls = SLOT_CLASS[fielderIdx] ?? 1;
      if      (cls === 0) applyFielderClose(acc, personality);
      else if (cls === 1) applyFielderInfield(acc, personality);
      else                applyFielderDeep(acc, personality);
      applyBreathing(acc, t, phase, personality);
      applyWeightShift(acc, t, phase, personality);
    }
  }
}
