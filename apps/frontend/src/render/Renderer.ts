import * as THREE from 'three';
import type { EngineSnapshot } from '../engine/GameEngine.js';
import { GameState } from '../engine/state/StateMachine.js';
import type { FielderSlot } from '../engine/worldLayout.js';
import {
  BATSMAN_CREASE_Z,
  BOWLER_RELEASE_Z,
  BOWLER_RUN_START_Z,
  FIELDER_SLOTS,
  fielderStanceClassForName,
  broadcastHierarchyFielderScale,
  getDepthScale,
  getFielderDepthScale,
  PITCH_MID_Z,
  sampleFielderIdleLookPoint,
} from '../engine/worldLayout.js';
import type { SimPhase } from '../engine/physics/ballTrajectory.js';
import { HumanCharacter } from '../characters/human/HumanCharacter.js';
import {
  animateHumanBatsman,
  animateHumanBowler,
  animateHumanFielder,
  type AnimatorInput,
} from '../characters/human/HumanAnimator.js';
import { BatsmanController } from '../characters/human/controllers/BatsmanController.js';
import { BowlerController }  from '../characters/human/controllers/BowlerController.js';
import { FielderController } from '../characters/human/controllers/FielderController.js';
import { HumanLOD }          from '../characters/human/lod/HumanLOD.js';
import { DoodleAssets } from './doodle/DoodleAssets.js';
import { Scene } from './Scene.js';
import { Camera } from './Camera.js';
import { BallEntity } from './entities/Ball.js';
import { StadiumEntity } from './entities/Stadium.js';
import { BonusObject3D } from './entities/BonusObject3D.js';
import { SkyObject3D } from './entities/SkyObject3D.js';
import { ImpactJuice } from './effects/ImpactJuice.js';
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
  private readonly scene: Scene;
  private readonly cam: Camera;
  private readonly assets: DoodleAssets;
  private readonly ball: BallEntity;
  private readonly batsmanChar: HumanCharacter;
  private readonly bowlerChar: HumanCharacter;
  private readonly fielders: Array<{ char: HumanCharacter; slot: FielderSlot; ctrl: FielderController; lod: HumanLOD }>;
  private readonly batsmanCtrl: BatsmanController;
  private readonly bowlerCtrl:  BowlerController;
  private readonly batsmanLOD: HumanLOD;
  private readonly bowlerLOD:  HumanLOD;
  private readonly _bowlerBall: THREE.Mesh;
  private readonly stadium: StadiumEntity;
  private readonly impactJuice = new ImpactJuice();
  private readonly fielderBadgeTextures: THREE.CanvasTexture[] = [];
  private readonly fielderBadgeMaterials: THREE.SpriteMaterial[] = [];
  private readonly bonusMeshes = new Map<string, BonusObject3D>();
  private _lastBonusHitId: string | null = null;
  private skyMesh: SkyObject3D | null = null;
  private _lastSkyId: string | null = null;
  private readonly debugEnabled: boolean;
  private readonly debugRoot: THREE.Group;
  private readonly debugLanding: THREE.Mesh;
  private readonly debugSkyTarget: THREE.Mesh;
  private readonly debugArc: THREE.Line;
  private readonly _fielderIdleLook = new THREE.Vector3();

  private snapshot: EngineSnapshot | null = null;
  private _lastTime = 0;
  private _time = 0;

  /** Prior frame snapshot slice for stadium LED / crowd spectacle edge triggers. */
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
    // M7: enable shadow map for close characters (batsman/bowler).
    // Fielders rely on the ContactShadow plane instead — bounded cost.
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type    = THREE.PCFSoftShadowMap;

    this.assets = new DoodleAssets();
    this.scene = new Scene();
    this.cam = new Camera(width / height);

    this.stadium = new StadiumEntity(this.assets);
    this.bowlerChar  = new HumanCharacter('bowler');
    this.batsmanChar = new HumanCharacter('batsman', options.batsmanAvatarId);
    this.ball = new BallEntity(this.assets);

    const bBallGeo = new THREE.SphereGeometry(0.044, 12, 8);
    const bBallMat = new THREE.MeshStandardMaterial({ color: 0xcc2020, roughness: 0.72, metalness: 0.0 });
    this._bowlerBall = new THREE.Mesh(bBallGeo, bBallMat);
    this._bowlerBall.position.set(0.01, -0.06, 0.05);
    this.bowlerChar.bones.handR.add(this._bowlerBall);

    this.batsmanCtrl = new BatsmanController(this.batsmanChar);
    this.bowlerCtrl  = new BowlerController(this.bowlerChar);
    this.batsmanLOD  = new HumanLOD(this.batsmanChar);
    this.bowlerLOD   = new HumanLOD(this.bowlerChar);

    this.scene.add(this.stadium.root);
    this.scene.add(this.bowlerChar.root);
    this.scene.add(this.batsmanChar.root);
    const stanceForIdx = ['crouch', 'athletic', 'deep', 'lean'] as const;
    this.fielders = FIELDER_SLOTS.map((slot, i) => {
      const char = new HumanCharacter('fielder');
      char.idlePhase          = i * 0.55;
      char.fieldStanceClass   = fielderStanceClassForName(slot.name);
      char.poseType           = i % 3;
      char.fieldYawJitter     = THREE.MathUtils.degToRad(Math.sin(i * 1.731 + 0.2) * 6);
      const closeSlot = slot.name === 'slip' || slot.name === 'gully' || slot.name === 'short_leg';
      char.fieldXJitter = Math.cos(i * 2.419 + 0.7) * (closeSlot ? 0.035 : 0.09);
      if (SHOW_FIELDER_NUMBERS) {
        const badge = createFielderNumberBadge(i + 1);
        this.fielderBadgeTextures.push(badge.texture);
        this.fielderBadgeMaterials.push(badge.sprite.material as THREE.SpriteMaterial);
        badge.sprite.position.set(0, 2.2, 0.08);
        char.scaleGroup.add(badge.sprite);
      }
      const stance = stanceForIdx[char.fieldStanceClass] ?? 'athletic';
      const ctrl   = new FielderController(char, stance, i);
      const lod    = new HumanLOD(char);
      return { char, slot, ctrl, lod };
    });
    for (const f of this.fielders) this.scene.add(f.char.root);
    this.scene.add(this.ball.root);

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
  }

  setSnapshot(snap: EngineSnapshot): void {
    this.snapshot = snap;
  }

  updateScoreboard(ballIdx: number, totalBalls: number, multiplier: number): void {
    this.stadium.updateScoreboard(ballIdx, totalBalls, multiplier);
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

    // LOD tier selection — close characters get full pipeline, far fielders
    // get the lightweight tier (less reaction + frozen frustum-culled meshes).
    this.batsmanLOD.update(this.cam.three);
    this.bowlerLOD.update(this.cam.three);

    if (!this.snapshot) {
      this.gl.render(this.scene.three, this.cam.three);
      return;
    }

    const { ball, batsman, bowler, feedback } = this.snapshot;

    this.ball.update(ball);
    const ballPos = ball.active
      ? new THREE.Vector3(ball.x, ball.y, ball.z)
      : new THREE.Vector3(0, 1.0, PITCH_MID_Z);

    // Position + yaw so each character root faces its attention target.
    // Bowler: slight lateral offset (natural bowling lane), farther back for depth
    const bowlerZ  = THREE.MathUtils.lerp(BOWLER_RUN_START_Z, BOWLER_RELEASE_Z, bowler.runT) - 0.4;
    const batsmanZ = BATSMAN_CREASE_Z;

    this.bowlerChar.root.position.set(0.14, 0, bowlerZ);  // X offset: natural bowling lane
    setYawToTarget(this.bowlerChar.root, this.batsmanChar.root.position, 0.18, 0);
    this.bowlerChar.scaleGroup.scale.setScalar(getDepthScale(bowlerZ) * 1.24 * 1.02);

    // Batsman: clear separation from wicket (forward of stumps), slight lateral for RH stance
    this.batsmanChar.root.position.set(0.12, 0, batsmanZ - 0.24);  // Z: forward of wicket at 0.6
    setYawToTarget(this.batsmanChar.root, this.bowlerChar.root.position, 0.2, 3 * Math.PI / 2);
    this.batsmanChar.scaleGroup.scale.setScalar(getDepthScale(batsmanZ) * 1.32 * 1.06);

    // Build snapshot-driven AnimatorInputs via the per-role CharacterController FSMs.
    // No more hardcoded 'Fast' / 'defend' / 'none' — snapshot now carries intent.
    const ctrlInput = { snapshot: this.snapshot, time: this._time, dt: scaledDt };

    // Bowler
    const bowlerInput: AnimatorInput = this.bowlerCtrl.update(ctrlInput);
    bowlerInput.ballPos = ballPos;
    animateHumanBowler(this.bowlerChar, bowlerInput);
    this._bowlerBall.visible = bowlerInput.phase === 'idle';

    // Batsman
    const batsmanInput: AnimatorInput = this.batsmanCtrl.update(ctrlInput);
    batsmanInput.ballPos = ballPos;
    batsmanInput.stanceFocusWorld = this.bowlerChar.root.position;
    // Drive base phaseProgress from the engine when actively swinging or in-flight,
    // so layered animations still respect the existing timing curve.
    if (batsman.phase === 'swing') {
      batsmanInput.phaseProgress = THREE.MathUtils.clamp((batsman.swingAngle - -1.1) / (2.7 - -1.1), 0, 1) * 0.22;
    } else if (this.snapshot.phase === 'BALL_TRAVEL' || this.snapshot.phase === 'HIT') {
      batsmanInput.phaseProgress = THREE.MathUtils.clamp(ball.elapsed / (ball.params?.hitTime ?? 1.1), 0, 1);
    }
    animateHumanBatsman(this.batsmanChar, batsmanInput);

    // Fielders
    for (let i = 0; i < this.fielders.length; i++) {
      const { char, slot, ctrl, lod } = this.fielders[i];
      const fState = this.snapshot.fielders[i];
      lod.update(this.cam.three);

      const posX = fState.phase === 'idle' ? slot.x + char.fieldXJitter : fState.x;
      const posZ = fState.phase === 'idle' ? slot.z                      : fState.z;

      char.root.position.set(posX, 0, posZ);

      const batRoot = this.batsmanChar.root.position;
      if (fState.phase === 'chase') {
        setYawToTarget(char.root, ballPos, 0.25, char.fieldYawJitter);
      } else {
        sampleFielderIdleLookPoint(slot.name, batRoot.x, batRoot.y, batRoot.z, this._fielderIdleLook);
        setYawToTarget(char.root, this._fielderIdleLook, 0.14, char.fieldYawJitter);
      }

      char.scaleGroup.scale.setScalar(
        getFielderDepthScale(posZ) * slot.silhouetteScale * 1.24 * broadcastHierarchyFielderScale(slot.name),
      );

      // Controller-driven AnimatorInput; the local chase/gather override is still
      // applied here because BallSystem owns the immediate per-frame fielder phase.
      const fInput = ctrl.update(ctrlInput);
      fInput.ballPos = ballPos;
      const animPhase: SimPhase =
        fState.phase === 'chase'  ? 'bowl' :
        fState.phase === 'gather' ? 'hit'  : fInput.phase;
      const presenceW = THREE.MathUtils.clamp(1.12 - Math.abs(posZ - BATSMAN_CREASE_Z) * 0.026, 0.32, 1);
      animateHumanFielder(
        char,
        ballPos,
        this._time,
        scaledDt,
        animPhase,
        presenceW,
        fInput.fieldGatherBlend ?? 0,
      );
    }

    this.syncBonusObjects();
    this.syncSkyObject();
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

    const shake = {
      x: feedback.shakeOffset.x + this.impactJuice.shakeOffset.x,
      y: feedback.shakeOffset.y + this.impactJuice.shakeOffset.y,
      z: feedback.shakeOffset.z + this.impactJuice.shakeOffset.z,
    };
    this.cam.update(this.snapshot, shake, this.impactJuice.zoomOffset);
    this.gl.render(this.scene.three, this.cam.three);
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
    this.cam.resize(width / height);
  }

  setAutobetFraming(active: boolean): void {
    this.cam.setSessionPullZ(active ? 2.35 : 0);
  }

  dispose(): void {
    this.gl.dispose();
    this.ball.dispose();
    this.stadium.dispose();
    this.batsmanChar.dispose();
    this.bowlerChar.dispose();
    for (const f of this.fielders) f.char.dispose();
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

  private syncBonusObjects(): void {
    if (!this.snapshot) return;
    const nextIds = new Set(this.snapshot.bonusObjects.map((b) => b.id));
    for (const bonus of this.snapshot.bonusObjects) {
      if (this.bonusMeshes.has(bonus.id)) continue;
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
