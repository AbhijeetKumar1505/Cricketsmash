import * as THREE from 'three';
import type { SimPhase, BowlerType } from '../physics/ballTrajectory.js';
import type { ShotType } from '../../core/modeEngine.js';
import { lookAtBall } from '../objects/players.js';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }

const BAT_IDLE = { az: -0.7, ax: -0.25, tx: -0.25, ty: 0.2 } as const;
const BOW_IDLE = { torsoX: -0.15, torsoY: -0.1, armX: -0.2 } as const;

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

function squashStretch(torso: THREE.Group, head: THREE.Group | undefined, intensity: number, stretch: boolean = true) {
  if (stretch) {
    torso.scale.y = 1 + intensity;
    torso.scale.x = torso.scale.z = 1 - intensity * 0.5;
    if (head) head.scale.setScalar(1 + intensity * 0.2);
  } else {
    torso.scale.y = 1 - intensity;
    torso.scale.x = torso.scale.z = 1 + intensity * 0.5;
    if (head) head.scale.setScalar(1 - intensity * 0.1);
  }
}

export function animateBowler(fig: THREE.Group, input: AnimatorInput): void {
  const { phase, phaseProgress: pp, bowlerType: _bowlerType, dt, time, ballPos } = input;
  const ud = fig.userData;
  if (!ud.rArmPivot || !ud.torso) return;

  const α = Math.min(1, dt * 10);

  // Behavioral Eye Tracking
  lookAtBall(fig, ballPos, phase !== 'idle' && phase !== 'celebrate');

  if (phase === 'idle' || phase === 'celebrate') {
    const breathe = Math.sin(time * 2) * 0.05;
    squashStretch(ud.torso, ud.headGroup, breathe, breathe > 0);
    ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, BOW_IDLE.armX, α);
    
    if (phase === 'celebrate') {
      fig.position.y = Math.abs(Math.sin(time * 8)) * 0.3;
      ud.rArmPivot.rotation.x = -Math.PI * 1.5; // Arms up
    } else {
      fig.position.y = lerp(fig.position.y, 0, α);
    }
  } else if (phase === 'bowl') {
    // Release is at pp = 0.375
    const rp = clamp(pp / 0.375, 0, 1); // Run up progress
    ud.rArmPivot.rotation.x = -rp * Math.PI * 2.5; // Arm swings over

    if (pp < 0.25) {
      // Run-up bounce
      const runCycle = Math.sin(rp * Math.PI * 8);
      fig.position.y = Math.abs(runCycle) * 0.15;
      squashStretch(ud.torso, ud.headGroup, Math.abs(runCycle) * 0.1, runCycle < 0);

      if (ud.rLegPivot && ud.lLegPivot) {
        ud.rLegPivot.rotation.x = runCycle * 0.5;
        ud.lLegPivot.rotation.x = -runCycle * 0.5;
      }
    } else if (pp >= 0.25 && pp < 0.45) {
      // Jump
      const jp = (pp - 0.25) / 0.20;
      fig.position.y = Math.sin(jp * Math.PI) * 0.6; // High jump
      squashStretch(ud.torso, ud.headGroup, 0.4, true); // Maximum stretch
      if (ud.rLegPivot && ud.lLegPivot) {
        ud.rLegPivot.rotation.x = lerp(ud.rLegPivot.rotation.x, 0, α);
        ud.lLegPivot.rotation.x = lerp(ud.lLegPivot.rotation.x, 0, α);
      }
    } else {
      // Follow through
      fig.position.y = lerp(fig.position.y, 0, α * 2);
      squashStretch(ud.torso, ud.headGroup, 0, true);
    }
  } else {
    // Return to idle rotation
    ud.rArmPivot.rotation.x = lerp(ud.rArmPivot.rotation.x, BOW_IDLE.armX, α);
    fig.position.y = lerp(fig.position.y, 0, α);
  }
}

export function animateBatsman(fig: THREE.Group, input: AnimatorInput): void {
  const { phase, phaseProgress: pp, shotType: _shotType, dt, time, ballPos } = input;
  const ud = fig.userData;
  if (!ud.armsGroup || !ud.torso) return;

  const ag = ud.armsGroup as THREE.Group;
  const α = Math.min(1, dt * 10);

  // Always look at the ball
  lookAtBall(fig, ballPos, phase !== 'idle' && phase !== 'celebrate' && phase !== 'wicket');

  if (phase === 'idle') {
    // Exact Doodle idle bounce
    fig.position.y = Math.sin(time * 3) * 0.05;
    const breathe = Math.sin(time * 2.5) * 0.1;
    squashStretch(ud.torso, ud.headGroup, breathe, breathe > 0);
    ag.rotation.z = lerp(ag.rotation.z, BAT_IDLE.az, α);
    ag.rotation.x = lerp(ag.rotation.x, BAT_IDLE.ax, α);
  } else if (phase === 'bowl') {
    const lean = Math.sin(pp * Math.PI * 0.8) * 0.25;
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0.4 + lean, α);
    
    if (input.isSwinging || pp > 0.85) {
      // Active Swing
      const sp = clamp((pp - 0.85) / 0.15, 0, 1); // 0 to 1
      ag.rotation.z = lerp(-1.3, 2.8, sp); 
      ag.rotation.x = lerp(-0.8, 0.4, sp);
      ud.torso.scale.y = lerp(1.1, 0.8, sp);
    } else if (pp > 0.6) {
      // Anticipate
      const sp = (pp - 0.6) / 0.25;
      ag.rotation.z = lerp(-1.3, -1.8, sp);
      ag.rotation.x = lerp(-0.5, -0.8, sp);
      ud.torso.scale.y = lerp(1, 1.1, sp); // slight stretch
      fig.position.x += Math.sin(time * 60) * 0.03; // Tension jitter
    } else {
      ag.rotation.z = lerp(ag.rotation.z, -1.3, α); 
      ag.rotation.x = lerp(ag.rotation.x, -0.5, α);
    }
  } else if (phase === 'hit') {
    const hp = clamp(pp / 0.22, 0, 1);
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0, α);

    ag.rotation.z = lerp(ag.rotation.z, 2.8, easeOut(hp));
    ag.rotation.x = lerp(ag.rotation.x, 0.4, easeOut(hp));
    
    // Impact Visuals
    if (pp < 0.2) {
      const intensity = input.hitQuality === 'perfect' ? 0.6 : (input.hitQuality === 'good' ? 0.4 : 0.25);
      squashStretch(ud.torso, ud.headGroup, intensity, pp < 0.1);
    } else {
      squashStretch(ud.torso, ud.headGroup, 0, true);
    }
  } else if (phase === 'celebrate') {
    const jump = Math.abs(Math.sin(time * 12)) * 0.6;
    fig.position.y = jump;
    squashStretch(ud.torso, ud.headGroup, 0.3, true);
    ag.rotation.z = -1.8 + Math.sin(time * 20) * 0.5; // Flap arms!
    ud.torso.rotation.y = time * 5; // Spin!
  } else if (phase === 'wicket') {
    squashStretch(ud.torso, ud.headGroup, 0.25, false); // Very sad squash
    if (ud.headGroup) ud.headGroup.rotation.x = 0.8; // Head drop
    ag.rotation.z = -0.3;
    ud.torso.rotation.z = 0.4; // Slumped
    ud.torso.rotation.y = lerp(ud.torso.rotation.y, 0, α);
  }
}

export function animateFielder(fig: THREE.Group, ballPos: THREE.Vector3, time: number, dt: number, phase: SimPhase): void {
  const ud = fig.userData;
  if (!ud.torso) return;

  lookAtBall(fig, ballPos, phase === 'hit');

  if (phase === 'hit') {
    // Snail tries to move toward ball (very slowly)
    const toBall = ballPos.clone().sub(fig.position).normalize();
    toBall.y = 0;
    fig.position.add(toBall.multiplyScalar(dt * 0.5));
    
    // Waddle bounce while moving
    const waddle = Math.sin(time * 10) * 0.1;
    fig.position.y = Math.abs(waddle);
    ud.torso.rotation.z = waddle;
  } else {
    const pulse = Math.sin(time * 1.5 + fig.position.x) * 0.05;
    ud.torso.scale.x = 1 + pulse;
    ud.torso.scale.y = 1 - pulse * 0.5;
    fig.position.y = lerp(fig.position.y, 0, 0.1);
  }
  
  if (ud.eyePivots) {
    // Exact Snail eye rotation
    ud.eyePivots.rotation.y = Math.sin(time * 2);
    
    const isBlinking = Math.sin(time * 2.2 + fig.position.x) > 0.985;
    const blinkScale = isBlinking ? 0.05 : 1.0;
    ud.eyePivots.scale.y = lerp(ud.eyePivots.scale.y, blinkScale, 0.4);
  }
}

