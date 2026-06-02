/**
 * AnimationBrain — top-level orchestrator for bowler + batsman + fielder animation.
 *
 * Layered pipeline per character each frame:
 *
 *   1. mixer.update(dt)                         — clip drives all bones
 *   2. layerSet.beginFrame()                    — clear all layer targets
 *   3. controller.update → layerSet.acc(ROLE)   — setRot/addRot cricket actions
 *   4. fx.contributeBoneDeltas → layerSet.acc(REACTION) — contact recoil
 *   5. updateHeadTracking → layerSet.acc(HEAD)  — ball lookAt
 *   6. layerSet.applyAll(char)                  — write in priority order
 *       LOCOMOTION → ROLE → REACTION → HEAD → SPRING → IK
 *   7. springAcc.begin() + applySprings + apply — secondary additive lag
 *
 * Layer rules:
 *   • setRot only writes to bones the layer OWNS (per BONE_OWNERSHIP).
 *   • addRot always stacks on current bone rotation (mixer + previous layers).
 *   • Bones with no target from any layer retain the mixer's animation output.
 *
 * Architecture: Mixer provides natural body movement; procedural overrides
 * provide precise cricket actions (bowling arm, batting swing, etc.)
 * through the correct layer so each bone's authority is unambiguous.
 */

import * as THREE from 'three';
import type { EngineSnapshot } from '../../engine/GameEngine.js';
import type { CharacterInstance } from '../CharacterManager.js';
import { BoneAccumulator } from './BoneAccumulator.js';
import { BowlingController } from './BowlingController.js';
import { BattingController } from './BattingController.js';
import { FieldingController } from './FieldingController.js';
import { AnimationFX, type FxFrameOutput } from './fxBus.js';
import { updateHeadTracking } from './headTracking.js';
import { applySprings } from './springs.js';
import { getPersonality } from './personality.js';
import { animDebug } from './animDebugState.svelte.js';
import { StagingController } from './StagingController.js';
import { CapabilityTestController } from './CapabilityTest.js';
import { BowlingProtoController } from './BowlingProtoController.js';
import { LayerSet } from './LayerResolver.js';
import { LayerId } from './BoneLayer.js';
import { BatTargetIK } from '../../characters/human/ik/BatTargetIK.js';
import { BatContact }  from '../../characters/human/bat/BatContact.js';
import { anim_telemetry } from './animTelemetry.js';

// Scratch vector for predictive head gaze — avoids per-frame allocation
const _predContactTarget = new THREE.Vector3();

// ── Recovery / debug flags ────────────────────────────────────────────────────

// ANIM_PROCEDURAL_ENABLED = true → cricket stance + swing controllers active.
// Set to false to fall back to mixer-only mode for debugging.
export let ANIM_PROCEDURAL_ENABLED = true;

// LOCOMOTION_TEST_MODE = true → all characters cycle WALK → RUN → WALK
// automatically, ignoring game state.
export let LOCOMOTION_TEST_MODE = false;
let _locoT = 0;

// CHARACTERS_STATIC = true → mixer.update receives 0 dt, freezing all characters
// at their current keyframe. Set false to resume animation.
export let CHARACTERS_STATIC = false;

// STAGING_ENABLED = true → apply cricket-ready stances, breathing, weight shift,
// and head tracking on top of the frozen mixer base.
export let STAGING_ENABLED = true;

// CAPABILITY_TEST_MODE = true → batsman cycles through 6 bone deformation tests
// (arm/spine/hip/leg/head) to verify skin weights and hierarchy.
export let CAPABILITY_TEST_MODE = false;

// BOWL_TEST_MODE = true → bowler loops a standalone 5-second delivery cycle.
// Validates bowling animation quality before connecting to game state.
// Toggle: __anim.bowlTest(true)
export let BOWL_TEST_MODE = false;

// BONE_AXES_VISIBLE = true → attach THREE.AxesHelper to key bones on batsman + bowler
// so local axis directions are visible in world space.
export let BONE_AXES_VISIBLE = false;

// ── Console toggle helpers ────────────────────────────────────────────────────
// import() in the browser adds Vite's ?v=<hash> suffix, so console import()
// creates a separate module instance. Expose setters on window instead — this
// closure captures the SAME module-level variables that AnimationBrain reads.
export function setCapTest(v: boolean):    void { CAPABILITY_TEST_MODE     = v; }
export function setBowlTest(v: boolean):   void { BOWL_TEST_MODE           = v; }
export function setBoneAxes(v: boolean):   void { BONE_AXES_VISIBLE        = v; }
export function setStaging(v: boolean):    void { STAGING_ENABLED          = v; }
export function setStatic(v: boolean):     void { CHARACTERS_STATIC        = v; }
export function setProcedural(v: boolean): void { ANIM_PROCEDURAL_ENABLED  = v; }

if (typeof window !== 'undefined') {
  (window as any).__anim = {
    capTest:    (v: boolean) => { CAPABILITY_TEST_MODE    = v; },
    bowlTest:   (v: boolean) => { BOWL_TEST_MODE          = v; },
    boneAxes:   (v: boolean) => { BONE_AXES_VISIBLE       = v; },
    staging:    (v: boolean) => { STAGING_ENABLED         = v; },
    static:     (v: boolean) => { CHARACTERS_STATIC       = v; },
    procedural: (v: boolean) => { ANIM_PROCEDURAL_ENABLED = v; },
    // Telemetry stats (computed on demand)
    getContactStats: () => anim_telemetry.getContactStats(),
    getPhaseStats:   () => anim_telemetry.getPhaseStats(),
    getBalanceStats: () => anim_telemetry.getBalanceStats(),
    resetStats:      () => anim_telemetry.resetStats(),
  };
}

// Bones to visualise when BONE_AXES_VISIBLE is on
const AX_BONES = ['hips','spine','chest','head','leftArm','rightArm','leftUpLeg','rightUpLeg'];
const AX_SIZE  = 0.12;
const AX_TAG   = '__axHelper';

function syncAxesHelpers(inst: CharacterInstance, visible: boolean): void {
  for (const name of AX_BONES) {
    const bone = inst.bones.get(name);
    if (!bone) continue;
    const existing = bone.children.find(c => c.name === AX_TAG);
    if (visible && !existing) {
      const ax = new THREE.AxesHelper(AX_SIZE);
      ax.name = AX_TAG;
      bone.add(ax);
    } else if (!visible && existing) {
      bone.remove(existing);
    }
  }
}

// Locomotion state enum
export const enum LocoState {
  WALK = 'walk',
  RUN  = 'run',
}

// ── ClipPlayer — manages walk/run/celebrate crossfade per character ───────────

class ClipPlayer {
  private readonly _mixer: THREE.AnimationMixer;
  private readonly _clipMap: Map<string, THREE.AnimationClip>;
  private _currentName = '';
  private _currentAction: THREE.AnimationAction | null = null;
  private _frozen = false;

  constructor(inst: CharacterInstance) {
    this._mixer   = inst.mixer;
    this._clipMap = new Map(inst.clips.map(c => [c.name, c]));
  }

  freeze(): void {
    if (this._frozen) return;
    if (this._currentAction) {
      this._currentAction.time = 0;
      this._currentAction.timeScale = 0;
    }
    this._frozen = true;
    this._currentName = '';
  }

  /**
   * Play at a reduced timeScale so the character stays upright (walk clip
   * provides the visual base) while legs barely cycle.  rate=0 equals freeze
   * but avoids snapping to the prone frame-0 of these Meshy AI clips.
   * Calling play() afterwards restores normal speed.
   */
  setRate(rate: number): void {
    if (this._currentAction) {
      this._currentAction.timeScale = rate;
      this._frozen = false;
    }
  }

  play(name: string, fadeDuration = 0.25): void {
    if (this._frozen && this._currentAction) {
      this._currentAction.timeScale = 1;
      this._frozen = false;
    }
    if (this._currentName === name) return;
    const clip = this._clipMap.get(name);
    if (!clip) return;

    const next = this._mixer.clipAction(clip);
    next.loop = THREE.LoopRepeat;
    next.clampWhenFinished = false;

    if (!this._currentAction) {
      next.reset();
      next.play();
    } else {
      next.reset();
      next.play();
      this._currentAction.crossFadeTo(next, fadeDuration, true);
    }

    this._currentAction = next;
    this._currentName   = name;
  }

  hasClip(name: string):  boolean { return this._clipMap.has(name); }
  currentClip():     string  { return this._currentName; }
  currentTime():     number  { return this._currentAction?.time ?? 0; }
  currentDuration(): number  { return this._currentAction?.getClip().duration ?? 0; }
  currentWeight():   number  { return this._currentAction?.getEffectiveWeight() ?? 0; }
  hasSomeAction():   boolean { return this._currentAction !== null; }
}

// ── CharacterBinding ──────────────────────────────────────────────────────────

export interface CharacterBinding {
  instance: CharacterInstance;
  root: THREE.Object3D;
  playerId: string;
}

interface BoundCharacter {
  binding:    CharacterBinding;
  clipPlayer: ClipPlayer;
}

// ── Bind-pose snapshot ────────────────────────────────────────────────────────
// Captured before any animation plays so we can reset bones to the GLB bind
// pose every frame, preventing addRot from accumulating across frames.

const LOCO_BONES = [
  'hips','leftUpLeg','rightUpLeg','leftLeg','rightLeg','leftFoot','rightFoot',
] as const;

// ROLE layer bones — arms/torso. Controllers use addRot (delta from bind pose)
// after this base is written, making values rig-agnostic regardless of whether
// the GLB was authored in Mixamo (near-zero bind) or Meshy AI (large bind angles).
// neck is intentionally excluded from ROLE_BONES: its local axes on Meshy AI rigs
// don't match expected conventions, so locking it to bind-pose Y causes visible
// sideways tilt. Neck retains its natural resting value; only addRot swing deltas apply.
const ROLE_BONES = [
  'spine','chest','upperChest',
  'leftShoulder','rightShoulder',
  'leftArm','rightArm',
  'leftForeArm','rightForeArm',
  'leftHand','rightHand',
] as const;

type BindPose = Map<string, [number, number, number]>;

/**
 * Bind-pose POSITION snapshot for locomotion bones (hips + legs).
 * These must be reset every frame to prevent addPos accumulation
 * (e.g. `addPos('hips', 0, -0.08, 0)` in BattingController stacking
 * -8cm per frame).
 */
type BindPosMap = Map<string, [number, number, number]>;

function captureBP(inst: CharacterInstance): BindPose {
  const bp: BindPose = new Map();
  for (const name of [...LOCO_BONES, ...ROLE_BONES, 'head' as const]) {
    const bone = inst.bones.get(name);
    if (bone) bp.set(name, [bone.rotation.x, bone.rotation.y, bone.rotation.z]);
  }
  return bp;
}

function captureBPos(inst: CharacterInstance): BindPosMap {
  const bp: BindPosMap = new Map();
  for (const name of LOCO_BONES) {
    const bone = inst.bones.get(name);
    if (bone) bp.set(name, [bone.position.x, bone.position.y, bone.position.z]);
  }
  return bp;
}

function applyBPToLoco(bp: BindPose, pos: BindPosMap, acc: BoneAccumulator): void {
  for (const name of LOCO_BONES) {
    const r = bp.get(name);
    if (r) acc.setRot(name, r[0], r[1], r[2]);
    const p = pos.get(name);
    if (p) acc.setPos(name, p[0], p[1], p[2]);
  }
}

function applyBPToRole(bp: BindPose, acc: BoneAccumulator): void {
  for (const name of ROLE_BONES) {
    const v = bp.get(name);
    if (v) acc.setRot(name, v[0], v[1], v[2]);
  }
}

// Resets head to bind pose each frame so updateHeadTracking's addRot stacks a clean
// delta rather than accumulating on the persisted bone value from previous frames.
function applyBPToHead(bp: BindPose, acc: BoneAccumulator): void {
  const v = bp.get('head');
  if (v) acc.setRot('head', v[0], v[1], v[2]);
}

// ── AnimationBrain ────────────────────────────────────────────────────────────

export class AnimationBrain {
  private readonly bowlingCtl  = new BowlingController();
  private readonly battingCtl  = new BattingController();
  private readonly fieldingCtl = new FieldingController();
  private readonly stagingCtl  = new StagingController();
  private readonly capTest     = new CapabilityTestController();
  private readonly bowlProto   = new BowlingProtoController();

  // Per-character layer sets (one per role) + per-spring accumulators
  private readonly bowlerLayers   = new LayerSet();
  private readonly batsmanLayers  = new LayerSet();
  private readonly fielderLayerSets: LayerSet[] = [];
  private readonly bowlerSpring   = new BoneAccumulator();
  private readonly batsmanSpring  = new BoneAccumulator();
  private readonly fielderSprings: BoneAccumulator[] = [];

  readonly bowlerFx  = new AnimationFX();
  readonly batsmanFx = new AnimationFX();

  /** IK: arm chain guides bat toward contact point during CONTACT phase. */
  private readonly _batTargetIK = new BatTargetIK();
  /** Post-step: spring vibration on rightHand at contact. */
  private readonly _batContact  = new BatContact();
  /** Last seen contact counter — fires batContact.trigger on diff. */
  private _lastContactId = -1;

  private _bowler:  BoundCharacter | null = null;
  private _batsman: BoundCharacter | null = null;
  private _fielders: (BoundCharacter | null)[] = [];

  // Bind-pose snapshots (per character) — rotation + position
  private _bowlerBP:  BindPose = new Map();
  private _batsmanBP: BindPose = new Map();
  private readonly _fielderBPs: BindPose[] = [];
  private _bowlerBPos:  BindPosMap = new Map();
  private _batsmanBPos: BindPosMap = new Map();
  private readonly _fielderBPos: BindPosMap[] = [];

  /** Running time — drives breathing / weight-shift sine waves. */
  private _t = 0;

  // Telemetry — tracks batsman FSM phase changes to emit phase durations
  private _lastBatsmanPhase = '';

  /** Renderer reads this each frame and adds to mount.root.position.z. */
  batsmanRootZ = 0;

  // ── Bind / unbind ─────────────────────────────────────────────────────────

  setBowler(b: CharacterBinding | null): void {
    this.bowlerLayers.reset();
    this.bowlerSpring.reset();
    if (!b) { this._bowler = null; this.bowlingCtl.reset(); this._bowlerBP = new Map(); this._bowlerBPos = new Map(); return; }
    // Capture bind pose BEFORE any animation touches the bones
    this._bowlerBP = captureBP(b.instance);
    this._bowlerBPos = captureBPos(b.instance);
    const clipPlayer = new ClipPlayer(b.instance);
    this._bowler = { binding: b, clipPlayer };
    this.bowlingCtl.reset();
  }

  setBatsman(b: CharacterBinding | null): void {
    this.batsmanLayers.reset();
    this.batsmanSpring.reset();
    this._batTargetIK.reset();
    this._batContact.reset();
    this._lastContactId = -1;
    this._lastBatsmanPhase = '';
    if (!b) { this._batsman = null; this.battingCtl.reset(); this._batsmanBP = new Map(); this._batsmanBPos = new Map(); return; }
    this._batsmanBP = captureBP(b.instance);
    this._batsmanBPos = captureBPos(b.instance);
    const clipPlayer = new ClipPlayer(b.instance);
    this._batsman = { binding: b, clipPlayer };
    this.battingCtl.reset();
  }

  setFielder(idx: number, b: CharacterBinding | null): void {
    if (!b) { this._fielders[idx] = null; delete this._fielderBPos[idx]; return; }
    this._fielderBPs[idx] = captureBP(b.instance);
    this._fielderBPos[idx] = captureBPos(b.instance);
    const clipPlayer = new ClipPlayer(b.instance);
    this._fielders[idx] = { binding: b, clipPlayer };
    if (!this.fielderLayerSets[idx]) this.fielderLayerSets[idx] = new LayerSet();
    if (!this.fielderSprings[idx]) this.fielderSprings[idx] = new BoneAccumulator();
  }

  clearFielders(): void { this._fielders.length = 0; this.fielderLayerSets.length = 0; this.fielderSprings.length = 0; this._fielderBPos.length = 0; }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(snap: EngineSnapshot, dt: number, ballWorld: THREE.Vector3): void {
    this._t += dt;

    if (LOCOMOTION_TEST_MODE) {
      _locoT += dt;
      const phase = _locoT % 9;
      const locoClip: string = phase < 6 ? LocoState.WALK : LocoState.RUN;
      const allChars: (BoundCharacter | null)[] = [this._bowler, this._batsman, ...this._fielders];
      for (const bc of allChars) {
        if (!bc) continue;
        bc.clipPlayer.play(locoClip, 0.25);
        bc.binding.instance.mixer.update(CHARACTERS_STATIC ? 0 : dt);
      }
      if (animDebug.active) {
        this._writeDebugState(snap);
        animDebug.locoTestMode      = true;
        animDebug.proceduralEnabled = false;
      }
      return;
    }

    this._updateBowler(snap, dt, ballWorld);
    this._updateBatsman(snap, dt, ballWorld);
    this._updateFielders(snap, dt, ballWorld);

    if (animDebug.active) {
      this._writeDebugState(snap);
      animDebug.locoTestMode      = false;
      animDebug.proceduralEnabled = ANIM_PROCEDURAL_ENABLED;
    }
  }

  private _writeDebugState(snap: EngineSnapshot): void {
    if (this._bowler) {
      const cp = this._bowler.clipPlayer;
      animDebug.bowlerClip         = cp.currentClip();
      animDebug.bowlerPhase        = snap.bowlerFSM.phase;
      animDebug.bowlerBones        = this._bowler.binding.instance.bones.size;
      animDebug.bowlerClipTime     = cp.currentTime();
      animDebug.bowlerClipDuration = cp.currentDuration();
      animDebug.bowlerClipWeight   = cp.currentWeight();
      animDebug.bowlerMixerActive  = cp.hasSomeAction();
    }
    if (this._batsman) {
      const cp = this._batsman.clipPlayer;
      animDebug.batsmanClip         = cp.currentClip();
      animDebug.batsmanPhase        = snap.batsmanFSM.phase;
      animDebug.batsmanBones        = this._batsman.binding.instance.bones.size;
      animDebug.batsmanClipTime     = cp.currentTime();
      animDebug.batsmanClipDuration = cp.currentDuration();
      animDebug.batsmanClipWeight   = cp.currentWeight();
    }
    if (this._fielders[0]) {
      animDebug.fielderClip = this._fielders[0].clipPlayer.currentClip();
    }
    if (CAPABILITY_TEST_MODE) {
      animDebug.capTestPhase    = this.capTest.currentPhase.name;
      animDebug.capTestLookFor  = this.capTest.currentPhase.lookFor;
      animDebug.capTestProgress = this.capTest.phaseProgress;
    } else {
      animDebug.capTestPhase = '—';
    }
    if (BOWL_TEST_MODE) {
      animDebug.bowlTestPhase   = this.bowlProto.phaseName;
      animDebug.bowlTestT       = this.bowlProto.bowlT;
      animDebug.bowlTestRelease = this.bowlProto.isAtRelease;
    } else {
      animDebug.bowlTestPhase = '—';
    }
  }

  private _updateBowler(snap: EngineSnapshot, dt: number, ballWorld: THREE.Vector3): void {
    const bc = this._bowler;
    if (!bc) return;
    const { binding: b, clipPlayer } = bc;

    // ── Clip selection + mixer advance ────────────────────────────────────────
    // Walk/run clip only plays when needed; idle + bowling phases use bind pose.
    if (snap.bowlerFSM.phase === 'RUN_UP') {
      clipPlayer.play('run');
    } else if (!ANIM_PROCEDURAL_ENABLED) {
      clipPlayer.play('walk');
    }
    // else: no clip active — mixer.update is a no-op, bones stay at bind pose
    b.instance.mixer.update(CHARACTERS_STATIC ? 0 : dt);

    syncAxesHelpers(b.instance, BONE_AXES_VISIBLE);

    const personality = getPersonality(b.playerId);
    this.bowlerLayers.beginFrame();

    // ── BOWL_TEST_MODE: standalone bowling cycle via proto controller ─────────
    if (BOWL_TEST_MODE) {
      if (STAGING_ENABLED && !ANIM_PROCEDURAL_ENABLED) {
        this.stagingCtl.update('bowler', 0, this._t, 0, this.bowlerLayers.acc(LayerId.ROLE), personality);
      }
      this.bowlProto.update(dt, this.bowlerLayers.acc(LayerId.ROLE));
      applyBPToHead(this._bowlerBP, this.bowlerLayers.acc(LayerId.HEAD));
      updateHeadTracking(b.instance, b.root, ballWorld, this.bowlerLayers.acc(LayerId.HEAD), true);
      this.bowlerLayers.applyAll(b.instance);
      this.bowlerSpring.begin();
      applySprings(b.instance, dt, this.bowlerSpring, 1, personality);
      this.bowlerSpring.apply(b.instance);
      return;
    }

    // ── Game-loop bowl action ─────────────────────────────────────────────────
    if (STAGING_ENABLED && !ANIM_PROCEDURAL_ENABLED) {
      this.stagingCtl.update('bowler', 0, this._t, 0, this.bowlerLayers.acc(LayerId.ROLE), personality);
      if (snap.bowlerFSM.phase !== 'IDLE') {
        this.bowlProto.updateFromGameSnap(snap.bowlerFSM, this._t, this.bowlerLayers.acc(LayerId.ROLE));
      }
    }

    if (ANIM_PROCEDURAL_ENABLED) {
      // RUN_UP: run clip owns both loco and upper-body — don't override.
      // All other phases: anchor both layers to bind pose so addRot controllers
      // stack clean deltas on a known base rather than drifting each frame.
      if (snap.bowlerFSM.phase !== 'RUN_UP') {
        applyBPToLoco(this._bowlerBP, this._bowlerBPos, this.bowlerLayers.acc(LayerId.LOCOMOTION));
        applyBPToRole(this._bowlerBP, this.bowlerLayers.acc(LayerId.ROLE));
      }
      this.bowlerFx.consume(snap, dt);
      this.bowlingCtl.update(snap, dt, this.bowlerLayers.acc(LayerId.ROLE), personality);
      this.bowlerFx.contributeBoneDeltas(this.bowlerLayers.acc(LayerId.REACTION));
    }

    const headEnabled = ANIM_PROCEDURAL_ENABLED ? snap.bowlerFSM.phase !== 'IDLE' : true;
    applyBPToHead(this._bowlerBP, this.bowlerLayers.acc(LayerId.HEAD));
    updateHeadTracking(b.instance, b.root, ballWorld, this.bowlerLayers.acc(LayerId.HEAD), headEnabled);

    this.bowlerLayers.applyAll(b.instance);

    // Springs post-step: reads final bone rotation from all layers
    this.bowlerSpring.begin();
    applySprings(b.instance, dt, this.bowlerSpring, 1, personality);
    this.bowlerSpring.apply(b.instance);
  }

  /** Release duration: lock decays over first 100ms of FOLLOW_THROUGH. */
  private static _LOCK_RELEASE = 0.100;

  /**
   * Compute contact lock weight [0..1] from the batsman FSM state.
   * 1 = fully frozen (CONTACT hold), 0 = free motion (idle/backlift/swing).
   * Decays smoothly through the first 100ms of FOLLOW_THROUGH.
   */
  private static _contactLockWeight(fsm: EngineSnapshot['batsmanFSM']): number {
    if (fsm.phase === 'CONTACT') return 1;
    if (fsm.phase === 'FOLLOW_THROUGH') {
      const releaseT = Math.min(1, fsm.elapsed / AnimationBrain._LOCK_RELEASE);
      // Quadratic ease-out decay
      const t = 1 - releaseT;
      return t * t;
    }
    return 0;
  }

  private _updateBatsman(snap: EngineSnapshot, dt: number, ballWorld: THREE.Vector3): void {
    const bc = this._batsman;
    if (!bc) return;
    const { binding: b, clipPlayer } = bc;

    // Procedural mode: no clip needed — LOCOMOTION layer uses bind pose every frame.
    // Non-procedural: walk clip drives bones normally.
    if (!ANIM_PROCEDURAL_ENABLED) {
      clipPlayer.play('walk');
    }
    b.instance.mixer.update(CHARACTERS_STATIC ? 0 : dt);

    syncAxesHelpers(b.instance, BONE_AXES_VISIBLE);

    const personality = getPersonality(b.playerId);
    this.batsmanLayers.beginFrame();

    // ── Telemetry: phase-change events ────────────────────────────────────────
    {
      const phase = snap.batsmanFSM.phase;
      if (phase !== this._lastBatsmanPhase) {
        anim_telemetry.onPhaseChange(phase, this._t);
        this._lastBatsmanPhase = phase;
      }
    }

    // ── Contact lock weight ─────────────────────────────────────────────────
    // Freezes micro-motion at impact (springs + head tracking + FX recoil).
    // Full lock during CONTACT phase, smooth release over first 100ms of FOLLOW_THROUGH.
    const lockWeight = AnimationBrain._contactLockWeight(snap.batsmanFSM);

    // ── Capability test ───────────────────────────────────────────────────────
    if (CAPABILITY_TEST_MODE) {
      this.stagingCtl.update('batsman', 0, this._t, 0, this.batsmanLayers.acc(LayerId.ROLE), personality);
      this.capTest.update(dt, this.batsmanLayers.acc(LayerId.ROLE));
      this.batsmanLayers.applyAll(b.instance);
      this.batsmanSpring.begin();
      applySprings(b.instance, dt, this.batsmanSpring, 1, personality);
      this.batsmanSpring.apply(b.instance);
      return;
    }

    // ── Staging-only mode ─────────────────────────────────────────────────────
    if (STAGING_ENABLED && !ANIM_PROCEDURAL_ENABLED) {
      this.stagingCtl.update('batsman', 0, this._t, 0, this.batsmanLayers.acc(LayerId.ROLE), personality);
    }

    // ── Procedural batting mode ───────────────────────────────────────────────
    if (ANIM_PROCEDURAL_ENABLED) {
      // Anchor both layers to bind pose every frame so controller addRot calls
      // stack clean deltas on a fixed base without accumulating across frames.
      applyBPToLoco(this._batsmanBP, this._batsmanBPos, this.batsmanLayers.acc(LayerId.LOCOMOTION));
      applyBPToRole(this._batsmanBP, this.batsmanLayers.acc(LayerId.ROLE));
      this.batsmanFx.consume(snap, dt);
      const { rootZ } = this.battingCtl.update(snap, dt, this.batsmanLayers.acc(LayerId.ROLE), personality);
      this.batsmanRootZ = rootZ;
      // Scale down REACTION-layer FX recoil during lock so body doesn't
      // jitter through the frozen impact frame
      if (lockWeight < 1) {
        this.batsmanFx.contributeBoneDeltas(this.batsmanLayers.acc(LayerId.REACTION));
      }
    } else {
      this.batsmanRootZ = 0;
    }

    // Head tracking: disabled during contact lock (head must stay frozen
    // through impact so the hit reads as a solid pose, not a tracking swivel)
    const headBaseEnabled = ANIM_PROCEDURAL_ENABLED
      ? (snap.ball.active || snap.batsmanFSM.phase === 'BACKLIFT' || snap.batsmanFSM.phase === 'SWING')
      : true;
    const headEnabled = headBaseEnabled && lockWeight < 0.5;
    applyBPToHead(this._batsmanBP, this.batsmanLayers.acc(LayerId.HEAD));
    // Predictive gaze: smoothly blend from live ballWorld toward contactPointWorld
    // as the batsman enters the swing. Blend schedule:
    //   BACKLIFT  0 → 30%  (ramps with eased.backlift progress)
    //   SWING    30 → 80%  (ramps with FSM progress)
    //   CONTACT  100%      (full lock on impact zone)
    //   FOLLOW_THROUGH / IDLE: 0% (track the actual ball flight)
    let headTarget = ballWorld;
    if (ANIM_PROCEDURAL_ENABLED && snap.contactSolution) {
      const { contactPointWorld: cp } = snap.contactSolution;
      _predContactTarget.set(cp.x, cp.y, cp.z);
      const phase = snap.batsmanFSM.phase;
      let blend = 0;
      if (phase === 'BACKLIFT') {
        blend = 0.30 * snap.batsmanFSM.eased.backlift;
      } else if (phase === 'SWING') {
        blend = 0.30 + 0.50 * snap.batsmanFSM.progress;  // 30% → 80%
      } else if (phase === 'CONTACT') {
        blend = 1.0;
      }
      if (blend > 0) {
        // lerp: contactPt * blend + ballWorld * (1-blend)
        _predContactTarget.lerp(ballWorld, 1 - blend);
        headTarget = _predContactTarget;
      }
    }
    updateHeadTracking(b.instance, b.root, headTarget, this.batsmanLayers.acc(LayerId.HEAD), headEnabled);

    // IK layer: guide bat arm toward ball (soft reach in late SWING, full
    // correction in CONTACT). Runs before applyAll to be included in composite.
    if (ANIM_PROCEDURAL_ENABLED) {
      this._batTargetIK.solve(snap, b.instance, this.batsmanLayers.acc(LayerId.IK), ballWorld);
    }

    this.batsmanLayers.applyAll(b.instance);

    // Contact impulse detection — fires BatContact spring on new contact event
    const cid = snap.syncEvents.ballContactId;
    if (this._lastContactId === -1) {
      this._lastContactId = cid;
    } else if (cid !== this._lastContactId) {
      this._batContact.trigger(personality.power);
      this._lastContactId = cid;
    }

    // (Contact-error telemetry is now fed by the Renderer, which is the only
    // place with the real bat mesh — measuring the bat sweet spot, not the wrist.)

    // Springs post-step: multiply damping during lock to freeze secondary motion.
    // Also passes personality so power hitters get stiffer extremity springs.
    const springDampingMult = 1 + lockWeight * 9;  // 1x → 10x at full lock
    this.batsmanSpring.begin();
    applySprings(b.instance, dt, this.batsmanSpring, springDampingMult, personality);

    // BatContact spring: additive wrist twist that decays after impact
    const batDelta = this._batContact.update(dt);
    if (batDelta.z !== 0) {
      this.batsmanSpring.addRot('rightHand', batDelta.x, batDelta.y, batDelta.z);
    }

    this.batsmanSpring.apply(b.instance);
  }

  private _updateFielders(snap: EngineSnapshot, dt: number, ballWorld: THREE.Vector3): void {
    // Fielders look toward batsman in idle staging mode
    const batsmanPos = (this._batsman?.binding.root.position as THREE.Vector3 | undefined) ?? ballWorld;

    for (let i = 0; i < this._fielders.length; i++) {
      const bc = this._fielders[i];
      if (!bc) continue;
      const { binding: b, clipPlayer } = bc;
      const layerSet = this.fielderLayerSets[i];
      const springAcc = this.fielderSprings[i];
      if (!layerSet || !springAcc) continue;

      const fState = snap.fielders[i];
      // Chase: walk clip drives the leg cycle visually.
      // Idle / gather: no clip — LOCOMOTION layer anchors bones to bind pose below.
      if (fState?.phase === 'chase') {
        clipPlayer.play('walk');
      }
      b.instance.mixer.update(CHARACTERS_STATIC ? 0 : dt);

      const personality = getPersonality(b.playerId);
      layerSet.beginFrame();

      if (STAGING_ENABLED && !ANIM_PROCEDURAL_ENABLED) {
        this.stagingCtl.update('fielder', i, this._t, 0, layerSet.acc(LayerId.ROLE), personality);
      }

      if (ANIM_PROCEDURAL_ENABLED) {
        const bp = this._fielderBPs[i];
        const bpos = this._fielderBPos[i];
        // LOCO bind pose: idle/gather anchor legs; chase lets walk clip drive them.
        // ROLE bind pose: always applied so arm controllers use clean deltas each frame.
        if (fState?.phase !== 'chase') {
          if (bp && bpos) applyBPToLoco(bp, bpos, layerSet.acc(LayerId.LOCOMOTION));
        }
        if (bp) applyBPToRole(bp, layerSet.acc(LayerId.ROLE));
        const fx = b.root.position.x;
        const fz = b.root.position.z;
        this.fieldingCtl.update(i, snap, dt, layerSet.acc(LayerId.ROLE), fx, fz, ballWorld.x, ballWorld.z, personality);
      }

      const headTarget = ANIM_PROCEDURAL_ENABLED ? ballWorld : batsmanPos;
      const headEnabled = ANIM_PROCEDURAL_ENABLED ? snap.ball.active : true;
      const fbp = this._fielderBPs[i];
      if (fbp) applyBPToHead(fbp, layerSet.acc(LayerId.HEAD));
      updateHeadTracking(b.instance, b.root, headTarget, layerSet.acc(LayerId.HEAD), headEnabled);

      layerSet.applyAll(b.instance);

      springAcc.begin();
      applySprings(b.instance, dt, springAcc, 1, personality);
      springAcc.apply(b.instance);
    }
  }

  // ── Debug / inspection ────────────────────────────────────────────────────

  getDebugState(): {
    bowler:  { clip: string; phase: string; bones: number } | null;
    batsman: { clip: string; phase: string; bones: number } | null;
  } {
    return {
      bowler: this._bowler ? {
        clip:  this._bowler.clipPlayer.currentClip(),
        phase: 'n/a',
        bones: this._bowler.binding.instance.bones.size,
      } : null,
      batsman: this._batsman ? {
        clip:  this._batsman.clipPlayer.currentClip(),
        phase: 'n/a',
        bones: this._batsman.binding.instance.bones.size,
      } : null,
    };
  }

  getBatsmanFx(): FxFrameOutput { return this.batsmanFx.frameOutput(); }
  getBowlerFx():  FxFrameOutput { return this.bowlerFx.frameOutput(); }
}
