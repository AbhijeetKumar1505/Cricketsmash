/**
 * FieldingController — per-fielder layered motion.
 *
 * The engine's fielder snapshot only carries 3 phases (idle/chase/gather),
 * so we derive sub-phases visually:
 *
 *   idle    → IDLE_POSE + per-fielder sway phase (so 11 fielders don't sync)
 *   chase   → full run cycle (legs + arms + forward lean). Slows near ball.
 *   gather  → bend over, both hands reach ground, knees bent, head down
 *
 * Personality `speed` scales run cycle frequency (Ronaldo runs faster than
 * Kimjong). Each call passes fielderIdx for per-character phase offset.
 */

import type { EngineSnapshot } from '../../engine/GameEngine.js';
import type { Personality } from './personality.js';
import type { BoneAccumulator } from './BoneAccumulator.js';
import { lerp } from './poses.js';

const PI = Math.PI;
const GATHER_DUR  = 0.30;   // seconds to complete the gather bend
const DIVE_BLEND  = 0.10;   // seconds to blend from chase into dive pose

export class FieldingController {
  // Per-fielder elapsed times — avoids the N×dt-per-frame accumulation bug
  // that occurs when a single shared _time is incremented once per fielder call.
  private readonly _times    = new Map<number, number>();
  private readonly _prevPhase = new Map<number, string>();
  private readonly _gatherAt  = new Map<number, number>();
  private readonly _diveAt    = new Map<number, number>();

  reset(): void {
    this._times.clear();
    this._prevPhase.clear();
    this._gatherAt.clear();
    this._diveAt.clear();
  }

  update(
    fielderIdx: number,
    snap: EngineSnapshot,
    dt: number,
    acc: BoneAccumulator,
    fielderX: number,
    fielderZ: number,
    ballX: number,
    ballZ: number,
    personality: Personality,
  ): void {
    const t = (this._times.get(fielderIdx) ?? 0) + dt;
    this._times.set(fielderIdx, t);
    const prev = this._prevPhase.get(fielderIdx) ?? '';
    this._prevPhase.set(fielderIdx, snap.fielders[fielderIdx]?.phase ?? 'idle');

    const fState = snap.fielders[fielderIdx];
    if (!fState) return;

    switch (fState.phase) {
      case 'idle':
        this._idle(acc, fielderIdx, t, personality);
        break;

      case 'chase': {
        const dx = ballX - fielderX;
        const dz = ballZ - fielderZ;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.5) {
          // Track dive start on transition from chase
          if (prev !== 'chase') this._diveAt.set(fielderIdx, t);
          this._dive(acc, fielderIdx, t, personality, prev);
        } else {
          this._chase(acc, fielderIdx, t, fielderX, fielderZ, ballX, ballZ, personality);
        }
        break;
      }

      case 'gather': {
        // Record gather start time on transition from another phase
        if (prev !== 'gather') this._gatherAt.set(fielderIdx, t);
        const gatherT = t - (this._gatherAt.get(fielderIdx) ?? t);
        this._gather(acc, gatherT, personality);
        break;
      }
    }
  }

  // ── idle: slow sway, breathing, per-fielder phase offset ──────────────────
  // Matches FielderCharacter spec: XZ root sway ±0.04m, bone-rotation idle sway.
  // Slight hip tilt + knee bend from stanceCrouch so all fielders share a consistent
  // athletic readiness posture (Kimjong reference pose). stanceWidth controls how
  // wide the legs sit. Arms use addRot (ROLE-owned) to override walk-clip arm pose
  // at freeze-frame. Legs use addRot since LOCOMOTION owns them.
  private _idle(acc: BoneAccumulator, idx: number, t: number, pers: Personality): void {
    const phase = t + idx * 0.83;
    const bob   = pers.bob;
    const c     = pers.stanceCrouch;
    const w     = pers.stanceWidth;
    const sway  = Math.sin(phase * 1.5) * 0.05 * bob;
    const breath = Math.sin(phase * 1.3) * 0.015 * bob;

    // Root XZ sway — matches FielderCharacter spec (±0.04 X, ±0.03 Z)
    acc.addPos('hips',
      Math.sin(phase * 0.85 + idx * 0.5) * 0.04,
      0,
      Math.cos(phase * 0.72 + idx * 0.3) * 0.03,
    );

    // Hip tilt (X rotation) for athletic readiness — forward tilt increases with crouch
    acc.addRot('hips', -0.06 * c, 0, sway * 0.3);
    acc.addRot('chest', breath, 0, sway * 0.15);
    acc.addRot('spine', breath * 0.5, 0, 0);

    // Arms: addRot delta on top of bind pose
    const armSway = Math.sin(phase * 0.7 + idx * 0.41) * 0.02 * bob;
    acc.addRot('rightArm', 0.05, 0, -0.15 + armSway);
    acc.addRot('leftArm',  0.05, 0,  0.15 - armSway);
    acc.addRot('rightForeArm', 0.10, 0, 0);
    acc.addRot('leftForeArm',  0.10, 0, 0);

    // Legs: knee flex depth from stanceCrouch, leg spread from stanceWidth.
    // Values calibrated so crouch=1.0/width=1.0 matches existing default pose.
    acc.addRot('leftUpLeg',  -0.12 * c, 0,  0.06 * w);
    acc.addRot('rightUpLeg', -0.12 * c, 0, -0.06 * w);
    acc.addRot('leftLeg',     0.18 * c, 0, 0);
    acc.addRot('rightLeg',    0.18 * c, 0, 0);
  }

  // ── chase: run cycle with intensity drop near ball ────────────────────────
  private _chase(
    acc: BoneAccumulator,
    idx: number,
    t: number,
    fx: number, fz: number,
    bx: number, bz: number,
    personality: Personality,
  ): void {
    const dx = bx - fx;
    const dz = bz - fz;
    const dist = Math.hypot(dx, dz);
    // Slow down within 2.5m of the ball
    const intensity = dist < 2.5 ? Math.max(0.35, dist / 2.5) : 1.0;

    const runFreq = 6.0 * personality.speed;
    const phase = t * runFreq + idx * 0.31;
    const armSwing = Math.sin(phase) * 0.65 * intensity * personality.power;
    const legSwing = Math.sin(phase + PI) * 0.85 * intensity;

    // Forward lean
    acc.addRot('spine', 0.20 * intensity, 0, 0);
    acc.addRot('hips',  0.10 * intensity, 0, 0);

    // Arms swing opposite to legs
    acc.addRot('rightArm', -armSwing, 0, 0);
    acc.addRot('leftArm',   armSwing, 0, 0);
    acc.addRot('rightForeArm', Math.abs(armSwing) * 0.45, 0, 0);
    acc.addRot('leftForeArm',  Math.abs(armSwing) * 0.45, 0, 0);

    // Legs alternate; knees bend on forward swing
    acc.addRot('rightUpLeg',  legSwing, 0, 0);
    acc.addRot('leftUpLeg',  -legSwing, 0, 0);
    acc.addRot('rightLeg', Math.max(0,  legSwing) * 0.85, 0, 0);
    acc.addRot('leftLeg',  Math.max(0, -legSwing) * 0.85, 0, 0);

    // Bounce
    acc.addPos('hips', 0, Math.abs(Math.sin(phase)) * 0.04 * intensity, 0);
  }

  // ── dive: asymmetrical lunge with optional chase→dive blend ──────────────
  // One leg pushes (drives body forward), the other leg reaches (counter-balance).
  // This creates the unmistakable diving silhouette — NOT a symmetrical starfish.
  // When `blendT < 1`, blends from neutral (chase-pose assumption) into full dive
  // so the transition reads as a forward lunge rather than a pose snap.
  private _dive(acc: BoneAccumulator, idx: number, t: number, pers: Personality, prevPhase: string): void {
    const blendT = prevPhase === 'chase'
      ? Math.min((t - (this._diveAt.get(idx) ?? t)) / DIVE_BLEND, 1)
      : 1;
    const b = blendT; // easeOutQuad for natural slow-in on the dive
    const easeB = b * (2 - b);

    // Hips rotated forward + twisted toward ball
    acc.addRot('hips',  0.30 * easeB, 0, 0.40 * easeB);
    // Spine arches forward
    acc.addRot('spine', 0.35 * easeB, 0, 0.20 * easeB);
    acc.addRot('chest', 0.25 * easeB, 0, 0.10 * easeB);
    const p = pers.power;
    acc.addRot('rightArm', -1.50 * p * easeB, 0, -0.30 * easeB);
    acc.addRot('leftArm',  -1.50 * p * easeB, 0,  0.30 * easeB);
    acc.addRot('rightForeArm', 0.40 * easeB, 0, 0);
    acc.addRot('leftForeArm',  0.40 * easeB, 0, 0);
    // Asymmetrical legs
    acc.addRot('leftUpLeg',  -0.40 * easeB, 0,  0.25 * easeB);
    acc.addRot('rightUpLeg',  0.60 * easeB, 0, -0.10 * easeB);
    acc.addRot('rightLeg',    0.45 * easeB, 0, 0);
    // Head looks at target
    acc.addRot('head', 0.10 * easeB, 0, 0);
  }

  // ── gather: bend down, both hands reach ground, head down ─────────────────
  // `gatherElapsed` drives progressive spine bend (was `lerp(…, 1)` = always 0.55).
  private _gather(acc: BoneAccumulator, gatherElapsed: number, pers: Personality): void {
    const t = Math.min(gatherElapsed / GATHER_DUR, 1);
    const crouch = pers.stanceCrouch;
    const p      = pers.power;
    acc.addRot('hips',  0.30 * crouch * t, 0, 0);
    acc.addRot('spine', lerp(0.06, 0.55, t) * crouch, 0, 0);
    acc.addRot('chest', 0.20 * crouch * t, 0, 0);
    const armReach = lerp(0.80, 1.20, t);
    acc.addRot('rightArm', -armReach * p, 0, -0.04 * t);
    acc.addRot('leftArm',  -armReach * p, 0,  0.04 * t);
    acc.addRot('rightForeArm', 0.35 * t, 0, 0.08 * t);
    acc.addRot('leftForeArm',  0.35 * t, 0, -0.08 * t);
    acc.addRot('rightHand', 0.20 * t, 0, 0.12 * t);
    acc.addRot('leftHand',  0.20 * t, 0, -0.12 * t);
    // Knees bend progressively
    acc.addRot('rightUpLeg', -0.40 * crouch * t, 0, 0);
    acc.addRot('leftUpLeg',  -0.40 * crouch * t, 0, 0);
    acc.addRot('rightLeg',    0.75 * crouch * t, 0, 0);
    acc.addRot('leftLeg',     0.75 * crouch * t, 0, 0);
    // Head looks down at ball
    acc.addRot('head', 0.40 * t, 0, 0);
  }
}
