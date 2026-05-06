import type { SkyObjectType } from '../sky/types.js';

// ── Shared types ──────────────────────────────────────────────────────────────

export type HitQuality   = 'perfect' | 'good' | 'miss';
export type BowlerType   = 'fast' | 'spin' | 'swing';
export type RoundOutcome = 'hit' | 'wicket';
export type OutcomeBucket = 'dot' | 'single' | 'double' | 'triple' | 'four' | 'six' | 'wicket';
export type BonusZone = 'ground' | 'stands' | 'boundary';
export type BonusType = 'plus1' | 'plus2' | 'plus3' | 'multiplier';
export type BonusRarityTier = 'common' | 'rare' | 'epic' | 'legendary';

// ── Typed event map ───────────────────────────────────────────────────────────

export interface EngineEvents {
  /** Ball has been struck (or missed) — with resulting velocity for physics. */
  hit: {
    quality: HitQuality;
    bucket: OutcomeBucket;
    vx: number; vy: number; vz: number;
  };

  /** Multiplier value during or after a delivery. */
  multiplier: { value: number };

  /** Engine phase changed — consumed by UI for transitions. */
  stateChange: { from: string; to: string };

  /** A new delivery has started — hitTime lets UI show a progress arc. */
  bowlStart: { bowlerType: BowlerType; hitTime: number };

  /** Round fully settled (ball stopped / wicket complete). */
  roundEnd: { multiplier: number; outcome: RoundOutcome };

  /** Bonus prop entered play for this delivery. */
  bonusSpawned: {
    sourceId: string;
    type: BonusType;
    zone: BonusZone;
    rarityTier: BonusRarityTier;
    worldPos: { x: number; y: number; z: number };
  };
  /** Bonus prop was struck by the ball before reward settlement. */
  bonusHit: {
    sourceId: string;
    type: BonusType;
    zone: BonusZone;
    rarityTier: BonusRarityTier;
    worldPos: { x: number; y: number; z: number };
  };
  /** Bonus prop expired without being hit. */
  bonusExpired: { sourceId: string };
  /** Ball touched a bonus object and awarded extra balls. */
  bonusAwarded: {
    sourceId: string;
    type: BonusType;
    zone: BonusZone;
    rarityTier: BonusRarityTier;
    extraBalls: number;
    /** >1 payout-preview multiplier (same session — see `game.bonusProfitMultProduct`). */
    profitMult: number;
    worldPos: { x: number; y: number; z: number };
  };

  /** Sky Object Lite — spawned for this delivery (standard mode). */
  skyObjectSpawned: {
    type: SkyObjectType;
    worldPos: { x: number; y: number; z: number };
  };
  skyObjectHit: {
    type: SkyObjectType;
    multiplier: 10 | 100;
    worldPos: { x: number; y: number; z: number };
  };
}

// ── EventBus ─────────────────────────────────────────────────────────────────

type Handler<T> = (payload: T) => void;

export class EventBus {
  // Internal map uses `any` because TypeScript cannot narrow Map<K, Set<Handler<K>>>
  // generically; the public API is fully typed through the overloads below.
  private readonly _map = new Map<keyof EngineEvents, Set<Handler<any>>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof EngineEvents>(
    event: K,
    handler: Handler<EngineEvents[K]>,
  ): () => void {
    let set = this._map.get(event);
    if (!set) { set = new Set(); this._map.set(event, set); }
    set.add(handler);
    return () => set!.delete(handler);
  }

  off<K extends keyof EngineEvents>(
    event: K,
    handler: Handler<EngineEvents[K]>,
  ): void {
    this._map.get(event)?.delete(handler);
  }

  emit<K extends keyof EngineEvents>(event: K, payload: EngineEvents[K]): void {
    this._map.get(event)?.forEach(h => h(payload));
  }

  clear(): void { this._map.clear(); }
}
