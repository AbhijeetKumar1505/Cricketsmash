/**
 * EngineBridge — the ONLY integration point between Svelte and the game engine.
 *
 * Responsibilities:
 *   • Create and wire GameEngine + Renderer + GameLoop on mount.
 *   • Forward UI input → engine.handleInput()
 *   • Subscribe to engine events → call provided callbacks (Svelte sets these).
 *   • Resize on canvas resize.
 *   • Clean up on unmount.
 *
 * Svelte components must NOT import from engine/ or render/ directly.
 */

import { GameEngine }    from '../engine/GameEngine.js';
import { Renderer }      from '../render/Renderer.js';
import { GameLoop }      from '../engine/loop/GameLoop.js';
import { OutcomeSystem } from '../engine/rng/OutcomeSystem.js';
import type { DeliveryOutcome } from '../engine/rng/OutcomeSystem.js';
import type { HitQuality, RoundOutcome } from '../engine/events/EventBus.js';

// ── Callback types ────────────────────────────────────────────────────────────

export interface BridgeCallbacks {
  onHitResult:       (quality: HitQuality)  => void;
  onMultiplier:      (value: number)        => void;
  onRoundEnd:        (multiplier: number, outcome: RoundOutcome) => void;
  onStateChange?:    (from: string, to: string) => void;
  onBowlStart?:      (bowlerType: string, hitTime: number) => void;
}

// Re-export so game controller can type bowl params without importing engine
export type { DeliveryOutcome };

// ── EngineBridge ──────────────────────────────────────────────────────────────

export class EngineBridge {
  private readonly engine:   GameEngine;
  private readonly renderer: Renderer;
  private readonly loop:     GameLoop;
  private readonly outcomes: OutcomeSystem;

  /** Unsubscribe callbacks from engine events. Collected on init. */
  private readonly _unsubs: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.engine   = new GameEngine();
    this.renderer = new Renderer(canvas, width, height);
    this.outcomes = new OutcomeSystem();

    // The loop is the single rAF: engine.update → renderer.render
    this.loop = new GameLoop(
      {
        update: (dt) => {
          this.engine.update(dt);
          // Push the latest snapshot to the renderer after each engine tick
          this.renderer.setSnapshot(this.engine.getSnapshot());
        },
      },
      this.renderer,   // renderer.render() is called by GameLoop
    );
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  destroy(): void {
    this.stop();
    this._unsubs.forEach(fn => fn());
    this._unsubs.length = 0;
    this.renderer.dispose();
    this.engine.events.clear();
  }

  /**
   * Wire Svelte callbacks. Call once after creating the bridge.
   * All subscriptions are cleaned up in destroy().
   */
  setCallbacks(cb: BridgeCallbacks): void {
    this._unsubs.push(
      this.engine.events.on('hit', ({ quality }) => {
        cb.onHitResult(quality);
      }),
      this.engine.events.on('multiplier', ({ value }) => {
        cb.onMultiplier(value);
      }),
      this.engine.events.on('roundEnd', ({ multiplier, outcome }) => {
        cb.onRoundEnd(multiplier, outcome);
      }),
    );

    if (cb.onStateChange) {
      this._unsubs.push(
        this.engine.events.on('stateChange', ({ from, to }) => {
          cb.onStateChange!(from, to);
        }),
      );
    }

    if (cb.onBowlStart) {
      this._unsubs.push(
        this.engine.events.on('bowlStart', ({ bowlerType, hitTime }) => {
          cb.onBowlStart!(bowlerType, hitTime);
        }),
      );
    }
  }

  // ── UI → Engine commands ──────────────────────────────────────────────────

  /**
   * Start a new delivery. Pass a pre-computed DeliveryOutcome from the server.
   * For local/demo mode, pass null to get a random outcome.
   */
  triggerBowl(outcome?: DeliveryOutcome | null): void {
    const resolved = outcome ?? this.outcomes.localRandom();
    this.engine.handleInput({ type: 'bowl', outcome: resolved });
  }

  /** Register a swing input. Call on user tap / click / key press. */
  triggerSwing(): void {
    this.engine.handleInput({ type: 'swing' });
  }

  /** Signal that the result phase is done — engine returns to idle. */
  triggerReset(): void {
    this.engine.handleInput({ type: 'reset' });
  }

  // ── Canvas management ─────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }

  /** Push scoreboard state to the 3D stadium display. */
  updateScoreboard(ballIdx: number, totalBalls: number, multiplier: number): void {
    this.renderer.updateScoreboard(ballIdx, totalBalls, multiplier);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Build a DeliveryOutcome from server-supplied data.
   * Use this when gameController already has the round result.
   */
  makeOutcome(
    result:          'hit' | 'wicket',
    bowlerType:      'fast' | 'spin' | 'swing',
    targetMultiplier: number,
  ): DeliveryOutcome {
    return this.outcomes.fromServer(result, bowlerType, targetMultiplier);
  }
}
