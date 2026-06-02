/**
 * animTelemetry — dev-only animation measurement dashboard.
 *
 * Collects per-delivery metrics and aggregates them on demand. Zero runtime
 * cost in production — all collection is gated by `ANIM_TELEMETRY_ENABLED`
 * which is set from the `window.__anim` setup block (only in the browser).
 *
 * Usage:
 *   window.__anim.getContactStats()   → IK accuracy with percentiles
 *   window.__anim.getPhaseStats()     → FSM phase durations per shot type
 *   window.__anim.getBalanceStats()   → balance recovery amplitude per outcome
 *   window.__anim.resetStats()        → clear all collected data
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryRecord {
  shotType:     string;
  outcome:      string;
  errBall:      number;   // bat sweet-spot → actual ball world pos (visual accuracy)
  errTarget:    number;   // bat sweet-spot → predicted contactPointWorld (IK tracking)
  backlift:     number;
  swing:        number;
  contact:      number;
  followThrough:number;
  maxBalanceMag:number;
}

export interface ContactStats {
  count: number; avg: number; p50: number; p95: number; p99: number; max: number;
  byShotType: Record<string, { count: number; avg: number; p95: number }>;
}

/** Two parallel series: bat→ball (visual) and bat→predicted-target (IK tracking). */
export interface ContactStatsPair {
  vsBall:   ContactStats;
  vsTarget: ContactStats;
}

export interface PhaseStats {
  deliveries:       number;
  backliftAvg:      number;
  swingAvg:         number;
  followThroughAvg: number;
  byShotType: Record<string, { swingAvg: number; followThroughAvg: number }>;
}

export interface BalanceStats {
  byOutcome: Record<string, { count: number; avg: number; max: number }>;
}

// ── AnimTelemetry ─────────────────────────────────────────────────────────────

class AnimTelemetry {
  private _records: DeliveryRecord[] = [];

  // Per-delivery accumulator — reset at IDLE→BACKLIFT
  private _curErrBall       = 0;
  private _curErrTarget     = 0;
  private _curPhaseStart    = 0;
  private _curPhase         = '';
  private _curPhaseDur: Record<string, number> = {};

  // ── Collection API (called from AnimationBrain / BattingController) ────────

  /**
   * Called every CONTACT-phase frame from the Renderer (only place with the
   * real bat mesh). Last value before phase ends is the final contact error.
   * @param errBall   bat sweet-spot → actual ball world position (metres)
   * @param errTarget bat sweet-spot → predicted contactPointWorld (metres)
   */
  setContactError(errBall: number, errTarget: number): void {
    this._curErrBall   = errBall;
    this._curErrTarget = errTarget;
  }

  /**
   * Called from AnimationBrain whenever snap.batsmanFSM.phase changes.
   * `elapsed` is AnimationBrain._t at the moment of the change.
   */
  onPhaseChange(newPhase: string, elapsed: number): void {
    // Finalise outgoing phase duration
    if (this._curPhase) {
      this._curPhaseDur[this._curPhase] = elapsed - this._curPhaseStart;
    }
    // New delivery begins at BACKLIFT — reset per-delivery state
    if (newPhase === 'BACKLIFT') {
      this._curErrBall   = 0;
      this._curErrTarget = 0;
      this._curPhaseDur = {};
    }
    this._curPhase     = newPhase;
    this._curPhaseStart = elapsed;
  }

  /**
   * Called from BattingController at FOLLOW_THROUGH→IDLE transition.
   * Finalises and stores the delivery record.
   */
  onDeliveryEnd(shotType: string, outcome: string | null, peakBalanceMag: number): void {
    this._records.push({
      shotType,
      outcome:       outcome ?? 'unknown',
      errBall:       this._curErrBall,
      errTarget:     this._curErrTarget,
      backlift:      this._curPhaseDur['BACKLIFT']      ?? 0,
      swing:         this._curPhaseDur['SWING']         ?? 0,
      contact:       this._curPhaseDur['CONTACT']       ?? 0,
      followThrough: this._curPhaseDur['FOLLOW_THROUGH'] ?? 0,
      maxBalanceMag: peakBalanceMag,
    });
  }

  // ── Aggregation (compute on demand, no per-frame work) ────────────────────

  getContactStats(): ContactStatsPair {
    return {
      vsBall:   this._statsFor(r => r.errBall),
      vsTarget: this._statsFor(r => r.errTarget),
    };
  }

  /**
   * Aggregate one error series with percentiles + per-shot-type breakdown.
   * Validity gate: errBall > 0 (a delivery that actually reached CONTACT).
   */
  private _statsFor(sel: (r: DeliveryRecord) => number): ContactStats {
    const records = this._records.filter(r => r.errBall > 0);
    if (records.length === 0) return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0, byShotType: {} };

    const sorted = records.map(sel).sort((a, b) => a - b);
    const sum    = sorted.reduce((a, b) => a + b, 0);

    const pct = (arr: number[], p: number) =>
      arr[Math.min(Math.floor(arr.length * p), arr.length - 1)] ?? 0;

    const byShotType: Record<string, { count: number; avg: number; p95: number }> = {};
    for (const r of records) {
      if (!byShotType[r.shotType]) byShotType[r.shotType] = { count: 0, avg: 0, p95: 0 };
      byShotType[r.shotType].count++;
      byShotType[r.shotType].avg += sel(r);
    }
    for (const st of Object.keys(byShotType)) {
      const stRecs = records.filter(r => r.shotType === st).map(sel).sort((a,b)=>a-b);
      byShotType[st].avg = byShotType[st].avg / byShotType[st].count;
      byShotType[st].p95 = pct(stRecs, 0.95);
    }

    return {
      count: sorted.length,
      avg:   sum / sorted.length,
      p50:   pct(sorted, 0.50),
      p95:   pct(sorted, 0.95),
      p99:   pct(sorted, 0.99),
      max:   sorted[sorted.length - 1]!,
      byShotType,
    };
  }

  getPhaseStats(): PhaseStats {
    const n = this._records.length;
    if (n === 0) return { deliveries: 0, backliftAvg: 0, swingAvg: 0, followThroughAvg: 0, byShotType: {} };

    const sum = (key: keyof DeliveryRecord) =>
      this._records.reduce((a, r) => a + (r[key] as number), 0);

    const byShotType: Record<string, { swingAvg: number; followThroughAvg: number }> = {};
    const grouped: Record<string, DeliveryRecord[]> = {};
    for (const r of this._records) {
      (grouped[r.shotType] ??= []).push(r);
    }
    for (const [st, recs] of Object.entries(grouped)) {
      byShotType[st] = {
        swingAvg:         recs.reduce((a, r) => a + r.swing, 0) / recs.length,
        followThroughAvg: recs.reduce((a, r) => a + r.followThrough, 0) / recs.length,
      };
    }

    return {
      deliveries:       n,
      backliftAvg:      sum('backlift') / n,
      swingAvg:         sum('swing') / n,
      followThroughAvg: sum('followThrough') / n,
      byShotType,
    };
  }

  getBalanceStats(): BalanceStats {
    const byOutcome: Record<string, { count: number; avg: number; max: number }> = {};
    for (const r of this._records) {
      const o = byOutcome[r.outcome] ??= { count: 0, avg: 0, max: 0 };
      o.count++;
      o.avg += r.maxBalanceMag;
      if (r.maxBalanceMag > o.max) o.max = r.maxBalanceMag;
    }
    for (const o of Object.values(byOutcome)) {
      o.avg = o.avg / o.count;
    }
    return { byOutcome };
  }

  resetStats(): void {
    this._records = [];
    this._curErrBall   = 0;
    this._curErrTarget = 0;
    this._curPhaseDur = {};
    this._curPhase = '';
  }
}

export const anim_telemetry = new AnimTelemetry();
