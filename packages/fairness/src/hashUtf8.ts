import { sha256 } from 'js-sha256';

/** SHA-256 hex of UTF-8 string — works in browser and Node (no node:crypto). */
export function hashServerSeed(serverSeed: string): string {
  return sha256(serverSeed);
}
