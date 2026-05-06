import { SIM } from '../layout.js';

export type SimPhase = 'idle' | 'bowl' | 'hit' | 'wicket' | 'celebrate';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

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
 * EXACT DOODLE SIMULATION MODEL
 * Scripted Curve + Deterministic Timing Gate
 * 
 * Timeline (from Bowler Start):
 * 0.0s -> Run up
 * 0.6s -> Release
 * 1.2s -> Bounce
 * 1.6s -> HIT WINDOW
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
  let glowRgb: [number, number, number] = [1, 1, 1];
  let glowStrength = 0.1;

  if (ph === 'idle') {
    bx = p.bowlerX + 18;
    by = SIM.GY - 45;
    bAlpha = 0.5;
  } else if (ph === 'bowl') {
    // 0.0s -> 0.6s is Bowler Run Up (pp < 0.375 if phLen=1.6)
    // But we use pp relative to phaseLen. 
    // To reach hit window at 1.6s, bowl phase must be 1.6s.
    const releaseAt = 0.375; // 0.6 / 1.6
    
    if (pp < releaseAt) {
      // Ball in bowler's hand
      bx = p.bowlerX + 22;
      const handSwing = Math.sin((pp/releaseAt) * Math.PI * 2);
      by = SIM.GY - 52 + handSwing * 10;
      bAlpha = clamp((pp - 0.1) * 10, 0, 1);
    } else {
      // Flight Progress (0.0 to 1.0) from release to hit window
      const fp = (pp - releaseAt) / (1.0 - releaseAt);
      
      // 1. Z-equivalent (Longitudinal)
      // Map fp to longitudinal movement
      bx = lerp(SIM.CX_BOWL, SIM.CX_BAT, fp);

      // 2. X Swing Curve (Scripted Sine)
      const swingAmp = bType === 'Swing' ? 0.6 : bType === 'Spin' ? 0.4 : 0.1;
      const swingX = Math.sin(fp * Math.PI) * swingAmp * 60; 
      bx += swingX;

      // 3. Y Arc (Scripted Bounce)
      // Bounce occurs at 1.2s (pp = 0.75, which is fp = 0.6 relative to release)
      // Actually the prompt says progress < 0.5 is descent.
      // 0.6 to 1.6 duration is 1.0s. Midpoint is 1.1s. 
      // Bounce at 1.2s is 0.6 into the 1.0s flight.
      const bounceFp = 0.6; 
      if (fp < bounceFp) {
        const u = fp / bounceFp;
        by = lerp(SIM.BALL_RELEASE_Y, SIM.BALL_BOUNCE_Y, u * u);
      } else {
        const u = (fp - bounceFp) / (1.0 - bounceFp);
        const bounceH = bType === 'Fast' ? 45 : 75;
        by = SIM.BALL_BOUNCE_Y - Math.sin(u * Math.PI) * bounceH + lerp(0, SIM.BALL_AT_BAT_Y - SIM.BALL_BOUNCE_Y, u);
      }
      spinRate = 25;
    }
  } else if (ph === 'hit') {
    const dist = Math.log10(Math.max(1, mult)) * 180;
    
    if (traj === 'six') {
      bx = SIM.BALL_AT_BAT_X + pp * (450 + dist);
      by = SIM.BALL_AT_BAT_Y - Math.sin(pp * Math.PI) * (280 + dist * 0.5);
      bScale = 1.0 + pp * 1.5;
      glowRgb = [1, 0.9, 0.1];
      glowStrength = 0.7;
    } else if (traj === 'four') {
      bx = SIM.BALL_AT_BAT_X + pp * (300 + dist);
      const bounceCount = 3;
      const bounceU = (pp * bounceCount) % 1.0;
      const bounceAmp = 60 * Math.exp(-pp * 1.5);
      by = lerp(SIM.BALL_AT_BAT_Y, SIM.GY, clamp(pp * 2.5, 0, 1)) - Math.abs(Math.sin(bounceU * Math.PI)) * bounceAmp;
      glowRgb = [1, 0.7, 0.2];
    } else {
      bx = SIM.BALL_AT_BAT_X + pp * 180;
      by = lerp(SIM.BALL_AT_BAT_Y, SIM.GY, clamp(pp * 4, 0, 1)) - Math.abs(Math.sin(pp * 15)) * 20 * Math.exp(-pp * 2);
    }
    spinRate = 45;
  } else if (ph === 'wicket') {
    const u = clamp(pp * 2, 0, 1);
    bx = lerp(SIM.BALL_AT_BAT_X, SIM.CX_BAT - 60, u);
    by = SIM.BALL_AT_BAT_Y - Math.sin(u * Math.PI) * 45;
    bAlpha = 1 - (pp > 0.6 ? (pp - 0.6) * 2.5 : 0);
    glowRgb = [1, 0.1, 0.1];
    glowStrength = 0.6;
  }

  return { bx, by, bScale, bAlpha, spinRate, glowRgb, glowStrength };
}

/**
 * EXACT DOODLE TIMING
 */
export function phaseLength(phase: SimPhase, _bowlerType: BowlerType): number {
  if (phase === 'bowl') return 1.6; // Bowler Start (0.0) to Hit Window (1.6)
  if (phase === 'hit') return 1.2;  // Follow through
  if (phase === 'wicket') return 1.0;
  if (phase === 'celebrate') return 1.5;
  return 1.0;
}
