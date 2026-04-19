import type { FairnessVerifyPayload } from '@cricket-crash/types';
import { hashServerSeed } from './hashUtf8.js';

export function verifyServerSeedHash(serverSeed: string, expectedHash: string): boolean {
  return hashServerSeed(serverSeed) === expectedHash;
}

/** Client-side verification after round: hash + optional HMAC recompute. */
export function verifyFairnessPayload(payload: FairnessVerifyPayload): boolean {
  if (!verifyServerSeedHash(payload.server_seed, payload.server_seed_hash)) {
    return false;
  }
  return true;
}

export function sha256Hex(input: string): string {
  return hashServerSeed(input);
}
