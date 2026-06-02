import type { GameEventBus } from './GameEventBus.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InsuranceState {
  active: boolean;
  /** Cost is 10× the current bet amount */
  cost: number;
  /** Whether insurance was triggered (used) this session */
  triggered: boolean;
  /** How many times insurance saved a wicket in the current session */
  saveCount: number;
}

// ── InsuranceManager ──────────────────────────────────────────────────────────

export class InsuranceManager {
  private _active = false;
  private _triggered = false;
  private _saveCount = 0;
  private _betAmount = 0;
  private _bus: GameEventBus | null = null;

  init(bus: GameEventBus): void {
    this._bus = bus;
  }

  /** Call whenever the bet amount changes so cost stays in sync. */
  setBetAmount(amount: number): void {
    this._betAmount = amount;
  }

  get cost(): number { return this._betAmount * 10; }

  getState(): InsuranceState {
    return {
      active:    this._active,
      cost:      this.cost,
      triggered: this._triggered,
      saveCount: this._saveCount,
    };
  }

  /**
   * Activate insurance for the next over.
   * Returns false if already active or balance insufficient.
   */
  activate(balance: number): boolean {
    if (this._active) return false;
    if (balance < this.cost) return false;

    this._active = true;
    this._triggered = false;
    this._bus?.emit('INSURANCE_ACTIVATED', { cost: this.cost });
    return true;
  }

  deactivate(): void {
    if (!this._active) return;
    this._active = false;
    this._bus?.emit('INSURANCE_DEACTIVATED', {});
  }

  /**
   * Called when a wicket occurs. If insurance is active, absorbs it.
   * Returns true if the wicket was saved (insurance triggered).
   */
  onWicket(): boolean {
    if (!this._active) return false;

    this._triggered = true;
    this._saveCount++;
    this._active = false; // Insurance consumed

    this._bus?.emit('INSURANCE_TRIGGERED', { saveCount: this._saveCount });
    return true;
  }

  /** Reset for a new session. */
  resetSession(): void {
    this._triggered = false;
    // Note: _active intentionally NOT reset — player bought it for this session
  }

  /** Full reset (on idle return). */
  reset(): void {
    this._active    = false;
    this._triggered = false;
    this._saveCount = 0;
  }
}

export const insuranceManager = new InsuranceManager();
