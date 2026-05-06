// Engine public API — consumers should import through the bridge, not directly.
// These re-exports exist for type-only usage (TypeScript inference in the bridge).
export { GameEngine }    from './GameEngine.js';
export type { EngineSnapshot, EngineInput } from './GameEngine.js';
export { GameState } from './state/StateMachine.js';
export { EventBus }      from './events/EventBus.js';
export type { HitQuality, BowlerType, RoundOutcome } from './events/EventBus.js';
export { OutcomeSystem } from './rng/OutcomeSystem.js';
export type { DeliveryOutcome, ShotResult } from './rng/OutcomeSystem.js';
export { BaseCharacter, Character, CHARACTER_SCALE } from './characters/BaseCharacter.js';
export { BatsmanCharacter } from './characters/Batsman.js';
export { BowlerCharacter } from './characters/Bowler.js';
export { FielderCharacter } from './characters/Fielder.js';
export {
  ACTION_CENTER,
  FIELDER_SLOTS,
  getDepthScale,
  getFielderDepthScale,
  PITCH_MID_Z,
} from './worldLayout.js';

// Legacy UI helper — retained for multiplier display component
export { multiplierBand, BAND_COLORS } from './ui/multiplierPalette.js';
