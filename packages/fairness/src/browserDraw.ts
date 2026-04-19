/**
 * HMAC draw + unit interval — mirrors `crypto.ts` using js-sha256 (browser-safe).
 */
import { sha256 } from 'js-sha256';

function hexToKeyBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** HMAC_SHA256(server_seed, client_seed + ':' + nonce) — same bytes as Node `crypto.ts`. */
export function hmacDraw(serverSeed: string, clientSeed: string, nonce: number): Uint8Array {
  const payload = `${clientSeed}:${nonce}`;
  const key = hexToKeyBytes(serverSeed);
  const digest = sha256.hmac.array(key, payload);
  return new Uint8Array(digest);
}

/** First 8 bytes as unsigned big-endian float in [0,1) */
export function bytesToUnitInterval(buf: Uint8Array | ArrayBuffer): number {
  const slice = buf instanceof Uint8Array ? buf.subarray(0, 8) : new Uint8Array(buf).subarray(0, 8);
  let x = 0n;
  for (let i = 0; i < slice.length; i++) {
    x = (x << 8n) | BigInt(slice[i] ?? 0);
  }
  const max = 2n ** 64n;
  return Number(x % max) / Number(max);
}
