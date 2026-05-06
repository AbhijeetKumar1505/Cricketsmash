import * as THREE from 'three';
import type { SimPhase, BowlerType } from '../physics/ballTrajectory.js';
import type { ShotType } from '../../core/modeEngine.js';
import { applySquash } from '../objects/players.js';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }
function easeIn(t: number) { return t * t; }
function smoothstep01(t: number) { return t * t * (3 - 2 * t); }
function lockToGround(fig: THREE.Group): void {
  const minY = (fig.userData.lockMinY as number | undefined) ?? 0;
  fig.position.y = Math.max(fig.position.y, minY);
}

// ── Batsman pose constants ───────────────────────────────────────────────────
// Hierarchy: rArmPivot (shoulder) → rElbow → rWrist → armsGroup (bat).
// "Ready" = cricket pre-shot stance: bat lifted behind shoulder, front arm out.

const BAT_READY_Z   = -0.90;   // bat in wrist-space, behind shoulder
const BAT_READY_X   = -0.10;
const BAT_LOAD_Z    = -1.10;   // extra draw-back just before swing
const BAT_LOAD_X    = -0.20;
const BAT_SWING_Z   =  1.40;   // full follow-through
const BAT_SWING_X   =  0.22;

const ARM_R_LOAD_Z  = -0.95;
const ARM_R_LOAD_X  = -0.35;
const ARM_R_HIT_Z   =  0.85;
const ARM_R_HIT_X   = -0.28;

const ARM_L_SWING_Z =  0.18;
const ARM_L_SWING_X = -0.10;

const ELBOW_R_READY_Z = -0.4; // right elbow — compact ready bend
const ELBOW_R_LOAD_Z  = -0.78;
const ELBOW_R_HIT_Z   =  0.30; // straightens through impact

const WRIST_R_READY_X = -0.20; // wrist cocked back (bat faces camera clearly)
const WRIST_R_LOAD_X  = -0.30;
const WRIST_R_HIT_X   =  0.18; // rolls through at contact

// ── Bowler pre-delivery idle (coiled, not mannequin-upright) ─────────────────
const BOW_IDLE_TORSO_X = -0.25;
const BOW_IDLE_R_ARM_X = -1.6;
const BOW_IDLE_R_ARM_Z = 0.25;
const BOW_IDLE_L_ARM_X = 0.5;
const BOW_IDLE_BODY_Y = 0.15;

// ── Batsman ready stance (torso + shoulders; bat mesh offset is in players.ts) ─
const BATSMAN_IDLE_TORSO_X = -0.18;
const BATSMAN_IDLE_TORSO_Y = 0.25;
const BATSMAN_READY_R_ARM_X = -0.9;
const BATSMAN_READY_R_ARM_Z = -0.25;
const BATSMAN_READY_L_ARM_X = -0.5;
const BATSMAN_READY_L_ARM_Z = 0.35;

// ── Blink ────────────────────────────────────────────────────────────────────
const BLINK_INTERVAL = 3.2;
const BLINK_CLOSE    = 0.09;
const BLINK_OPEN     = 0.12;
const ENABLE_LOOK_TRACKING = true;

function blinkScaleAtTime(time: number, seed: number): number {
  const cycle = (time + seed) % BLINK_INTERVAL;
  if (cycle < BLINK_CLOSE) {
    return 0.2 + (cycle / BLINK_CLOSE) * 0.8;
  }
  if (cycle < BLINK_CLOSE + BLINK_OPEN) {
    const t = (cycle - BLINK_CLOSE) / BLINK_OPEN;
    return 1 - 0.8 * (1 - t);
  }
  return 1;
}

function applyBlink(fig: THREE.Group, time: number): void {
  const eyePivots = fig.userData.eyePivots as THREE.Group | undefined;
  if (!eyePivots) return;
  const seed = (fig.position.x * 0.17 + fig.position.z * 0.11) % 1;
  eyePivots.scale.y = blinkScaleAtTime(time, seed);
}

function applyHeadLook(fig: THREE.Group, ballPos: THREE.Vector3, weight: number): void {
  if (!ENABLE_LOOK_TRACKING || weight <= 0) return;
  const head = fig.userData.headGroup as THREE.Group | undefined;
  if (!head) return;
  const dx = ballPos.x - fig.position.x;
  const dy = ballPos.y - (fig.position.y + 1.2);
  head.rotation.y = lerp(head.rotation.y, THREE.MathUtils.clamp(dx * 0.08, -0.22, 0.22), weight);
  head.rotation.x = lerp(head.rotation.x, THREE.MathUtils.clamp(-dy * 0.12, -0.2, 0.18), weight);
}

export interface AnimatorInput {
  phase: SimPhase;
  phaseProgress: number;
  bowlerType: BowlerType;
  shotType: ShotType;
  dt: number;
  time: number;
  ballPos: THREE.Vector3;
  isSwinging?: boolean;
  hitQuality?: 'perfect' | 'good' | 'edge' | 'miss' | 'none';
}

function squashStretch(
  torso: THREE.Group,
  _head: THREE.Group | undefined,
  intensity: number,
  stretch: boolean = true,
) {
  if (stretch) {
    torso.scale.y = 1 + intensity;
    torso.scale.x = torso.scale.z = 1 - intensity * 0.5;
  } else {
    torso.scale.y = 1 - intensity;
    torso.scale.x = torso.scale.z = 1 + intensity * 0.5;
  }
}

// ── Bowler ───────────────────────────────────────────────────────────────────

export function animateBowler(fig: THREE.Group, input: AnimatorInput): void {
  const { phase, phaseProgress: pp, dt, time } = input;
  const ud = fig.userData;
  if (!ud.rArmPivot || !ud.torso) return;
  const bodyRoot = (ud.bodyRoot as THREE.Group | undefined) ?? fig;
  const α = Math.min(1, dt * 10);

  if (phase === 'idle' || phase === 'celebrate') {
    const breathe = Math.sin(time * 2) * 0.035;

    if (phase === 'celebrate') {
      squashStretch(ud.torso, ud.headGroup, breathe, breathe > 0);
      applySquash(ud, breathe * 0.5);
      bodyRoot.position.y = Math.abs(Math.sin(time * 8)) * 0.3;
      ud.rArmPivot.rotation.x = -Math.PI * 1.5;
    } else {
      squashStretch(ud.torso, ud.headGroup, breathe * 0.45, breathe > 0);
      applySquash(ud, breathe * 0.25);
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, BOW_IDLE_TORSO_X + breathe * 0.02, α);
      ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0, α * 0.8);
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α * 0.8);
      ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, BOW_IDLE_R_ARM_X, α);
      ud.rArmPivot.rotation.z = lerp(ud.rArmPivot.rotation.z, BOW_IDLE_R_ARM_Z, α);
      const lArm = ud.lArmPivot as THREE.Group | undefined;
      if (lArm) lArm.rotation.x = lerp(lArm.rotation.x, BOW_IDLE_L_ARM_X, α);
      bodyRoot.position.y = lerp(bodyRoot.position.y, BOW_IDLE_BODY_Y, α);
    }

  } else if (phase === 'bowl') {
    // ── Phase breakdown ──────────────────────────────────────────
    // 0.00 – 0.25  run-up    : body bouncing, arm swings back naturally
    // 0.25 – 0.375 gather    : arm pulls to maximum cock position (-π/2)
    // 0.375– 0.65  release   : arm sweeps over the top (0 → +0.6)
    // 0.65 – 1.0   follow-through

    if (pp < 0.25) {
      // Run-up: arm swings back while running
      const rp  = pp / 0.25;                          // 0→1
      const run = Math.sin(rp * Math.PI * 6);
      bodyRoot.position.y = Math.abs(run) * 0.15;
      squashStretch(ud.torso, ud.headGroup, Math.abs(run) * 0.08, run < 0);
      applySquash(ud, Math.abs(run) * 0.04);
      // Arm stays coiled then draws further back (idle is already ~-1.6 on X).
      const runArm = BOW_IDLE_R_ARM_X - easeIn(rp) * 0.48;
      ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, runArm, α);
      if (ud.rLegPivot && ud.lLegPivot) {
        ud.rLegPivot.rotation.x = run * 0.55;
        ud.lLegPivot.rotation.x = -run * 0.55;
      }

    } else if (pp < 0.375) {
      // Gather: arm cocks to maximum (-π/2 ≈ -1.57)
      const gp = (pp - 0.25) / 0.125;                // 0→1
      bodyRoot.position.y = lerp(bodyRoot.position.y, Math.sin(gp * Math.PI) * 0.45, α * 1.5);
      squashStretch(ud.torso, ud.headGroup, 0.3, true);
      applySquash(ud, 0.06);
      ud.rArmPivot.rotation.x = lerp(
        ud.rArmPivot.rotation.x,
        -Math.PI * 0.5 - easeIn(gp) * 0.3,   // -1.57 → -1.88 (maximum cock)
        α * 2,
      );
      if (ud.rLegPivot && ud.lLegPivot) {
        ud.rLegPivot.rotation.x = lerp(ud.rLegPivot.rotation.x, 0, α);
        ud.lLegPivot.rotation.x = lerp(ud.lLegPivot.rotation.x, 0, α);
      }

    } else if (pp < 0.65) {
      // Release arc: arm sweeps from cocked (-1.88) through vertical (0) to follow (+0.6)
      const rp = (pp - 0.375) / 0.275;               // 0→1
      const arc = smoothstep01(clamp(rp, 0, 1));
      bodyRoot.position.y = lerp(bodyRoot.position.y, 0, α * 1.5);
      squashStretch(ud.torso, ud.headGroup, 0.2 * (1 - arc), true);
      applySquash(ud, 0.04 * (1 - arc));
      // -1.88 → +0.65 (arm sweeps over and slightly past vertical)
      ud.rArmPivot.rotation.x = lerp(-1.88, 0.65, arc);

    } else {
      // Follow-through: settle arm forward and body returns to idle
      bodyRoot.position.y = lerp(bodyRoot.position.y, 0, α);
      squashStretch(ud.torso, ud.headGroup, 0, true);
      applySquash(ud, 0);
      ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, 0.65, α * 0.5);
    }

  } else {
    ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, BOW_IDLE_R_ARM_X, α);
    ud.rArmPivot.rotation.z = lerp(ud.rArmPivot.rotation.z, BOW_IDLE_R_ARM_Z, α);
    const lArm = ud.lArmPivot as THREE.Group | undefined;
    if (lArm) lArm.rotation.x = lerp(lArm.rotation.x, BOW_IDLE_L_ARM_X, α);
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, BOW_IDLE_TORSO_X, α);
    bodyRoot.position.y = lerp(bodyRoot.position.y, BOW_IDLE_BODY_Y, α);
    applySquash(ud, 0);
  }

  applyBlink(fig, time);
  applyHeadLook(fig, input.ballPos, 0.08);
  lockToGround(fig);
}

// ── Batsman ──────────────────────────────────────────────────────────────────

export function animateBatsman(fig: THREE.Group, input: AnimatorInput): void {
  const { phase, phaseProgress: pp, dt, time } = input;
  const ud = fig.userData;
  if (!ud.armsGroup || !ud.torso) return;
  const bodyRoot = (ud.bodyRoot as THREE.Group | undefined) ?? fig;
  ud.torso.position.x = 0;  // stance shift is on root.position.x (world space)

  const ag     = ud.armsGroup as THREE.Group;               // bat in rWrist-space
  const rArm   = ud.rArmPivot as THREE.Group | undefined;   // right (bat) arm pivot
  const lArm   = ud.lArmPivot as THREE.Group | undefined;   // left (front) arm pivot
  const rElb   = ud.rElbow    as THREE.Group | undefined;   // right elbow
  const rWrist = ud.rWrist    as THREE.Group | undefined;   // right wrist
  const α = Math.min(1, dt * 10);

  // Helper: drive all limb targets toward rest values.
  function toReady(αMul = 1) {
    ag.rotation.z   = lerp(ag.rotation.z,   BAT_READY_Z,   α * αMul);
    ag.rotation.x   = lerp(ag.rotation.x,   BAT_READY_X,   α * αMul);
    if (rArm) {
      rArm.rotation.x = lerp(rArm.rotation.x, BATSMAN_READY_R_ARM_X, α * αMul);
      rArm.rotation.z = lerp(rArm.rotation.z, BATSMAN_READY_R_ARM_Z, α * αMul);
    }
    if (lArm) {
      lArm.rotation.x = lerp(lArm.rotation.x, BATSMAN_READY_L_ARM_X, α * αMul);
      lArm.rotation.z = lerp(lArm.rotation.z, BATSMAN_READY_L_ARM_Z, α * αMul);
    }
    if (rElb)   rElb.rotation.z   = lerp(rElb.rotation.z,   ELBOW_R_READY_Z, α * αMul);
    if (rWrist) rWrist.rotation.x = lerp(rWrist.rotation.x, WRIST_R_READY_X, α * αMul);
  }

  if (phase === 'idle') {
    // Grounded ready stance: slight forward lean + open shoulders, not mid-swing freeze.
    bodyRoot.position.y = lerp(bodyRoot.position.y, 0, α);
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, BATSMAN_IDLE_TORSO_X, α);
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, BATSMAN_IDLE_TORSO_Y, α);
    ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
    ud.torso.scale.set(1, 1, 1);
    applySquash(ud, 0);
    toReady();

  } else if (phase === 'bowl') {
    bodyRoot.position.y = lerp(bodyRoot.position.y, 0, α);
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, BATSMAN_IDLE_TORSO_X, α);
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, BATSMAN_IDLE_TORSO_Y, α);
    ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
    ud.torso.scale.set(1, 1, 1);

    if (input.isSwinging || pp > 0.9) {
      // ── Active swing ─────────────────────────────────────────
      const sp = smoothstep01(clamp((pp - 0.9) / 0.1, 0, 1));

      ag.rotation.z = lerp(BAT_LOAD_Z,  BAT_SWING_Z,  sp);
      ag.rotation.x = lerp(BAT_LOAD_X,  BAT_SWING_X,  sp);
      if (rArm) {
        rArm.rotation.z = lerp(ARM_R_LOAD_Z, ARM_R_HIT_Z, sp);
        rArm.rotation.x = lerp(ARM_R_LOAD_X, ARM_R_HIT_X, sp);
      }
      if (lArm) {
        lArm.rotation.z = lerp(lArm.rotation.z, ARM_L_SWING_Z, α);
        lArm.rotation.x = lerp(lArm.rotation.x, ARM_L_SWING_X, α);
      }
      if (rElb)   rElb.rotation.z   = lerp(ELBOW_R_LOAD_Z, ELBOW_R_HIT_Z,    sp);
      if (rWrist) rWrist.rotation.x = lerp(WRIST_R_LOAD_X, WRIST_R_HIT_X,    sp);

      ud.torso.rotation.y = lerp(ud.torso.rotation.y, sp * 0.4, α);
      ud.torso.scale.y = lerp(1.08, 0.88, sp);
      applySquash(ud, (0.5 - sp) * 0.06);

    } else {
      // ── Pre-delivery load: draw bat back a little further ────
      ag.rotation.z   = lerp(ag.rotation.z,   BAT_LOAD_Z,   α);
      ag.rotation.x   = lerp(ag.rotation.x,   BAT_LOAD_X,   α);
      if (rArm) {
        rArm.rotation.z = lerp(rArm.rotation.z, ARM_R_LOAD_Z, α);
        rArm.rotation.x = lerp(rArm.rotation.x, ARM_R_LOAD_X, α);
      }
      if (lArm) {
        lArm.rotation.z = lerp(lArm.rotation.z, BATSMAN_READY_L_ARM_Z, α);
        lArm.rotation.x = lerp(lArm.rotation.x, BATSMAN_READY_L_ARM_X, α);
      }
      if (rElb)   rElb.rotation.z   = lerp(rElb.rotation.z,   ELBOW_R_LOAD_Z, α);
      if (rWrist) rWrist.rotation.x = lerp(rWrist.rotation.x, WRIST_R_LOAD_X, α);
      ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0, α);
      applySquash(ud, 0);
    }

  } else if (phase === 'hit') {
    bodyRoot.position.y = 0;
    const hp = clamp(pp / 0.22, 0, 1);
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, 0, α);
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0, α);

    ag.rotation.z   = lerp(ag.rotation.z,   BAT_SWING_Z,  easeOut(hp));
    ag.rotation.x   = lerp(ag.rotation.x,   BAT_SWING_X,  easeOut(hp));
    if (rArm) {
      rArm.rotation.z = lerp(rArm.rotation.z, ARM_R_HIT_Z, easeOut(hp));
      rArm.rotation.x = lerp(rArm.rotation.x, ARM_R_HIT_X, easeOut(hp));
    }
    if (lArm) {
      lArm.rotation.z = lerp(lArm.rotation.z, ARM_L_SWING_Z, α);
      lArm.rotation.x = lerp(lArm.rotation.x, ARM_L_SWING_X, α);
    }
    if (rElb)   rElb.rotation.z   = lerp(rElb.rotation.z,   ELBOW_R_HIT_Z, easeOut(hp));
    if (rWrist) rWrist.rotation.x = lerp(rWrist.rotation.x, WRIST_R_HIT_X, easeOut(hp));

    if (pp < 0.2) {
      const intensity = input.hitQuality === 'perfect' ? 0.6
        : input.hitQuality === 'good' ? 0.4 : 0.25;
      squashStretch(ud.torso, ud.headGroup, intensity, pp < 0.1);
      applySquash(ud, intensity * 0.08 * (pp < 0.1 ? 1 : -0.6));
    } else {
      squashStretch(ud.torso, ud.headGroup, 0, true);
      applySquash(ud, 0);
    }

  } else if (phase === 'celebrate') {
    const jump = Math.abs(Math.sin(time * 12)) * 0.6;
    bodyRoot.position.y = jump;
    squashStretch(ud.torso, ud.headGroup, 0.3, true);
    applySquash(ud, Math.sin(time * 12) * 0.04);
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, 0, α);
    ag.rotation.z = -1.6 + Math.sin(time * 20) * 0.5;
    ud.torso.rotation.y = Math.sin(time * 8) * 0.35;
    if (rArm) {
      rArm.rotation.z = -1.3 + Math.sin(time * 15) * 0.4;
      rArm.rotation.x = BATSMAN_READY_R_ARM_X;
    }
    if (lArm) {
      lArm.rotation.z = 1.3 - Math.sin(time * 15) * 0.4;
      lArm.rotation.x = BATSMAN_READY_L_ARM_X;
    }
    if (rWrist) rWrist.rotation.x = lerp(rWrist.rotation.x, 0, α);

  } else if (phase === 'wicket') {
    squashStretch(ud.torso, ud.headGroup, 0.25, false);
    ud.torso.rotation.z = 0.4;
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0, α);
    applySquash(ud, -0.05);
    toReady(0.4);  // drift back to ready pose slowly (slumped feel)
  }

  applyBlink(fig, time);
  applyHeadLook(fig, input.ballPos, phase === 'bowl' || phase === 'hit' ? 0.22 : 0.08);
  lockToGround(fig);
}

// ── Fielder ──────────────────────────────────────────────────────────────────

export function animateFielder(
  fig: THREE.Group,
  ballPos: THREE.Vector3,
  time: number,
  dt: number,
  phase: SimPhase,
): void {
  const ud = fig.userData;
  if (!ud.torso) return;
  void ballPos;

  const α        = Math.min(1, dt * 8);
  const bodyRoot = (ud.bodyRoot as THREE.Group | undefined) ?? fig;

  if (phase === 'bowl') {
    // Chase: forward lean, opposing arm/leg swing, vertical bounce
    const run = Math.sin(time * 8) * 0.55;
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, 0.35, α);
    ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
    if (ud.rArmPivot) (ud.rArmPivot as THREE.Group).rotation.x =
      lerp((ud.rArmPivot as THREE.Group).rotation.x, -run * 0.7, α * 0.6);
    if (ud.lArmPivot) (ud.lArmPivot as THREE.Group).rotation.x =
      lerp((ud.lArmPivot as THREE.Group).rotation.x, run * 0.7, α * 0.6);
    if (ud.rLegPivot) (ud.rLegPivot as THREE.Group).rotation.x = run;
    if (ud.lLegPivot) (ud.lLegPivot as THREE.Group).rotation.x = -run;
    bodyRoot.position.y = Math.abs(run) * 0.10;
    ud.torso.scale.x = lerp(ud.torso.scale.x, 1, 0.25);
    ud.torso.scale.y = lerp(ud.torso.scale.y, 1, 0.25);
    applySquash(ud, 0);

  } else if (phase === 'hit') {
    // Gather: stoop deeply, both arms reach down
    ud.torso.rotation.x = lerp(ud.torso.rotation.x, 0.65, α);
    ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
    if (ud.rArmPivot) (ud.rArmPivot as THREE.Group).rotation.x =
      lerp((ud.rArmPivot as THREE.Group).rotation.x, -1.2, α);
    if (ud.lArmPivot) (ud.lArmPivot as THREE.Group).rotation.x =
      lerp((ud.lArmPivot as THREE.Group).rotation.x, -1.2, α);
    if (ud.rLegPivot) (ud.rLegPivot as THREE.Group).rotation.x =
      lerp((ud.rLegPivot as THREE.Group).rotation.x, 0, α);
    if (ud.lLegPivot) (ud.lLegPivot as THREE.Group).rotation.x =
      lerp((ud.lLegPivot as THREE.Group).rotation.x, 0, α);
    bodyRoot.position.y = lerp(bodyRoot.position.y, 0, α);
    ud.torso.scale.x = lerp(ud.torso.scale.x, 1, 0.25);
    ud.torso.scale.y = lerp(ud.torso.scale.y, 1, 0.25);
    applySquash(ud, 0);

  } else {
    // Idle — three distinct poses; lerp bodyRoot back to ground
    bodyRoot.position.y = lerp(bodyRoot.position.y, 0, α * 0.5);
    const phaseOffset = (ud.idlePhase as number | undefined) ?? 0;
    const poseType    = (ud.poseType  as number | undefined) ?? 0;
    const sway = Math.sin(time * 1.2 + phaseOffset) * 0.015;

    if (poseType === 0) {
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, 0.10 + sway, 0.14);
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, sway * 0.5, 0.14);
      if (ud.rArmPivot) (ud.rArmPivot as THREE.Group).rotation.x = lerp(
        (ud.rArmPivot as THREE.Group).rotation.x, -0.55 + Math.sin(time * 0.9 + phaseOffset) * 0.05, 0.08);
      if (ud.lArmPivot) (ud.lArmPivot as THREE.Group).rotation.x = lerp(
        (ud.lArmPivot as THREE.Group).rotation.x, -0.40 + Math.sin(time * 0.9 + phaseOffset) * 0.05, 0.08);
    } else if (poseType === 1) {
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, sway * 0.8, 0.14);
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, sway * 0.4, 0.14);
      if (ud.rArmPivot) (ud.rArmPivot as THREE.Group).rotation.x = lerp(
        (ud.rArmPivot as THREE.Group).rotation.x, -0.10, 0.08);
      if (ud.lArmPivot) (ud.lArmPivot as THREE.Group).rotation.x = lerp(
        (ud.lArmPivot as THREE.Group).rotation.x, -0.10, 0.08);
    } else {
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, 0.06 + sway, 0.14);
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0.04 + sway * 0.4, 0.14);
      if (ud.rArmPivot) (ud.rArmPivot as THREE.Group).rotation.x = lerp(
        (ud.rArmPivot as THREE.Group).rotation.x, -0.30 + Math.sin(time * 1.1 + phaseOffset) * 0.04, 0.08);
      if (ud.lArmPivot) (ud.lArmPivot as THREE.Group).rotation.x = lerp(
        (ud.lArmPivot as THREE.Group).rotation.x, -0.65 + Math.sin(time * 1.1 + phaseOffset) * 0.04, 0.08);
    }

    ud.torso.scale.x = lerp(ud.torso.scale.x, 1, 0.25);
    ud.torso.scale.y = lerp(ud.torso.scale.y, 1, 0.25);
    applySquash(ud, sway * 0.015);
  }

  applyBlink(fig, time);
  applyHeadLook(fig, ballPos, phase === 'bowl' ? 0.18 : 0.06);
  lockToGround(fig);
}
