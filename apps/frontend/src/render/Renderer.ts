import * as THREE from 'three';
import type { EngineSnapshot } from '../engine/GameEngine.js';
import type { FielderSlot } from '../engine/worldLayout.js';
import {
  BATSMAN_CREASE_Z,
  BOWLER_RELEASE_Z,
  BOWLER_RUN_START_Z,
  FIELDER_SLOTS,
  getDepthScale,
  getFielderDepthScale,
  PITCH_MID_Z,
} from '../engine/worldLayout.js';
import { animateBatsman, animateBowler, animateFielder } from '../engine/animation/playerAnimator.js';
import type { SimPhase, BowlerType } from '../engine/physics/ballTrajectory.js';
import type { ShotType } from '../core/modeEngine.js';
import { createBatsmanFigure, createBowlerFigure, createFielderFigure } from '../engine/objects/players.js';
import { DoodleAssets } from './doodle/DoodleAssets.js';
import { Scene } from './Scene.js';
import { Camera } from './Camera.js';
import { BallEntity } from './entities/Ball.js';
import { StadiumEntity } from './entities/Stadium.js';
import { BonusObject3D } from './entities/BonusObject3D.js';
import { SkyObject3D } from './entities/SkyObject3D.js';
import { ImpactJuice } from './effects/ImpactJuice.js';
import type { Renderable } from '../engine/loop/GameLoop.js';
import type { AnimatorInput } from '../engine/animation/playerAnimator.js';

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

function depthLiftFor(z: number): number {
  const depth = Math.max(0, BATSMAN_CREASE_Z - z);
  return depth * 0.015;
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
  private readonly batsmanFig: THREE.Group;
  private readonly bowlerFig: THREE.Group;
  private readonly fielders: Array<{ fig: THREE.Group; slot: FielderSlot }>;
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

  private snapshot: EngineSnapshot | null = null;
  private _lastTime = 0;
  private _time = 0;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, options: { debug?: boolean } = {}) {
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
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = false;

    this.assets = new DoodleAssets();
    this.scene = new Scene();
    this.cam = new Camera(width / height);

    this.stadium = new StadiumEntity(this.assets);
    this.bowlerFig = createBowlerFigure(0);
    this.batsmanFig = createBatsmanFigure();
    this.ball = new BallEntity(this.assets);

    this.scene.add(this.stadium.root);
    const boundaryGlow = new THREE.Mesh(
      new THREE.RingGeometry(18.5, 19.2, 72),
      new THREE.MeshBasicMaterial({ color: 0x8bf7b3, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
    );
    boundaryGlow.rotation.x = -Math.PI / 2;
    boundaryGlow.position.set(0, 0.03, -7);
    this.scene.add(boundaryGlow);
    this.scene.add(this.bowlerFig);
    this.scene.add(this.batsmanFig);
    this.fielders = FIELDER_SLOTS.map((slot, i) => {
      const fig = createFielderFigure(i);
      fig.userData.idlePhase = i * 0.55;
      fig.userData.poseType = i % 3;
      // Deterministic micro-variation so outfielders are not copy-paste clones.
      fig.userData.fieldYawJitter = THREE.MathUtils.degToRad(Math.sin(i * 1.731 + 0.2) * 6);
      fig.userData.fieldXJitter = Math.cos(i * 2.419 + 0.7) * 0.1;
      if (SHOW_FIELDER_NUMBERS) {
        const badge = createFielderNumberBadge(i + 1);
        this.fielderBadgeTextures.push(badge.texture);
        this.fielderBadgeMaterials.push(badge.sprite.material as THREE.SpriteMaterial);
        const bodyRoot = fig.userData.bodyRoot as THREE.Group | undefined;
        (bodyRoot ?? fig).add(badge.sprite);
      }
      return { fig, slot };
    });
    for (const f of this.fielders) this.scene.add(f.fig);
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

    this.stadium.updateAnimations(scaledDt, this.cam.three);

    if (!this.snapshot) {
      this.gl.render(this.scene.three, this.cam.three);
      return;
    }

    const { ball, batsman, bowler, feedback } = this.snapshot;

    this.ball.update(ball);
    const ballPos = ball.active
      ? new THREE.Vector3(ball.x, ball.y, ball.z)
      : new THREE.Vector3(0, 1.0, PITCH_MID_Z);

    // Position + yaw so each primitive "root" faces its attention target.
    const bowlerZ = THREE.MathUtils.lerp(BOWLER_RUN_START_Z, BOWLER_RELEASE_Z, bowler.runT);
    const batsmanZ = BATSMAN_CREASE_Z;
    this.bowlerFig.position.set(0, depthLiftFor(bowlerZ) + 0.12, bowlerZ);
    setYawToTarget(this.bowlerFig, this.batsmanFig.position, 0.18, 0);
    const bowlerDepth = getDepthScale(bowlerZ);
    const bowlerScalePivot = this.bowlerFig.userData.scalePivot as THREE.Group | undefined;
    (bowlerScalePivot ?? this.bowlerFig).scale.setScalar(bowlerDepth);

    this.batsmanFig.position.set(0.08, -0.29, batsmanZ - 0.68);
    setYawToTarget(this.batsmanFig, this.bowlerFig.position, 0.2, 3 * Math.PI / 2);
    const batsmanScalePivot = this.batsmanFig.userData.scalePivot as THREE.Group | undefined;
    (batsmanScalePivot ?? this.batsmanFig).scale.setScalar(getDepthScale(batsmanZ));

    // Bowler animation
    const bowlerSimPhase: SimPhase = bowler.phase === 'run' ? 'bowl' : 'idle';
    const bowlerInput: AnimatorInput = {
      phase: bowlerSimPhase,
      phaseProgress: THREE.MathUtils.clamp(bowler.runT, 0, 1),
      bowlerType: 'Fast' as BowlerType,
      shotType: 'defend' as ShotType,
      dt: scaledDt,
      time: this._time,
      ballPos,
    };
    animateBowler(this.bowlerFig, bowlerInput);

    // Batsman animation mapping:
    // - idle + ball-in-flight => pre-swing "bowl"
    // - swing => "hit" (impact visuals)
    // - stumped/celebrate => wicket/celebrate
    let batsmanSimPhase: SimPhase = 'idle';
    let batsmanPP = 0;
    if (batsman.phase === 'celebrate') {
      batsmanSimPhase = 'celebrate';
    } else if (batsman.phase === 'stumped') {
      batsmanSimPhase = 'wicket';
    } else if (batsman.phase === 'swing') {
      batsmanSimPhase = 'hit';
      const t = THREE.MathUtils.clamp(
        (batsman.swingAngle - -1.1) / (2.7 - -1.1),
        0,
        1,
      );
      // Drive impact stretch early in the hit phase.
      batsmanPP = t * 0.22;
    } else {
      // batsman.phase === 'idle' or 'run'
      const ballInFlight = this.snapshot.phase === 'BALL_TRAVEL' || this.snapshot.phase === 'HIT';
      batsmanSimPhase = ballInFlight ? 'bowl' : 'idle';
      batsmanPP = ballInFlight
        ? THREE.MathUtils.clamp(ball.elapsed / (ball.params?.hitTime ?? 1.1), 0, 1)
        : 0;
    }

    const batsmanInput: AnimatorInput = {
      phase: batsmanSimPhase,
      phaseProgress: batsmanPP,
      bowlerType: 'Fast' as BowlerType,
      shotType: 'defend' as ShotType,
      dt: scaledDt,
      time: this._time,
      ballPos,
      isSwinging: this.snapshot.phase === 'HIT' || batsman.phase === 'swing',
      hitQuality: 'none',
    };
    animateBatsman(this.batsmanFig, batsmanInput);

    // Fielders — position and animate from per-fielder snapshot state
    for (let i = 0; i < this.fielders.length; i++) {
      const { fig, slot } = this.fielders[i];
      const fState = this.snapshot.fielders[i];

      const xJ = (fig.userData.fieldXJitter as number | undefined) ?? 0;
      const yJ = (fig.userData.fieldYawJitter as number | undefined) ?? 0;

      // Idle fielders keep slot + micro-jitter; active fielder tracks live position
      const posX = fState.phase === 'idle' ? slot.x + xJ : fState.x;
      const posZ = fState.phase === 'idle' ? slot.z       : fState.z;

      fig.position.set(posX, depthLiftFor(posZ), posZ);

      // Chase: face the ball; idle/gather: face the batsman
      const lookTarget = fState.phase === 'chase' ? ballPos : this.batsmanFig.position;
      setYawToTarget(fig, lookTarget, fState.phase === 'chase' ? 0.25 : 0.12, yJ);

      const depth = getFielderDepthScale(posZ);
      const composedScale = depth * slot.silhouetteScale;
      const scalePivot = fig.userData.scalePivot as THREE.Group | undefined;
      (scalePivot ?? fig).scale.setScalar(composedScale);

      const animPhase: SimPhase =
        fState.phase === 'chase'  ? 'bowl' :
        fState.phase === 'gather' ? 'hit'  : 'idle';
      animateFielder(fig, ballPos, this._time, scaledDt, animPhase);
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

  resize(width: number, height: number): void {
    this.gl.setSize(width, height);
    this.cam.resize(width / height);
  }

  dispose(): void {
    this.gl.dispose();
    this.ball.dispose();
    this.stadium.dispose();
    // Primitives: nothing to dispose yet (materials are created once per rig).
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
