import * as THREE from 'three';
import type { SimPhase, BowlerType } from '../physics/ballTrajectory.js';
import type { ShotType } from '../../core/modeEngine.js';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }

// Cricket stance idle targets — batsman guard position
const BAT_IDLE = { az: -0.55, ax: -0.18, tx: -0.12, ty: 0.08 } as const;
// Bowler pre-runup stance
const BOW_IDLE = { torsoX: -0.12, lArmX: 0.18 } as const;

export interface AnimatorInput {
  phase: SimPhase;
  phaseProgress: number;
  bowlerType: BowlerType;
  shotType: ShotType;
  dt: number;
  time: number;
}

/**
 * Drives all limb rotations + vertical offset for the bowler figure.
 * Called every frame from BallSystem. Assumes placeBowler() has already
 * set group.position.x / .z — this function only writes .position.y.
 */
export function animateBowler(fig: THREE.Group, input: AnimatorInput): void {
  const { phase, phaseProgress: pp, bowlerType, dt, time } = input;
  const ud = fig.userData;
  if (!ud.rArmPivot) return;

  const α = Math.min(1, dt * 8);

  if (phase === 'idle' || phase === 'celebrate') {
    // Gentle breathing idle — lerp toward pre-runup cricket stance
    fig.position.y = lerp(fig.position.y, Math.sin(time * 1.4) * 0.025, Math.min(1, dt * 3));
    ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, 0, α);
    ud.lArmPivot.rotation.x = lerp(ud.lArmPivot.rotation.x, BOW_IDLE.lArmX, α);
    ud.rLegPivot.rotation.x = lerp(ud.rLegPivot.rotation.x, 0, α);
    ud.lLegPivot.rotation.x = lerp(ud.lLegPivot.rotation.x, 0, α);
    if (ud.torso) {
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, BOW_IDLE.torsoX, α);
    }
  } else if (phase === 'bowl') {
    const rp = clamp(pp / 0.74, 0, 1);

    // Arm windmill — full circle during run-up
    ud.rArmPivot.rotation.x = -rp * Math.PI * 2;
    // Leg alternation with increasing frequency
    ud.rLegPivot.rotation.x = Math.sin(rp * Math.PI * 6) * 0.45;
    ud.lLegPivot.rotation.x = -Math.sin(rp * Math.PI * 6) * 0.45;

    // Bowler-type specific body lean (side-on vs front-on action)
    if (ud.torso) {
      const lean = bowlerType === 'Fast' ? -0.28 : bowlerType === 'Swing' ? -0.35 : 0.12;
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, rp * lean, α);
    }

    // Jump peak at delivery — vertical offset on figure
    if (pp >= 0.68 && pp < 0.90) {
      const jp = (pp - 0.68) / 0.22;
      fig.position.y = Math.sin(jp * Math.PI) * 0.38;
    } else {
      fig.position.y = lerp(fig.position.y, 0, Math.min(1, dt * 6));
    }
  } else {
    // Return to pre-runup cricket stance
    ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, 0, α);
    ud.lArmPivot.rotation.x = lerp(ud.lArmPivot.rotation.x, BOW_IDLE.lArmX, α);
    ud.rLegPivot.rotation.x = lerp(ud.rLegPivot.rotation.x, 0, α);
    ud.lLegPivot.rotation.x = lerp(ud.lLegPivot.rotation.x, 0, α);
    if (ud.torso) {
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, BOW_IDLE.torsoX, α);
    }
    fig.position.y = lerp(fig.position.y, 0, Math.min(1, dt * 4));
  }
}

/**
 * Drives batsman arms, torso and vertical offset per shot type.
 * Called every frame from BallSystem. placeBatsman() sets x/z only.
 */
export function animateBatsman(fig: THREE.Group, input: AnimatorInput): void {
  const { phase, phaseProgress: pp, shotType, dt, time } = input;
  const ud = fig.userData;
  if (!ud.armsGroup) return;

  const ag = ud.armsGroup as THREE.Group;
  const α = Math.min(1, dt * 8);

  if (phase === 'idle') {
    // Bat-backlift guard stance with slow breathing bob
    fig.position.y = lerp(fig.position.y, Math.sin(time * 1.2) * 0.02, Math.min(1, dt * 2));
    ag.rotation.z = lerp(ag.rotation.z, BAT_IDLE.az, α);
    ag.rotation.x = lerp(ag.rotation.x, BAT_IDLE.ax, α);
    ag.rotation.y = lerp(ag.rotation.y, 0, α);
    if (ud.torso) {
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, BAT_IDLE.tx, α);
      ud.torso.rotation.y = lerp(ud.torso.rotation.y, BAT_IDLE.ty, α);
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
    }
  } else if (phase === 'hit') {
    // hp: fast swing phase (0–25%), ft: follow-through (25–65%)
    const hp = clamp(pp / 0.25, 0, 1);
    const ft = clamp((pp - 0.25) / 0.4, 0, 1);

    switch (shotType) {
      case 'defend': {
        // Soft forward push, minimal arc — bat kept vertical
        const push = easeOut(clamp(pp / 0.15, 0, 1));
        const pullBack = clamp((pp - 0.22) / 0.28, 0, 1);
        ag.rotation.z = lerp(push * 0.42, 0, pullBack);
        ag.rotation.x = lerp(push * 0.18, 0, pullBack);
        break;
      }
      case 'miss': {
        // Aggressive attempted swing that overshoots with recoil
        ag.rotation.z = easeOut(clamp(pp / 0.2, 0, 1)) * 1.25;
        ag.rotation.x = Math.sin(pp * Math.PI) * 0.28;
        if (pp > 0.28) {
          ag.rotation.z += lerp(0, -0.55, easeOut(clamp((pp - 0.28) / 0.22, 0, 1)));
        }
        break;
      }
      case 'quick_single':
      case 'pushed_two':
      case 'run_three':
      case 'drive': {
        // Front-foot drive — punch through with full follow-through
        ag.rotation.z = easeOut(hp) * 1.12 + ft * 0.28;
        ag.rotation.x = easeOut(hp) * 0.28 + ft * 0.38;
        break;
      }
      case 'cut': {
        // Square cut — horizontal bat, body rotation off-side
        ag.rotation.y = -easeOut(hp) * 0.82;
        ag.rotation.z = easeOut(hp) * 0.92;
        if (ud.torso) ud.torso.rotation.y = lerp(ud.torso.rotation.y, -0.42, easeOut(hp) * Math.min(1, dt * 10));
        break;
      }
      case 'pull': {
        // Pull shot — back-foot, bat sweeps across body toward leg-side
        ag.rotation.y = easeOut(hp) * 0.72;
        ag.rotation.z = easeOut(hp) * 0.82;
        ag.rotation.x = -easeOut(hp) * 0.38;
        if (ud.torso) ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0.36, easeOut(hp) * Math.min(1, dt * 10));
        break;
      }
      case 'loft': {
        // Lofted drive — bat arcs up and over the shoulder
        ag.rotation.z = easeOut(hp) * 1.82;
        ag.rotation.x = -(easeOut(hp) * 0.58 + ft * 0.52);
        break;
      }
      default:
        ag.rotation.z = easeOut(hp) * 1.5;
    }
  } else if (phase === 'celebrate') {
    // Arms raise overhead, whole body bounces
    const cp = easeOut(clamp(pp * 3, 0, 1));
    ag.rotation.z = lerp(ag.rotation.z, -1.25, cp * Math.min(1, dt * 5));
    ag.rotation.x = lerp(ag.rotation.x, -0.3, cp * Math.min(1, dt * 5));
    fig.position.y = Math.abs(Math.sin(pp * Math.PI * 4)) * 0.34;
  } else if (phase === 'wicket') {
    // Stagger back — torso tilts, arms drop
    const wp = easeOut(clamp(pp * 2.5, 0, 1));
    if (ud.torso) ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0.32, wp * Math.min(1, dt * 8));
    ag.rotation.z = lerp(ag.rotation.z, -0.42, Math.min(1, dt * 4));
    ag.rotation.x = lerp(ag.rotation.x, 0.22, Math.min(1, dt * 3));
  } else {
    // Return to cricket guard stance
    ag.rotation.z = lerp(ag.rotation.z, BAT_IDLE.az, α);
    ag.rotation.x = lerp(ag.rotation.x, BAT_IDLE.ax, α);
    ag.rotation.y = lerp(ag.rotation.y, 0, α);
    fig.position.y = lerp(fig.position.y, 0, Math.min(1, dt * 4));
    if (ud.torso) {
      ud.torso.rotation.x = lerp(ud.torso.rotation.x, BAT_IDLE.tx, α);
      ud.torso.rotation.y = lerp(ud.torso.rotation.y, BAT_IDLE.ty, α);
      ud.torso.rotation.z = lerp(ud.torso.rotation.z, 0, α);
    }
  }
}
