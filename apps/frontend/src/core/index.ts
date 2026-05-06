/**
 * core/index.ts — Barrel export for the core Stake integration layer.
 */
export { createStakeClient, GAME_MODES, API_MULTIPLIER, DisplayAmount, ParseAmount } from './stakeClient.js';
export type { StakeGameClient, AuthResult, PlayResult, Balance, Currency, GameModeName } from './stakeClient.js';



export { createDevMockClient, shouldUseMock } from './devMock.js';
