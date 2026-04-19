import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import gsap from 'gsap';
import { createScene } from './scene.js';
import { createWebGLRenderer } from './renderer.js';
import { createArenaLighting, updateLightingRiskEvent, type DynamicLighting } from './arena/lighting.js';
import { createEnvironment, type ArenaEnvironment } from './arena/environment.js';
import { SpectatorSystem } from './arena/spectators.js';
import { ArenaParticleSystem } from './arena/particles.js';
import { triggerHardwareShake } from './arena/cameraEffects.js';
import { StadiumCameraRig, type CameraPerspective } from './camera.js';
import { createPitch } from './objects/pitch.js';
import { StumpsSide } from './objects/stumps.js';
import { CricketBall } from './objects/ball.js';
import { createBowlerFigure, createBatsmanFigure, placeBowler, placeBatsman } from './objects/players.js';
import { createStarfield } from './objects/sky.js';
import {
  computeBallFrame,
  phaseLength,
  type SimPhase,
  type BowlerType,
} from './physics/ballTrajectory.js';
import { SIM, WORLD } from './layout.js';
import { screenGroundPoint } from './worldMapping.js';
import { POVSystem } from './POVSystem.js';
import type { ShotType } from '../core/modeEngine.js';

// Post-processing imports
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

const NAMES = {
  six: ['MAXIMUM!', 'SIX! SIX! SIX!', 'OVER THE ROPE!', 'HUGE HIT!'],
  four: ['FOUR!', 'BOUNDARY!', 'CRACKING DRIVE!', 'MAGNIFICENT!'],
  runs: ['GOOD SHOT!', 'RUNNING HARD!', 'SHARP CRICKET!'],
  dot: ['DEFENDED!', 'DOT BALL!', 'TIGHT LINE!'],
  wicket: ['BOWLED!', 'TIMBER!', 'CLEAN BOWLED!', 'OUT!'],
};

function pickDeterministic(arr: string[], seed: number) {
  const i = Math.abs(seed) % arr.length;
  return arr[i]!;
}

export interface EngineCallbacks {
  onShotLabel?: (text: string, color: string, alpha: number) => void;
}

export interface EngineProps {
  phase: SimPhase;
  multiplier: number;
  hitTrajectory: 'six' | 'four' | 'neutral';
  bowlerType: BowlerType;
  runs: number;
  deliveryKey: number;
  perspective?: CameraPerspective;
  phaseProgress?: number;
  shotType?: ShotType;
}

export class CricketWebGLEngine {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraRig: StadiumCameraRig;
  readonly domElement: HTMLCanvasElement;
  readonly composer: EffectComposer;

  private readonly bloomPass: UnrealBloomPass;
  private readonly ball: CricketBall;
  private readonly ballShadow: THREE.Mesh;
  private readonly particles: ArenaParticleSystem;
  private readonly arenaEnv: ArenaEnvironment;
  private readonly arenaLights: DynamicLighting;
  private readonly bowlingStumps: StumpsSide;
  private readonly battingStumps: StumpsSide;
  private readonly bowlerFig: THREE.Group;
  private readonly batFig: THREE.Group;
  private raf = 0;
  private lastT = performance.now() / 1000;
  private t = 0;
  private phaseStartT = 0;
  private prevPh: SimPhase = 'idle';
  private prevDeliveryKey = 0;
  private bowlerX: number = SIM.BOWLER_REST_X;
  private stumpsFly = false;
  private stumpFlyT = 0;
  private dustSpawnedBounce = false;
  private povSystem: POVSystem;
  private spectators: SpectatorSystem;
  private prevBType?: BowlerType;
  private shotText = '';
  private shotColor = '#ffffff';
  private shotAlpha = 0;
  private props: EngineProps;
  private cb: EngineCallbacks;
  private disposeRenderer: () => void;
  private stats: Stats;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, initial: EngineProps, callbacks: EngineCallbacks = {}) {
    this.domElement = canvas;
    this.props = initial;
    this.cb = callbacks;

    const { renderer, dispose } = createWebGLRenderer(canvas);
    this.renderer = renderer;
    this.disposeRenderer = dispose;
    renderer.setSize(width, height, false);

    this.scene = createScene();
    
    // Atmospheric Fog (Neon Depth)
    this.scene.fog = new THREE.FogExp2(0x020208, 0.012);
    
    // Mount Premium Arena Atmosphere
    this.arenaEnv = createEnvironment();
    this.scene.add(this.arenaEnv.group);
    
    // Mount Responsive Lighting Rig
    this.arenaLights = createArenaLighting();
    this.scene.add(this.arenaLights.stadiumGroup);

    // Use tight 40deg FOV to compress depth naturally and avoid wide-angle edge distortion
    const cam = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
    this.cameraRig = new StadiumCameraRig(cam);
    this.scene.add(this.cameraRig.group);

    const { ground, pitch, boundary } = createPitch();
    this.scene.add(ground, pitch, boundary);

    const stars = createStarfield();
    this.scene.add(stars);

    // Debugging GridHelper for pitch alignment explicitly requested by the audit
    // const gridHelper = new THREE.GridHelper(20, 20, 0xff0000, 0x444444);
    // gridHelper.position.y = 0.01;
    // this.scene.add(gridHelper);

    const bp = screenGroundPoint(SIM.CX_BOWL);
    const bap = screenGroundPoint(SIM.CX_BAT);
    this.bowlingStumps = new StumpsSide(false);
    this.bowlingStumps.position.set(bp.x, 0, bp.z);
    this.battingStumps = new StumpsSide(true);
    this.battingStumps.position.set(bap.x, 0, bap.z);
    this.scene.add(this.bowlingStumps, this.battingStumps);

    this.bowlerFig = createBowlerFigure(0x1e40af);
    this.batFig = createBatsmanFigure();
    this.scene.add(this.bowlerFig, this.batFig);

    this.ball = new CricketBall();
    this.scene.add(this.ball);

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD.ballRadius, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.04;
    this.ballShadow.receiveShadow = false;
    this.scene.add(this.ballShadow);

    this.particles = new ArenaParticleSystem();
    this.scene.add(this.particles);

    // Mount Spectator Density
    this.spectators = new SpectatorSystem();
    this.scene.add(this.spectators.group);

    // Setup Post-processing
    const renderScene = new RenderPass(this.scene, this.cameraRig.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.5, 0.85);
    
    // Casino-grade bloom settings: Subtle but punchy
    this.bloomPass.threshold = 0.25;
    this.bloomPass.strength = 0.45;
    this.bloomPass.radius = 0.4;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // Mount native FPS + memory performance overlay hook 
    this.stats = new Stats();
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '0px';
    this.stats.dom.style.right = '0px'; 
    this.stats.dom.style.left = 'unset'; 
    // We attach it to the parent canvas wrapper if possible, or body
    if (canvas.parentElement) {
      canvas.parentElement.style.position = 'relative'; // Ensure absolute positioning binds to wrapper
      canvas.parentElement.appendChild(this.stats.dom);
    } else {
      document.body.appendChild(this.stats.dom);
    }

    this.povSystem = new POVSystem(this.cameraRig);

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setProps(p: EngineProps) {
    this.props = p;
  }

  setCallbacks(cb: EngineCallbacks) {
    this.cb = cb;
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.cameraRig.resize(width, height);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.povSystem.dispose();
    gsap.killTweensOf(this.cameraRig.camera.position);
    gsap.killTweensOf(this.cameraRig.group.position);
    if (this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
    }
    this.disposeRenderer();
  }

  private loop() {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - this.lastT);
    this.lastT = now;
    this.t += dt;

    const ph = this.props.phase;
    const traj = this.props.hitTrajectory;
    const bType = this.props.bowlerType;
    const runs = this.props.runs;
    const mult = this.props.multiplier;
    const dKey = this.props.deliveryKey;

    const phLen = phaseLength(ph, bType);

    if (ph !== this.prevPh) {
      this.phaseStartT = this.t;
      this.dustSpawnedBounce = false;

      if (ph === 'bowl') {
        this.bowlerX = SIM.BOWLER_REST_X - 72;
        this.stumpsFly = false;
        this.stumpFlyT = 0;
        this.battingStumps.resetWicket();
      }
      if (ph === 'hit') {
        const seed = dKey * 17 + 3;
        const n =
          traj === 'six'
            ? pickDeterministic(NAMES.six, seed)
            : traj === 'four'
              ? pickDeterministic(NAMES.four, seed + 1)
              : runs > 0
                ? pickDeterministic(NAMES.runs, seed + 2)
                : pickDeterministic(NAMES.dot, seed + 4);
        this.shotText = n;
        this.shotColor =
          traj === 'six' ? '#facc15' : traj === 'four' ? '#fb923c' : runs > 0 ? '#86efac' : '#94a3b8';
        this.shotAlpha = 1.3;
        
        // Dynamic Camera Impact Shake
        triggerHardwareShake(this.cameraRig, traj === 'six' ? 'heavy' : 'mild');
        updateLightingRiskEvent(this.arenaLights, 'extreme');

        const hitP = screenGroundPoint(SIM.BALL_AT_BAT_X - 15);
        this.particles.spawnBurst(new THREE.Vector3(hitP.x, 0.2, hitP.z), 14, 'spark');
      }
      if (ph === 'wicket') {
        this.stumpsFly = true;
        this.shotText = pickDeterministic(NAMES.wicket, dKey * 19 + 7);
        this.shotColor = '#ef4444';
        this.shotAlpha = 1.3;

        triggerHardwareShake(this.cameraRig, 'heavy');
        updateLightingRiskEvent(this.arenaLights, 'high');

        const wp = screenGroundPoint(SIM.CX_BAT);
        this.particles.spawnBurst(new THREE.Vector3(wp.x, 0.4, wp.z), 22, 'debris');
      }
      if (ph === 'idle' || ph === 'celebrate') {
        this.shotText = '';
        this.shotAlpha = 0;
        updateLightingRiskEvent(this.arenaLights, 'idle');
      }
      this.prevPh = ph;
    }
    
    // Performance Fix: Only traverse geometry nodes if bowler type physically swaps
    if (bType !== this.prevBType) {
      this.prevBType = bType;
      const kit = bType === 'Fast' ? 0x1e40af : bType === 'Swing' ? 0x166534 : 0x92400e;
      this.bowlerFig.traverse((o) => {
        if (o.userData.kit && (o as THREE.Mesh).isMesh) {
          ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(kit);
        }
      });
    }

    if (dKey !== this.prevDeliveryKey) {
      this.prevDeliveryKey = dKey;
      if (ph === 'hit') {
        this.phaseStartT = this.t;
        this.dustSpawnedBounce = false;
        const seed = dKey * 17 + 3;
        const n =
          traj === 'six'
            ? pickDeterministic(NAMES.six, seed)
            : traj === 'four'
              ? pickDeterministic(NAMES.four, seed + 1)
              : runs > 0
                ? pickDeterministic(NAMES.runs, seed + 2)
                : pickDeterministic(NAMES.dot, seed + 4);
        this.shotText = n;
        this.shotColor =
          traj === 'six' ? '#facc15' : traj === 'four' ? '#fb923c' : runs > 0 ? '#86efac' : '#94a3b8';
        this.shotAlpha = 1.3;
        
        triggerHardwareShake(this.cameraRig, traj === 'six' ? 'heavy' : 'mild');
        updateLightingRiskEvent(this.arenaLights, 'extreme');
        
        const hitP = screenGroundPoint(SIM.BALL_AT_BAT_X - 15);
        this.particles.spawnBurst(new THREE.Vector3(hitP.x, 0.2, hitP.z), 14, 'spark');
      }
    }

    // Gradual Multiplier Ticker Light Shifts (High-Energy Reactivity)
    if (ph === 'bowl' || ph === 'hit') {
       const cachedPh = this.prevPh as unknown as string;
       if (mult > 12 && cachedPh !== 'extreme_tick') {
         this.prevPh = 'extreme_tick' as any;
         updateLightingRiskEvent(this.arenaLights, 'extreme');
       } else if (mult > 5 && mult <= 12 && cachedPh !== 'high_tick') {
         this.prevPh = 'high_tick' as any;
         updateLightingRiskEvent(this.arenaLights, 'high');
       } else if (mult > 2 && mult <= 5 && cachedPh !== 'low_tick') {
         this.prevPh = 'low_tick' as any;
         updateLightingRiskEvent(this.arenaLights, 'low');
       }
    } else if (ph === 'idle' || ph === 'celebrate') {
       const cachedPh = this.prevPh as unknown as string;
       if (cachedPh !== 'idle') {
          updateLightingRiskEvent(this.arenaLights, 'idle');
       }
    }

    // Use provided phaseProgress if available, otherwise fallback to internal timing
    const pp = this.props.phaseProgress ?? clamp((this.t - this.phaseStartT) / phLen, 0, 1);

    if (this.shotAlpha > 0) {
      this.shotAlpha = Math.max(0, this.shotAlpha - dt * 0.7);
    }
    this.cb.onShotLabel?.(this.shotText, this.shotColor, Math.min(1, this.shotAlpha));

    if (ph === 'bowl') {
      const rp = clamp(pp / 0.74, 0, 1);
      this.bowlerX = lerp(SIM.BOWLER_REST_X - 72, SIM.CX_BOWL - 34, easeOut(rp));
      if (this.bowlerFig.userData.rArmPivot) {
        this.bowlerFig.userData.rArmPivot.rotation.x = -rp * Math.PI * 2;
        this.bowlerFig.userData.rLegPivot.rotation.x = Math.sin(rp * Math.PI * 6) * 0.4;
        this.bowlerFig.userData.lLegPivot.rotation.x = -Math.sin(rp * Math.PI * 6) * 0.4;
      }
    } else {
      this.bowlerX = lerp(this.bowlerX, SIM.BOWLER_REST_X, Math.min(1, dt * 2.5));
      if (this.bowlerFig.userData.rArmPivot) {
        this.bowlerFig.userData.rArmPivot.rotation.x = 0;
        this.bowlerFig.userData.rLegPivot.rotation.x = 0;
        this.bowlerFig.userData.lLegPivot.rotation.x = 0;
      }
    }

    if (this.batFig.userData.armsGroup) {
      if (ph === 'hit') {
        const hp = clamp(pp / 0.25, 0, 1);
        this.batFig.userData.armsGroup.rotation.z = easeOut(hp) * 1.5;
      } else {
        this.batFig.userData.armsGroup.rotation.z = 0;
      }
    }

    if (this.stumpsFly) this.stumpFlyT = Math.min(1, this.stumpFlyT + dt * 0.72);
    if (this.stumpsFly) this.battingStumps.setWicketFly(this.stumpFlyT);

    placeBowler(this.bowlerFig, this.bowlerX);
    placeBatsman(this.batFig);

    const frame = computeBallFrame({
      phase: ph,
      phaseProgress: pp,
      phaseLen: phLen,
      t: this.t,
      bowlerType: bType,
      bowlerX: this.bowlerX,
      hitTrajectory: traj,
      runs,
      multiplier: mult,
    });

    if (ph === 'bowl' && pp >= 0.74) {
      const releaseAt = 0.74;
      const fp = clamp((pp - releaseAt) / (1.0 - releaseAt), 0, 1);
      const bounceAt = bType === 'Fast' ? 0.38 : bType === 'Swing' ? 0.44 : 0.52;
      if (fp >= bounceAt) {
        const p = clamp((fp - bounceAt) / (1.0 - bounceAt), 0, 1);
        if (!this.dustSpawnedBounce && p > 0.04) {
          const bp = screenGroundPoint(SIM.BALL_BOUNCE_X);
          this.particles.spawnBurst(new THREE.Vector3(bp.x, 0.05, bp.z), 11, 'dust');
          this.dustSpawnedBounce = true;
        }
      }
    }

    // Cinematic POV system — drives all camera position/lookAt/FOV transitions
    const ballPos3 = screenGroundPoint(frame.bx);
    ballPos3.y = Math.max(0, SIM.GY - frame.by) * 0.04 + 0.2;
    this.povSystem.update(ph, mult, ballPos3, traj, dt);

    this.arenaLights.ballPoint.position.copy(ballPos3);
    this.arenaLights.ballPoint.color.setRGB(frame.glowRgb[0], frame.glowRgb[1], frame.glowRgb[2]);
    this.arenaLights.ballPoint.intensity = frame.glowStrength * 40.0; // Boost pointlight relative strength
    
    if (ph === 'hit' && frame.bAlpha > 0) {
      // Rapid emit friction trails behind the ball geometry natively
      this.particles.emitTrail(ballPos3);
    }

    this.ball.applyFrame(
      frame.bx,
      frame.by,
      frame.bScale,
      frame.bAlpha,
      frame.spinRate,
      dt,
      frame.glowRgb,
      frame.glowStrength
    );

    // shadowH: screen pixels above ground → proxy for ball height (0 at ground).
    const shadowH = Math.max(0, SIM.GY - frame.by);
    const gp = screenGroundPoint(frame.bx);
    this.ballShadow.position.x = gp.x;
    this.ballShadow.position.z = gp.z;
    const mat = this.ballShadow.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0.05, 0.5 - shadowH * 0.005) * frame.bAlpha;
    // Shadow shrinks as ball rises (stadium floodlights behave like near-parallel sources).
    const sc = Math.max(0.4, 1.0 - shadowH * 0.004);
    this.ballShadow.scale.setScalar(sc);

    this.particles.update(dt);
    this.arenaEnv.update(this.t);
    
    // Dynamic Bloom Intensity based on multiplier (heat buildup)
    if (ph === 'hit') {
      this.bloomPass.strength = 0.45 + Math.min(1.5, mult * 0.05);
    } else {
      this.bloomPass.strength = 0.45;
    }

    // Apply Spectator Animation
    this.spectators.update(dt);

    // Apply Cinematic Camera Handheld Drift
    const driftSpeed = 0.4;
    const driftAmount = 0.08;
    this.cameraRig.group.position.x = Math.sin(this.t * driftSpeed) * driftAmount;
    this.cameraRig.group.position.y = Math.cos(this.t * driftSpeed * 0.8) * driftAmount;

    // Apply the animated look-at target — this is the single place where camera.lookAt is called.
    this.cameraRig.camera.lookAt(this.cameraRig.lookAtTarget);
    this.composer.render();
    
    // Performance Tick Update
    this.stats.update();
  }
}
