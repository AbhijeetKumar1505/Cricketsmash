import type { EventBus } from '../events/EventBus.js';

// ── Phase enum ────────────────────────────────────────────────────────────────

export enum GameState {
  IDLE = 'IDLE',
  BETTING = 'BETTING',
  BOWLER_RUNUP = 'BOWLER_RUNUP',
  BALL_RELEASE = 'BALL_RELEASE',
  BALL_TRAVEL = 'BALL_TRAVEL',
  HIT = 'HIT',
  BALL_RESULT = 'BALL_RESULT',
  RESET = 'RESET',
}

// ── Transition table ──────────────────────────────────────────────────────────
//
// Only listed edges are legal. Anything else is logged and rejected.
//   idle → bowling
//   bowling → hit_window (ball arrives at batsman zone)
//   hit_window → post_hit (batsman swings and connects)
//   hit_window → result   (window expired — auto wicket)
//   post_hit → result     (ball settled / over boundary)
//   result → idle         (UI done showing result)

const EDGES: Partial<Record<GameState, readonly GameState[]>> = {
  [GameState.IDLE]: [GameState.BETTING],
  [GameState.BETTING]: [GameState.BOWLER_RUNUP],
  [GameState.BOWLER_RUNUP]: [GameState.BALL_RELEASE],
  [GameState.BALL_RELEASE]: [GameState.BALL_TRAVEL],
  [GameState.BALL_TRAVEL]: [GameState.HIT],
  [GameState.HIT]: [GameState.BALL_RESULT],
  [GameState.BALL_RESULT]: [GameState.RESET],
  [GameState.RESET]: [GameState.IDLE],
};

// ── StateMachine ──────────────────────────────────────────────────────────────

export class StateMachine {
  private _phase: GameState = GameState.IDLE;

  /** Elapsed time inside the current phase (seconds). */
  private _phaseTime = 0;

  constructor(private readonly bus: EventBus) {}

  get phase(): GameState { return this._phase; }

  /** Elapsed seconds since the last phase transition. */
  get phaseTime(): number { return this._phaseTime; }

  is(phase: GameState): boolean { return this._phase === phase; }

  /**
   * Attempt a transition. Returns true if successful, false if the edge is
   * not in the transition table (caller decides whether to warn/throw).
   */
  transition(to: GameState): boolean {
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
    this._phase = GameState.IDLE;
    this._phaseTime = 0;
  }
}
