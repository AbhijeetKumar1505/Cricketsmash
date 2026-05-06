import { TIMING } from '../constants.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Anything that needs simulation stepping. */
export interface Updatable {
  update(dt: number): void;
}

/** Anything that draws to screen after a simulation step. */
export interface Renderable {
  render(): void;
}

// ── GameLoop ──────────────────────────────────────────────────────────────────

/**
 * Single requestAnimationFrame loop.
 *
 * Contract:
 *   1. Computes dt from real wall-clock time.
 *   2. Clamps dt to TIMING.MAX_DT so a stalled tab never causes a physics spike.
 *   3. Calls updatable.update(dt) — game logic only.
 *   4. Calls renderable.render()  — Three.js draw only.
 *   5. Owns no game state itself.
 */
export class GameLoop {
  private rafId    = 0;
  private lastTime = 0;
  private running  = false;

  constructor(
    private readonly updatable:  Updatable,
    private readonly renderable: Renderable,
  ) {}

  start(): void {
    if (this.running) return;
    this.running  = true;
    this.lastTime = performance.now();
    this.rafId    = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  get isRunning(): boolean { return this.running; }

  private readonly tick = (timestamp: number): void => {
    if (!this.running) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    const dt    = Math.min(rawDt, TIMING.MAX_DT);
    this.lastTime = timestamp;

    this.updatable.update(dt);
    this.renderable.render();

    this.rafId = requestAnimationFrame(this.tick);
  };
}
