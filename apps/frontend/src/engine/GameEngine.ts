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
import { TIMING, WORLD }      from './constants.js';
import type { BallData }      from './systems/BallSystem.js';
import type { CharacterAnimState } from './systems/AnimationSystem.js';
import type { FeedbackState } from './systems/FeedbackSystem.js';
import type { RoundData }     from './systems/RoundSystem.js';
import type { DeliveryOutcome } from './rng/OutcomeSystem.js';

// ── Public snapshot (read-only view consumed by Renderer each frame) ──────────

export interface EngineSnapshot {
  readonly phase:    string;
  readonly ball:     Readonly<BallData>;
  readonly batsman:  Readonly<CharacterAnimState>;
  readonly bowler:   Readonly<CharacterAnimState>;
  readonly feedback: Readonly<FeedbackState>;
  readonly round:    Readonly<RoundData>;
}

// ── Input union ───────────────────────────────────────────────────────────────

export type EngineInput =
  | { type: 'bowl';  outcome: DeliveryOutcome }
  | { type: 'swing' }
  | { type: 'reset' };   // called by bridge after result phase ends

// ── GameEngine ────────────────────────────────────────────────────────────────

export class GameEngine {
  // Public: UI layer subscribes to events here
  readonly events: EventBus;

  // ── Architecture ─────────────────────────────────────────────────────────
  private readonly sm:        StateMachine;
  private readonly ballSys:   BallSystem;
  private readonly hitSys:    HitSystem;
  private readonly animSys:   AnimationSystem;
  private readonly feedSys:   FeedbackSystem;
  private readonly roundSys:  RoundSystem;

  // ── State (engine owns, systems mutate via reference) ─────────────────────
  private readonly ball:     BallData     = {
    x: 0, y: 1.8, z: -9, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, elapsed: 0, params: null, active: false,
  };
  private readonly batsman:  CharacterAnimState = makeCharacterAnim();
  private readonly bowler:   CharacterAnimState = makeCharacterAnim();
  private readonly feedback: FeedbackState      = makeFeedbackState();
  private          round:    RoundData;

  // ── Internal flags ────────────────────────────────────────────────────────
  /** True once triggerSwing is received, until end of round. */
  private swingPending    = false;
  /** Signed: +1 off-side, -1 leg-side. Randomised per delivery. */
  private lateralSign     = 1;
  /** True when ball is in post_hit for a wicket (rolling toward stumps). */
  private wicketPostHit   = false;

  constructor() {
    this.events   = new EventBus();
    this.sm       = new StateMachine(this.events);
    this.ballSys  = new BallSystem();
    this.hitSys   = new HitSystem();
    this.animSys  = new AnimationSystem();
    this.feedSys  = new FeedbackSystem();
    this.roundSys = new RoundSystem();
    this.round    = this.roundSys.makeData();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Dispatch an input action from the bridge.
   * The engine validates it against the current state machine phase;
   * invalid actions are silently dropped.
   */
  handleInput(input: EngineInput): void {
    switch (input.type) {
      case 'bowl':  this.startBowl(input.outcome); break;
      case 'swing': this.registerSwing();           break;
      case 'reset': this.resetToIdle();             break;
    }
  }

  /**
   * Main update.  Called by GameLoop every frame.
   * Advances simulation by dt (already clamped by GameLoop).
   */
  update(dt: number): void {
    this.sm.tick(dt);

    // Hit-pause freezes ball/physics but not animations or particles.
    const physicsDt = this.feedSys.isPaused(this.feedback) ? 0 : dt;

    this.feedSys.update(this.feedback, dt);
    this.animSys.update(this.batsman, dt);
    this.animSys.update(this.bowler,  dt);

    const phase = this.sm.phase;

    if (phase === 'bowling')    this.tickBowling(physicsDt);
    else if (phase === 'hit_window') this.tickHitWindow(dt);
    else if (phase === 'post_hit')   this.tickPostHit(physicsDt);
    else if (phase === 'result')     this.tickResult();
  }

  /** Immutable snapshot for the Renderer. Cheap — no copies. */
  getSnapshot(): EngineSnapshot {
    return {
      phase:    this.sm.phase,
      ball:     this.ball,
      batsman:  this.batsman,
      bowler:   this.bowler,
      feedback: this.feedback,
      round:    this.round,
    };
  }

  // ── Private: phase logic ───────────────────────────────────────────────────

  private startBowl(outcome: DeliveryOutcome): void {
    if (!this.sm.transition('bowling')) return;

    this.swingPending   = false;
    this.lateralSign    = Math.random() > 0.5 ? 1 : -1;

    this.ballSys.bowl(this.ball, {
      bowlerType: outcome.bowlerType,
      hitTime:    outcome.hitTime,
      outcome:    outcome.result,
    });

    this.roundSys.startRound(this.round, outcome.targetMultiplier);
    this.animSys.reset(this.batsman);
    this.animSys.reset(this.bowler);
    this.animSys.startBowl(this.bowler);

    this.events.emit('bowlStart', {
      bowlerType: outcome.bowlerType,
      hitTime:    outcome.hitTime,
    });
  }

  private registerSwing(): void {
    if (this.swingPending) return;  // only one swing per delivery

    if (this.sm.is('bowling') || this.sm.is('hit_window')) {
      this.swingPending = true;

      // If we're already in hit_window, resolve immediately.
      // If still in bowling, the resolution fires when hit_window opens.
      if (this.sm.is('hit_window')) {
        this.resolveSwing();
      }
    }
  }

  private resolveSwing(): void {
    const params  = this.ball.params!;
    const quality = this.hitSys.evaluate(this.ball.elapsed, params.hitTime);

    // Animate batsman
    this.animSys.triggerSwing(this.batsman);

    // Trigger feedback (shake + pause + particles)
    this.feedSys.triggerHit(this.feedback, quality, {
      x: this.ball.x,
      y: this.ball.y,
      z: this.ball.z,
    });

    // Apply velocity (even on 'miss' so ball continues plausibly)
    this.ballSys.applyHitVelocity(this.ball, quality, this.lateralSign);

    // Round resolution
    this.roundSys.applyResult(this.round, quality);

    // Emit events
    this.events.emit('hit', {
      quality,
      vx: this.ball.vx,
      vy: this.ball.vy,
      vz: this.ball.vz,
    });
    this.events.emit('multiplier', { value: this.round.multiplier });

    if (quality === 'miss') {
      this.animSys.stump(this.batsman);
      this.sm.transition('result');
    } else {
      this.sm.transition('post_hit');
      this.animSys.followThrough(this.batsman);
    }
  }

  private tickBowling(dt: number): void {
    this.ballSys.updatePreHit(this.ball, dt);

    // Advance bowler run-up progress
    const hitTime   = this.ball.params!.hitTime;
    this.bowler.runT = Math.min(this.ball.elapsed / hitTime, 1);

    // Transition when ball enters batsman zone
    if (this.ballSys.isAtBatsman(this.ball)) {
      if (!this.sm.transition('hit_window')) return;
      // If swing was registered early (before window), resolve it now
      if (this.swingPending) this.resolveSwing();
    }
  }

  private tickHitWindow(dt: number): void {
    // Ball continues on pre-hit trajectory while the window is open
    this.ballSys.updatePreHit(this.ball, dt);

    const params = this.ball.params!;
    if (!this.hitSys.isWindowOpen(this.ball.elapsed, params.hitTime)) {
      // Window expired without a swing → auto wicket
      if (!this.swingPending) {
        this.swingPending = true;
        this.roundSys.applyResult(this.round, 'miss');
        this.animSys.stump(this.batsman);

        // Give ball realistic stumps-ward velocity before post_hit
        this.ball.vx = (Math.random() - 0.5) * 0.5;
        this.ball.vy = 0;
        this.ball.vz = 4.5;  // rolls toward batting stumps at Z = 0.6

        this.events.emit('hit', { quality: 'miss', vx: 0, vy: 0, vz: 0 });
        this.events.emit('multiplier', { value: 0 });
        this.wicketPostHit = true;
        this.sm.transition('post_hit');
      }
    }
  }

  private tickPostHit(dt: number): void {
    this.ballSys.updatePostHit(this.ball, dt);

    if (this.wicketPostHit) {
      // Wicket delivery: ball rolls toward stumps. End when it arrives or times out.
      const reachedStumps = this.ball.z >= WORLD.STUMPS_NEAR_Z;
      if (reachedStumps || this.sm.phaseTime >= 0.7) {
        this.wicketPostHit = false;
        this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
        this.sm.transition('result');
      }
      return;
    }

    // Normal post-hit: after enough flight time, settle into result
    if (this.sm.phaseTime >= TIMING.POST_HIT_MAX) {
      this.sm.transition('result');
      if (this.round.outcome === 'hit') this.animSys.celebrate(this.batsman);
      this.events.emit('roundEnd', {
        multiplier: this.round.multiplier,
        outcome:    this.round.outcome ?? 'wicket',
      });
    }
  }

  private tickResult(): void {
    // Hold in result until bridge calls handleInput({ type: 'reset' })
    // Nothing to tick — animations are still running via animSys.update() above.
  }

  private resetToIdle(): void {
    this.sm.reset();
    this.ball.active    = false;
    this.swingPending   = false;
    this.wicketPostHit  = false;
  }
}
