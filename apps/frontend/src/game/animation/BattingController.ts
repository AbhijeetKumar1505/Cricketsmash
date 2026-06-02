/**
 * BattingController — drives all batsman bone motion from BatsmanFSM signals.
 *
 * Phases (all driven by snapshot.batsmanFSM):
 *   IDLE           — guard stance + breathing sway
 *   BACKLIFT       — bat raises (shoulder + elbow + wrist), weight transfers back
 *   SWING          — kinetic chain hips→spine→chest→shoulder→forearm→wrist
 *   CONTACT        — single sync frame; FX bus fires bat-vibration/recoil/flash
 *   FOLLOW_THROUGH — arms continue past contact, scaled by outcome (small→huge)
 *
 * Rotation distribution (from BattingReference):
 *   Each torso bone receives a SHARE of MAX_SWING_RAD — never raw degree literals.
 *   This prevents world-space rotation stacking (the "bowling lean" class of bug).
 *
 * Kinetic chain lead (from BattingReference):
 *   Hips initiate, spine/chest/shoulder follow with small offsets so the swing
 *   unfolds as hips→spine→chest→shoulder→elbow→wrist rather than in lockstep.
 *
 * Personality scales every phase:
 *   stanceWidth    — leg spread in guard
 *   stanceCrouch   — knee bend depth
 *   bob            — idle breathing amplitude
 *   backliftHeight — bat raise height
 *   power          — arm rotation magnitude in swing
 *   swingSpeed     — easing-curve tempo (snappier whip)
 *   hipRotation    — hip pivot magnitude through contact
 *   followThrough  — post-contact extension
 *   reactionFlair  — bonus follow-through multiplier on top of outcome bucket
 */

import type { EngineSnapshot } from '../../engine/GameEngine.js';
import type { Personality } from './personality.js';
import { anim_telemetry } from './animTelemetry.js';
import type { BoneAccumulator } from './BoneAccumulator.js';
import { easeSwingAccel, easeWhip, easeOutQuad, lerp, clamp } from './poses.js';
import type { BatsmanPhase } from '../../engine/physics/animationFSM.js';
import {
  MAX_SWING_RAD,
  HIP_SHARE, SPINE_SHARE, CHEST_SHARE, NECK_SHARE,
  HIP_LEAD, SPINE_LEAD, CHEST_LEAD, ARM_LEAD, FOREARM_START,
  BACKLIFT_ELBOW_EXTRA, BACKLIFT_WRIST_EXTRA,
  SWING_ELBOW_EXTEND, SWING_WRIST_SNAP,
  HUGE_HIT_RIGHT_ARM_Z, HUGE_HIT_RIGHT_FORE_Z,
  HUGE_HIT_RIGHT_HAND_Z, HUGE_HIT_HEAD_Y,
} from './BattingReference.js';

/** Hit outcome personality — drives distinct pose profiles, not just amplitude. */
type HitPersonality = 'miss' | 'dot' | 'small' | 'big' | 'huge';

/** Map round outcome + multiplier to a personality type and a follow-through scale. */
function hitPersonalityFor(snap: EngineSnapshot): { personality: HitPersonality; scale: number } {
  const round = snap.round;
  if (round.outcome === 'wicket') return { personality: 'miss', scale: 0.3 };
  const shotType = snap.batsman.shotType;
  const m = round.targetMult ?? 1;
  if (shotType === 'loft' || m >= 8) return { personality: 'huge', scale: 1.8 };
  if (m >= 3)                        return { personality: 'big',  scale: 1.4 };
  if (m >= 2)                        return { personality: 'big',  scale: 1.2 };
  if (m >= 1.4)                      return { personality: 'small', scale: 1.0 };
  if (m >= 1.1)                      return { personality: 'small', scale: 0.8 };
  return { personality: 'dot', scale: 0.5 };
}

// ── Phase-transition blend helpers ─────────────────────────────────────────────
// On BACKLIFT→SWING the arm chain snaps because setRot values differ.
// The blend captures BACKLIFT's final arm rotation as a blend-from and
// lerps toward SWING's computed target over BLEND_DUR seconds.
const BLEND_DUR = 0.050; // 3 frames at 60fps
type ArmBlend = [number, number, number];

export class BattingController {
  private _time = 0;
  private _triggerStepZ = 0;
  private _missTimer = -1;

  // Blend state
  private _prevPhase: BatsmanPhase = 'IDLE';
  private _blendT = 0;
  private _blendFrom: Partial<Record<string, ArmBlend>> = {};

  // Balance recovery state — fires after FOLLOW_THROUGH ends
  private _balanceTimer    = -1;   // -1 = inactive; >= 0 = seconds elapsed in recovery
  private _balancePower    = 0;    // 0..1, normalised from hp.scale (huge=1.8 → 1.0)
  private _balanceDir      = 1;    // +1 forward (hit), -1 backward (miss swing)
  private _peakBalanceMag  = 0;    // peak |mag| during current recovery — for telemetry

  /** Weight distribution: 0 = fully on back foot, 1 = fully on front foot. Exposed for debug. */
  comWeight = 0.5;

  reset(): void {
    this._time = 0;
    this._triggerStepZ = 0;
    this._missTimer = -1;
    this._balanceTimer   = -1;
    this._peakBalanceMag = 0;
    this._prevPhase = 'IDLE';
    this._blendT = 0;
    this._blendFrom = {};
  }

  /**
   * Updates the batsman accumulator AND returns a root-offset delta in metres
   * (the trigger-step). The renderer applies the delta to mount.root.position.z.
   */
  update(
    snap: EngineSnapshot,
    dt: number,
    acc: BoneAccumulator,
    pers: Personality,
  ): { rootZ: number } {
    const fsm = snap.batsmanFSM;
    this._time += dt;

    // ── Phase-transition blend tracking ────────────────────────────────────
    // On BACKLIFT→SWING capture the backlift final arm values as blend origin
    // so the swing doesn't snap from a different rest pose.
    if (fsm.phase !== this._prevPhase) {
      this._blendT = 0;
      if (this._prevPhase === 'BACKLIFT' && fsm.phase === 'SWING') {
        // Snapshot BACKLIFT final arm rotations (at eased t=1)
        this._captureBackliftFinal(pers);
      } else if (this._prevPhase === 'SWING' && fsm.phase === 'CONTACT') {
        this._blendFrom = {}; // no blend needed — CONTACT is a hold frame
      } else if (this._prevPhase === 'FOLLOW_THROUGH' && fsm.phase === 'IDLE') {
        // Impart balance impulse from shot outcome — drives recovery overshoot
        const hp = hitPersonalityFor(snap);
        this._balancePower = hp.scale / 1.8;  // normalise: huge(1.8)→1.0, dot(0.5)→0.28
        this._balanceDir   = hp.personality === 'miss' ? -1 : 1;
        this._balanceTimer = 0;
        // Finalise delivery telemetry record
        anim_telemetry.onDeliveryEnd(
          snap.batsman.shotType ?? 'unknown',
          snap.round.outcome,
          this._peakBalanceMag,
        );
        this._peakBalanceMag = 0;
      }
      this._prevPhase = fsm.phase;
    }

    this._applyGuardWithStance(acc, pers);

    // Ball-height delta: deviation of current ball Y from standard contact height.
    // Used by _backlift and _idleArmGuard to pre-set body and arm for the
    // incoming delivery height (high full-toss vs yorker).
    // Clamped to ±40cm and only active while the ball is in flight.
    const HIT_Y = 0.85;
    const heightDelta = snap.ball.active
      ? clamp(snap.ball.y - HIT_Y, -0.40, 0.40)
      : 0;

    let rootZ = 0;

    switch (fsm.phase) {
      case 'IDLE':
        this._idleSway(acc, pers.bob);
        this._idleArmGuard(acc, pers, heightDelta);
        // 6cm forward bias keeps COM over the balls of the feet instead of
        // behind the heels — transforms "settling backward" into "ready forward"
        this._triggerStepZ = lerp(this._triggerStepZ, 0.06, Math.min(1, dt * 4));
        rootZ = this._triggerStepZ + this._tickBalance(dt, acc);
        break;

      case 'BACKLIFT':
        this._backlift(fsm.eased.backlift, acc, pers, heightDelta, snap.contactSolution ?? undefined);
        {
          const triggerT = clamp((fsm.eased.backlift - 0.5) / 0.5, 0, 1);
          this._triggerStepZ = -0.20 * triggerT;
          rootZ = this._triggerStepZ;
        }
        break;

      case 'SWING':
        {
          const swingT = clamp(fsm.progress, 0, 1);
          this._swing(swingT, acc, pers);
          // V6: anticipation hold — weight stays loaded during 80ms hold,
          // then drives forward through contact for readable momentum
          const heldT = clamp((swingT - 0.36) / 0.64, 0, 1);
          rootZ = lerp(-0.20, 0.25, easeSwingAccel(heldT));
          this._triggerStepZ = rootZ;
        }
        break;

      case 'CONTACT':
        {
          const hp = hitPersonalityFor(snap);
          this._contact(acc, pers, hp.personality);
          if (hp.personality === 'miss') rootZ = -0.10;
          else if (hp.personality === 'huge') rootZ = 0.25;
          else                           rootZ = 0.20;
          this._triggerStepZ = rootZ;
        }
        break;

      case 'FOLLOW_THROUGH':
        {
          const hp = hitPersonalityFor(snap);
          this._followThrough(fsm.eased.followThrough, acc, pers, hp, snap.batsman.shotType);
          const ftE = fsm.eased.followThrough;
          const ftForward = hp.personality === 'huge' ? 0.25 : hp.personality === 'big' ? 0.20 : 0.15;
          // V6: easeOutQuad holds weight forward through arc (was easeInQuad
          // which decayed immediately) — body travels through shot at distance
          rootZ = lerp(ftForward, 0, easeOutQuad(ftE));
          this._triggerStepZ = rootZ;
          if (hp.personality === 'miss') this._missTimer = 0;
        }
        break;
    }

    // COM solver: stabilises COM over support base every frame
    this._applyCOM(acc, fsm.phase, clamp(fsm.progress, 0, 1));

    // Tick blend timer (used by _swing for arm-chain blend)
    if (this._blendT < 1) this._blendT = Math.min(1, this._blendT + dt / BLEND_DUR);

    // Head shake decaying after miss
    if (this._missTimer >= 0) {
      this._missTimer += dt;
      this._headShake(acc, this._missTimer);
      if (this._missTimer > 0.8) this._missTimer = -1;
    }

    return { rootZ };
  }

  // ── COM Solver — stabilises body weight over the support base ──────────────
  //
  // Estimates center-of-mass drift from the weight distribution and applies
  // pelvis position correction to keep COM centred over the support polygon.
  // Small counter-tilt on hips prevents upper-body compensation from pulling
  // the character off-balance.
  //
  // Weight model: backlift loads rear foot, swing drives forward through
  // contact, follow-through returns to neutral. At 50/50 the COM is under
  // the hips and no correction is needed.
  private _applyCOM(
    acc: BoneAccumulator,
    fsmPhase: BatsmanPhase,
    fsmProgress: number,
  ): void {
    let w: number;
    switch (fsmPhase) {
      case 'IDLE':           w = 0.50; break;
      case 'BACKLIFT':       w = 0.45 - 0.15 * fsmProgress; break;        // 0.45→0.30
      case 'SWING':          w = 0.30 + 0.55 * fsmProgress; break;        // 0.30→0.85
      case 'CONTACT':        w = 0.85; break;
      case 'FOLLOW_THROUGH': w = 0.85 - 0.35 * fsmProgress; break;        // 0.85→0.50
      default:               w = 0.50; break;
    }
    this.comWeight = w;

    const imbalance = (w - 0.5) * 2;  // -1 (fully back) to +1 (fully forward)

    // Max COM drift amplitude per unit imbalance — ~1.5cm at full weight shift.
    // Reduced from 4cm: pelvis pitch in the guard stance now carries the lean,
    // so the COM solver only needs a small Z correction, not a large correction
    // fighting an already-displaced baseline.
    const maxDrift = 0.015;

    // Pelvis counter-shift: when COM drifts forward, shift pelvis backward
    // to recenter the mass over the support base.
    const drift = imbalance * maxDrift;
    acc.addPos('hips', 0, 0, -drift * 0.35);
    // Counter-tilt: small pelvis pitch opposes weight shift so hips stay level
    // under the spine rather than tipping with it. Amplitude ~2° max at full
    // weight shift — just enough to prevent the pelvis-led tilt from dragging
    // the COM off the support polygon without fighting the guard base.
    acc.addRot('hips', drift * 0.04, 0, 0);
  }

  // ── Stance application — ADDITIVE deltas on top of the walk animation ─────
  //
  // Meshy AI biped bones have large bind-pose rotations (legs at ~130°, arms
  // at ~106°). Using setRot (absolute) with Mixamo-authored values jumps 150°+
  // and flips the character upside-down. addRot layers small cricket-stance
  // deltas on top of whatever the walk animation has, keeping the character
  // upright regardless of the rig's internal bone convention.
  //
  // ARM bones are intentionally excluded here: backlift/swing/contact each
  // call setRot on arms directly, so the guard arm position is applied only
  // during IDLE (via _idleArmGuard) and overridden by batting phases.
  private _applyGuardWithStance(acc: BoneAccumulator, pers: Personality): void {
    const c = pers.stanceCrouch;
    const w = pers.stanceWidth;

    // Torso — pelvis-led forward lean. Hips use NEGATIVE X (forward hip hinge
    // convention for this Meshy AI rig). Spine/chest use POSITIVE X (forward
    // lean convention) — matching StagingController and GUARD_POSE. All staging
    // controllers confirmed: negative X on hips = forward hip hinge; positive X
    // on spine/chest = torso leans forward over the hips.
    // Pelvis hinge reduced from -0.20 to -0.12 to stay near the -7° athletic
    // target; combined with backlift's -0.05 this peaks at ~-10° maximum.
    acc.addRot('hips',       0.02 * c, -0.01, 0.06);  // pelvis -6.9° — primary balance owner
    acc.addRot('spine',       0.15,      0.02,  0);      // forward lean matches staging convention
    acc.addRot('chest',       0.08,      0,     0);      // forward lean continues up the chain
    acc.addRot('upperChest',  0.04,      0,     0);
    acc.addRot('neck',        0,         0,     0);
    acc.addRot('head',        0.10,      0,     0);

    // Shoulders: front closed, back open — resists the pelvis coil so the
    // upper body stores rotational energy without visually spinning out.
    acc.addRot('leftShoulder',  0, -0.03,  0.08);  // front shoulder closed
    acc.addRot('rightShoulder', 0,  0.03, -0.08);  // back shoulder open

    // Legs — deep crouch, wide base. Increased knee flex (+15%) so the legs
    // visually preload with visible spring tension rather than standing upright.
    acc.addRot('leftUpLeg',  -0.42 * c, 0,  0.12 * w);
    acc.addRot('rightUpLeg', -0.42 * c, 0, -0.12 * w);
    acc.addRot('leftLeg',     0.12 * c, 0,  0);
    acc.addRot('rightLeg',    0.12 * c, 0,  0);
    acc.addRot('leftFoot',    0,        0,  0.02);
    acc.addRot('rightFoot',   0,        0, -0.02);

    // Wrist pronation correction — seats bat handle naturally in the palm
    acc.addRot('rightHand', 0, 0, -0.08);
  }

  // ── IDLE arm guard — cricket bat-holding stance during idle only ───────────
  // addRot layers cleanly on top of the walk-clip arm base (which is upright
  // while the clip runs). Batting phases override arms via their own setRot.
  // heightDelta > 0 = ball is above standard height → raise arm guard slightly.
  private _idleArmGuard(acc: BoneAccumulator, pers: Personality, heightDelta = 0): void {
    const p = pers.power;
    // Pre-set arm height based on ball Y — visible anticipation of incoming height
    const armHeightAdj = heightDelta * 0.20;
    acc.addRot('rightShoulder',  0.05, 0,  0);
    acc.addRot('rightArm',      (-0.18 + armHeightAdj) * p, 0, -0.22 * p);
    acc.addRot('rightForeArm',   0.25,     0,  0);
    acc.addRot('rightHand',      0.04,     0, -0.08);
    acc.addRot('leftShoulder',   0.05, 0,  0);
    acc.addRot('leftArm',       (-0.15 + armHeightAdj * 0.5) * p, 0,  0.20 * p);
    acc.addRot('leftForeArm',    0.20,     0,  0);
    acc.addRot('leftHand',       0.04,     0,  0.06);
  }

  // ── IDLE — guard stance + breathing sway ──────────────────────────────────
  private _idleSway(acc: BoneAccumulator, bob: number): void {
    const t = this._time;
    const sway   = Math.sin(t * 2.2) * 0.018 * bob;
    const bobAmt = Math.abs(Math.sin(t * 1.7)) * 0.012 * bob;
    const breath = Math.sin(t * 1.4) * 0.012 * bob;
    acc.addRot('hips', 0, 0, sway);
    acc.addPos('hips', 0, -bobAmt, 0);
    acc.addRot('chest', breath, 0, 0);
    acc.addRot('spine', breath * 0.5, 0, 0);
  }

  // ── Phase 1: BACKLIFT — bat raises (full arm chain), weight shifts back ───
  // heightDelta: deviation of ball Y from 0.85m contact height, ±0.40 clamped.
  //   Positive = ball arriving high → spine tilts back, arm pre-rises.
  //   Negative = ball arriving low (yorker) → spine pitches forward, arm drops.
  // cs: optional ContactSolution — if available, scales shoulder commitment by
  //   delivery speed (fast ball → earlier commitment; slow spinner → hold longer).
  private _backlift(
    e:           number,
    acc:         BoneAccumulator,
    pers:        Personality,
    heightDelta = 0,
    cs?:         { requiredSwingDuration: number },
  ): void {
    const lift  = easeOutQuad(e);
    const reach = pers.backliftHeight;
    const p     = pers.power;

    // Ball-height torso adaptation — subtle pre-set toward incoming delivery
    const spineAdj = heightDelta * 0.12 * e;  // tilt back for high ball
    const hipAdj   = heightDelta * 0.08 * e;  // hip follows spine

    // Delivery-speed anticipation: fast balls (short requiredSwingDuration) force
    // the batsman to commit shoulders earlier. Slow spinners allow a longer hold.
    // requiredSwingDuration: ~0.12s (fast) to ~0.35s (slow) from BallPredictor.
    // fastBonus: 0 = slow delivery (hold coil), 1 = very fast (open now).
    const fastBonus = cs ? Math.max(0, 1 - cs.requiredSwingDuration / 0.35) : 0;

    // Weight shift back — 20cm of visible root change + hip sway for readability
    acc.addRot('hips', -0.05 * e + hipAdj, 0, -0.22 * e);
    // Hip drops slightly as weight loads onto rear foot — visible energy storage
    acc.addPos('hips', 0, -0.04 * e * reach, 0);
    // Spine counter-rotation prep — coils the torso like a spring, deeper wind-up
    // spineAdj adds X-tilt (backward lean for high ball, forward crouch for low)
    // fast-ball bonus adds slight forward lean (committed body language for pace)
    acc.addRot('spine', 0.02 + spineAdj + 0.04 * fastBonus * e, -0.40 * e, 0.04 * e);
    acc.addRot('chest', spineAdj * 0.6, -0.20 * e, 0);
    // Faster deliveries trigger earlier front-shoulder opening — visible commitment
    acc.addRot('leftShoulder', 0, 0.10 * e * fastBonus, 0);

    // Shoulder loading — increased separation for visible stored energy
    // Left shoulder rotates back (opens chest), right shoulder pulls bat back
    acc.addRot('leftShoulder', 0, 0.18 * e, 0);
    acc.addRot('rightShoulder', 0, -0.22 * e, 0);

    // ── Rear leg loading — weight visibly settles onto back foot ─────────────
    // Right leg compresses (more knee bend) as body mass shifts rearward
    acc.addRot('rightUpLeg', -0.06 * e, 0, 0.02 * e);
    acc.addRot('rightLeg',    0.06 * e, 0, 0);
    // Front leg relaxes slightly — weight comes off it
    acc.addRot('leftUpLeg',  0.03 * e, 0, 0);
    acc.addRot('leftLeg',   -0.03 * e, 0, 0);

    // Arms raise and load — right arm lifts bat, left arm guides
    acc.addRot('rightArm', -0.32 - 1.80 * lift * p * reach, 0, -0.58 - 1.30 * lift * p * reach);
    acc.addRot('leftArm',  -0.28 - 1.15 * lift * p * reach, 0,  0.68 + 0.75 * lift * p * reach);

    // Elbow cocks further back as bat rises — deeper loading
    acc.addRot('rightForeArm', 0.58 + BACKLIFT_ELBOW_EXTRA * lift * reach, 0, -0.24);
    // Wrist loads more at top of backlift — extra cock before the unleash
    acc.addRot('rightHand',    0.06 + BACKLIFT_WRIST_EXTRA * lift * (0.8 + 0.2 * lift), 0, -0.16);
    // Left elbow mirrors (less pronounced — left arm is guide hand)
    acc.addRot('leftForeArm', 0.52 + 0.30 * lift * reach, 0, 0.20);

    // Head locks toward bowler — stable focus point, slightly more pronounced
    acc.addRot('head', 0.18 * e, 0, 0);

    // ── Pre-swing anticipation (final ~80ms of BACKLIFT) ──────────────────
    // Micro adjustments just before swing launch so the player visibly
    // "loads up" rather than being frozen at the top of the backlift.
    if (e > 0.70) {
      const ant = (e - 0.70) / 0.30;
      // Shoulder compresses — right shoulder pulls back a final degree
      acc.addRot('rightShoulder', 0, -0.06 * ant, 0);
      // Wrist sets — final cock before the unleash
      acc.addRot('rightHand', 0, 0, -0.05 * ant);
      // Front foot pressure — subtle forward lean begins
      acc.addRot('hips', -0.03 * ant, 0, 0.04 * ant);
      // Spine preload — tiny extra coil release tension
      acc.addRot('spine', 0, -0.04 * ant, 0);
    }
  }

  // ── Phase 3: SWING — kinetic chain hips→spine→chest→shoulder→elbow→wrist ──
  // Each bone has a lead offset so the chain unfolds sequentially (hips→spine→etc).
  // The normalise helper rescales each delayed segment to [0,1] so it reaches
  // full easing value at contact (linearT=1.0) regardless of lead offset.
  private _leadNorm(t: number, lead: number): number {
    return clamp((t - lead) / (1 - lead), 0, 1);
  }

  private _swing(linearT: number, acc: BoneAccumulator, pers: Personality): void {
    // Anticipation hold — first 12% of swing shows minimal movement (a beat),
    // then the full chain unfolds. 12% keeps the "stillness" tell without
    // wasting time-warped window on fast deliveries (was 36% = 126ms wasted
    // when time-warp compresses to 350ms). At 220ms swing: 12% ≈ 26ms hold.
    const heldT = clamp((linearT - 0.12) / 0.88, 0, 1);

    // Staggered per-segment timing — each bone starts later than its parent.
    // Normalised so each eases to 1.0 by contact. With widened leads (V3),
    // the chain unfolds as: hips(0)→spine(0.25)→chest(0.40)→shoulder(0.55)
    // →forearm(0.62)→wrist(0.62+compressed). Energy visibly travels through
    // the body rather than everything rotating simultaneously.
    const hipT   = clamp(heldT - HIP_LEAD,   0, 1);
    const spineT = this._leadNorm(heldT, SPINE_LEAD);
    const chestT = this._leadNorm(heldT, CHEST_LEAD);
    const shldT  = this._leadNorm(heldT, ARM_LEAD);
    // Forearm/wrist use a delayed, compressed window after ARM_LEAD
    const forearmT = clamp((heldT - FOREARM_START) / (1 - FOREARM_START), 0, 1);

    // V4: pelvis pops open early (easeOutQuad) to lead the chain while
    // torso segments still accelerate through contact (easeInQuad).
    const hipE     = easeOutQuad(hipT);
    const spineE   = easeSwingAccel(spineT);
    const chestE   = easeSwingAccel(chestT);
    const shldE    = easeWhip(shldT);
    const foreE    = easeWhip(forearmT);
    // Wrist snap: compressed to last 50% of forearm window — fires at impact
    const wristT   = clamp((foreE - 0.50) / 0.50, 0, 1);

    const totalRot = MAX_SWING_RAD * pers.hipRotation;
    const p        = pers.power;

    // Torso — each bone driven by its own offset eased value
    // Hips drive forward (weight transfer) + rotate through the shot
    // Hip rises from its backlift drop as weight transfers forward — visible unloading
    // V4: increased hip Z opening from 0.12→0.18 for visible pelvis snap
    acc.addRot('hips', -0.02 + 0.06 * hipE, totalRot * HIP_SHARE * hipE, 0.18 * hipE);
    acc.addPos('hips', 0, 0.05 * hipE, 0);
    // Spine X: guard provides +0.10 base; add +0.08 more at full swing = +0.18 total.
    // Old value (0.12 + 0.12*spineE) was compensating for the wrong-sign guard base;
    // now the guard is correct, this just adds athletic forward lean through the shot.
    acc.addRot('spine', 0.08 * spineE, totalRot * SPINE_SHARE * spineE, 0.04 * spineE);
    acc.addRot('chest', 0.02 * chestE, totalRot * CHEST_SHARE * chestE, 0);
    acc.addRot('neck',  0.02, totalRot * NECK_SHARE  * shldE,  0);

    // ── Contact snap zone (heldT 0.83–0.97) ───────────────────────────
    // Fires in the final 14% of swing — peaks just before contact, fades
    // exactly at the CONTACT phase transition (heldT=1.0). Previously this
    // fired at heldT 0.19–0.41 (mid-swing), causing visual impact to peak
    // long before the mechanical contact event — the primary timing disconnect.
    const snapT = clamp((heldT - 0.83) / 0.14, 0, 1);
    const snapE = snapT * snapT;
    const snapFade = 1 - clamp((heldT - 0.97) / 0.03, 0, 1);
    const snap = snapE * snapFade;

    acc.addRot('hips',     0, 0,                 0.12 * snap);    // pelvis snap
    acc.addRot('spine',    0, totalRot * 0.04,   0);              // spine burst
    acc.addRot('chest',    0, totalRot * 0.04,   0);              // chest burst
    acc.addRot('rightArm', 0, 0,                -0.08 * snap);    // bat whip

    // Weight transfer through swing — front leg braces strongly, rear heel lifts.
    // Values increased for visible mass commitment through the shot.
    acc.addRot('leftLeg',  -0.14 * hipE, 0, 0);               // front knee extends (braces)
    acc.addRot('leftFoot', -0.06 * hipE, 0, 0);               // front foot dorsiflexes (toes up)
    acc.addRot('rightFoot',  0.22 * hipE, 0, 0);              // rear heel lifts clearly
    // Lateral hip shift toward front foot — mass visibly transfers left through contact
    acc.addPos('hips', -0.03 * hipE, 0, 0);

    // Right arm kinetic chain — ramps toward HUGE_HIT values at full swing
    // Uses _blendVec3 when transitioning from BACKLIFT to prevent pose snap
    const b = this._blendT;
    this._blendVec3(acc, 'rightArm', b,
      -1.30 * p + 0.50 * shldE, 0, lerp(-1.30 * p, HUGE_HIT_RIGHT_ARM_Z * p, shldE));
    this._blendVec3(acc, 'rightForeArm', b,
      0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND * foreE, 0, lerp(-0.24, HUGE_HIT_RIGHT_FORE_Z, foreE));
    // Wrist snap fires in last 50% of forearm window
    this._blendVec3(acc, 'rightHand', b,
      0.06 - SWING_WRIST_SNAP * wristT, 0, lerp(-0.16, HUGE_HIT_RIGHT_HAND_Z, wristT));

    // Left arm mirrors (guide hand)
    this._blendVec3(acc, 'leftArm', b,
      -0.98 * p + 0.35 * shldE, 0, 1.10 * p + 0.15 * shldE);
    this._blendVec3(acc, 'leftForeArm', b,
      0.52 + 0.35 * foreE, 0, 0.20);

    // Head tracks shot direction — connected to spine rotation so head
    // follows torso naturally rather than tracking independently
    acc.addRot('head', 0.12, HUGE_HIT_HEAD_Y * spineE, 0);
  }

  // ── Phase 4: CONTACT — sync frame (FX bus also fires here) ────────────────
  // Distinct body language per hit outcome so the player reads the result from
  // physical pose before the ball even travels — not just amplitude scaling.
  //
  // V4: torso values MATCH the _swing end state (t=1.0) so contact is a
  // continuation of the kinetic chain, not a separate pose. Added front leg
  // brace + rear heel lift so the viewer sees force transfer at impact.
  private _contact(acc: BoneAccumulator, pers: Personality, personality: HitPersonality): void {
    const totalRot = MAX_SWING_RAD * pers.hipRotation;
    const p        = pers.power;

    switch (personality) {

      // ── MISS: late swing, collapsed finish, dropped head ────────────────────
      case 'miss': {
        const r = 0.40;
        acc.addRot('hips',  0.02, totalRot * HIP_SHARE   * r, 0);
        // guard provides +0.10 spine base; was 0.22 (designed for old -0.12 guard = +0.10 total)
        // → keep same total of +0.10: phase adds 0.00
        acc.addRot('spine', 0.00, totalRot * SPINE_SHARE * r, 0.08);
        acc.addRot('chest', 0,    totalRot * CHEST_SHARE * r, 0);
        acc.addRot('neck',  0.04, totalRot * NECK_SHARE  * r, 0);
        acc.addRot('rightArm',     -0.50 * p, 0, -0.90 * p);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND, 0, -0.30);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP, 0, -0.16);
        acc.addRot('leftArm',      -0.40 * p, 0,  0.70 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35, 0, 0.20);
        acc.addRot('head', 0.20, 0, 0);
        return;
      }

      // ── DOT / SMALL: short compact finish, minimal torso rotation ──────────
      case 'dot':
      case 'small': {
        const r = 0.65;
        acc.addRot('hips',  0.02, totalRot * HIP_SHARE   * r, 0);
        // guard +0.10 base; was 0.22 (old -0.12 guard = +0.10 total) → keep total +0.12: add 0.02
        acc.addRot('spine', 0.02, totalRot * SPINE_SHARE * r, 0.10);
        acc.addRot('chest', 0,    totalRot * CHEST_SHARE * r, 0);
        acc.addRot('neck',  0.04, totalRot * NECK_SHARE  * r, 0);
        acc.addRot('rightArm',     -0.80 * p, 0, -1.20 * p);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND, 0, -0.40);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP * 0.7, 0, -0.30);
        acc.addRot('leftArm',      -0.55 * p, 0,  0.90 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35, 0, 0.20);
        acc.addRot('head', 0.10, 0.15, 0);
        return;
      }

      // ── BIG: full extension, clear torso rotation ──────────────────────────
      case 'big': {
        // V4: torso values match _swing end (t=1.0) for seamless contact
        acc.addRot('hips',  0.04, totalRot * HIP_SHARE,   0.12);
        // guard +0.10 base; was 0.24 (old -0.12 guard = +0.12 total) → keep total +0.18: add 0.08
        acc.addRot('spine', 0.08, totalRot * SPINE_SHARE, 0.04);
        acc.addRot('chest', 0.02, totalRot * CHEST_SHARE, 0);
        acc.addRot('neck',  0.02, totalRot * NECK_SHARE,  0);
        // Front leg firms at impact — lead knee straightens to brace
        acc.addRot('leftLeg', -0.08, 0, 0);
        // Rear heel lifts as weight drives forward — weight leaves back foot
        acc.addRot('rightFoot', 0.15, 0, 0);
        acc.addRot('rightArm',     -0.90 * p, 0, HUGE_HIT_RIGHT_ARM_Z * p);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND, 0, HUGE_HIT_RIGHT_FORE_Z * p);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP, 0, HUGE_HIT_RIGHT_HAND_Z * p);
        acc.addRot('leftArm',      -0.68 * p, 0,  1.20 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35, 0, 0.20);
        acc.addRot('head', 0.10, 0.25, 0);
        return;
      }

      // ── HUGE: maximum extension, head already tilting up to track ball ─────
      case 'huge': {
        // V4: torso values match _swing end (t=1.0) for seamless contact
        acc.addRot('hips',  0.04, totalRot * HIP_SHARE,   0.18);
        // guard +0.10 base; was 0.24 (old -0.12 guard = +0.12 total) → keep total +0.20: add 0.10
        acc.addRot('spine', 0.10, totalRot * SPINE_SHARE, 0.04);
        acc.addRot('chest', 0.04, totalRot * CHEST_SHARE, 0);
        acc.addRot('neck',  0.02, totalRot * NECK_SHARE,  0);
        // Front leg firms at impact — lead knee straightens to brace
        acc.addRot('leftLeg', -0.10, 0, 0);
        // Rear heel lifts as weight drives through — aggressive toe pivot
        acc.addRot('rightFoot', 0.20, 0, 0.06);
        acc.addRot('rightArm',     -0.95 * p, 0, HUGE_HIT_RIGHT_ARM_Z * p * 1.05);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND, 0, HUGE_HIT_RIGHT_FORE_Z * p * 1.05);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP, 0, HUGE_HIT_RIGHT_HAND_Z * p * 1.05);
        acc.addRot('leftArm',      -0.68 * p, 0,  1.30 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35, 0, 0.20);
        acc.addRot('head', -0.08, HUGE_HIT_HEAD_Y, 0);
        return;
      }
    }
  }

  // ── Phase 5: FOLLOW_THROUGH — arms continue, scaled by outcome × personality ──
  // Distinct pose profiles per outcome type (miss/dot/small/big/huge).
  // Each personality has its own body language, not just amplitude scaling.
  //
  // V4: momentum continuation — chest/shoulder/wrist keep rotating past contact,
  // rear foot pivots, torso rotation persists rather than decaying. The
  // easeOutQuad deceleration (from V3) naturally front-loads the motion so
  // the finish pose is reached early and held.
  // shotType from snap.batsman.shotType: 'pull'/'cut' → horizontal arc modifier,
  // 'defend' → compact modifier. Other types use base personality only.
  private _followThrough(
    e: number,
    acc: BoneAccumulator,
    pers: Personality,
    hp: { personality: HitPersonality; scale: number },
    shotType?: string,
  ): void {
    const p      = pers.power;
    const scale  = hp.scale * pers.followThrough * pers.reactionFlair;
    const totalRot = MAX_SWING_RAD * pers.hipRotation;

    switch (hp.personality) {

      // ── MISS: collapsed finish, no extension, head down ───────────────────
      case 'miss': {
        acc.addRot('hips',  0, totalRot * HIP_SHARE * 0.3, 0);
        // guard +0.10 base; was 0.25 (old -0.12 guard = +0.13 total) → keep ~+0.12: add 0.02
        acc.addRot('spine', 0.02, totalRot * SPINE_SHARE * 0.3, 0);
        acc.addRot('chest', 0,    totalRot * CHEST_SHARE * 0.3, 0);
        acc.addRot('rightArm',     -0.50 * p, 0, -0.90 * p);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND, 0, -0.30);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP, 0, -0.16);
        acc.addRot('leftArm',      -0.40 * p, 0,  0.70 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35, 0, 0.20);
        acc.addRot('head', 0.30, 0, 0);
        return;
      }

      // ── DOT/SMALL: compact finish, minimal torso, arms pull in ────────────
      case 'dot':
      case 'small': {
        const fte = easeOutQuad(e);
        const ftExtra = 0.15 * fte * scale;
        acc.addRot('hips',  0, totalRot * HIP_SHARE   + ftExtra * HIP_SHARE,   0);
        // guard +0.10 base; was 0.22 (old -0.12 guard = +0.10 total) → keep total +0.12: add 0.02
        acc.addRot('spine', 0.02, totalRot * SPINE_SHARE + ftExtra * SPINE_SHARE, 0.10 * fte * scale);
        acc.addRot('chest', 0, totalRot * CHEST_SHARE + ftExtra * CHEST_SHARE, 0);
        acc.addRot('rightArm',     -0.80 * p - 0.60 * fte * scale, 0, -1.20 * p);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND + 0.25 * fte * scale, 0, -0.40);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP + 0.12 * fte * scale, 0, -0.30);
        acc.addRot('leftArm',      -0.55 * p - 0.30 * fte * scale, 0,  0.90 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35 - 0.18 * fte * scale, 0, 0.20);
        acc.addRot('head', 0.15 + 0.15 * fte * scale, 0.15 * fte * scale, 0);
        return;
      }

      // ── BIG: full extension, torso rotation, bat wraps ────────────────────
      case 'big': {
        const fte = easeOutQuad(e);
        // V6 readability: stronger ftExtra + arm continuation so the follow-
        // through arc reads at gameplay distance — body travels, bat wraps,
        // chest opens to show momentum carrying through the shot
        const ftExtra = 0.50 * fte * scale;
        acc.addRot('hips',  0, totalRot * HIP_SHARE   + ftExtra * HIP_SHARE,   0);
        // guard +0.10 base; was 0.22 (old -0.12 guard = +0.10 total) → keep total +0.14: add 0.04
        acc.addRot('spine', 0.04, totalRot * SPINE_SHARE + ftExtra * SPINE_SHARE, 0.30 * fte * scale);
        acc.addRot('chest', 0, totalRot * CHEST_SHARE + ftExtra * CHEST_SHARE, 0.08 * fte * scale);
        acc.addRot('rightArm',     -0.90 * p - 1.40 * fte * scale, 0, HUGE_HIT_RIGHT_ARM_Z * p);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND + 0.60 * fte * scale, 0, HUGE_HIT_RIGHT_FORE_Z * p);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP + 0.35 * fte * scale, 0, HUGE_HIT_RIGHT_HAND_Z * p);
        acc.addRot('leftArm',      -0.68 * p - 0.55 * fte * scale, 0,  1.20 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35 - 0.28 * fte * scale, 0, 0.20);
        acc.addRot('rightFoot', 0, 0, 0.12 * fte * scale);
        acc.addRot('head', (0.15 + 0.22 * fte * scale) - 0.30 * fte * scale, HUGE_HIT_HEAD_Y * fte * scale * 0.6, 0);
        return;
      }

      // ── HUGE: massive wraparound, maximum rotation, watch ball into sky ────
      case 'huge': {
        const fte = easeOutQuad(e);
        // V6 readability: bigger ftExtra + arm wrap so the massive follow-
        // through reads at gameplay distance — chest opens, bat wraps around
        // shoulder, rear foot pivots aggressively
        const ftExtra = 0.70 * fte * scale;
        acc.addRot('hips',  0, totalRot * HIP_SHARE   + ftExtra * HIP_SHARE,   0);
        // guard +0.10 base; was 0.22 (old -0.12 guard = +0.10 total) → keep total +0.14: add 0.04
        acc.addRot('spine', 0.04, totalRot * SPINE_SHARE + ftExtra * SPINE_SHARE, 0.55 * fte * scale);
        acc.addRot('chest', 0, totalRot * CHEST_SHARE + ftExtra * CHEST_SHARE, 0.15 * fte * scale);
        acc.addRot('rightArm',     -0.90 * p - 2.00 * fte * scale, 0, HUGE_HIT_RIGHT_ARM_Z * p * 1.05);
        acc.addRot('rightForeArm',  0.58 + BACKLIFT_ELBOW_EXTRA - SWING_ELBOW_EXTEND + 1.00 * fte * scale, 0, HUGE_HIT_RIGHT_FORE_Z * p * 1.05);
        acc.addRot('rightHand',     0.06 - SWING_WRIST_SNAP + 0.55 * fte * scale, 0, HUGE_HIT_RIGHT_HAND_Z * p * 1.05);
        acc.addRot('leftArm',      -0.68 * p - 0.90 * fte * scale, 0,  1.50 * p);
        acc.addRot('leftForeArm',   0.52 + 0.35 - 0.45 * fte * scale, 0, 0.20);
        acc.addRot('rightFoot', 0.08 * fte * scale, 0, 0.22 * fte * scale);
        acc.addRot('head', (0.20 + 0.35 * fte * scale) - 0.70 * fte * scale, HUGE_HIT_HEAD_Y * fte * scale, 0);
        return;
      }
    }

    // ── Shot-type arc modifiers — additive overlays on the base outcome profile ──
    // Applied after the switch so they stack on any personality without replacing it.

    if (shotType === 'pull' || shotType === 'cut') {
      // Horizontal sweep arc: arm wraps across the body, chest opens laterally,
      // head tilts to follow the trajectory toward leg side.
      acc.addRot('rightArm',  0, 0,  0.35 * e);   // arm sweeps across body
      acc.addRot('chest',     0, 0,  0.15 * e);   // chest opens laterally
      acc.addRot('head',      0, 0,  0.12 * e);   // head tilts with arc
    } else if (shotType === 'defend') {
      // Compact recovery: arms pull in quickly, elbow tucks, minimal extension.
      acc.addRot('rightArm',     0, 0,  0.28 * e);  // arm draws back in
      acc.addRot('rightForeArm', 0, 0, -0.18 * e);  // elbow tucks toward body
    }
  }

  // ── Balance recovery — post-swing momentum persistence ───────────────────
  // Fires during IDLE after a FOLLOW_THROUGH→IDLE transition. Applies a
  // damped oscillation to torso + root based on shot power. Big hits stagger
  // forward; missed swings wobble slightly backward. Inert for dot balls.
  private _tickBalance(dt: number, acc: BoneAccumulator): number {
    if (this._balanceTimer < 0) return 0;
    this._balanceTimer += dt;
    const duration = 0.40 + this._balancePower * 0.25;  // 0.40s (dot) → 0.65s (huge)
    if (this._balanceTimer > duration) {
      this._balanceTimer = -1;
      return 0;
    }
    const t     = this._balanceTimer;
    const decay = Math.exp(-t * 5.5);                  // fast exponential settle
    const osc   = Math.sin(t * Math.PI * 2.5);         // one-and-a-bit oscillation
    const mag   = this._balancePower * this._balanceDir * decay * osc;
    // Track peak magnitude for telemetry
    if (Math.abs(mag) > this._peakBalanceMag) this._peakBalanceMag = Math.abs(mag);

    acc.addRot('spine', mag * 0.10, 0, 0);             // torso leans with momentum
    acc.addRot('chest', mag * 0.06, 0, 0);             // chest follows
    acc.addPos('hips',  0, 0, -mag * 0.018);           // pelvis Z carries the lean

    return mag * 0.04;                                  // rootZ overshoot in metres
  }

  // ── Head shake on miss (legacy _applyHeadShake) ──────────────────────────
  // Decaying oscillation: amplitude 0.22 × exp(-t × 2.8), frequency 18 rad/s
  private _headShake(acc: BoneAccumulator, t: number): void {
    const decay = Math.exp(-t * 2.8);
    const wobble = Math.sin(t * 18) * 0.22 * decay;
    acc.addRot('head', Math.abs(wobble) * 0.5, 0, wobble * 0.6);
  }

  // ── Phase-blend helpers ────────────────────────────────────────────────────
  // Capture the BACKLIFT phase's final arm-bone rotations so _swing can
  // smoothly blend from them instead of snapping from a different rest pose.
  private _captureBackliftFinal(pers: Personality): void {
    const reach = pers.backliftHeight;
    const p     = pers.power;
    this._blendFrom = {
      rightArm:      [-0.32 - 1.80 * p * reach, 0, -0.58 - 1.30 * p * reach],
      rightForeArm:  [0.58 + BACKLIFT_ELBOW_EXTRA * reach, 0, -0.24],
      rightHand:     [0.06 + BACKLIFT_WRIST_EXTRA, 0, -0.16],
      leftArm:       [-0.28 - 1.15 * p * reach, 0,  0.68 + 0.75 * p * reach],
      leftForeArm:   [0.52 + 0.30 * reach, 0, 0.20],
    };
  }

  /** Lerp each component of a blended arm-bone from `from` → `to`. */
  private _blendVec3(acc: BoneAccumulator, name: string, blendT: number,
    toX: number, toY: number, toZ: number): void {
    const from = this._blendFrom[name] as ArmBlend | undefined;
    if (from && blendT < 1) {
      acc.addRot(name,
        lerp(from[0], toX, blendT),
        lerp(from[1], toY, blendT),
        lerp(from[2], toZ, blendT),
      );
    } else {
      acc.addRot(name, toX, toY, toZ);
    }
  }
}
