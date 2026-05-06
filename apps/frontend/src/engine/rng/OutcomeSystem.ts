import { HIT_TIMES } from '../constants.js';
import type { BowlerType } from '../events/EventBus.js';
import type { SkyObjectMeta } from '../sky/types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OutcomeBucket = 'dot' | 'single' | 'double' | 'triple' | 'four' | 'six' | 'wicket';

export interface DeliveryOutcome {
  result:           'hit' | 'wicket';
  bowlerType:       BowlerType;
  /** Seconds for ball to reach batsman. Derived from bowlerType. */
  hitTime:          number;
  /**
   * Intended result multiplier for a hit.
   * 0 on a wicket.  GameController passes this from the server or SDK.
   */
  targetMultiplier: number;
  bucket: OutcomeBucket;
  /** Standard-mode sky bonus metadata (optional). */
  skyObject?: SkyObjectMeta | null;
}

export type ShotRuns = 0 | 1 | 2 | 3 | 4 | 6;

export interface ShotResult {
  runs: ShotRuns;
  direction: number; // angle in radians
  power: number;     // 0..1
  airTime: number;   // seconds
  isCatch: boolean;
}

// ── OutcomeSystem ─────────────────────────────────────────────────────────────
//
// In production the outcome comes from the server (Stake RGS or backend seed).
// This class wraps the conversion from raw server data into a typed DeliveryOutcome,
// and also provides a local RNG fallback for local/dev mode.

export class OutcomeSystem {
  /**
   * Convert a delivery outcome to a deterministic shot profile.
   * This is generated before animation starts and never mutated mid-flight.
   */
  toShotResult(outcome: DeliveryOutcome): ShotResult {
    if (outcome.result === 'wicket' || outcome.bucket === 'wicket') {
      return { runs: 0, direction: 0, power: 0, airTime: 0, isCatch: true };
    }

    const runs = this.runsFromBucket(outcome.bucket);
    const spreadDeg = runs >= 4 ? 120 : 60;
    const scalar = this.stableScalar(outcome);
    const direction = ((scalar * 2) - 1) * (spreadDeg * Math.PI / 180) * 0.5;
    const power = runs === 6 ? 1 : runs === 4 ? 0.8 : runs === 3 ? 0.65 : runs === 2 ? 0.5 : 0.3;
    const airTime = runs === 6 ? 1.8 : runs === 4 ? 1.2 : runs === 3 ? 1.0 : runs === 2 ? 0.8 : 0.5;
    return { runs, direction, power, airTime, isCatch: false };
  }

  /**
   * Convert server-supplied result data into a DeliveryOutcome.
   * Call this before triggering a new bowl.
   */
  fromServer(
    result:          'hit' | 'wicket',
    bowlerType:      BowlerType,
    targetMultiplier: number,
    bucket?: OutcomeBucket,
    skyObject?: SkyObjectMeta | null,
  ): DeliveryOutcome {
    const resolvedBucket = result === 'wicket'
      ? 'wicket'
      : (bucket ?? this.bucketFromMultiplier(targetMultiplier));
    return {
      result,
      bowlerType,
      hitTime:          HIT_TIMES[bowlerType],
      targetMultiplier: result === 'wicket' ? 0 : targetMultiplier,
      bucket: resolvedBucket,
      skyObject: skyObject ?? undefined,
    };
  }

  /**
   * Client-side RNG for local/demo mode.
   * Not used in Stake or realtime modes.
   */
  localRandom(): DeliveryOutcome {
    const types: BowlerType[] = ['fast', 'spin', 'swing'];
    const bowlerType          = types[Math.floor(Math.random() * 3)];
    const isWicket            = Math.random() < 0.28;   // 28% wicket rate
    const mult                = isWicket ? 0 : parseFloat((1.2 + Math.random() * 8).toFixed(2));
    const bucket              = isWicket ? 'wicket' : this.bucketFromMultiplier(mult);

    return {
      result:           isWicket ? 'wicket' : 'hit',
      bowlerType,
      hitTime:          HIT_TIMES[bowlerType],
      targetMultiplier: mult,
      bucket,
    };
  }

  bucketFromRuns(runs: number): OutcomeBucket {
    if (runs <= 0) return 'dot';
    if (runs === 1) return 'single';
    if (runs === 2) return 'double';
    if (runs === 3) return 'triple';
    if (runs === 4) return 'four';
    return 'six';
  }

  runsFromBucket(bucket: OutcomeBucket): ShotRuns {
    switch (bucket) {
      case 'single': return 1;
      case 'double': return 2;
      case 'triple': return 3;
      case 'four': return 4;
      case 'six': return 6;
      case 'dot':
      case 'wicket':
      default:
        return 0;
    }
  }

  bucketFromMultiplier(multiplier: number): OutcomeBucket {
    if (!Number.isFinite(multiplier) || multiplier <= 0) return 'wicket';
    if (multiplier < 1.05) return 'dot';
    if (multiplier < 1.35) return 'single';
    if (multiplier < 1.75) return 'double';
    if (multiplier < 2.25) return 'triple';
    if (multiplier < 4.6) return 'four';
    return 'six';
  }

  private stableScalar(outcome: DeliveryOutcome): number {
    const seed = `${outcome.targetMultiplier.toFixed(3)}:${outcome.bucket}:${outcome.bowlerType}:${outcome.hitTime.toFixed(3)}`;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }
}
