# Cricket Crash — Provably Fair System

## Overview

Cricket Crash uses HMAC-SHA256 provably-fair randomness. Every delivery outcome is deterministically derived from a server seed (unknown to the player until the round ends) and a client seed (chosen by the player). This ensures neither party can manipulate results.

## Seed Lifecycle

```
1. Before a round starts
   Server generates:    server_seed  (random 256-bit hex string)
   Server publishes:    hash(server_seed) = SHA256(server_seed)
   Player provides:     client_seed  (optional; defaults to timestamp)
   Round counter:       nonce        (integer, increments with each round)

2. Outcome derivation
   raw_bytes = HMAC-SHA256(key=server_seed, message=client_seed:nonce)
   float_0_1 = bytes_to_float(raw_bytes[0..3])   // 4-byte big-endian → [0, 1)

3. After the round settles
   Server reveals:      server_seed (full unhashed value)
   Player verifies:     SHA256(revealed_seed) === pre-published hash
   Player re-derives:   HMAC-SHA256(server_seed, client_seed:nonce) → same float
```

## Implementation

| Component | File | Notes |
|---|---|---|
| HMAC-SHA256 (Node) | `packages/fairness/src/crypto.ts` | Uses `node:crypto` — server-side only |
| HMAC-SHA256 (browser) | `packages/fairness/src/client.ts` | Uses `js-sha256` — no `node:crypto` |
| Mulberry32 RNG | `packages/fairness/src/rng.ts` | Seeded from HMAC output |
| Per-ball decomposer | `packages/fairness/src/perBallDecomposer.ts` | `decomposeRound(betID, mode, multiplier)` |
| Economic model | `packages/fairness/src/economicModel.ts` | Outcome weights, caps, sky chances |

## Delivery Decomposition

Stake RGS returns a single `payoutMultiplier` for the round. The client resolves this into one delivery deterministically:

```
seed_string = "pp:{betID}:{payoutMultiplier.toFixed(6)}"
rng         = mulberry32(seedFromString(seed_string))
ball        = pickWeighted(BONUS_BUY_PROFILE.outcomes, rng)
```

Special overrides applied in order:
1. **Sky override** (12% chance): delivery replaced with a sky object (10× or 100×)
2. **Hard cap**: factor > 100× is clamped to 100×
3. **Reconciliation**: factor is adjusted so the result equals the server `payoutMultiplier` exactly (within 1e-4)

## RTP Profile

| Outcome | Runs | Multiplier | Weight |
|---|---|---|---|
| Six | 6 | 2.25× | 11% |
| Four | 4 | 1.85× | 15% |
| Triple | 3 | 1.40× | 11% |
| Double | 2 | 1.18× | 16% |
| Single | 1 | 1.08× | 20% |
| Dot | 0 | 0.90× | 15% |
| Good fielding | 0 | 0.70× | 3% |
| Wicket | — | 0× | 9% |

Sky object chance: **12%** per delivery

## Hard Caps

- Single ball max multiplier: **100×** (`CAP_SINGLE_BALL_MULTIPLIER`)
- Over planning total cap: **200×** (`CAP_OVER_TOTAL_MULTIPLIER`) — settlement uses the full server value

## Boundary Streak Ladder

Consecutive boundary deliveries (4s and 6s) trigger a streak multiplier on the last ball of the streak:

| Streak length | Override multiplier |
|---|---|
| 3 in a row | 3× |
| 4 in a row | 4× |
| 5 in a row | 5× |
| 6 in a row | 8× |

## Verification Steps

Players can independently verify any round:

1. Note the pre-round server seed hash
2. After settlement, obtain the revealed `server_seed` from the round history
3. Compute `SHA256(server_seed)` — must match the pre-round hash
4. Compute `HMAC-SHA256(server_seed, "{client_seed}:{nonce}")` — must match the round's RNG seed
5. Run `decomposeRound({ payoutMultiplier, betID, mode })` with the same parameters — must produce the same delivery sequence

## Audit Trail

`gameController.svelte.ts` emits the following telemetry events via `client.sendEvent()` for every round:

| Event | When |
|---|---|
| `sky_override_applied` | A sky object overrides a ball's factor |
| `streak_bonus_applied` | A boundary streak activates the ladder multiplier |
| `cap_clamped` | A factor exceeds 100× and is clamped |
| `decomposer_residual_flagged` | Product deviates from target by > 1e-3 after reconciliation |
