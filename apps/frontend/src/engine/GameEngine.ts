/**
 * GameEngine — single source of truth.
 *
 * Owns all mutable state.  Every system receives a reference to the relevant
 * state object; no system stores its own copy.  The Renderer reads a snapshot
 * each frame without ever writing back.
 *
 * Data flow:
 *   Svelte → EngineBridge.triggerBowl / triggerSwing
 *     → handleInput()
 *       → StateMachine.transition()
 *       → system mutations
 *         → EventBus.emit()
 *           → EngineBridge callbacks → Svelte reactive state
 *
 * Physics upgrade (new deterministic modules):
 *   Post-hit physics is now driven by BallController (fixed 1/60 s steps,
 *   semi-implicit Euler) instead of the legacy variable-dt BallSystem path.
 *   Hit velocity is computed by HitEngine (result-driven kinematics).
 *   BowlerFSM + BatsmanFSM run alongside AnimationSystem for richer state data.
 */

import { EventBus }           from './events/EventBus.js';
import { StateMachine }       from './state/StateMachine.js';
import { BallSystem }         from './systems/BallSystem.js';
import { HitSystem }          from './systems/HitSystem.js';
import { AnimationSystem,
         makeCharacterAnim }  from './systems/AnimationSystem.js';
import { FeedbackSystem,
         makeFeedbackState }  from './systems/FeedbackSystem.js';
import { RoundSystem }        from './systems/RoundSystem.js';
import { TIMING, BALL }       from './constants.js';
import { OutcomeSystem }      from './rng/OutcomeSystem.js';
import type { BallData }      from './systems/BallSystem.js';
import type { CharacterAnimState } from './systems/AnimationSystem.js';
import type { FeedbackState } from './systems/FeedbackSystem.js';
import type { RoundData }     from './systems/RoundSystem.js';
import type { DeliveryOutcome, ShotResult } from './rng/OutcomeSystem.js';
import { GameState } from './state/StateMachine.js';
import type { ShotType } from '../core/modeEngine.js';

// ── New deterministic physics modules ─────────────────────────────────────────
import { BallController }  from './physics/ballController.js';
import { HitEngine }       from './physics/hitEngine.js';
import { BowlerFSM }       from './physics/animationFSM.js';
import { BatsmanFSM }      from './physics/animationFSM.js';
import { Vec3, mulberry32, makeSeed } from './physics/physics.js';
import {
  BATSMAN_CREASE_Z,
  BONUS_SKILL_ZONES,
  BOWLER_RELEASE_Z,
  BOWLER_RUN_START_Z,
  FIELDER_SLOTS,
} from './worldLayout.js';
import type { BonusType } from './events/EventBus.js';
import type { BonusRoamContext, BonusSnapshot } from './bonus/types.js';
import { BonusSystem } from './systems/BonusSystem.js';
import { SkyObjectSystem } from './systems/SkyObjectSystem.js';
import type { SkyObjectSnapshot } from './sky/types.js';

// ── Public snapshot (read-only view consumed by Renderer each frame) ──────────

export type FielderPhase = 'idle' | 'chase' | 'gather';

export interface FielderSnapState {
  readonly x:     number;
  readonly z:     number;
  readonly phase: FielderPhase;
}

export interface EngineSnapshot {
  readonly phase:    string;
  readonly ball:     Readonly<BallData>;
  readonly batsman:  Readonly<CharacterAnimState>;
  readonly bowler:   Readonly<CharacterAnimState>;
  readonly feedback: Readonly<FeedbackState>;
  readonly round:    Readonly<RoundData>;
  readonly fielders: ReadonlyArray<FielderSnapState>;
  readonly bonusObjects: ReadonlyArray<BonusSnapshot>;
  readonly activeBonusHit: Readonly<{
    sourceId: string;
    extraBalls: number;
    type: BonusType;
    worldPos: { x: number; y: number; z: number };
  } | null>;
  /** Sky Object Lite (standard mode); null when inactive. */
  readonly skyObject: SkyObjectSnapshot | null;
}

// ── Input union ───────────────────────────────────────────────────────────────

/** Optional intent passed alongside the engine outcome — used by the
 *  CharacterController FSM (M6) to drive shot-type sub-states without
 *  forcing the engine to know about the modeEngine vocabulary. */
export interface DeliveryIntent {
  shotType?: ShotType;
}

export type EngineInput =
  | { type: 'bowl';  outcome: DeliveryOutcome; intent?: DeliveryIntent }
  | { type: 'swing' }
  | { type: 'reset' };

// ── GameEngine ────────────────────────────────────────────────────────────────

export class GameEngine {
  readonly events: EventBus;

  // ── Legacy systems (unchanged) ────────────────────────────────────────────
  private readonly sm:        StateMachine;
  private readonly ballSys:   BallSystem;
  private readonly hitSys:    HitSystem;
  private readonly animSys:   AnimationSystem;
  private readonly feedSys:   FeedbackSystem;
  private readonly roundSys:  RoundSystem;
  private readonly outcomeSys: OutcomeSystem;

  // ── New deterministic physics ─────────────────────────────────────────────
  private readonly hitEng:    HitEngine;
  private readonly bowlerFSM: BowlerFSM;
  private readonly batsmanFSM: BatsmanFSM;
  /** Per-delivery ball physics controller (replaces ballSys.updatePostHit). */
  private readonly physicsCtrl: BallController;
  /** Seeded RNG for the current delivery. Re-created on each bowl. */
  private _rng: () => number = mulberry32(0);
  /** Match-level seed (same across all deliveries in a session). */
  private readonly _matchSeed: number;
  /** Rolling delivery counter for per-ball seeding. */
  private _ballId = 0;

  // ── State ─────────────────────────────────────────────────────────────────
  private readonly ball:     BallData     = {
    x: 0, y: 1.8, z: -9, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, elapsed: 0, params: null, active: false,
    predictedLanding: null, bounce: 0.45, groundFriction: 0.8,
  };
  private readonly batsman:  CharacterAnimState = makeCharacterAnim();
  private readonly bowler:   CharacterAnimState = makeCharacterAnim();
  private readonly feedback: FeedbackState      = makeFeedbackState();
  private          round:    RoundData;
  private          currentShot: ShotResult | null = null;

  // ── Fielder simulation state ──────────────────────────────────────────────
  private readonly _fielderStates: Array<{ x: number; z: number; phase: FielderPhase }>;
  private _activeFielder = -1;
  private _fielderTarget: { x: number; z: number } | null = null;
  private readonly _bonusSys = new BonusSystem(BONUS_SKILL_ZONES);
  private readonly _skySys = new SkyObjectSystem();
  /** Current delivery uses sky bonus trajectory (no stadium bonus collisions). */
  private _skyActive = false;
  private _skyImpactEmitted = false;
  private _activeBonusHit: {
    sourceId: string;
    extraBalls: number;
    type: BonusType;
    worldPos: { x: number; y: number; z: number };
    ttl: number;
  } | null = null;

  // ── Flags ─────────────────────────────────────────────────────────────────
  private swingPending   = false;
  private hitResolved    = false;
  private resultEmitted  = false;
  private _bonusEligible = false;

  constructor(matchSeed?: number) {
    this._matchSeed  = matchSeed ?? (Date.now() & 0xffffffff);
    this.events      = new EventBus();
    this.sm          = new StateMachine(this.events);
    this.ballSys     = new BallSystem();
    this.hitSys      = new HitSystem();
    this.animSys     = new AnimationSystem();
    this.feedSys     = new FeedbackSystem();
    this.roundSys    = new RoundSystem();
    this.outcomeSys  = new OutcomeSystem();
    this.round       = this.roundSys.makeData();

    // New physics modules
    this.hitEng      = new HitEngine();
    this.bowlerFSM   = new BowlerFSM();
    this.batsmanFSM  = new BatsmanFSM();
    this.physicsCtrl = new BallController(this._rng);

    // Wire FSM callbacks (no circular state mutation — only flag reads)
    this.bowlerFSM.onRelease = () => { /* ball spawned by BallSystem on BALL_RELEASE state */ };
    this.batsmanFSM.onContact = () => { /* hit is resolved in tickHit() */ };

    this._fielderStates = FIELDER_SLOTS.map(s => ({ x: s.x, z: s.z, phase: 'idle' as FielderPhase }));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  handleInput(input: EngineInput): void {
    switch (input.type) {
      case 'bowl':  this.startBowl(input.outcome, input.intent); break;
      case 'swing': this.registerSwing();           break;
      case 'reset': this.resetToIdle();             break;
    }
  }

  update(dt: number): void {
    this.sm.tick(dt);

    const physicsDt = this.feedSys.isPaused(this.feedback) ? 0 : dt;

    this.feedSys.update(this.feedback, dt);
    this.animSys.update(this.batsman, dt);
    this.animSys.update(this.bowler,  dt);

    // Advance new FSMs in parallel with existing animation system
    this.bowlerFSM.update(dt);
    this.batsmanFSM.update(dt);

    const phase = this.sm.phase;
    if (phase === GameState.BOWLER_RUNUP)   this.tickBowlerRunup();
    else if (phase === GameState.BALL_RELEASE) this.tickBallRelease();
    else if (phase === GameState.BALL_TRAVEL)  this.tickBallTravel(physicsDt);
    else if (phase === GameState.HIT)          this.tickHit();
    else if (phase === GameState.BALL_RESULT)  this.tickBallResult(physicsDt);
    else if (phase === GameState.RESET)        this.tickReset();

    if (this._activeBonusHit) {
      this._activeBonusHit.ttl -= dt;
      if (this._activeBonusHit.ttl <= 0) this._activeBonusHit = null;
    }
    const bowlerT = Math.min(1, Math.max(0, this.bowler.runT));
    const roam: BonusRoamContext = {
      fielders: this._fielderStates.map((f) => ({ x: f.x, z: f.z })),
      bowlerX:           0,
      bowlerZ:           BOWLER_RUN_START_Z
        + (BOWLER_RELEASE_Z - BOWLER_RUN_START_Z) * bowlerT,
      batsmanX:        0.08,
      batsmanZ:        BATSMAN_CREASE_Z - 0.68,
    };
    this._bonusSys.update(dt, roam, this._rng);
    this._skySys.update(dt);
  }

  getSnapshot(): EngineSnapshot {
    return {
      phase:    this.sm.phase,
      ball:     this.ball,
      batsman:  this.batsman,
      bowler:   this.bowler,
      feedback: this.feedback,
      round:    this.round,
      fielders: this._fielderStates,
      bonusObjects: this._bonusSys.getActive(),
      activeBonusHit: this._activeBonusHit
        ? {
            sourceId: this._activeBonusHit.sourceId,
            extraBalls: this._activeBonusHit.extraBalls,
            type: this._activeBonusHit.type,
            worldPos: this._activeBonusHit.worldPos,
          }
        : null,
      skyObject: this._skySys.snapshot,
    };
  }

  // ── Private: phase logic ───────────────────────────────────────────────────

  private startBowl(outcome: DeliveryOutcome, intent?: DeliveryIntent): void {
    if (!this.sm.transition(GameState.BETTING)) return;
    if (!this.sm.transition(GameState.BOWLER_RUNUP)) return;

    this.swingPending   = false;
    this.hitResolved    = false;
    this.resultEmitted  = false;
    this._bonusEligible = false;
    this._skyImpactEmitted = false;
    this.currentShot    = this.outcomeSys.toShotResult(outcome);

    // M6: publish delivery intent on the per-character anim states so the
    // CharacterController FSM can pick sub-states without re-deriving from bucket.
    this.bowler.bowlerType  = (outcome.bowlerType.charAt(0).toUpperCase() + outcome.bowlerType.slice(1)) as CharacterAnimState['bowlerType'];
    this.batsman.shotType   = intent?.shotType ?? this.deriveShotTypeFromBucket(outcome);
    this.batsman.bowlerType = this.bowler.bowlerType;
    this.feedback.hitQuality = 'none';

    // ── New: seed deterministic RNG for this delivery ──────────────────────
    this._ballId += 1;
    this._rng = mulberry32(makeSeed(this._ballId, this._matchSeed));
    this.physicsCtrl.setRNG(this._rng);

    this._skyActive = !!outcome.skyObject;
    if (!outcome.skyObject) {
      this._skySys.dispose();
    }

    // Reset physics controller (idle at release position)
    this.physicsCtrl.reset(new Vec3(0, 1.8, -9));

    // Reset new FSMs + fielders
    this.batsmanFSM.reset();
    this.bowlerFSM.start();
    this._resetFielders();
    this._activeBonusHit = null;

    // Legacy ball + round systems
    this.ballSys.bowl(this.ball, {
      bowlerType: outcome.bowlerType,
      hitTime:    outcome.hitTime,
      outcome:    outcome.result,
      bucket:     outcome.bucket,
    });
    this.roundSys.startRound(this.round, outcome.targetMultiplier);
    const spawned = this._bonusSys.spawnBonus({ ballNumber: this.round.ballNumber, canSpawn: true }, this._rng);
    if (spawned) {
      this.events.emit('bonusSpawned', {
        sourceId: spawned.id,
        type: spawned.def.type,
        zone: spawned.zone.zone,
        rarityTier: spawned.def.rarityTier,
        worldPos: { x: spawned.zone.x, y: spawned.zone.y, z: spawned.zone.z },
      });
    }
    this.animSys.reset(this.batsman);
    this.animSys.reset(this.bowler);
    this.animSys.startBowl(this.bowler);

    // Batsman enters pre-swing stance
    this.batsmanFSM.startBacklift();

    this.events.emit('bowlStart', {
      bowlerType: outcome.bowlerType,
      hitTime:    outcome.hitTime,
    });

    if (outcome.skyObject) {
      this._skySys.spawn(outcome.skyObject.type, this._ballId, this._rng);
      const p = this._skySys.getTarget();
      if (p) {
        this.events.emit('skyObjectSpawned', {
          type: outcome.skyObject.type,
          worldPos: { x: p.x, y: p.y, z: p.z },
        });
      }
    }
  }

  private registerSwing(): void {
    if (this.swingPending) return;
    if (this.sm.is(GameState.BALL_TRAVEL) || this.sm.is(GameState.HIT)) {
      this.swingPending = true;
      // Trigger batsman FSM swing (animation-only; physics resolved in tickHit)
      this.batsmanFSM.triggerSwing();
    }
  }

  private resolveSwing(): void {
    const params  = this.ball.params!;
    const legacy  = this.hitSys.evaluate(this.ball.elapsed, params.hitTime);
    const timingError = this.ball.elapsed - params.hitTime;

    // ── New: result-driven hit velocity via HitEngine ──────────────────────
    const hitOut = this.hitEng.resolve({
      timingError,
      shotPower:    this.currentShot?.power ?? 0.5,
      targetBucket: params.bucket,
      rng:          this._rng,
    });

    if (this._skyActive && this._skySys.snapshot) {
      hitOut.velocity = this._skySys.computeImpulse(
        new Vec3(this.ball.x, this.ball.y, this.ball.z),
        this._skySys.flightTime,
      );
    }

    const quality        = hitOut.quality !== 'miss' ? legacy : 'miss';
    const resolvedBucket = quality === 'miss' ? 'wicket' : params.bucket;
    this._bonusEligible = resolvedBucket !== 'wicket' && !this._skyActive;

    // Animate batsman
    this.animSys.triggerSwing(this.batsman);

    // Feedback (shake + pause + particles)
    this.feedSys.triggerHit(this.feedback, quality, resolvedBucket, {
      x: this.ball.x, y: this.ball.y, z: this.ball.z,
    });

    // ── New: sync BallController position then apply impulse ──────────────
    this.physicsCtrl.body.position.set(this.ball.x, this.ball.y, this.ball.z);
    this.physicsCtrl.applyImpulse(hitOut.velocity);

    // Sync velocity back to legacy BallData immediately (Renderer reads it)
    this.ball.vx = hitOut.velocity.x;
    this.ball.vy = hitOut.velocity.y;
    this.ball.vz = hitOut.velocity.z;

    // Apply per-bucket bounce/friction to physics controller and BallData.
    // Velocity is already set via physicsCtrl.applyImpulse above; we only need
    // the surface-contact parameters from OUTCOME_TRAJECTORIES.
    const traj = BALL.OUTCOME_TRAJECTORIES[resolvedBucket];
    this.ball.bounce         = traj.bounce;
    this.ball.groundFriction = traj.friction;
    this.physicsCtrl.configure({ restitution: traj.bounce, friction: traj.friction });

    // ── Fielder assignment: nearest fielder runs to landing zone ──────────
    if (resolvedBucket !== 'four' && resolvedBucket !== 'six' && resolvedBucket !== 'wicket') {
      const lp = this.physicsCtrl.predictedLanding;
      if (lp) this._assignFielder(lp.x, lp.z);
    }

    // Round resolution
    this.roundSys.applyResult(this.round, quality);

    // Events
    this.events.emit('hit', {
      quality,
      bucket: resolvedBucket,
      vx: this.ball.vx,
      vy: this.ball.vy,
      vz: this.ball.vz,
    });
    this.events.emit('multiplier', { value: this.round.multiplier });

    if (quality === 'miss') this.animSys.stump(this.batsman);
    else this.animSys.followThrough(this.batsman);

    this.hitResolved = true;
    this.sm.transition(GameState.BALL_RESULT);
  }

  private tickBowlerRunup(): void {
    const runupDuration = 0.55;
    this.bowler.runT = Math.min(this.sm.phaseTime / runupDuration, 1);
    if (this.bowler.runT >= 1) this.sm.transition(GameState.BALL_RELEASE);
  }

  private tickBallRelease(): void {
    this.sm.transition(GameState.BALL_TRAVEL);
  }

  private tickBallTravel(dt: number): void {
    this.ballSys.updatePreHit(this.ball, dt);

    if (this.ballSys.isAtBatsman(this.ball)) {
      this.sm.transition(GameState.HIT);
    }
  }

  private tickHit(): void {
    if (this.hitResolved) return;
    this.resolveSwing();
  }

  private tickBallResult(dt: number): void {
    // ── New: fixed-step post-hit physics ──────────────────────────────────
    this.physicsCtrl.updateFrame(dt);
    this._updateFielder(dt);

    // Sync BallController state → legacy BallData (Renderer reads BallData)
    const body = this.physicsCtrl.body;
    this.ball.x  = body.position.x;
    this.ball.y  = body.position.y;
    this.ball.z  = body.position.z;
    this.ball.vx = body.velocity.x;
    this.ball.vy = body.velocity.y;
    this.ball.vz = body.velocity.z;
    this.ball.rx = body.spin.x;
    this.ball.rz = body.spin.z;

    const lp = this.physicsCtrl.predictedLanding;
    this.ball.predictedLanding = lp ? { x: lp.x, z: lp.z } : null;

    if (
      this._skyActive
      && !this._skyImpactEmitted
      && this._skySys.snapshot?.phase === 'approaching'
      && this._skySys.isReadyForImpact(this.physicsCtrl.body.position, this.physicsCtrl.body.elapsedTime)
    ) {
      this._skyImpactEmitted = true;
      const target = this._skySys.getTarget();
      this._skySys.triggerImpact();
      if (target) {
        this.feedSys.triggerSkyObjectImpact(this.feedback, { x: target.x, y: target.y, z: target.z });
        this.events.emit('skyObjectHit', {
          type: this._skySys.type!,
          multiplier: this._skySys.multiplier!,
          worldPos: { x: target.x, y: target.y, z: target.z },
        });
      }
    }

    this._detectBonusCollision();

    if (!this.resultEmitted && this.sm.phaseTime >= TIMING.POST_HIT_MAX) {
      this.resultEmitted = true;
      if (this.round.outcome === 'hit') this.animSys.celebrate(this.batsman);
      this.events.emit('roundEnd', {
        multiplier: this.round.multiplier,
        outcome: this.round.outcome ?? 'wicket',
      });
      this.sm.transition(GameState.RESET);
    }
  }

  private _detectBonusCollision(): void {
    if (!this._bonusEligible) return;
    if (!this.ball.active) return;
    const hit = this._bonusSys.checkCollision(this.ball);
    if (!hit) return;

    this._activeBonusHit = {
      sourceId: hit.sourceId,
      extraBalls: hit.extraBalls,
      type: hit.type,
      worldPos: hit.worldPos,
      ttl: 0.8,
    };
    this.events.emit('bonusHit', {
      sourceId: hit.sourceId,
      type: hit.type,
      zone: hit.zone,
      rarityTier: hit.rarityTier,
      worldPos: hit.worldPos,
    });
    this.events.emit('bonusAwarded', {
      sourceId: hit.sourceId,
      type: hit.type,
      zone: hit.zone,
      rarityTier: hit.rarityTier,
      extraBalls: hit.extraBalls,
      profitMult: hit.profitMult,
      worldPos: hit.worldPos,
    });
  }

  private tickReset(): void {
    // Hold reset state until bridge calls handleInput({ type: 'reset' })
  }

  // ── Private: fielder simulation ────────────────────────────────────────────

  private _resetFielders(): void {
    for (let i = 0; i < this._fielderStates.length; i++) {
      const slot = FIELDER_SLOTS[i];
      this._fielderStates[i].x     = slot.x;
      this._fielderStates[i].z     = slot.z;
      this._fielderStates[i].phase = 'idle';
    }
    this._activeFielder = -1;
    this._fielderTarget = null;
  }

  private _assignFielder(tx: number, tz: number): void {
    let bestIdx  = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this._fielderStates.length; i++) {
      const f = this._fielderStates[i];
      const d = Math.sqrt((f.x - tx) ** 2 + (f.z - tz) ** 2);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx < 0) return;
    this._activeFielder              = bestIdx;
    this._fielderTarget              = { x: tx, z: tz };
    this._fielderStates[bestIdx].phase = 'chase';
  }

  private _updateFielder(dt: number): void {
    if (this._activeFielder < 0 || !this._fielderTarget) return;
    const f  = this._fielderStates[this._activeFielder];
    const tx = this._fielderTarget.x;
    const tz = this._fielderTarget.z;
    const dx = tx - f.x;
    const dz = tz - f.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = 5.5 * dt;

    if (dist > 0.1) {
      const ratio = Math.min(step / dist, 1);
      f.x += dx * ratio;
      f.z += dz * ratio;
    }

    const body = this.physicsCtrl.body;
    const bdx  = body.position.x - f.x;
    const bdz  = body.position.z - f.z;
    if (body.bounceCount >= 1 && body.position.y < 0.5 && Math.sqrt(bdx * bdx + bdz * bdz) < 1.8) {
      f.phase = 'gather';
      this.physicsCtrl.stop();
      this._activeFielder = -1;
    }
  }

  /** Fallback shot-type when no explicit intent is supplied (mock / legacy paths). */
  private deriveShotTypeFromBucket(outcome: DeliveryOutcome): ShotType {
    if (outcome.bucket === 'wicket' || outcome.result === 'wicket') return 'bowled';
    if (outcome.bucket === 'six')    return 'loft';
    if (outcome.bucket === 'four')   return 'cut';
    if (outcome.bucket === 'triple') return 'run_three';
    if (outcome.bucket === 'double') return 'pushed_two';
    if (outcome.bucket === 'single') return 'quick_single';
    return 'defend';
  }

  private resetToIdle(): void {
    this.sm.reset();
    this.ball.active           = false;
    this.ball.predictedLanding = null;
    this.swingPending   = false;
    this.hitResolved    = false;
    this.resultEmitted  = false;
    this._bonusEligible = false;
    this.currentShot    = null;
    this.physicsCtrl.stop();
    this.bowlerFSM.reset();
    this.batsmanFSM.reset();
    this._resetFielders();
    this._bonusSys.clear();
    this._activeBonusHit = null;
    this._skySys.dispose();
    this._skyActive = false;
    this._skyImpactEmitted = false;
  }
}
