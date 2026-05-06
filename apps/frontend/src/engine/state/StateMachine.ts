import type { EventBus } from '../events/EventBus.js';

// ── Phase enum ────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'idle'        // waiting for next delivery command
  | 'bowling'     // ball in flight, pre-hit trajectory
  | 'hit_window'  // ball at batsman — swing input valid
  | 'post_hit'    // ball struck — physics running
  | 'result';     // showing outcome before returning to idle

// ── Transition table ──────────────────────────────────────────────────────────
//
// Only listed edges are legal. Anything else is logged and rejected.
//   idle → bowling
//   bowling → hit_window (ball arrives at batsman zone)
//   hit_window → post_hit (batsman swings and connects)
//   hit_window → result   (window expired — auto wicket)
//   post_hit → result     (ball settled / over boundary)
//   result → idle         (UI done showing result)

const EDGES: Partial<Record<GamePhase, readonly GamePhase[]>> = {
  idle:       ['bowling'],
  bowling:    ['hit_window'],
  hit_window: ['post_hit', 'result'],
  post_hit:   ['result'],
  result:     ['idle'],
};

// ── StateMachine ──────────────────────────────────────────────────────────────

export class StateMachine {
  private _phase: GamePhase = 'idle';

  /** Elapsed time inside the current phase (seconds). */
  private _phaseTime = 0;

  constructor(private readonly bus: EventBus) {}

  get phase(): GamePhase { return this._phase; }

  /** Elapsed seconds since the last phase transition. */
  get phaseTime(): number { return this._phaseTime; }

  is(phase: GamePhase): boolean { return this._phase === phase; }

  /**
   * Attempt a transition. Returns true if successful, false if the edge is
   * not in the transition table (caller decides whether to warn/throw).
   */
  transition(to: GamePhase): boolean {
    if (!EDGES[this._phase]?.includes(to)) {
      // Vite sets DEV; guarded to avoid TS errors in non-Vite contexts
      try { if ((import.meta as any).env?.DEV) console.warn(`[StateMachine] Invalid: ${this._phase} → ${to}`); } catch { /**/ }
      return false;
    }
    const from = this._phase;
    this._phase = to;
    this._phaseTime = 0;
    this.bus.emit('stateChange', { from, to });
    return true;
  }

  /** Called by GameEngine each frame to advance phase timer. */
  tick(dt: number): void {
    this._phaseTime += dt;
  }

  reset(): void {
    this._phase = 'idle';
    this._phaseTime = 0;
  }
}
