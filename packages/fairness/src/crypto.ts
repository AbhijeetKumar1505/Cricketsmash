import { createHmac, randomBytes } from 'node:crypto';

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

/** HMAC_SHA256(server_seed, client_seed + ':' + nonce) — bytes used for draws */
export function hmacDraw(serverSeed: string, clientSeed: string, nonce: number): Buffer {
  const payload = `${clientSeed}:${nonce}`;
  // Key must use raw bytes ('hex' decode), not the ASCII hex string ('utf8'),
  // so external provably-fair tools can independently verify outcomes.
  return createHmac('sha256', Buffer.from(serverSeed, 'hex')).update(payload, 'utf8').digest();
}

/** First 8 bytes as unsigned big-endian float in [0,1) */
export function bytesToUnitInterval(buf: Buffer): number {
  const slice = buf.subarray(0, 8);
  let x = 0n;
  for (let i = 0; i < slice.length; i++) {
    x = (x << 8n) | BigInt(slice[i] ?? 0);
  }
  const max = 2n ** 64n;
  return Number(x % max) / Number(max);
}
