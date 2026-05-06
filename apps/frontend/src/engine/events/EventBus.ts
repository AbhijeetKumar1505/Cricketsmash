// ── Shared types ──────────────────────────────────────────────────────────────

export type HitQuality   = 'perfect' | 'good' | 'miss';
export type BowlerType   = 'fast' | 'spin' | 'swing';
export type RoundOutcome = 'hit' | 'wicket';

// ── Typed event map ───────────────────────────────────────────────────────────

export interface EngineEvents {
  /** Ball has been struck (or missed) — with resulting velocity for physics. */
  hit: {
    quality: HitQuality;
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
