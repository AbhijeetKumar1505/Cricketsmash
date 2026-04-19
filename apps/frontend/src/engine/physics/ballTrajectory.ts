import { SIM } from '../layout.js';

export type SimPhase = 'idle' | 'bowl' | 'hit' | 'wicket' | 'celebrate';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

export type BowlerType = 'Fast' | 'Spin' | 'Swing';

export interface TrajectoryParams {
  phase: SimPhase;
  phaseProgress: number;
  phaseLen: number;
  t: number;
  bowlerType: BowlerType;
  bowlerX: number;
  hitTrajectory: 'six' | 'four' | 'neutral';
  runs: number;
  multiplier: number;
}

export interface BallFrame {
  bx: number;
  by: number;
  bScale: number;
  bAlpha: number;
  spinRate: number;
  glowRgb: [number, number, number];
  glowStrength: number;
}

/**
 * Time-normalised ball state in legacy screen space. Deterministic from phase + inputs
 * (no RNG) — Stake / server results drive phase only.
 */
export function computeBallFrame(p: TrajectoryParams): BallFrame {
  const ph = p.phase;
  const pp = p.phaseProgress;
  const traj = p.hitTrajectory;
  const bType = p.bowlerType;
  const mult = p.multiplier;

  let bx = 0;
  let by = 0;
  let bAlpha = 1;
  let bScale = 1;
  let spinRate = 0;
  let glowRgb: [number, number, number] = [1, 0.25, 0.2];
  let glowStrength = 0.12;

  if (ph === 'idle') {
    bx = p.bowlerX + 14;
    by = SIM.GY - 48;
    bAlpha = 0.8;
    spinRate = 0;
  } else if (ph === 'bowl') {
    const releaseAt = 0.74;
    if (pp < releaseAt) {
      // Run-up: follow the bowler's hand (simulated local offset)
      bx = p.bowlerX + 22;
      // Dip and rise with the arm swing
      const swing = Math.sin(pp * Math.PI * 2.5);
      by = SIM.GY - 52 + swing * 8;
      bAlpha = pp < 0.3 ? 0 : clamp((pp - 0.3) / 0.2, 0, 1);
      spinRate = 0;
    } else {
      const fp = clamp((pp - releaseAt) / (1.0 - releaseAt), 0, 1);
      const relX = p.bowlerX + 8;
      const relY = SIM.BALL_RELEASE_Y - 6;
      const bounceAt = bType === 'Fast' ? 0.38 : bType === 'Swing' ? 0.44 : 0.52;

      if (fp < bounceAt) {
        const u = fp / bounceAt;
        bx = lerp(relX, SIM.BALL_BOUNCE_X, u);
        const gravY = relY + (SIM.BALL_BOUNCE_Y - relY) * (u * u);
        if (bType === 'Spin') {
          by = gravY - 4 * 34 * u * (1 - u); // True quadratic gravity parabola
        } else if (bType === 'Swing') {
          by = gravY - Math.pow(u, 3) * 22 - 4 * 10 * u * (1 - u); // Complex spin drift
        } else {
          by = gravY - 4 * 5 * u * (1 - u);
        }
        bScale = lerp(0.55, 0.88, u);
        bAlpha = clamp(fp / 0.07, 0, 1);
      } else {
        const u = clamp((fp - bounceAt) / (1.0 - bounceAt), 0, 1);
        bx = lerp(SIM.BALL_BOUNCE_X, SIM.BALL_AT_BAT_X, easeOut(u));
        const bounceH = bType === 'Fast' ? 42 : bType === 'Swing' ? 62 : 90;
        const peakY = SIM.BALL_BOUNCE_Y - bounceH;
        by =
          (1 - u) * (1 - u) * SIM.BALL_BOUNCE_Y +
          2 * (1 - u) * u * peakY +
          u * u * SIM.BALL_AT_BAT_Y;
        if (bType === 'Spin') {
          bx += 4 * 16 * u * (1 - u); // Deviation width path
        }
        bScale = lerp(0.9, 1.28, u);
        bAlpha = 1;
      }
      spinRate = bType === 'Spin' ? 13 : bType === 'Fast' ? 8 : 6;
      const gc = bType === 'Fast' ? [1, 0.33, 0.2] : bType === 'Swing' ? [0.27, 0.53, 1] : [1, 0.8, 0.27];
      glowRgb = gc as [number, number, number];
      glowStrength = 0.14;
    }
  } else if (ph === 'hit') {
    // Continuous trajectory linked to multiplier rather than fixed 1.0s duration
    // We use a base progress pp for sub-frame smoothing, but the multiplier is the scale
    const distFactor = Math.log(mult) * 80;
    
    if (traj === 'six') {
      bx = SIM.BALL_AT_BAT_X + distFactor * 2.5;
      by = SIM.BALL_AT_BAT_Y - Math.sin(Math.min(pp, 1) * Math.PI) * 120 - distFactor * 0.5;
      bScale = 1.05 + pp * 0.4;
      glowRgb = [1, 0.87, 0];
      glowStrength = 0.22 + mult * 0.05;
    } else if (traj === 'four') {
      bx = SIM.BALL_AT_BAT_X + distFactor * 3.2;
      // Bounce frequency increases as it slows down? No, standard crash is simple.
      const bounceU = (pp * 4) % 1.0; 
      by = SIM.BALL_AT_BAT_Y - 4 * 16 * bounceU * (1 - bounceU);
      bScale = 1.05;
      glowRgb = [1, 0.52, 0.2];
      glowStrength = 0.18 + mult * 0.02;
    } else {
      bx = SIM.BALL_AT_BAT_X + distFactor * 1.8;
      by = SIM.BALL_AT_BAT_Y - 4 * 12 * pp * (1 - pp);
      glowRgb = [1, 0.4, 0.25];
      glowStrength = 0.15 + mult * 0.01;
    }
    spinRate = 7 + mult;
  } else if (ph === 'wicket') {
    const u = clamp(pp * 2.4, 0, 1);
    bx = lerp(SIM.BALL_AT_BAT_X, SIM.CX_BAT + 14, u);
    by = lerp(SIM.BALL_AT_BAT_Y, SIM.PY2 - 4, u);
    bAlpha = Math.max(0, 1 - pp * 1.6);
    glowRgb = [1, 0, 0];
    glowStrength = 0.4;
  }
 else if (ph === 'celebrate') {
    const u = p.t * 2.8;
    const orb = traj === 'six' ? 72 : 50;
    bx = SIM.BAT_X - 25 + Math.cos(u) * orb;
    by = 178 + Math.sin(u * 0.85) * 28;
    bScale = traj === 'six' ? 1.35 : 1.18;
    glowRgb = [0.4, 1, 0.8];
    glowStrength = 0.2;
    spinRate = 7;
  }

  return {
    bx,
    by,
    bScale,
    bAlpha,
    spinRate,
    glowRgb,
    glowStrength,
  };
}

/**
 * Frontend animation duration for each phase.
 * Note: 'hit' duration is now dynamic (driven by playbackEngine and multiplier growth),
 * so this value is a fallback or represents the minimum time for the 'hit' animation.
 */
export function phaseLength(phase: SimPhase, bowlerType: BowlerType): number {
  if (phase === 'bowl') {
    return bowlerType === 'Fast' ? 1.2 : bowlerType === 'Swing' ? 1.45 : 1.8;
  }
  if (phase === 'hit') return 10.0; // Allow it to fly for a long time
  if (phase === 'wicket') return 1.5;
  if (phase === 'celebrate') return 2.0;
  return 1.6;
}
