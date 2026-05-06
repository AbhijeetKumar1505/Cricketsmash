// Engine public API — consumers should import through the bridge, not directly.
// These re-exports exist for type-only usage (TypeScript inference in the bridge).
export { GameEngine }    from './GameEngine.js';
export type { EngineSnapshot, EngineInput } from './GameEngine.js';
export { EventBus }      from './events/EventBus.js';
export type { HitQuality, BowlerType, RoundOutcome } from './events/EventBus.js';
export { OutcomeSystem } from './rng/OutcomeSystem.js';
export type { DeliveryOutcome } from './rng/OutcomeSystem.js';

// Legacy UI helper — retained for multiplier display component
export { multiplierBand, BAND_COLORS } from './ui/multiplierPalette.js';
