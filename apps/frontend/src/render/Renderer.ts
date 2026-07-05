import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { EngineSnapshot } from '../engine/GameEngine.js';
import { GameState } from '../engine/state/StateMachine.js';
import type { FielderSlot } from '../engine/worldLayout.js';
import {
  BATSMAN_CREASE_Z,
  BOWLER_RELEASE_Z,
  BOWLER_RUN_START_Z,
  FIELDER_SLOTS,
  broadcastHierarchyFielderScale,
  fielderStanceClassForName,
  getDepthScale,
  getFielderDepthScale,
  PITCH_MID_Z,
  sampleFielderIdleLookPoint,
} from '../engine/worldLayout.js';
import { preloadCharacter, instantiateCharacter } from '../game/CharacterManager.js';
import { bonusGLBAssets } from './entities/BonusGLBAssets.js';
import type { CharacterInstance } from '../game/CharacterManager.js';
import { AnimationBrain } from '../game/animation/AnimationBrain.js';
import { batVibrationQuat } from '../game/animation/fxBus.js';
import { gameBus } from '../game/GameEventBus.js';
import { animDebug } from '../game/animation/animDebugState.svelte.js';
import { anim_telemetry } from '../game/animation/animTelemetry.js';
import { BAT_QUAT_OFFSET, BAT_SWEET_OFFSET, BAT_GRIP_SEAT } from '../characters/human/bat/batGeometry.js';
import type { PredictDebug } from '../engine/physics/ContactSolution.js';
import { DoodleAssets } from './doodle/DoodleAssets.js';
import { Scene } from './Scene.js';
import { Camera } from './Camera.js';
import { BallEntity } from './entities/Ball.js';
import { StadiumEntity } from './entities/Stadium.js';
import { BonusObject3D } from './entities/BonusObject3D.js';
import { SkyObject3D } from './entities/SkyObject3D.js';
import { ImpactJuice } from './effects/ImpactJuice.js';
import { ContactSpark } from './effects/ContactSpark.js';
import type { Renderable } from '../engine/loop/GameLoop.js';

function lerpAngle(current: number, target: number, t: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * t;
}

function setYawToTarget(root: THREE.Group, target: THREE.Vector3, smooth = 1, yawOffset = Math.PI): void {
  const dx = target.x - root.position.x;
  const dz = target.z - root.position.z;
  const targetYaw = Math.atan2(dx, dz) + yawOffset;
  root.rotation.y = lerpAngle(root.rotation.y, targetYaw, smooth);
}

// ── World-space bat sync helpers (module-level scratch, zero allocations) ─────
const _tmpBatPos    = new THREE.Vector3();
const _tmpBatQuat   = new THREE.Quaternion();
const _tmpBatScale  = new THREE.Vector3();
const _sweetSpot    = new THREE.Vector3();
const _batUp        = new THREE.Vector3();
const _ballPos      = new THREE.Vector3();
const _vBallGrip    = new THREE.Vector3();
const _closestOnBat = new THREE.Vector3();
const _scratch      = new THREE.Vector3();
const _round3 = (n: number) => Math.round(n * 1000) / 1000;
// Bat geometry (BAT_QUAT_OFFSET / BAT_SWEET_OFFSET / BAT_GRIP_SEAT) is shared with
// BatTargetIK via batGeometry.ts so both systems agree on where the blade is.

// ── Minimal GLB mount — replaces HumanCharacter, no geometry/bones ────────────

interface GlbMount {
  root: THREE.Group;
  scaleGroup: THREE.Group;
  idlePhase?: number;
  fieldXJitter?: number;
  fieldYawJitter?: number;
}

function createGlbMount(): GlbMount {
  const root = new THREE.Group();
  const scaleGroup = new THREE.Group();
  root.add(scaleGroup);
  return { root, scaleGroup };
}

function isCloseFielderSlot(name: string): boolean {
  return name === 'slip' || name === 'gully' || name === 'short_leg';
}

// Keep badge system for future debugging/mapping, but off for normal gameplay.
const SHOW_FIELDER_NUMBERS = false;

function createFielderNumberBadge(num: number): { sprite: THREE.Sprite; texture: THREE.CanvasTexture } {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const cx = canvas.getContext('2d')!;

  cx.clearRect(0, 0, size, size);
  cx.fillStyle = 'rgba(0,0,0,0.65)';
  cx.beginPath();
  cx.arc(size / 2, size / 2, 34, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,0.9)';
  cx.lineWidth = 5;
  cx.stroke();

  cx.fillStyle = '#ffffff';
  cx.font = 'bold 42px Arial, sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(String(num), size / 2, size / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 2.0, 0.08);
  sprite.scale.set(0.58, 0.58, 0.58);
  sprite.renderOrder = 5;
  return { sprite, texture };
}

export class Renderer implements Renderable {
  private readonly gl: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly scene: Scene;
  private readonly cam: Camera;
  private readonly assets: DoodleAssets;
  private readonly ball: BallEntity;
  private readonly stadium: StadiumEntity;
  private readonly impactJuice = new ImpactJuice();
  private readonly contactSpark = new ContactSpark();
  private readonly bonusMeshes = new Map<string, BonusObject3D>();
  private _lastBonusHitId: string | null = null;
  private skyMesh: SkyObject3D | null = null;
  private _lastSkyId: string | null = null;
  private _flyoverMeshes: Map<string, SkyObject3D> = new Map();
  private readonly debugEnabled: boolean;
  private readonly debugRoot: THREE.Group;
  private readonly debugLanding: THREE.Mesh;
  private readonly debugSkyTarget: THREE.Mesh;
  private readonly debugArc: THREE.Line;
  private readonly _fielderIdleLook = new THREE.Vector3();

  // ── Pure GLB mounts (no procedural geometry) ──────────────────────────────
  private readonly _batsmanMount: GlbMount;
  private readonly _bowlerMount: GlbMount;
  private readonly _fielderMounts: Array<{ mount: GlbMount; slot: FielderSlot }>;

  // Bowler ball — attached to GLB right hand bone after load
  private _bowlerBall: THREE.Mesh | null = null;
  // Batsman cricket bat — attached to GLB right hand bone after load
  private _batsmanBat: THREE.Group | null = null;

  // GLB overlay roots — tracked for dispose
  private readonly _glbRoots: THREE.Object3D[] = [];
  // GLB character instances (needed for clean swaps)
  private _batsmanInst: CharacterInstance | null = null;
  private readonly _bowlerPlayerId = 'meloni';
  private readonly _fielderInsts: (CharacterInstance | null)[] = [];
  // AnimationBrain — sole animation pipeline for bowler, batsman, and fielders.
  private readonly _animBrain = new AnimationBrain();
  // Scratch quaternion for bat vibration FX application
  private readonly _batVibrateQuat = new THREE.Quaternion();


  // Badge textures (debug only)
  private readonly fielderBadgeTextures: THREE.CanvasTexture[] = [];
  private readonly fielderBadgeMaterials: THREE.SpriteMaterial[] = [];

  private snapshot: EngineSnapshot | null = null;
  private _lastTime = 0;
  private _time = 0;
  // Edge tracker for HIT_FLASH gameBus emit (CSS overlay)
  private _lastSeenContactId = -1;
  private _hitFlashKey = 0;
  // Contact timing validation
  private _contactDeliveryCount = 0;
  private _contactMinError = Infinity;        // legacy Y-only (hand anchor)
  private _contactMinErrBall = Infinity;      // bat sweet-spot → actual ball (3D)
  private _contactMinErrTarget = Infinity;    // bat sweet-spot → predicted target (3D)
  private _contactMinPerp = Infinity;         // ball ⟂ distance to bat axis (diagnostic)
  private _contactDump: Record<string, unknown> | null = null;
  private _lastImpactCaptureId = 0;           // engine ballContactId — true impact event
  private _impactDump: Record<string, unknown> | null = null;
  // Debug spheres: red=ball, green=contactPointWorld, blue=bat blade sweet spot.
  // Toggle with `window.__anim.contactDebug = false`. Default on.
  private _contactDbg: { group: THREE.Group; ball: THREE.Mesh; target: THREE.Mesh; sweet: THREE.Mesh; contact: THREE.Mesh } | null = null;
  private _lastPredict: PredictDebug | null = null;
  private _prevBatsmanPhase = '';

  private _stadiumAtmoPrev: {
    outcome: EngineSnapshot['round']['outcome'];
    hitQuality: string;
    phase: string;
    ballElapsed: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, options: { debug?: boolean; batsmanAvatarId?: string } = {}) {
    this.debugEnabled = options.debug ?? false;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.gl.setSize(width, height);
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type    = THREE.PCFSoftShadowMap;

    this.assets = new DoodleAssets();
    this.scene = new Scene();
    this.cam = new Camera(width / height);

    // ── Post-processing pipeline (Crystal Gold bloom) ─────────────────────────
    // strength, radius, threshold tuned conservatively — bloom accents gold
    // floodlights / boundary glow / LED boards without washing out faces.
    this.composer = new EffectComposer(this.gl);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.composer.addPass(new RenderPass(this.scene.three, this.cam.three));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.22,  // strength (driven by multiplier in render())
      0.80,  // radius
      0.90,  // threshold — only very bright pixels bloom (daylight-safe, preserves faces)
    );
    this.composer.addPass(this.bloomPass);

    // Dev-only handles for inspecting the scene from the console (e.g. moving the
    // camera onto the batsman for a close-up to check the bat hold, which is far too
    // small to judge at the gameplay camera). `__renderOnce` forces a composite.
    if (typeof window !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as { __cam?: unknown }).__cam = this.cam.three;
      (window as { __scene?: unknown }).__scene = this.scene.three;
      (window as { __renderOnce?: () => void }).__renderOnce = () => this.composer.render();
    }

    this.stadium = new StadiumEntity(this.assets);
    this.ball = new BallEntity(this.assets);

    // ── Pure GLB mounts — minimal empty groups, no geometry ─────────────────
    this._batsmanMount = createGlbMount();
    this._bowlerMount  = createGlbMount();
    this._fielderMounts = FIELDER_SLOTS.map((slot, i) => {
      const mount = createGlbMount();
      mount.idlePhase      = i * 0.55;
      mount.fieldXJitter   = Math.cos(i * 2.419 + 0.7) * (isCloseFielderSlot(slot.name) ? 0.035 : 0.09);
      mount.fieldYawJitter = THREE.MathUtils.degToRad(Math.sin(i * 1.731 + 0.2) * 6);
      if (SHOW_FIELDER_NUMBERS) {
        const badge = createFielderNumberBadge(i + 1);
        this.fielderBadgeTextures.push(badge.texture);
        this.fielderBadgeMaterials.push(badge.sprite.material as THREE.SpriteMaterial);
        badge.sprite.position.set(0, 2.2, 0.08);
        mount.scaleGroup.add(badge.sprite);
      }
      return { mount, slot };
    });

    this.scene.add(this.stadium.root);
    this.scene.add(this._batsmanMount.root);
    this.scene.add(this._bowlerMount.root);
    for (const { mount } of this._fielderMounts) this.scene.add(mount.root);
    this.scene.add(this.ball.root);
    this.scene.add(this.contactSpark.root);

    this.debugRoot = new THREE.Group();
    this.debugRoot.visible = this.debugEnabled;
    this.debugLanding = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x2aff7b, transparent: true, opacity: 0.9 }),
    );
    this.debugSkyTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.9 }),
    );
    this.debugArc = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x54a9ff, transparent: true, opacity: 0.95 }),
    );
    this.debugRoot.add(this.debugLanding);
    this.debugRoot.add(this.debugSkyTarget);
    this.debugRoot.add(this.debugArc);
    this.scene.add(this.debugRoot);

    // Async: load GLB assets and attach to mounts
    void this._initGlbOverlays(options.batsmanAvatarId);
  }

  setSnapshot(snap: EngineSnapshot): void {
    this.snapshot = snap;
  }

  updateScoreboard(winAmount: number, multiplier: number, currencySym: string): void {
    this.stadium.updateScoreboard(winAmount, multiplier, currencySym);
  }

  render(): void {
    const now = performance.now() * 0.001;
    const dt = this._lastTime > 0 ? Math.min(now - this._lastTime, 0.05) : 0;
    this._lastTime = now;
    this.impactJuice.update(dt);
    const scaledDt = dt * this.impactJuice.timeScale;
    this._time += scaledDt;
    this.scene.updateEnvironment(this._time);

    const phaseForStadium = this.snapshot?.phase ?? GameState.IDLE;
    if (this.snapshot) this.updateStadiumAtmosphere(this.snapshot);
    this.stadium.updateAnimations(scaledDt, this.cam.three, phaseForStadium);

    if (!this.snapshot) {
      this.composer.render();
      return;
    }

    const { ball, bowler, feedback } = this.snapshot;

    // Pick trail color from snapshot context, then update ball
    this._selectTrailLook(this.snapshot);
    this.ball.update(ball, dt);
    this.contactSpark.update(scaledDt);
    const ballPos = ball.active
      ? new THREE.Vector3(ball.x, ball.y, ball.z)
      : new THREE.Vector3(0, 1.0, PITCH_MID_Z);

    const bowlerZ  = THREE.MathUtils.lerp(BOWLER_RUN_START_Z, BOWLER_RELEASE_Z, bowler.runT) - 0.4;
    const batsmanZ = BATSMAN_CREASE_Z;

    // ── Bowler position + yaw ─────────────────────────────────────────────────
    this._bowlerMount.root.position.set(0.14, 0, bowlerZ);
    setYawToTarget(this._bowlerMount.root, this._batsmanMount.root.position, 0.18, 0);
    this._bowlerMount.scaleGroup.scale.setScalar(getDepthScale(bowlerZ) * 1.44 * 1.02);

    // Show/hide the bowler ball based on bowling phase
    if (this._bowlerBall) {
      this._bowlerBall.visible = bowler.runT < 0.55;
    }

    // ── Batsman position + yaw ────────────────────────────────────────────────
    this._batsmanMount.root.position.set(0.12, 0, batsmanZ - 0.24);
    setYawToTarget(this._batsmanMount.root, this._bowlerMount.root.position, 0.2, 3 * Math.PI / 2);
    this._batsmanMount.scaleGroup.scale.setScalar(getDepthScale(batsmanZ) * 1.32 * 1.06);

    // ── Fielders ──────────────────────────────────────────────────────────────
    const batRoot = this._batsmanMount.root.position;
    for (let i = 0; i < this._fielderMounts.length; i++) {
      const { mount, slot } = this._fielderMounts[i];
      const fState = this.snapshot.fielders[i];

      const posX = fState.phase === 'idle' ? slot.x + (mount.fieldXJitter ?? 0) : fState.x;
      const posZ = fState.phase === 'idle' ? slot.z : fState.z;
      mount.root.position.set(posX, 0, posZ);

      if (fState.phase === 'chase') {
        setYawToTarget(mount.root, ballPos, 0.25, mount.fieldYawJitter ?? 0);
      } else {
        sampleFielderIdleLookPoint(slot.name, batRoot.x, batRoot.y, batRoot.z, this._fielderIdleLook);
        setYawToTarget(mount.root, this._fielderIdleLook, 0.14, mount.fieldYawJitter ?? 0);
      }

      mount.scaleGroup.scale.setScalar(
        getFielderDepthScale(posZ) * slot.silhouetteScale * 1.5 * broadcastHierarchyFielderScale(slot.name),
      );
    }

    this._updateGlbAnims(scaledDt);
    this.syncBonusObjects();
    this.syncSkyObject();
    this.syncFlyoverAircraft();
    this.syncDebugVisuals(ballPos);

    const activeBonusId = this.snapshot.activeBonusHit?.sourceId ?? null;
    if (activeBonusId && this._lastBonusHitId !== activeBonusId && this.snapshot.activeBonusHit) {
      this.impactJuice.triggerBonusImpact(this.snapshot.activeBonusHit.type, this.snapshot.activeBonusHit.worldPos);
      this._lastBonusHitId = activeBonusId;
    }
    if (!activeBonusId) this._lastBonusHitId = null;
    for (const [id, mesh] of this.bonusMeshes.entries()) {
      const bSnap = this.snapshot.bonusObjects.find((b) => b.id === id);
      if (bSnap) mesh.update(this._time, scaledDt, id === activeBonusId, bSnap);
    }

    // Fold AnimationBrain FX (camera impulse on release, recoil shake on contact)
    const batFx = this._animBrain.getBatsmanFx();
    const bowFx = this._animBrain.getBowlerFx();
    const fxShake = batFx.cameraShake + bowFx.cameraShake;
    const fxImpulse = bowFx.cameraImpulse + batFx.cameraImpulse;

    // Edge-trigger HIT_FLASH overlay + perfect-timing spark on contact
    const curContactId = this.snapshot.syncEvents.ballContactId;
    if (curContactId !== this._lastSeenContactId) {
      this._lastSeenContactId = curContactId;
      if (curContactId > 0) {
        const snap = this.snapshot;
        const outcome = snap.round.outcome;
        const m = snap.round.targetMult ?? 1;
        let intensity = 0.35;
        if (outcome === 'hit') {
          if (snap.batsman.shotType === 'loft' || m >= 8) intensity = 1.0;
          else if (m >= 3) intensity = 0.7;
          else if (m >= 1.4) intensity = 0.5;
          else intensity = 0.3;
        } else if (outcome === 'wicket') {
          intensity = 0.45;
        }
        this._hitFlashKey += 1;
        gameBus.emit('HIT_FLASH', { intensity, key: this._hitFlashKey });

        // Direct audio event — bypasses $effect latency
        gameBus.emit('HIT_AUDIO', { intensity, quality: snap.feedback.hitQuality ?? 'good', vx: snap.ball.vx });

        // V6: trigger ImpactJuice freeze+zoom+shake on every hit
        this.impactJuice.triggerHitImpact();

        // Impact camera: instant zoom punch + directional impulse toward shot
        this.cam.triggerContactImpact(snap.ball.vx);

        // Trail burst: brightens + lengthens trail streak for 150ms
        this.ball.burst(0.15);

        // Contact spark on all hits — scales with intensity
        this.contactSpark.trigger(snap.ball.x, snap.ball.y, snap.ball.z, intensity);
      }
    }

    const shake = {
      x: feedback.shakeOffset.x + this.impactJuice.shakeOffset.x,
      y: feedback.shakeOffset.y + this.impactJuice.shakeOffset.y + fxShake * (Math.random() - 0.5),
      z: feedback.shakeOffset.z + this.impactJuice.shakeOffset.z + fxImpulse,
    };
    this.cam.update(this.snapshot, shake, this.impactJuice.zoomOffset);
    this._syncBatToHand();

    // Constant, gentle bloom — no multiplier-reactive brightening/coloring of the arena.
    this.bloomPass.strength = 0.22;

    this.composer.render();
  }

  private updateStadiumAtmosphere(snap: EngineSnapshot): void {
    const prev = this._stadiumAtmoPrev;
    const curOutcome = snap.round.outcome;
    const curQ = snap.feedback.hitQuality ?? 'none';

    if (prev) {
      if (prev.outcome === null && curOutcome !== null) {
        if (curOutcome === 'wicket') {
          if (curQ === 'miss') this.stadium.onDeliverySpectacle('miss');
          else this.stadium.onDeliverySpectacle('wicket');
        } else if (curOutcome === 'hit') {
          const st = snap.batsman.shotType;
          if (st === 'loft') this.stadium.onDeliverySpectacle('six');
          else if (st === 'cut') this.stadium.onDeliverySpectacle('four');
          else if (st === 'pull') {
            const sixGuess = snap.round.targetMult >= 3.5;
            this.stadium.onDeliverySpectacle(sixGuess ? 'six' : 'four');
          }
          this.impactJuice.triggerHitImpact();
        }
      }
      if (
        prev.phase !== GameState.BOWLER_RUNUP &&
        snap.phase === GameState.BOWLER_RUNUP &&
        snap.round.ballNumber === 1
      ) {
        this.stadium.onSessionPlayStart();
      }
    }

    const exc = Math.min(1, Math.log(1 + Math.max(0, snap.round.cumulative)) / Math.log(24));
    this.stadium.setLivingExcitement(exc);

    this._stadiumAtmoPrev = {
      outcome: curOutcome,
      hitQuality: curQ,
      phase: snap.phase,
      ballElapsed: snap.ball.elapsed,
    };
  }

  resize(width: number, height: number): void {
    this.gl.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.cam.resize(width / height);
  }

  setAutobetFraming(active: boolean): void {
    this.cam.setSessionPullZ(active ? 2.35 : 0);
  }

  // ── Cricket bat factory ────────────────────────────────────────────────────

  /**
   * Build a cricket bat Group in the hand bone's local space.
   * Long axis = local Y (Mixamo right-hand bone Y ≈ finger-tip direction).
   * Grip tape at top (positive Y, inside hand), blade hangs below (negative Y).
   *
   * Tuning: adjust `g.position` / `g.rotation` here if the bat sits off-center
   * for a particular GLB rig.
   */
  private _createCricketBat(): THREE.Group {
    const g = new THREE.Group();

    // Origin = grip seat (sits in palm, BAT_GRIP_SEAT metres up from wrist).
    // +Y = bat knob end,  −Y = blade toe.
    // Local Z = face (+) / back (−).
    // BAT_SWEET_OFFSET (−0.50) and BAT_GRIP_SEAT (0.085) in batGeometry.ts are
    // tuned to this geometry — do not change those constants here.

    // Materials
    const gripMat   = new THREE.MeshStandardMaterial({ color: 0x0d0608, roughness: 0.98, metalness: 0.00 });
    const willowMat = new THREE.MeshStandardMaterial({ color: 0xf5d98a, roughness: 0.50, metalness: 0.03 });
    const spineMat  = new THREE.MeshStandardMaterial({ color: 0xe4c055, roughness: 0.64, metalness: 0.02 });
    const edgeMat   = new THREE.MeshStandardMaterial({ color: 0xdcb848, roughness: 0.62, metalness: 0.04 });

    // ── Knob — rounded stop that prevents the bat slipping ───────────────────
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), gripMat);
    knob.position.set(0, 0.13, 0);
    g.add(knob);

    // ── Grip tape — cylindrical rubberised wrap (y=-0.055 → y=+0.105) ────────
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.16, 8), gripMat);
    grip.position.set(0, 0.025, 0);
    g.add(grip);

    // ── Handle — narrow willow cane (y=-0.23 → y=-0.05) ─────────────────────
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.18, 8), willowMat);
    handle.position.set(0, -0.14, 0);
    g.add(handle);

    // ── Shoulder swell — tapers from handle (narrow) to blade (wide) ─────────
    // radiusTop (y=-0.23, handle side) = 0.013; radiusBottom (y=-0.31, blade side) = 0.048
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.048, 0.08, 10), willowMat);
    shoulder.position.set(0, -0.27, 0);
    g.add(shoulder);

    // ── Blade — three-layer construction (face / spine / side edges) ─────────
    // Blade body spans y=-0.31 (shoulder join) to y=-0.77 (toe).
    // Centre y=-0.54, height 0.46.  BAT_SWEET_OFFSET=-0.50 sits in the upper blade.
    const bladeH = 0.46;
    const bladeY = -0.54;

    // Face — bright light-willow front face; slightly raised toward viewer (+z)
    const bladeFace = new THREE.Mesh(new THREE.BoxGeometry(0.110, bladeH, 0.016), willowMat);
    bladeFace.position.set(0, bladeY, 0.014);
    g.add(bladeFace);

    // Spine ridge — narrower raised rib on the back; slightly darker amber
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.044, bladeH - 0.02, 0.030), spineMat);
    spine.position.set(0, bladeY, -0.015);
    g.add(spine);

    // Side edges — visible blade thickness; amber to catch stadium rim light
    const lEdge = new THREE.Mesh(new THREE.BoxGeometry(0.012, bladeH, 0.042), edgeMat);
    const rEdge = new THREE.Mesh(new THREE.BoxGeometry(0.012, bladeH, 0.042), edgeMat);
    lEdge.position.set(-0.055, bladeY, -0.003);
    rEdge.position.set( 0.055, bladeY, -0.003);
    g.add(lEdge);
    g.add(rEdge);

    // ── Toe cap — rounded base of the blade ──────────────────────────────────
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), willowMat);
    toe.position.set(0, -0.77, -0.003);
    g.add(toe);

    return g;
  }

  private _disposeBat(bat: THREE.Group): void {
    bat.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material])
          .forEach((m: THREE.Material) => m.dispose());
      }
    });
  }

  /**
   * Sync the world-space bat Group to the batsman's right-hand bone each frame.
   * Decomposing matrixWorld avoids inheriting the character's scale hierarchy,
   * so bat geometry stays at true metre scale regardless of GLB proportions.
   */
  private _syncBatToHand(): void {
    if (!this._batsmanBat || !this._batsmanInst) return;
    const rh = this._batsmanInst.bones.get('rightHand');
    if (!rh) {
      // Bone not resolved — log available bones once and show bat at a rough guard position
      // so orientation is still tunable from the screenshot.
      if (this._batsmanBat.visible === false) {
        const boneNames: string[] = [];
        this._batsmanInst.root.traverse(o => { if (o instanceof THREE.Bone) boneNames.push(o.name); });
        console.warn('[Renderer] rightHand bone not found. Available bones:', boneNames.join(', '));
        // Fallback: place bat at approximate right-hand position in front of the batsman
        const root = this._batsmanMount.root;
        this._batsmanBat.position.set(
          root.position.x + 0.20,
          root.position.y + 0.85,
          root.position.z + 0.05,
        );
        this._batsmanBat.quaternion.identity();
        this._batsmanBat.visible = true;
      }
      return;
    }
    rh.updateWorldMatrix(true, false);
    rh.matrixWorld.decompose(_tmpBatPos, _tmpBatQuat, _tmpBatScale);
    this._batsmanBat.quaternion.copy(_tmpBatQuat).multiply(BAT_QUAT_OFFSET);
    // Offset along bat handle (+Y after BAT_QUAT_OFFSET maps GLB Y → World -Y) so
    // the grip seats in the palm instead of floating at the wrist joint.
    this._batsmanBat.position
      .copy(_tmpBatPos)
      .addScaledVector(
        _tmpBatScale.set(0, 1, 0).applyQuaternion(this._batsmanBat.quaternion),
        BAT_GRIP_SEAT,
      );

    // NB: body clearance is applied by moving the right HAND (BatTargetIK
    // .solveRightGripPost), not by offsetting the bat here — the bat is rigidly
    // parented to the hand, so it follows automatically and both hands stay on the
    // handle. Offsetting the mesh directly would detach the bottom hand.

    // FX bus contributes a short bat-vibration ring after contact (L7)
    const fx = this._animBrain.getBatsmanFx();
    if (fx.batVibration !== 0) {
      batVibrationQuat(fx.batVibration, this._batVibrateQuat);
      this._batsmanBat.quaternion.multiply(this._batVibrateQuat);
    }

    // ── Contact accuracy — bat SWEET SPOT (not the wrist) vs ball / target ──────
    // The wrist bone sits ~0.4m from the bat sweet spot, so any hand-based metric
    // is an anatomical constant, not contact accuracy. We measure the real bat:
    // sweetSpot = bat origin (grip) + 0.468m up the blade (length 0.72 × 0.65).
    if (this.snapshot) {
      const curPhase = this.snapshot.batsmanFSM.phase;

      // Live debug spheres so the spatial divergence is visible, not just logged
      this._updateContactDebug();

      // ── TRUE IMPACT FRAME ───────────────────────────────────────────────────
      // The engine fires onContact (ballContactId++) and immediately relaunches
      // the ball on its post-hit trajectory (GameEngine resolveSwing). This is the
      // ONLY frame where "did the bat meet the ball" is even askable. Capture the
      // bat sweet spot vs the ball at exactly this instant.
      const cid = this.snapshot.syncEvents.ballContactId;
      if (cid !== this._lastImpactCaptureId) {
        this._lastImpactCaptureId = cid;
        const sie  = this.snapshot.syncEvents;
        const live = this.snapshot.ball;
        // TRUE contact position (latched pre-relaunch), NOT the departing live ball.
        _ballPos.set(sie.contactBallX, sie.contactBallY, sie.contactBallZ);
        _batUp.set(0, 1, 0).applyQuaternion(this._batsmanBat.quaternion).normalize();
        const grip = this._batsmanBat.position;
        _vBallGrip.subVectors(_ballPos, grip);
        const axisT = _vBallGrip.dot(_batUp);
        _closestOnBat.copy(grip).addScaledVector(_batUp, axisT);
        const perp = _ballPos.distanceTo(_closestOnBat);
        _sweetSpot.copy(grip).addScaledVector(_batUp, BAT_SWEET_OFFSET);
        const cp = this.snapshot.contactSolution?.contactPointWorld ?? null;
        // predErr = how far the PLANNER's target is from the real contact point.
        const predErr = cp ? _ballPos.distanceTo(_scratch.set(cp.x, cp.y, cp.z)) : null;
        this._impactDump = {
          contactId:    cid,
          shot:         this.snapshot.batsman.shotType,
          fsmPhase:     curPhase,                                   // should be CONTACT if timed
          fsmProgress:  _round3(this.snapshot.batsmanFSM.progress),
          contactBall:  [_round3(sie.contactBallX), _round3(sie.contactBallY), _round3(sie.contactBallZ)],
          liveBall:     [_round3(live.x), _round3(live.y), _round3(live.z)],  // post-relaunch (departing)
          contactPoint: cp ? [_round3(cp.x), _round3(cp.y), _round3(cp.z)] : null,
          grip:         [_round3(grip.x), _round3(grip.y), _round3(grip.z)],
          sweet:        [_round3(_sweetSpot.x), _round3(_sweetSpot.y), _round3(_sweetSpot.z)], // blade @ contact frame
          axisT_m:      _round3(axisT),
          perpDist_m:   _round3(perp),
          sweetToBall_m: _round3(_sweetSpot.distanceTo(_ballPos)),  // blade → true contact pos (overall)
          predErr_m:    predErr === null ? null : _round3(predErr), // contactPoint → true contact pos (planner)
        };
        if (typeof window !== 'undefined') {
          (window as any).__anim ??= {};
          (window as any).__anim.lastImpactDump = this._impactDump;
          (window as any).__anim.dumpImpactFrame = () => (window as any).__anim.lastImpactDump;
        }
        console.log('[IMPACT]', this._impactDump);
      }

      // Detect CONTACT entry — reset all minima
      if (this._prevBatsmanPhase !== 'CONTACT' && curPhase === 'CONTACT') {
        this._contactMinError     = Infinity;
        this._contactMinErrBall   = Infinity;
        this._contactMinErrTarget = Infinity;
        this._contactMinPerp      = Infinity;
        this._contactDeliveryCount += 1;
      }
      // Every frame during CONTACT — track minimum distances (closest approach).
      // Reference = the LATCHED true contact position (constant through the phase),
      // not the live ball which has already been relaunched and is departing.
      if (curPhase === 'CONTACT') {
        const sie = this.snapshot.syncEvents;
        _ballPos.set(sie.contactBallX, sie.contactBallY, sie.contactBallZ);

        // Legacy Y-only metric (hand anchor) — kept for animDebug continuity
        const yErr = sie.contactBallY - _tmpBatPos.y;
        if (yErr < this._contactMinError) this._contactMinError = yErr;

        // Bat axis in world space (unit). grip = bat origin (this._batsmanBat.position).
        _batUp.set(0, 1, 0).applyQuaternion(this._batsmanBat.quaternion).normalize();
        const grip = this._batsmanBat.position;

        // Bat sweet spot — blade side (local −Y), see BAT_SWEET_OFFSET
        _sweetSpot.copy(grip).addScaledVector(_batUp, BAT_SWEET_OFFSET);
        const errBall = _sweetSpot.distanceTo(_ballPos);
        if (errBall < this._contactMinErrBall) this._contactMinErrBall = errBall;

        const cs = this.snapshot.contactSolution;
        if (cs) {
          const cp = cs.contactPointWorld;
          _scratch.set(cp.x, cp.y, cp.z);
          const errTarget = _sweetSpot.distanceTo(_scratch);
          if (errTarget < this._contactMinErrTarget) this._contactMinErrTarget = errTarget;
        }

        // ── DIAGNOSTIC: project ball onto the infinite bat axis ────────────────
        // axisT = signed metres from grip along batUp to the point nearest the ball.
        // perpDist = how far the ball is off the bat line. This is direction- and
        // offset-agnostic: it reveals WHERE on the bat the ball is and whether the
        // bat is even near it. Captured at the frame of closest approach (≈ impact).
        _vBallGrip.subVectors(_ballPos, grip);
        const axisT = _vBallGrip.dot(_batUp);
        _closestOnBat.copy(grip).addScaledVector(_batUp, axisT);
        const perp = _ballPos.distanceTo(_closestOnBat);
        if (perp < this._contactMinPerp) {
          this._contactMinPerp = perp;
          const cp = cs?.contactPointWorld ?? null;
          const predErr = cp ? _ballPos.distanceTo(_scratch.set(cp.x, cp.y, cp.z)) : null;
          this._contactDump = {
            delivery:        this._contactDeliveryCount,
            shot:            this.snapshot.batsman.shotType,
            contactBall:     [_round3(sie.contactBallX), _round3(sie.contactBallY), _round3(sie.contactBallZ)],
            contactPoint:    cp ? [_round3(cp.x), _round3(cp.y), _round3(cp.z)] : null,
            hand:            [_round3(_tmpBatPos.x), _round3(_tmpBatPos.y), _round3(_tmpBatPos.z)],
            grip:            [_round3(grip.x), _round3(grip.y), _round3(grip.z)],
            batUp:           [_round3(_batUp.x), _round3(_batUp.y), _round3(_batUp.z)],
            axisT_m:         _round3(axisT),   // where ON the bat the ball is (0=grip, −=blade)
            perpDist_m:      _round3(perp),    // ⟂ distance ball→bat line (the real "miss")
            sweetToBall_m:   _round3(errBall), // blade sweet spot → true contact pos (overall)
            predErr_m:       predErr === null ? null : _round3(predErr), // contactPoint → true contact pos (planner)
          };
        }
      }
      // Detect CONTACT exit — log + feed telemetry
      if (this._prevBatsmanPhase === 'CONTACT' && curPhase !== 'CONTACT') {
        const sie = this.snapshot.syncEvents;
        const bfme = this.snapshot.batsmanFSM;
        const fmt = (n: number) => n.toFixed(4);
        const errBall   = Number.isFinite(this._contactMinErrBall)   ? this._contactMinErrBall   : 0;
        const errTarget = Number.isFinite(this._contactMinErrTarget) ? this._contactMinErrTarget : 0;
        const dump = this._contactDump;
        const axisT   = dump ? (dump.axisT_m as number) : NaN;
        const predErr = dump && dump.predErr_m != null ? (dump.predErr_m as number) : NaN;
        console.log(
          `[CONTACT] #${this._contactDeliveryCount}  ` +
          `vsBall=${fmt(errBall)}  vsTarget=${fmt(errTarget)}  predErr=${fmt(predErr)}  ` +
          `perp=${fmt(this._contactMinPerp)}  axisT=${fmt(axisT)}  ` +
          `shot=${this.snapshot.batsman.shotType}`
        );
        // Renderer is the only place with the real bat mesh — feed telemetry here
        anim_telemetry.setContactError(errBall, errTarget);
        if (typeof window !== 'undefined') {
          (window as any).__anim ??= {};
          (window as any).__anim.lastContactError = errBall;
          (window as any).__anim.lastContactDump  = dump;
          (window as any).__anim.dumpLastContact  = () => (window as any).__anim.lastContactDump;
        }
        animDebug.contactDeliveryId = this._contactDeliveryCount;
        animDebug.contactHeightError = this._contactMinError;
        animDebug.contactBatsmanPhase = curPhase;
        animDebug.contactBatsmanProgress = bfme.progress;
        animDebug.contactBallVelY = this.snapshot.ball.vy;
        animDebug.contactBounceCount = this.snapshot.ball.bounce;
        animDebug.contactLog = animDebug.contactLog.concat([{
          deliveryId: this._contactDeliveryCount,
          ballY: sie.contactBallY,
          batY: 0,
          heightError: this._contactMinError,
          ballVelY: this.snapshot.ball.vy,
          bounceCount: this.snapshot.ball.bounce,
        }]);
      }
      this._prevBatsmanPhase = curPhase;
    }

    this._batsmanBat.visible = true;
  }

  /**
   * Update (lazily create) the contact-debug spheres so the spatial relationship
   * between ball / IK target / bat sweet spot is visible in-scene:
   *   red   = actual ball world position
   *   green = contactSolution.contactPointWorld (the IK aim point)
   *   blue  = bat blade sweet spot (grip + BAT_SWEET_OFFSET·batUp)
   * Toggle via `window.__anim.contactDebug = false`. Rendered on top (no depth test).
   */
  private _updateContactDebug(): void {
    if (!this._batsmanBat || !this.snapshot) return;
    const on = typeof window === 'undefined'
      ? false
      : (((window as any).__anim?.contactDebug ?? true) as boolean);

    if (!this._contactDbg) {
      if (!on) return;
      const mk = (color: number): THREE.Mesh => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 12, 8),
          new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
        );
        m.renderOrder = 999;
        return m;
      };
      const group  = new THREE.Group();
      const ball   = mk(0xff2222);  // red    — live ball (departs after contact)
      const target = mk(0x22ff22);  // green  — planner target (contactPointWorld)
      const sweet  = mk(0x2266ff);  // blue   — bat blade sweet spot (tracks the bat)
      const contact = mk(0xffff00); // yellow — latched TRUE contact position (persists)
      group.add(ball, target, sweet, contact);
      this.scene.three.add(group);
      this._contactDbg = { group, ball, target, sweet, contact };
    }

    const dbg = this._contactDbg;
    dbg.group.visible = on;
    if (!on) return;

    const b = this.snapshot.ball;
    dbg.ball.position.set(b.x, b.y, b.z);
    dbg.ball.visible = b.active;

    _batUp.set(0, 1, 0).applyQuaternion(this._batsmanBat.quaternion).normalize();
    const grip = this._batsmanBat.position;
    dbg.sweet.position.copy(grip).addScaledVector(_batUp, BAT_SWEET_OFFSET);

    const cs = this.snapshot.contactSolution;
    if (cs) {
      dbg.target.position.set(cs.contactPointWorld.x, cs.contactPointWorld.y, cs.contactPointWorld.z);
      dbg.target.visible = true;
    } else {
      dbg.target.visible = false;
    }

    // Yellow: the latched TRUE contact position (persists after contact so the
    // blue-vs-yellow gap = the real bat-to-ball miss is visible at rest).
    const sie = this.snapshot.syncEvents;
    dbg.contact.position.set(sie.contactBallX, sie.contactBallY, sie.contactBallZ);
    dbg.contact.visible = sie.ballContactId > 0;

    // dumpBat(): proves the bat sweet spot is a real 0.50m off the grip (not "≈ grip").
    if (typeof window !== 'undefined') {
      (window as any).__anim ??= {};
      const gripA  = [_round3(grip.x), _round3(grip.y), _round3(grip.z)];
      const sweetA = [_round3(dbg.sweet.position.x), _round3(dbg.sweet.position.y), _round3(dbg.sweet.position.z)];
      const g2s    = _round3(grip.distanceTo(dbg.sweet.position));
      const inst = this._batsmanInst;
      (window as any).__anim.dumpBat = () => {
        const lh = inst?.bones.get('leftHand');
        const rh2 = inst?.bones.get('rightHand');
        const la = inst?.bones.get('leftArm');
        const lfa = inst?.bones.get('leftForeArm');
        const lp = new THREE.Vector3(), rp = new THREE.Vector3();
        if (lh) lh.getWorldPosition(lp);
        if (rh2) rh2.getWorldPosition(rp);
        const lap = la ? [_round3(la.rotation.x), _round3(la.rotation.y), _round3(la.rotation.z)] : null;
        const lfar = lfa ? [_round3(lfa.rotation.x), _round3(lfa.rotation.y), _round3(lfa.rotation.z)] : null;
        const lhInChain = lh && la && lh.parent === lfa && lfa.parent === la;
        return {
          leftArmRot: lap, leftForeArmRot: lfar, lhChainOk: lhInChain,
          grip: gripA, sweet: sweetA, gripToSweet_m: g2s,
          batUp: [_round3(_batUp.x), _round3(_batUp.y), _round3(_batUp.z)],
          leftHand: lh ? [_round3(lp.x), _round3(lp.y), _round3(lp.z)] : null,
          rightHand: rh2 ? [_round3(rp.x), _round3(rp.y), _round3(rp.z)] : null,
          leftHandToGrip_m: lh ? _round3(lp.distanceTo(grip)) : null,
          handGap_m: lh && rh2 ? _round3(lp.distanceTo(rp)) : null,
        };
      };
      // dumpPredict(): the exact inputs BallPredictor used for the last delivery.
      // Cache it — contactSolution is cleared between overs, so reading it live
      // returns null; the cache persists so the call always has data.
      const predictDbg = this.snapshot?.contactSolution?.debug;
      if (predictDbg) this._lastPredict = predictDbg;
      (window as any).__anim.dumpPredict = () => this._lastPredict ?? null;
    }
  }

  /**
   * Load GLB character models and attach them to the minimal GlbMount containers.
   * This is the sole rendering path — no procedural fallback meshes.
   */
  private async _initGlbOverlays(batsmanAvatarId?: string): Promise<void> {
    // Kick off the bonus-prop GLBs without blocking — character attachment must not
    // wait for the (large) rover/spider/aircraft downloads. syncBonusObjects renders a
    // procedural placeholder immediately and swaps to each GLB the moment it loads.
    // (CricketSimulation also starts this at mount; preload() is idempotent.)
    void bonusGLBAssets.preload();

    type PlayerId = Parameters<typeof instantiateCharacter>[0];

    const fitAndAttach = async (
      mount: GlbMount,
      playerId: PlayerId,
      targetH = 1.6,
    ): Promise<{ inst: CharacterInstance } | null> => {
      try {
        await preloadCharacter(playerId);
      } catch (e) {
        console.error(`[Renderer] Failed to load character "${playerId}":`, e);
        return null;
      }
      const inst = instantiateCharacter(playerId);
      if (!inst) { console.error(`[Renderer] instantiateCharacter("${playerId}") returned null`); return null; }

      // Box3.setFromObject uses buffer geometry positions (bind pose), not skinned positions.
      // For SkinnedMesh the bounding box can only be computed from geometry directly.
      let h = 0;
      inst.root.traverse(obj => {
        if (obj instanceof THREE.SkinnedMesh && h === 0) {
          const geo = obj.geometry;
          if (!geo.boundingBox) geo.computeBoundingBox();
          if (geo.boundingBox) h = geo.boundingBox.max.y - geo.boundingBox.min.y;
        }
      });
      // Fallback to Box3 if no skinned mesh found
      if (h <= 0.01) {
        const box = new THREE.Box3().setFromObject(inst.root);
        h = box.max.y - box.min.y;
      }
      const s = h > 0.01 ? targetH / h : 1.0;
      inst.root.scale.setScalar(s);
      // Ground the character: lift so feet sit at y=0
      inst.root.position.set(0, 0, 0);
      const floatBox = new THREE.Box3().setFromObject(inst.root);
      inst.root.position.set(0, -floatBox.min.y, 0);

      console.log(`[Renderer] "${playerId}" h=${h.toFixed(3)} scale=${s.toFixed(3)} yOffset=${inst.root.position.y.toFixed(3)} bones=${inst.bones.size}`);

      mount.scaleGroup.add(inst.root);
      this._glbRoots.push(inst.root);

      return { inst };
    };

    const batsmanId = ((batsmanAvatarId && batsmanAvatarId in { modi:1, trump:1, putin:1, adeft:1, kimjong:1 })
      ? batsmanAvatarId
      : 'modi') as PlayerId;

    const [bat, bowl, ...fields] = await Promise.allSettled([
      fitAndAttach(this._batsmanMount, batsmanId),
      fitAndAttach(this._bowlerMount, 'meloni'),
      ...this._fielderMounts.map(({ mount }) => fitAndAttach(mount, 'ronaldo')),
    ]).then(results => results.map(r => {
      if (r.status === 'rejected') { console.error('[Renderer] fitAndAttach rejected:', r.reason); return null; }
      return r.value;
    }));

    if (bat) {
      this._batsmanInst = bat.inst;
      this._animBrain.setBatsman({
        instance: bat.inst,
        root:     this._batsmanMount.root,
        playerId: batsmanId,
      });
      // Bat lives in world space; synced to hand bone every frame via _syncBatToHand()
      this._batsmanBat = this._createCricketBat();
      this._batsmanBat.visible = false; // hidden until first sync confirms hand bone exists
      this.scene.three.add(this._batsmanBat);
    }

    if (bowl) {
      this._animBrain.setBowler({
        instance: bowl.inst,
        root:     this._bowlerMount.root,
        playerId: this._bowlerPlayerId,
      });
      // Wire the bowler ball to the GLB's actual right hand bone
      const handBone = bowl.inst.bones.get('rightHand');
      if (handBone) {
        const bBallGeo = new THREE.SphereGeometry(0.044, 12, 8);
        const bBallMat = new THREE.MeshStandardMaterial({ color: 0xcc2020, roughness: 0.72, metalness: 0.0 });
        this._bowlerBall = new THREE.Mesh(bBallGeo, bBallMat);
        this._bowlerBall.position.set(0.01, -0.06, 0.05);
        handBone.add(this._bowlerBall);
      }
    }

    for (let i = 0; i < fields.length; i++) {
      this._fielderInsts[i] = fields[i]?.inst ?? null;
      const inst = fields[i]?.inst;
      if (inst) {
        const slotName = this._fielderMounts[i]?.slot.name ?? '';
        this._animBrain.setFielder(i, {
          instance: inst,
          root:     this._fielderMounts[i].mount.root,
          playerId: 'ronaldo',
        }, fielderStanceClassForName(slotName));
      }
    }

    // Swap batsman GLB when difficulty changes
    gameBus.on('DIFFICULTY_CHANGED', async ({ batsman: newId }) => {
      if (!newId) return;
      const bid = newId as PlayerId;
      if (this._batsmanInst) {
        this._batsmanMount.scaleGroup.remove(this._batsmanInst.root);
        const idx = this._glbRoots.indexOf(this._batsmanInst.root);
        if (idx >= 0) this._glbRoots.splice(idx, 1);
      }
      // Unbind brain from old batsman before old instance is collected
      this._animBrain.setBatsman(null);
      // Dispose old bat (it was parented to the old hand bone, now removed)
      if (this._batsmanBat) {
        this.scene.three.remove(this._batsmanBat);
        this._disposeBat(this._batsmanBat);
        this._batsmanBat = null;
      }
      const result = await fitAndAttach(this._batsmanMount, bid);
      if (result) {
        this._batsmanInst = result.inst;
        this._animBrain.setBatsman({
          instance: result.inst,
          root:     this._batsmanMount.root,
          playerId: bid,
        });
        this._batsmanBat = this._createCricketBat();
        this._batsmanBat.visible = false;
        this.scene.three.add(this._batsmanBat);
      }
    });

    // Swap all fielder GLBs on insurance/bonus-buy activation (ronaldo ↔ kimjong)
    gameBus.on('FIELDER_SWAP', async ({ to }) => {
      const newId = (to as PlayerId) ?? 'ronaldo';
      for (let i = 0; i < this._fielderMounts.length; i++) {
        const { mount } = this._fielderMounts[i];
        const oldInst = this._fielderInsts[i];
        if (oldInst) {
          mount.scaleGroup.remove(oldInst.root);
          const idx = this._glbRoots.indexOf(oldInst.root);
          if (idx >= 0) this._glbRoots.splice(idx, 1);
        }
        this._animBrain.setFielder(i, null);
        const result = await fitAndAttach(mount, newId);
        this._fielderInsts[i] = result?.inst ?? null;
        if (result?.inst) {
          const slotName = this._fielderMounts[i]?.slot.name ?? '';
          this._animBrain.setFielder(i, {
            instance: result.inst,
            root:     mount.root,
            playerId: newId,
          }, fielderStanceClassForName(slotName));
        }
      }
    });
  }

  /** Map snapshot context → ball trail color/opacity/boost. Called per-frame. */
  private _selectTrailLook(snap: EngineSnapshot): void {
    const outcome = snap.round.outcome;
    const m       = snap.round.targetMult ?? 1;
    const shot    = snap.batsman.shotType;

    if (outcome === 'hit') {
      // six → gold boosted; four → cyan; runs → soft mint; small/dot → dim
      const isSix = shot === 'loft' || m >= 8;
      if (isSix)               return this.ball.setTrailLook(0xffd24a, 0.95, true);
      if (shot === 'cut' || m >= 4) return this.ball.setTrailLook(0x40e0ff, 0.80, false);
      if (m >= 1.4)            return this.ball.setTrailLook(0xb8ffd2, 0.65, false);
      return this.ball.setTrailLook(0x9aa2b3, 0.45, false);
    }
    if (outcome === 'wicket') {
      return this.ball.setTrailLook(0xff5b5b, 0.75, false);
    }
    // Pre-hit — color by bowler type
    switch (snap.bowler.bowlerType) {
      case 'Fast':  return this.ball.setTrailLook(0x40e0ff, 0.55, false);
      case 'Spin':  return this.ball.setTrailLook(0xffb540, 0.55, false);
      case 'Swing': return this.ball.setTrailLook(0x66ffd0, 0.55, false);
      default:      return this.ball.setTrailLook(0xffcdd2, 0.50, false);
    }
  }

  private _updateGlbAnims(dt: number): void {
    if (!this.snapshot) return;
    const { ball } = this.snapshot;

    // ── All characters driven by AnimationBrain (Phases 1-3) ────────────────
    const ballWorld = ball.active
      ? new THREE.Vector3(ball.x, ball.y, ball.z)
      // Ball idle → bowler + batsman + fielders still need a target so heads stay oriented
      : new THREE.Vector3(0, 1.0, 0);
    this._animBrain.update(this.snapshot, dt, ballWorld);

    // Apply batsman trigger-step delta on the mount root Z.
    // Renderer.render() already set the base batsman position; add the L0 offset.
    if (this._animBrain.batsmanRootZ !== 0) {
      this._batsmanMount.root.position.z += this._animBrain.batsmanRootZ;
    }
  }

  dispose(): void {
    this._glbRoots.length = 0;
    this._batsmanInst = null;
    this._fielderInsts.length = 0;
    if (this._batsmanBat) {
      this.scene.three.remove(this._batsmanBat);
      this._disposeBat(this._batsmanBat);
      this._batsmanBat = null;
    }
    if (this._bowlerBall) {
      this._bowlerBall.geometry.dispose();
      (this._bowlerBall.material as THREE.Material).dispose();
      this._bowlerBall = null;
    }
    this.gl.dispose();
    this.ball.dispose();
    this.stadium.dispose();
    for (const mat of this.fielderBadgeMaterials) mat.dispose();
    for (const tex of this.fielderBadgeTextures) tex.dispose();
    for (const mesh of this.bonusMeshes.values()) mesh.dispose();
    this.bonusMeshes.clear();
    if (this.skyMesh) {
      this.scene.three.remove(this.skyMesh.root);
      this.skyMesh.dispose();
      this.skyMesh = null;
      this._lastSkyId = null;
    }
    for (const mesh of this._flyoverMeshes.values()) {
      this.scene.three.remove(mesh.root);
      mesh.dispose();
    }
    this._flyoverMeshes.clear();
    this.debugLanding.geometry.dispose();
    (this.debugLanding.material as THREE.Material).dispose();
    this.debugSkyTarget.geometry.dispose();
    (this.debugSkyTarget.material as THREE.Material).dispose();
    this.debugArc.geometry.dispose();
    (this.debugArc.material as THREE.Material).dispose();
    this.assets.dispose();
  }

  private syncSkyObject(): void {
    if (!this.snapshot) return;
    const s = this.snapshot.skyObject;
    if (s) {
      if (!this.skyMesh || this._lastSkyId !== s.id) {
        if (this.skyMesh) {
          this.scene.three.remove(this.skyMesh.root);
          this.skyMesh.dispose();
        }
        this.skyMesh = new SkyObject3D(s);
        this._lastSkyId = s.id;
        this.scene.add(this.skyMesh.root);
      }
      this.skyMesh.update(s, this._time);
    } else if (this.skyMesh) {
      this.scene.three.remove(this.skyMesh.root);
      this.skyMesh.dispose();
      this.skyMesh = null;
      this._lastSkyId = null;
    }
  }

  private syncFlyoverAircraft(): void {
    if (!this.snapshot) return;
    const activeIds = new Set<string>();

    for (const s of this.snapshot.flyoverAircrafts) {
      if (!s) continue;
      activeIds.add(s.id);
      let mesh = this._flyoverMeshes.get(s.id);
      if (!mesh) {
        mesh = new SkyObject3D(s);
        this._flyoverMeshes.set(s.id, mesh);
        this.scene.add(mesh.root);
      }
      mesh.update(s, this._time);
      mesh.root.rotation.y = (s.headingY ?? 0) + Math.sin(this._time * 0.7) * 0.02;
    }

    // Remove meshes whose lane is no longer active
    for (const [id, mesh] of this._flyoverMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.three.remove(mesh.root);
        mesh.dispose();
        this._flyoverMeshes.delete(id);
      }
    }
  }

  private syncBonusObjects(): void {
    if (!this.snapshot) return;
    const nextIds = new Set(this.snapshot.bonusObjects.map((b) => b.id));
    for (const bonus of this.snapshot.bonusObjects) {
      const existing = this.bonusMeshes.get(bonus.id);
      if (existing) {
        // Upgrade a procedural placeholder to its real GLB once that specific asset
        // has finished loading — one slow asset never blocks the others.
        if (existing.needsGlbUpgrade && existing.glbKey && bonusGLBAssets.isLoaded(existing.glbKey)) {
          this.scene.three.remove(existing.root);
          existing.dispose();
          const upgraded = new BonusObject3D(bonus);
          this.bonusMeshes.set(bonus.id, upgraded);
          this.scene.add(upgraded.root);
        }
        continue;
      }
      const node = new BonusObject3D(bonus);
      this.bonusMeshes.set(bonus.id, node);
      this.scene.add(node.root);
    }
    for (const [id, node] of this.bonusMeshes.entries()) {
      if (nextIds.has(id)) continue;
      this.scene.three.remove(node.root);
      node.dispose();
      this.bonusMeshes.delete(id);
    }
  }

  private syncDebugVisuals(ballPos: THREE.Vector3): void {
    if (!this.snapshot || !this.debugEnabled) return;
    const landing = this.snapshot.ball.predictedLanding;
    this.debugLanding.visible = !!landing;
    if (landing) this.debugLanding.position.set(landing.x, 0.12, landing.z);

    const sky = this.snapshot.skyObject;
    this.debugSkyTarget.visible = !!sky;
    if (sky) this.debugSkyTarget.position.set(sky.position.x, sky.position.y, sky.position.z);

    const pts: THREE.Vector3[] = [];
    if (landing) {
      const end = new THREE.Vector3(landing.x, 0.12, landing.z);
      const mid = ballPos.clone().lerp(end, 0.5);
      mid.y += 1.2;
      pts.push(ballPos.clone(), mid, end);
    } else if (sky) {
      const end = new THREE.Vector3(sky.position.x, sky.position.y, sky.position.z);
      const mid = ballPos.clone().lerp(end, 0.5);
      mid.y += 1.2;
      pts.push(ballPos.clone(), mid, end);
    }
    this.debugArc.visible = pts.length > 1;
    if (pts.length > 1) this.debugArc.geometry.setFromPoints(pts);
  }
}
