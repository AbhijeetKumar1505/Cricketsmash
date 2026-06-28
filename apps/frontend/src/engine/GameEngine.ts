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
import { TIMING, BALL, WORLD } from './constants.js';
import { OutcomeSystem }      from './rng/OutcomeSystem.js';
import type { BallData }      from './systems/BallSystem.js';
import type { CharacterAnimState } from './systems/AnimationSystem.js';
import type { FeedbackState } from './systems/FeedbackSystem.js';
import type { RoundData }     from './systems/RoundSystem.js';
import type { DeliveryOutcome, ShotResult, OutcomeBucket } from './rng/OutcomeSystem.js';
import { GameState } from './state/StateMachine.js';
import type { ShotType } from '../core/modeEngine.js';

// ── New deterministic physics modules ─────────────────────────────────────────
import { BallController }  from './physics/ballController.js';
import { HitEngine }       from './physics/hitEngine.js';
import { BowlerFSM }       from './physics/animationFSM.js';
import { BatsmanFSM }      from './physics/animationFSM.js';
import type { BowlerPhase, BatsmanPhase } from './physics/animationFSM.js';
import { Vec3, mulberry32, makeSeed, clamp } from './physics/physics.js';
import { predictContact } from './physics/BallPredictor.js';
import type { ContactSolution } from './physics/ContactSolution.js';
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
import { FlyoverSystem } from './systems/FlyoverSystem.js';
import type { SkyObjectSnapshot } from './sky/types.js';
import type { PlayerProfile } from './player/PlayerProfile.js';
import { DEFAULT_PROFILE } from './player/PlayerProfile.js';

// ── Public snapshot (read-only view consumed by Renderer each frame) ──────────

export type FielderPhase = 'idle' | 'chase' | 'gather';

export interface FielderSnapState {
  readonly x:     number;
  readonly z:     number;
  readonly phase: FielderPhase;
}

/** Bowler FSM snapshot for the animation brain (phase + pre-computed eased progress). */
export interface BowlerFSMSnapshot {
  readonly phase:    BowlerPhase;
  readonly progress: number;   // 0..1 within current phase
  readonly runT:     number;   // 0..1 across full action
  readonly eased: {
    readonly runUp:         number;
    readonly gather:        number;
    readonly armSwing:      number;
    readonly followThrough: number;
  };
}

/** Batsman FSM snapshot for the animation brain. */
export interface BatsmanFSMSnapshot {
  readonly phase:    BatsmanPhase;
  readonly elapsed:  number;
  readonly progress: number;
  readonly runT:     number;
  readonly eased: {
    readonly backlift:      number;
    readonly swing:         number;
    readonly contact:       number;
    readonly followThrough: number;
  };
}

/**
 * Monotonic counters incremented on FSM phase entries.
 * Renderer/FX bus compare against last-seen value and fire bundles on diff.
 * Frame-perfect, no setTimeout, no cross-boundary callbacks.
 */
export interface SyncEvents {
  readonly ballReleaseId: number;
  readonly ballContactId: number;
  readonly contactBallX: number;
  readonly contactBallY: number;
  readonly contactBallZ: number;
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
  /** Autonomous flyover aircraft per lane (3 lanes); null entries = lane inactive. */
  readonly flyoverAircrafts: (SkyObjectSnapshot | null)[];
  /** Bowler animation FSM mirror — drives BowlingController in the renderer. */
  readonly bowlerFSM:  BowlerFSMSnapshot;
  /** Batsman animation FSM mirror — drives BattingController in the renderer. */
  readonly batsmanFSM: BatsmanFSMSnapshot;
  /** Frame-perfect sync counters for release/contact event bundles. */
  readonly syncEvents: SyncEvents;
  /**
   * Pre-contact motion target package generated at swing trigger.
   * Null before swing, or when no prediction was made.
   * Consumed by BattingController for time-warped swing timing,
   * contact lock, and environment-responsive procedural layers.
   */
  readonly contactSolution: ContactSolution | null;
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
  private readonly _flyoverSys = new FlyoverSystem();
  /** Current delivery uses sky bonus trajectory (no stadium bonus collisions). */
  private _skyActive = false;
  private _skyImpactEmitted = false;
  private _flyoverHitEmitted = false;
  private _activeBonusHit: {
    sourceId: string;
    extraBalls: number;
    type: BonusType;
    worldPos: { x: number; y: number; z: number };
    ttl: number;
  } | null = null;

  // ── Current delivery contact solution ─────────────────────────────────────
  private _contactSolution: ContactSolution | null = null;

  // ── Flags ─────────────────────────────────────────────────────────────────
  private swingPending    = false;
  private hitResolved     = false;
  private resultEmitted   = false;
  private _bonusEligible  = false;
  /** Bucket resolved after swing (used to extend POST_HIT_MAX for sixes). */
  private _resolvedBucket: OutcomeBucket = 'dot';

  // ── Sync event counters (incremented from FSM phase entries) ─────────────
  private _ballReleaseId = 0;
  private _ballContactId = 0;
  private _contactBallX = 0;
  private _contactBallY = 0;
  private _contactBallZ = 0;

  constructor(matchSeed?: number, private readonly _profile: PlayerProfile = DEFAULT_PROFILE) {
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

    // Wire FSM callbacks: increment sync counters so the renderer's FX bus
    // fires bundles on the exact frame the FSM enters RELEASE / CONTACT.
    this.bowlerFSM.onRelease   = () => { this._ballReleaseId += 1; };
    this.batsmanFSM.onContact  = () => {
      this._ballContactId += 1;
      // Latch the TRUE contact position now — before resolveSwing() relaunches
      // the ball with hit velocity. The post-relaunch ball departs immediately
      // (a loft shoots upward), so the live snapshot ball is NOT the contact point.
      this._contactBallX = this.ball.x;
      this._contactBallY = this.ball.y;
      this._contactBallZ = this.ball.z;
      // Drive gameplay resolution from the same frame as visual contact.
      // If state is still BALL_TRAVEL (FSM fired fractionally early), force
      // the HIT transition so resolveSwing()'s BALL_RESULT transition is valid.
      if (this.swingPending && !this.hitResolved) {
        if (this.sm.is(GameState.BALL_TRAVEL)) this.sm.transition(GameState.HIT);
        this.resolveSwing();
      }
    };

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
    this._flyoverSys.update(dt);
  }

  getSnapshot(): EngineSnapshot {
    const bSnap = this.bowlerFSM.snapshot;
    const tSnap = this.batsmanFSM.snapshot;
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
      skyObject:        this._skySys.snapshot,
      flyoverAircrafts: this._flyoverSys.snapshots,
      bowlerFSM: {
        phase:    bSnap.phase,
        progress: bSnap.progress,
        runT:     bSnap.runT,
        eased: {
          runUp:         this.bowlerFSM.runUpEased,
          gather:        this.bowlerFSM.gatherEased,
          armSwing:      this.bowlerFSM.armSwingEased,
          followThrough: this.bowlerFSM.followThroughEased,
        },
      },
      batsmanFSM: {
        phase:    tSnap.phase,
        elapsed:  tSnap.elapsed,
        progress: tSnap.progress,
        runT:     tSnap.runT,
        eased: {
          backlift:      this.batsmanFSM.backliftEased,
          swing:         this.batsmanFSM.swingEased,
          contact:       this.batsmanFSM.contactImpact,
          followThrough: this.batsmanFSM.followThroughEased,
        },
      },
      syncEvents: {
        ballReleaseId: this._ballReleaseId,
        ballContactId: this._ballContactId,
        contactBallX:  this._contactBallX,
        contactBallY:  this._contactBallY,
        contactBallZ:  this._contactBallZ,
      },
      contactSolution: this._contactSolution,
    };
  }

  // ── Private: phase logic ───────────────────────────────────────────────────

  private startBowl(outcome: DeliveryOutcome, intent?: DeliveryIntent): void {
    // Ensure engine is in IDLE before starting a new delivery.
    // Prevents stale RESET → BETTING transition when the game controller
    // calls triggerBowl before triggerReset has been processed.
    if (!this.sm.is(GameState.IDLE)) this.resetToIdle();
    if (!this.sm.transition(GameState.BETTING)) return;
    if (!this.sm.transition(GameState.BOWLER_RUNUP)) return;

    this.swingPending   = false;
    this.hitResolved    = false;
    this.resultEmitted  = false;
    this._bonusEligible = false;
    this._skyImpactEmitted  = false;
    this._flyoverHitEmitted = false;
    this._contactSolution   = null;
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

      // ── Generate ContactSolution from current ball state ─────────────────
      // Predict when and where the ball will reach the batsman, then convert
      // to FSM-clock-relative timing so the animation system can synchronize.
      // Sample the deterministic trajectory at the batsman — the REAL contact point
      // (pre-hit velocities aren't maintained, so projection can't be used).
      const cpos = this.ballSys.contactSample(this.ball.params!);
      this._contactSolution = predictContact(
        this.ball.params!.hitTime,
        this.ball.elapsed,
        this.batsmanFSM.totalRun,
        cpos.x, cpos.y, cpos.z,
      );

      // ── DIAGNOSTIC: sampled contact point vs the ball's current position ──────
      const cp = this._contactSolution.contactPointWorld;
      console.log('[PREDICT]', {
        hitTime: +this.ball.params!.hitTime.toFixed(3),
        elapsed: +this.ball.elapsed.toFixed(3),
        ballNow: [+this.ball.x.toFixed(3), +this.ball.y.toFixed(3), +this.ball.z.toFixed(3)],
        contactSample: [+cpos.x.toFixed(3), +cpos.y.toFixed(3), +cpos.z.toFixed(3)],
        contactPoint: [+cp.x.toFixed(3), +cp.y.toFixed(3), +cp.z.toFixed(3)],
      });

      // Trigger batsman FSM swing with the contact solution for time-warped timing
      this.batsmanFSM.triggerSwing(this._contactSolution);
    }
  }

  private resolveSwing(): void {
    const params  = this.ball.params!;
    const legacy  = this.hitSys.evaluate(this.ball.elapsed, params.hitTime);
    const timingError = this.ball.elapsed - params.hitTime;

    // Scale shot power by player's powerIndex so aggressive characters hit harder.
    const basePower  = this.currentShot?.power ?? 0.5;
    const shotPower  = clamp(basePower * this._profile.stats.powerIndex, 0, 1);

    // ── New: result-driven hit velocity via HitEngine ──────────────────────
    // batsmanFSM.onContact can fire early (MAX_SWING=0.45s cap) for slow
    // deliveries, making timingError >> GOOD_WINDOW → hitEng returns miss
    // velocity (+Z toward camera) even when the server confirms a hit.
    // Clamping to ±GOOD_WINDOW guarantees the correct outfield velocity.
    const effectiveTimingError = params.outcome === 'hit'
      ? clamp(timingError, -this.hitEng.GOOD_WINDOW, this.hitEng.GOOD_WINDOW)
      : timingError;
    const hitOut = this.hitEng.resolve({
      timingError: effectiveTimingError,
      shotPower,
      targetBucket: params.bucket,
      rng:          this._rng,
      shotType:     this.batsman.shotType ?? undefined,
    });

    if (this._skyActive && this._skySys.snapshot) {
      const imp = this._skySys.computeImpulse(
        new Vec3(this.ball.x, this.ball.y, this.ball.z),
        this._skySys.flightTime,
      );
      if (Number.isFinite(imp.x) && Number.isFinite(imp.y) && Number.isFinite(imp.z)) {
        hitOut.velocity = imp;
        // Lock sky object position so the ball actually reaches its visual position.
        this._skySys.freeze();
      }
    }

    // Server outcome is the single source of truth.
    // If the delivery was pre-planned as a hit, auto-swing timing jitter must
    // never override it to a wicket — the animation is cosmetic.
    const rawQuality     = hitOut.quality !== 'miss' ? legacy : 'miss';
    const quality        = (params.outcome === 'hit' && rawQuality === 'miss') ? 'good' : rawQuality;
    const resolvedBucket = quality === 'miss' ? 'wicket' : params.bucket;
    this._resolvedBucket = resolvedBucket;
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
    // When a swing was registered, resolveSwing() fires from batsmanFSM.onContact
    // so gameplay resolution aligns with visual contact in the same frame.
    // Safety: if FSM never reaches CONTACT within 400ms (shouldn't happen),
    // force-resolve to prevent an infinite hang in HIT state.
    if (this.swingPending) {
      if (this.sm.phaseTime > 0.5) this.resolveSwing();
      return;
    }
    // No swing registered — resolve immediately (wicket / no-shot miss).
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
    this._detectFlyoverCollision();

    // Stop fours at the boundary rope so the ball visibly comes to rest at the
    // rope rather than rolling deep into the stands. Sixes fly over (no stop).
    if (this._resolvedBucket === 'four' && !this.resultEmitted) {
      const bx = body.position.x, bz = body.position.z;
      if (bx * bx + bz * bz >= WORLD.BOUNDARY_R * WORLD.BOUNDARY_R) {
        this.physicsCtrl.stop();
      }
    }

    const postHitMax = this._resolvedBucket === 'six' ? 3.2 : TIMING.POST_HIT_MAX;
    if (!this.resultEmitted && this.sm.phaseTime >= postHitMax) {
      this.resultEmitted = true;
      if (this.round.outcome === 'hit') this.animSys.celebrate(this.batsman);
      this.events.emit('roundEnd', {
        multiplier: this.round.multiplier,
        outcome: this.round.outcome ?? 'wicket',
      });
      this.sm.transition(GameState.RESET);
    }
  }

  private _detectFlyoverCollision(): void {
    if (this._flyoverHitEmitted) return;
    if (!this.ball.active) return;
    const hit = this._flyoverSys.checkCollision(this.ball);
    if (!hit) return;
    this._flyoverHitEmitted = true;
    this.events.emit('skyObjectHit', {
      type:       hit.type,
      multiplier: hit.multiplier,
      worldPos:   hit.worldPos,
    });
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
    this._contactSolution = null;
    this.currentShot    = null;
    this.physicsCtrl.stop();
    this.bowlerFSM.reset();
    this.batsmanFSM.reset();
    this._resetFielders();
    this._bonusSys.clear();
    this._activeBonusHit = null;
    this._skySys.dispose();
    this._skyActive         = false;
    this._skyImpactEmitted  = false;
    this._flyoverHitEmitted = false;
  }
}
