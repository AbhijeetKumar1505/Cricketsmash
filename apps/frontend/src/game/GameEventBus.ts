// Game-level event bus — separate from the engine's EngineEvents.
// Use for UI ↔ game-logic communication (insurance, difficulty, bonus buy).

export interface GameEvents {
  // Insurance
  INSURANCE_ACTIVATED:   { cost: number };
  INSURANCE_DEACTIVATED: Record<string, never>;
  INSURANCE_TRIGGERED:   { saveCount: number };

  // Difficulty / character
  DIFFICULTY_CHANGED:    { difficulty: string; batsman: string };
  CHARACTER_SWITCHED:    { role: 'batsman' | 'fielder' | 'bowler'; id: string };

  // Bonus buy
  BONUS_BUY_REQUESTED:   { betAmount: number };
  BONUS_BUY_STARTED:     { betAmount: number };

  // Hit popup
  HIT_POPUP:             {
    quality: 'perfect' | 'good' | 'edge' | 'miss';
    multiplier: number;
    worldX: number;
    worldY: number;
    worldZ: number;
  };

  // Fielder swap (insurance visual)
  FIELDER_SWAP:          { from: string; to: string; explosion: boolean };

  // Generic notification
  TOAST:                 { text: string; color: string; key: number };

  // Hit-flash overlay (Phase 4) — full-screen white pulse on bat contact
  HIT_FLASH:             { intensity: number; key: number };

  // Direct contact audio — emitted at EXACT contact frame, bypasses $effect latency
  HIT_AUDIO:             { intensity: number; quality: string; vx: number };

  // Swing start — emitted when batsman begins swing phase (for pre-swing whoosh)
  SWING_AUDIO:           Record<string, never>;
}

type Handler<T> = (payload: T) => void;

export class GameEventBus {
  private readonly _map = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this._map.get(event);
    if (!set) { set = new Set(); this._map.set(event, set); }
    set.add(handler);
    return () => set!.delete(handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this._map.get(event)?.delete(handler);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this._map.get(event)?.forEach(h => h(payload));
  }

  clear(): void { this._map.clear(); }
}

export const gameBus = new GameEventBus();
