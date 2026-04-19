import * as THREE from 'three';
import { CricketBall } from './objects/ball.js';
import { ArenaParticleSystem } from './arena/particles.js';
import { computeBallFrame, type BallFrame } from './physics/ballTrajectory.js';
import { SIM, WORLD } from './layout.js';
import { screenGroundPoint } from './worldMapping.js';
import { createPitch } from './objects/pitch.js';
import { StumpsSide } from './objects/stumps.js';
import { createBowlerFigure, createBatsmanFigure, placeBowler, placeBatsman } from './objects/players.js';
import { animateBowler, animateBatsman } from './animation/playerAnimator.js';
import type { EngineProps } from './CricketWebGLEngine.js';
import { phaseLength } from './physics/ballTrajectory.js';

export class BallSystem {
  private ball: CricketBall;
  private ballShadow: THREE.Mesh;
  private particles: ArenaParticleSystem;
  private bowlingStumps: StumpsSide;
  private battingStumps: StumpsSide;
  private bowlerFig: THREE.Group;
  private batFig: THREE.Group;
  
  private bowlerX: number = SIM.BOWLER_REST_X;
  private dustSpawnedBounce = false;
  private stumpsFly = false;
  private stumpFlyT = 0;
  private lastBallWorldPos = new THREE.Vector3();
  private lastFrame: BallFrame | null = null;

  constructor(scene: THREE.Scene) {
    const { ground, pitch, boundary, innerCircle } = createPitch();
    scene.add(ground, pitch, boundary, innerCircle);

    const bp = screenGroundPoint(SIM.CX_BOWL);
    const bap = screenGroundPoint(SIM.CX_BAT);
    this.bowlingStumps = new StumpsSide(false);
    this.bowlingStumps.position.set(bp.x, 0, bp.z);
    this.battingStumps = new StumpsSide(true);
    this.battingStumps.position.set(bap.x, 0, bap.z);
    scene.add(this.bowlingStumps, this.battingStumps);

    this.bowlerFig = createBowlerFigure(0x1e40af);
    this.batFig = createBatsmanFigure();
    scene.add(this.bowlerFig, this.batFig);

    this.ball = new CricketBall();
    scene.add(this.ball);

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD.ballRadius, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.04;
    scene.add(this.ballShadow);

    this.particles = new ArenaParticleSystem();
    scene.add(this.particles);
  }

  update(dt: number, _time: number, props: EngineProps) {
    const ph = props.phase;
    const pp = props.phaseProgress ?? 0;
    const phLen = phaseLength(ph, props.bowlerType);
    
    // 1. Reset on phase start
    if (pp < 0.02 && ph === 'bowl') {
       this.bowlerX = SIM.BOWLER_REST_X - 72;
       this.stumpsFly = false;
       this.stumpFlyT = 0;
       this.battingStumps.resetWicket();
       this.dustSpawnedBounce = false;
    }

    // 2. Advance bowler X position
    if (ph === 'bowl') {
      const rp = Math.min(1, pp / 0.74);
      this.bowlerX = (SIM.BOWLER_REST_X - 72) + (SIM.CX_BOWL - (SIM.BOWLER_REST_X - 72)) * rp;
    } else {
      this.bowlerX += (SIM.BOWLER_REST_X - this.bowlerX) * dt * 2.5;
    }

    const animInput = {
      phase: ph,
      phaseProgress: pp,
      bowlerType: props.bowlerType,
      shotType: props.shotType ?? 'defend',
      dt,
      time: _time,
    };

    // Place (sets X/Z only) then animate (sets Y + limb rotations)
    placeBowler(this.bowlerFig, this.bowlerX);
    animateBowler(this.bowlerFig, animInput);
    placeBatsman(this.batFig);
    animateBatsman(this.batFig, animInput);

    // 3. Trajectory Calculation
    const frame = computeBallFrame({
      ...props,
      phaseProgress: pp,
      phaseLen: phLen,
      t: _time,
      bowlerX: this.bowlerX,
    });

    // 4. Particles & VFX
    if (ph === 'bowl' && pp >= 0.74 && !this.dustSpawnedBounce) {
       // Check for bounce in Travis' logic? No, just simple timing.
       if (pp > 0.85) {
         const bp = screenGroundPoint(SIM.BALL_BOUNCE_X);
         this.particles.spawnBurst(new THREE.Vector3(bp.x, 0.05, bp.z), 11, 'dust');
         this.dustSpawnedBounce = true;
       }
    }

    if (ph === 'wicket' && !this.stumpsFly) {
      this.stumpsFly = true;
      const wp = screenGroundPoint(SIM.CX_BAT);
      this.particles.spawnBurst(new THREE.Vector3(wp.x, 0.4, wp.z), 22, 'debris');
    }

    if (this.stumpsFly) {
      this.stumpFlyT = Math.min(1, this.stumpFlyT + dt * 0.72);
      this.battingStumps.setWicketFly(this.stumpFlyT);
    }

    // 5. Apply Frame to Mesh
    this.lastFrame = frame;
    const ballPos3 = screenGroundPoint(frame.bx);
    ballPos3.y = Math.max(0, SIM.GY - frame.by) * 0.04 + 0.2;
    this.lastBallWorldPos.copy(ballPos3);
    
    if (ph === 'hit' && frame.bAlpha > 0) {
      this.particles.emitTrail(ballPos3);
    }

    this.ball.applyFrame(
      frame.bx, frame.by, frame.bScale, frame.bAlpha, 
      frame.spinRate, dt, frame.glowRgb, frame.glowStrength
    );

    // 6. Shadow
    this.ballShadow.position.x = ballPos3.x;
    this.ballShadow.position.z = ballPos3.z;
    const shadowH = Math.max(0, SIM.GY - frame.by);
    const mat = this.ballShadow.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0.05, 0.5 - shadowH * 0.005) * frame.bAlpha;
    this.ballShadow.scale.setScalar(Math.max(0.4, 1.0 - shadowH * 0.004));

    this.particles.update(dt);
  }

  getBallWorldPos(): THREE.Vector3 {
    return this.lastBallWorldPos;
  }

  getLastFrame(): BallFrame | null {
    return this.lastFrame;
  }

  dispose() {}
}
