/**
 * animationFSM.ts — Decoupled animation state machines.
 *
 * BowlerFSM   RUN_UP → GATHER → ARM_SWING → RELEASE → FOLLOW_THROUGH
 * BatsmanFSM  IDLE → BACKLIFT → SWING → CONTACT → FOLLOW_THROUGH
 *
 * Design rules:
 *   • No physics coupling — these are pure animation state containers.
 *   • Callbacks (onRelease, onContact) bridge to physics without creating
 *     circular dependencies.
 *   • Each FSM exposes eased progress values ready for use by playerAnimator.
 *   • Durations match the existing GameEngine phase timing.
 *
 * THREE.js-free.
 */

import { clamp, smoothstep } from './physics.js';

function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t: number):  number { return t * t; }
function easeInOut(t: number):   number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ── Generic FSM state snapshot ─────────────────────────────────────────────────

export interface FSMSnapshot<P extends string> {
  /** Current phase label. */
  phase:     P;
  /** Seconds elapsed within the current phase. */
  elapsed:   number;
  /** Normalised progress [0, 1] within the current phase. */
  progress:  number;
  /**
   * Overall delivery progress [0, 1] across the full animation sequence.
   * Maps to the `runT` used by playerAnimator for smooth arm interpolation.
   */
  runT:      number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOWLER FSM
// ═══════════════════════════════════════════════════════════════════════════════

export type BowlerPhase =
  | 'IDLE'
  | 'RUN_UP'
  | 'GATHER'
  | 'ARM_SWING'
  | 'RELEASE'
  | 'FOLLOW_THROUGH';

/**
 * Phase durations (seconds).
 * Total active duration = 0.55 + 0.20 + 0.18 + 0.06 + 0.55 = 1.54 s
 * This is deliberately close to the GameEngine `hitTime` for fast bowlers
 * so the arm sweep aligns with ball travel.
 */
const BOWLER_DUR: Record<BowlerPhase, number> = {
  IDLE:           Infinity,
  RUN_UP:         0.55,
  GATHER:         0.20,
  ARM_SWING:      0.18,
  RELEASE:        0.06,
  FOLLOW_THROUGH: 0.55,
};

const BOWLER_TOTAL =
  BOWLER_DUR.RUN_UP + BOWLER_DUR.GATHER +
  BOWLER_DUR.ARM_SWING + BOWLER_DUR.RELEASE +
  BOWLER_DUR.FOLLOW_THROUGH;

export class BowlerFSM {
  private _phase: BowlerPhase = 'IDLE';
  private _elapsed  = 0;
  private _totalRun = 0;

  /**
   * Fires exactly once at the start of RELEASE phase.
   * Connect: `fsm.onRelease = () => engine.spawnBall()`
   */
  onRelease: (() => void) | null = null;

  /**
   * Fires when FOLLOW_THROUGH completes and FSM returns to IDLE.
   */
  onComplete: (() => void) | null = null;

  // ── State snapshot ──────────────────────────────────────────────────────────

  get snapshot(): FSMSnapshot<BowlerPhase> {
    const dur = BOWLER_DUR[this._phase];
    return {
      phase:    this._phase,
      elapsed:  this._elapsed,
      progress: dur === Infinity ? 0 : clamp(this._elapsed / dur, 0, 1),
      runT:     clamp(this._totalRun / BOWLER_TOTAL, 0, 1),
    };
  }

  get phase(): BowlerPhase { return this._phase; }

  // ── Eased progress helpers (consumed by playerAnimator) ─────────────────────

  /** Run-up bounce intensity (easeOutQuad). */
  get runUpEased(): number {
    return this._phase === 'RUN_UP'
      ? easeOutQuad(clamp(this._elapsed / BOWLER_DUR.RUN_UP, 0, 1))
      : 0;
  }

  /** Gather cock intensity (smoothstep). */
  get gatherEased(): number {
    return this._phase === 'GATHER'
      ? smoothstep(clamp(this._elapsed / BOWLER_DUR.GATHER, 0, 1))
      : 0;
  }

  /** Arm sweep arc (easeInQuad — fast at start, decelerates). */
  get armSwingEased(): number {
    return this._phase === 'ARM_SWING'
      ? easeInQuad(clamp(this._elapsed / BOWLER_DUR.ARM_SWING, 0, 1))
      : 0;
  }

  /** Follow-through inertia — easeInOut so deceleration feels natural. */
  get followThroughEased(): number {
    return this._phase === 'FOLLOW_THROUGH'
      ? easeInOut(clamp(this._elapsed / BOWLER_DUR.FOLLOW_THROUGH, 0, 1))
      : 0;
  }

  // ── Control ─────────────────────────────────────────────────────────────────

  /** Begin a new delivery cycle. */
  start(): void {
    this._totalRun = 0;
    this._enter('RUN_UP');
  }

  reset(): void {
    this._phase    = 'IDLE';
    this._elapsed  = 0;
    this._totalRun = 0;
  }

  /** Advance the FSM by `dt` seconds. Call every game tick. */
  update(dt: number): void {
    if (this._phase === 'IDLE') return;
    this._elapsed   += dt;
    this._totalRun  += dt;

    const dur = BOWLER_DUR[this._phase];
    if (this._elapsed >= dur) this._advance();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _enter(phase: BowlerPhase): void {
    this._phase   = phase;
    this._elapsed = 0;
    if (phase === 'RELEASE') this.onRelease?.();
  }

  private _advance(): void {
    switch (this._phase) {
      case 'RUN_UP':         this._enter('GATHER');         break;
      case 'GATHER':         this._enter('ARM_SWING');      break;
      case 'ARM_SWING':      this._enter('RELEASE');        break;
      case 'RELEASE':        this._enter('FOLLOW_THROUGH'); break;
      case 'FOLLOW_THROUGH': this._enter('IDLE'); this.onComplete?.(); break;
      default: break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATSMAN FSM
// ═══════════════════════════════════════════════════════════════════════════════

export type BatsmanPhase =
  | 'IDLE'
  | 'BACKLIFT'
  | 'SWING'
  | 'CONTACT'
  | 'FOLLOW_THROUGH';

/**
 * Phase durations (seconds).
 * CONTACT must align with the physics hit frame — kept very short (1 frame @60fps).
 */
const BATSMAN_DUR: Record<BatsmanPhase, number> = {
  IDLE:           Infinity,
  BACKLIFT:       0.28,
  SWING:          0.16,   // bat sweeps through strike zone
  CONTACT:        0.017,  // ≈ 1 physics frame — aligns with physics hit
  FOLLOW_THROUGH: 0.60,
};

const BATSMAN_ACTIVE_TOTAL =
  BATSMAN_DUR.BACKLIFT + BATSMAN_DUR.SWING +
  BATSMAN_DUR.CONTACT  + BATSMAN_DUR.FOLLOW_THROUGH;

export class BatsmanFSM {
  private _phase:   BatsmanPhase = 'IDLE';
  private _elapsed  = 0;
  private _totalRun = 0;

  /**
   * Fires at the start of CONTACT phase.
   * Connect: `fsm.onContact = () => engine.resolveHit()`
   * IMPORTANT: called synchronously inside update() — caller must NOT
   * mutate the FSM inside this callback (no re-entrancy).
   */
  onContact: (() => void) | null = null;

  /** Fires when FOLLOW_THROUGH completes (bat back at rest). */
  onComplete: (() => void) | null = null;

  // ── State snapshot ──────────────────────────────────────────────────────────

  get snapshot(): FSMSnapshot<BatsmanPhase> {
    const dur = BATSMAN_DUR[this._phase];
    return {
      phase:    this._phase,
      elapsed:  this._elapsed,
      progress: dur === Infinity ? 0 : clamp(this._elapsed / dur, 0, 1),
      runT:     clamp(this._totalRun / BATSMAN_ACTIVE_TOTAL, 0, 1),
    };
  }

  get phase(): BatsmanPhase { return this._phase; }
  get isIdle(): boolean { return this._phase === 'IDLE'; }

  // ── Eased progress helpers ───────────────────────────────────────────────────

  /** Back-lift raise amount (easeInOut). */
  get backliftEased(): number {
    return this._phase === 'BACKLIFT'
      ? easeInOut(clamp(this._elapsed / BATSMAN_DUR.BACKLIFT, 0, 1))
      : (this._phase !== 'IDLE' ? 1 : 0);
  }

  /**
   * Swing arc (easeOutQuad — fast start, decelerates at contact).
   * Bat swing easing curve as required by spec.
   */
  get swingEased(): number {
    if (this._phase === 'SWING') {
      return easeOutQuad(clamp(this._elapsed / BATSMAN_DUR.SWING, 0, 1));
    }
    if (this._phase === 'CONTACT' || this._phase === 'FOLLOW_THROUGH') return 1;
    return 0;
  }

  /** Contact impact flash (0→1 during CONTACT phase). */
  get contactImpact(): number {
    return this._phase === 'CONTACT'
      ? smoothstep(clamp(this._elapsed / BATSMAN_DUR.CONTACT, 0, 1))
      : 0;
  }

  /** Follow-through completion (easeInOut — natural deceleration). */
  get followThroughEased(): number {
    return this._phase === 'FOLLOW_THROUGH'
      ? easeInOut(clamp(this._elapsed / BATSMAN_DUR.FOLLOW_THROUGH, 0, 1))
      : 0;
  }

  // ── Control ─────────────────────────────────────────────────────────────────

  /**
   * Begin raising bat in anticipation of delivery.
   * Ignored if already in an active swing phase.
   */
  startBacklift(): void {
    if (this._phase !== 'IDLE') return;
    this._totalRun = 0;
    this._enter('BACKLIFT');
  }

  /**
   * User / auto triggers the swing.
   * Drives directly into SWING regardless of backlift progress
   * (short backlift still looks fine for a reactive shot).
   */
  triggerSwing(): void {
    if (this._phase === 'IDLE' || this._phase === 'FOLLOW_THROUGH') return;
    this._enter('SWING');
  }

  reset(): void {
    this._phase    = 'IDLE';
    this._elapsed  = 0;
    this._totalRun = 0;
  }

  /** Advance FSM by `dt` seconds. Call every game tick. */
  update(dt: number): void {
    if (this._phase === 'IDLE') return;
    this._elapsed   += dt;
    this._totalRun  += dt;

    const dur = BATSMAN_DUR[this._phase];
    if (this._elapsed >= dur) this._advance();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _enter(phase: BatsmanPhase): void {
    this._phase   = phase;
    this._elapsed = 0;
    if (phase === 'CONTACT') this.onContact?.();
  }

  private _advance(): void {
    switch (this._phase) {
      case 'BACKLIFT':       this._enter('SWING');          break;
      case 'SWING':          this._enter('CONTACT');        break;
      case 'CONTACT':        this._enter('FOLLOW_THROUGH'); break;
      case 'FOLLOW_THROUGH': this._enter('IDLE'); this.onComplete?.(); break;
      default: break;
    }
  }
}
