/**
 * StadiumScene — GLB-based Three.js game scene.
 * Drop-in replacement for EngineBridge. Consumes CharacterManager GLBs
 * instead of the old procedural character pipeline.
 */

import * as THREE from 'three';
import type { BridgeCallbacks } from '../bridge/EngineBridge.js';
import {
  OutcomeSystem,
  type DeliveryOutcome,
  type OutcomeBucket,
} from '../engine/rng/OutcomeSystem.js';
import type { HitQuality } from '../engine/events/EventBus.js';
import { HIT_TIMES } from '../engine/constants.js';
import type { SkyObjectMeta } from '../engine/sky/types.js';
import type { BowlerType } from '../engine/events/EventBus.js';
import { CharacterManager } from '../game/CharacterManager.js';
import { AnimationManager, type AnimState } from '../game/AnimationManager.js';
import type { PlayerId } from '../game/CharacterManager.js';
import { gameBus } from '../game/GameEventBus.js';
import { BallTrail } from '../effects/Trails.js';
import { CameraShake } from '../effects/CameraFX.js';
import { Fireworks } from '../effects/Fireworks.js';

// ── Constants ────────────────────────────────────────────────────────────────

const BOWLER_POS   = new THREE.Vector3(0, 0, -9);
const RELEASE_POS  = new THREE.Vector3(0, 1.9, -8.5);
const CONTACT_POS  = new THREE.Vector3(0, 0.9, 0);
const BATSMAN_POS  = new THREE.Vector3(0, 0, -0.3);
const FIELDER_POS  = new THREE.Vector3(6, 0, -18);

const BROADCAST_POS    = new THREE.Vector3(0, 3.9, 11.5);
const BROADCAST_LOOKAT = new THREE.Vector3(0, 1.5, -5.5);

const HIT_FLIGHT_DURATION = 1.8; // seconds ball flies after hit

type ScenePhase = 'IDLE' | 'BOWLING' | 'HITTING' | 'DONE';

// ── Helpers ──────────────────────────────────────────────────────────────────

function bucketToQuality(b: OutcomeBucket): HitQuality {
  if (b === 'six' || b === 'four') return 'perfect';
  if (b === 'triple' || b === 'double' || b === 'single' || b === 'dot') return 'good';
  return 'miss';
}

function bucketToAnimState(b: OutcomeBucket): AnimState {
  if (b === 'six') return 'BAT_HUGE_HIT';
  if (b === 'four' || b === 'triple') return 'BAT_BIG_HIT';
  if (b === 'double' || b === 'single') return 'BAT_SMALL_HIT';
  if (b === 'dot') return 'BAT_SMALL_HIT';
  return 'BAT_MISS';
}

function bucketToTrailColor(b: OutcomeBucket): number {
  if (b === 'six') return 0xffc800;   // gold
  if (b === 'four') return 0x4488ff;  // blue
  return 0xffffff;                    // white
}

function buildHitCurve(bucket: OutcomeBucket): THREE.CatmullRomCurve3 {
  const s = CONTACT_POS.clone();
  switch (bucket) {
    case 'six':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(1.5, 14, -15),
        new THREE.Vector3(3,   22, -32),
        new THREE.Vector3(5,   8,  -52),
      ]);
    case 'four':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(1,   1.5, -12),
        new THREE.Vector3(2,   0.8, -24),
        new THREE.Vector3(3.5, 0.1, -40),
      ]);
    case 'triple':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(0.8, 6,  -10),
        new THREE.Vector3(1.5, 8,  -18),
        new THREE.Vector3(2,   1,  -26),
      ]);
    case 'double':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(0.5, 4,  -8),
        new THREE.Vector3(1,   5,  -14),
        new THREE.Vector3(1.5, 0.5,-20),
      ]);
    case 'single':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(0.3, 1.5,-4),
        new THREE.Vector3(0.5, 2,  -8),
        new THREE.Vector3(0.6, 0.2,-12),
      ]);
    case 'dot':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(0.1, 1,  -2),
        new THREE.Vector3(0.2, 1.2,-4),
        new THREE.Vector3(0.1, 0,  -6),
      ]);
    case 'wicket':
      return new THREE.CatmullRomCurve3([s,
        new THREE.Vector3(0,   0.5, 0.3),
        new THREE.Vector3(0,   0.1, 0.6),
        new THREE.Vector3(0,   0,   1.0),
      ]);
  }
}

// ── StadiumScene ─────────────────────────────────────────────────────────────

export class StadiumScene {
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly gameplayCamera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();

  // Characters
  private readonly charMgr: CharacterManager;
  private readonly batsmanAnim = new AnimationManager();
  private readonly bowlerAnim  = new AnimationManager();
  private readonly fielderAnim = new AnimationManager();

  // Ball
  private readonly ballMesh: THREE.Mesh;
  private readonly trail: BallTrail;

  // Effects
  private readonly shake: CameraShake;
  private readonly fireworks: Fireworks;
  private readonly cameraBasePos = BROADCAST_POS.clone();

  // Game state
  private phase: ScenePhase = 'IDLE';
  private deliveryT  = 0;
  private hitFlightT = 0;
  private currentOutcome: DeliveryOutcome | null = null;
  private deliveryCurve: THREE.CatmullRomCurve3 | null = null;
  private hitCurve: THREE.CatmullRomCurve3 | null = null;
  private callbacks: BridgeCallbacks | null = null;
  private readonly outcomes = new OutcomeSystem();
  private raf = 0;

  // Unsub handles for gameBus
  private readonly _unsubs: Array<() => void> = [];

  constructor(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    options: { debug?: boolean; batsmanAvatarId?: string } = {},
  ) {
    // ── Renderer ────────────────────────────────────────────────────────────
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.gl.setSize(width, height);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.2;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;

    // ── Scene ────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1020);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.018);

    // ── Camera ────────────────────────────────────────────────────────────────
    this.gameplayCamera = new THREE.PerspectiveCamera(52, width / height, 0.1, 500);
    this.gameplayCamera.position.copy(BROADCAST_POS);
    this.gameplayCamera.lookAt(BROADCAST_LOOKAT);

    // ── Build scene geometry ──────────────────────────────────────────────────
    this._buildEnvironment();
    this._buildPitch();
    this._buildStumps(CONTACT_POS.z + 0.7, false);
    this._buildStumps(-10.5, true);

    // ── Ball ──────────────────────────────────────────────────────────────────
    const ballGeo = new THREE.SphereGeometry(0.036, 16, 12);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xcc2211, roughness: 0.6, metalness: 0.1 });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.copy(RELEASE_POS);
    this.scene.add(this.ballMesh);

    this.trail     = new BallTrail(this.scene, 22);
    this.shake     = new CameraShake();
    this.fireworks = new Fireworks(this.scene);

    // ── Characters ────────────────────────────────────────────────────────────
    this.charMgr = new CharacterManager();
    this.charMgr.setScene(this.scene);

    const startBatsmanId = (options.batsmanAvatarId as PlayerId | undefined) ?? 'modi';
    this._initCharacters(startBatsmanId);

    // ── gameBus: character/difficulty switches ────────────────────────────────
    this._unsubs.push(
      gameBus.on('DIFFICULTY_CHANGED', ({ batsman }) => {
        void this.charMgr.switchBatsman(batsman as PlayerId).then(inst => {
          if (inst) {
            inst.root.position.copy(BATSMAN_POS);
            inst.root.scale.setScalar(1.0);
            this.batsmanAnim.attach(inst);
          }
        });
      }),
      gameBus.on('FIELDER_SWAP', ({ to }) => {
        const newId = to as PlayerId;
        const speedScale = newId === 'kimjong' ? 0.45 : 1.8;
        void this.charMgr.switchFielder(newId).then(inst => {
          if (inst) {
            inst.root.position.copy(FIELDER_POS);
            inst.root.scale.setScalar(1.0);
            this.fielderAnim.attach(inst);
            this.fielderAnim.setSpeedScale(speedScale);
          }
        });
      }),
    );
  }

  // ── Scene builders ─────────────────────────────────────────────────────────

  private _buildEnvironment(): void {
    // Hemisphere light: sky (blue-white) + ground (green bounce)
    const hemi = new THREE.HemisphereLight(0x7799ff, 0x224411, 0.6);
    this.scene.add(hemi);

    // Main key light (stadium floodlight feel)
    const key = new THREE.DirectionalLight(0xfff5e0, 2.2);
    key.position.set(10, 20, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 80;
    key.shadow.camera.left = -25;
    key.shadow.camera.right = 25;
    key.shadow.camera.top = 25;
    key.shadow.camera.bottom = -25;
    this.scene.add(key);

    // Fill from opposite side
    const fill = new THREE.DirectionalLight(0x4466cc, 0.8);
    fill.position.set(-8, 12, -5);
    this.scene.add(fill);

    // Ground — large outfield circle
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(60, 64),
      new THREE.MeshStandardMaterial({ color: 0x1e5e1e, roughness: 0.9, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Stadium stands: simple cylinder ring, far back
    const stands = new THREE.Mesh(
      new THREE.CylinderGeometry(58, 62, 12, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x223366, roughness: 0.8, metalness: 0.1, side: THREE.BackSide,
      }),
    );
    stands.position.y = 5;
    this.scene.add(stands);
  }

  private _buildPitch(): void {
    // Pitch strip — 20m long, 2.4m wide, slight elevation
    const pitch = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.02, 20),
      new THREE.MeshStandardMaterial({ color: 0xc8a87a, roughness: 0.85, metalness: 0 }),
    );
    pitch.position.set(0, 0.01, -5);
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    // Crease lines
    const creaseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const creaseGeo = new THREE.BoxGeometry(2.8, 0.03, 0.04);
    [-0.3, -10.5].forEach(z => {
      const c = new THREE.Mesh(creaseGeo, creaseMat);
      c.position.set(0, 0.015, z);
      this.scene.add(c);
    });
  }

  private _buildStumps(z: number, isFar: boolean): void {
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c0, roughness: 0.6 });
    const bailMat  = new THREE.MeshStandardMaterial({ color: 0xf5e6c0, roughness: 0.6 });

    const offsets = [-0.115, 0, 0.115];
    for (const xOff of offsets) {
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.72, 8),
        stumpMat,
      );
      stump.position.set(xOff, 0.36, z);
      stump.castShadow = true;
      this.scene.add(stump);
    }

    // Bails
    for (let b = 0; b < 2; b++) {
      const bail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6),
        bailMat,
      );
      bail.rotation.z = Math.PI / 2;
      bail.position.set((b === 0 ? -0.058 : 0.058), 0.74, z);
      this.scene.add(bail);
    }

    void isFar; // suppress unused warning
  }

  // ── Character initialization ──────────────────────────────────────────────

  private _initCharacters(batsmanId: PlayerId): void {
    void this.charMgr.init(batsmanId).then(() => {
      // Batsman — loaded as batsmanId directly (no flash)
      const batsman = this.charMgr.getBatsmanInstance();
      if (batsman) {
        batsman.root.position.copy(BATSMAN_POS);
        batsman.root.scale.setScalar(1.0);
        batsman.root.rotation.y = Math.PI;
        this.batsmanAnim.attach(batsman);
        this.batsmanAnim.setState('IDLE');
        this.scene.add(batsman.root);
      }

      // Bowler
      const bowler = this.charMgr.getBowlerInstance();
      if (bowler) {
        bowler.root.position.copy(BOWLER_POS);
        bowler.root.scale.setScalar(1.0);
        bowler.root.rotation.y = 0;
        this.bowlerAnim.attach(bowler);
        this.bowlerAnim.setState('IDLE');
        this.scene.add(bowler.root);
      }

      // Fielder (Ronaldo by default — fast speed scale)
      const fielder = this.charMgr.getFielderInstance();
      if (fielder) {
        fielder.root.position.copy(FIELDER_POS);
        fielder.root.scale.setScalar(1.0);
        this.fielderAnim.attach(fielder);
        this.fielderAnim.setState('IDLE');
        this.fielderAnim.setSpeedScale(1.8);
        this.scene.add(fielder.root);
      }
    });
  }

  // ── EngineBridge interface ────────────────────────────────────────────────

  setCallbacks(cb: BridgeCallbacks): void {
    this.callbacks = cb;
  }

  triggerBowl(outcome?: DeliveryOutcome | null, _intent?: unknown): void {
    const o = outcome ?? this.outcomes.localRandom();
    this.currentOutcome = o;
    this.deliveryT = 0;
    this.phase = 'BOWLING';
    this.trail.clear();
    this.trail.setColor(0xffffff);

    // Delivery curve: bowler release → batsman contact
    const lateralMid = o.bowlerType === 'swing' ? 0.35 : (Math.random() - 0.5) * 0.2;
    const heightMid  = o.bowlerType === 'fast'  ? 0.75 :
                       o.bowlerType === 'spin'  ? 1.30 : 1.0;
    this.deliveryCurve = new THREE.CatmullRomCurve3([
      RELEASE_POS.clone(),
      new THREE.Vector3(lateralMid, heightMid, -4.5),
      CONTACT_POS.clone(),
    ]);

    // Notify game controller: schedules auto-swing at delay = hitTime * 600 ms (≈60%)
    const hitTime = o.hitTime ?? HIT_TIMES[o.bowlerType as keyof typeof HIT_TIMES] ?? 1.1;
    this.callbacks?.onBowlStart?.(o.bowlerType, hitTime);

    // Character animations
    this.batsmanAnim.setState('IDLE');
    this.bowlerAnim.setState('BOWL');
  }

  triggerSwing(): void {
    if (this.phase !== 'BOWLING' || !this.currentOutcome) return;
    this._resolveHit();
  }

  triggerReset(): void {
    this.phase = 'IDLE';
    this.deliveryCurve = null;
    this.hitCurve = null;
    this.deliveryT = 0;
    this.hitFlightT = 0;
    this.ballMesh.position.copy(RELEASE_POS);
    this.trail.clear();
    this.batsmanAnim.setState('IDLE');
    this.bowlerAnim.setState('IDLE');
    this.fielderAnim.setState('IDLE');
  }

  start(): void {
    if (this.raf) return;
    this.clock.start();
    this._loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    this._unsubs.forEach(fn => fn());
    this._unsubs.length = 0;
    this.trail.dispose();
    this.fireworks.dispose();
    this.batsmanAnim.detach();
    this.bowlerAnim.detach();
    this.fielderAnim.detach();
    this.charMgr.dispose();
    this.gl.dispose();
  }

  resize(width: number, height: number): void {
    this.gl.setSize(width, height);
    this.gameplayCamera.aspect = width / height;
    this.gameplayCamera.updateProjectionMatrix();
  }

  updateScoreboard(_ballIdx: number, _totalBalls: number, _multiplier: number): void {
    // Stub — visual scoreboard not yet wired in this scene
  }

  setAutobetFraming(_active: boolean): void {
    // Stub — camera framing adjustment not needed for GLB scene yet
  }

  makeOutcome(
    result:           'hit' | 'wicket',
    bowlerType:       'fast' | 'spin' | 'swing',
    targetMultiplier: number,
    bucket?:          OutcomeBucket,
    skyObject?:       SkyObjectMeta | null,
  ): DeliveryOutcome {
    return this.outcomes.fromServer(result, bowlerType as BowlerType, targetMultiplier, bucket, skyObject);
  }

  // ── Hit resolution ────────────────────────────────────────────────────────

  private _resolveHit(): void {
    const o = this.currentOutcome!;
    this.phase = 'HITTING';
    this.hitFlightT = 0;

    const quality = bucketToQuality(o.bucket);
    const animState = bucketToAnimState(o.bucket);
    this.batsmanAnim.setState(animState);
    this.bowlerAnim.setState('IDLE');

    if (o.bucket !== 'wicket') {
      this.trail.setColor(bucketToTrailColor(o.bucket));
    }

    this.hitCurve = buildHitCurve(o.bucket);

    // Snap ball to contact point before flight
    this.ballMesh.position.copy(CONTACT_POS);
    this.trail.clear();

    // Emit hit result immediately (gameController updates multiplier display)
    this.callbacks?.onHitResult(quality, o.bucket);
    this.callbacks?.onMultiplier(o.targetMultiplier);

    // Camera + effects for big hits
    if (o.bucket === 'six') {
      this.shake.trigger(0.5);
      this.fireworks.burst(CONTACT_POS.clone().setY(3));
    } else if (o.bucket === 'four') {
      this.shake.trigger(0.25);
    }

    if (o.bucket === 'wicket') {
      this.fielderAnim.setState('CATCH');
    }
  }

  // ── Auto-wicket (no triggerSwing called by gameController) ────────────────

  private _autoResolveWicket(): void {
    this.phase = 'DONE';
    this.batsmanAnim.setState('BAT_MISS');
    this.ballMesh.position.set(0, 0, CONTACT_POS.z + 0.8);
    this.trail.clear();
    this.callbacks?.onHitResult('miss', 'wicket');
    this.callbacks?.onMultiplier(0);
  }

  // ── rAF loop ──────────────────────────────────────────────────────────────

  private _loop = (): void => {
    this.raf = requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._update(dt);
    this.shake.update(dt, this.gameplayCamera, this.cameraBasePos);
    this.fireworks.update(dt);
    this.gl.render(this.scene, this.gameplayCamera);
  };

  private _update(dt: number): void {
    // Character animations
    this.batsmanAnim.update(dt);
    this.bowlerAnim.update(dt);
    this.fielderAnim.update(dt);

    switch (this.phase) {
      case 'BOWLING':
        this._updateBowling(dt);
        break;
      case 'HITTING':
        this._updateHitting(dt);
        break;
      default:
        break;
    }
  }

  private _updateBowling(dt: number): void {
    if (!this.deliveryCurve || !this.currentOutcome) return;
    const hitTime = this.currentOutcome.hitTime ?? 1.1;
    this.deliveryT += dt;
    const t = Math.min(this.deliveryT / hitTime, 1);
    this.deliveryCurve.getPoint(t, this.ballMesh.position);
    this.trail.update(this.ballMesh.position);

    // Auto-resolve wicket if ball passes batsman and no swing was called
    if (t >= 1 && this.currentOutcome.result === 'wicket') {
      this._autoResolveWicket();
    } else if (t >= 1) {
      // Hit delivery that never got a triggerSwing (shouldn't happen in normal flow)
      this._resolveHit();
    }
  }

  private _updateHitting(dt: number): void {
    if (!this.hitCurve) return;
    this.hitFlightT += dt;
    const t = Math.min(this.hitFlightT / HIT_FLIGHT_DURATION, 1);
    this.hitCurve.getPoint(t, this.ballMesh.position);
    this.trail.update(this.ballMesh.position);

    if (t >= 1) {
      this.phase = 'DONE';
      this.trail.clear();
      // Emit round end — gameController handles next ball scheduling
      if (this.currentOutcome && this.currentOutcome.result !== 'wicket') {
        this.callbacks?.onRoundEnd(this.currentOutcome.targetMultiplier, 'hit');
      }
    }
  }
}
