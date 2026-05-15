/**
 * Browser / bundler entry — no Node-only modules (`node:crypto` HMAC/RNG).
 * Server code should use the package root (dist) which includes `crypto.js`.
 */
export { hashServerSeed } from './hashUtf8.js';
export { verifyServerSeedHash, verifyFairnessPayload, sha256Hex } from './verify.js';
export { payoutMultiplierToCricketOutcome } from './stakeMapping.js';
/** Browser-safe HMAC draw + interval (same semantics as Node `crypto.ts`). Used by `game-engine` in Vite. */
export { hmacDraw, bytesToUnitInterval } from './browserDraw.js';
export * from './economicModel.js';
export { mulberry32, seedFromString } from './rng.js';
export {
  decomposeRound,
  analyticalRtpStandard,
  DECOMPOSE_EPSILON,
  type DecomposeOptions,
  type DecomposeResult,
  type DecomposedBall,
  type DecomposeTelemetryEvent,
} from './perBallDecomposer.js';
