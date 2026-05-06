# Cricket Crash PRD (v2 — Audit-Revised)
*Last updated: 2026-04-02*

---

## 1. Product Vision

Cricket Crash is a crash-style wagering game with cricket-themed outcomes. The product preserves core crash psychology:

- Continuous multiplier growth during each delivery sequence.
- Fast bet placement in a fixed pre-round window.
- One-tap cashout while the delivery is live (realtime mode) or between deliveries (local mode).
- Server-authoritative outcome — no client can alter results.
- Full provably-fair auditability for every round.

---

## 2. Supported Modes

### Realtime mode (`mode: "realtime"`)

Canonical crash-like mode. A WebSocket server controls all state transitions and emits a live multiplier stream. The server resolves outcomes before the round begins using HMAC-SHA256 from committed seeds.

**Cashout window:** During `hitting` phase only.

**Bet settlement:**
- Manual cashout during `hitting` → payout at current display multiplier.
- No cashout before round end → **automatic payout at final display multiplier** (if outcome is non-wicket).
- Wicket falls → all open bets lose.

**Fairness:** Commit-reveal seed flow. Server seed hash published at round start; seed revealed after result. Full outcome re-derivation possible by any party.

### Stake mode (`mode: "stake"`)

Instant RGS outcome model. No client RNG, no local simulation authority. The Stake engine is the sole source of truth for all financial outcomes.

**Flow:** `AUTH → BET → RESULT → COMPLETE`

**Lifecycle phases emitted:** `waiting → locked → bowling → hitting → result|wicket`

Animation is representational (post-result dramatization) and **must never imply a different result** from what the RGS returned.

**Cashout:** Not applicable. Result is instant from RGS `Play()`.

### Local mode (`mode: "local"`)

Single-player 6-ball over for offline and demo use. Non-authoritative and clearly labeled as a local simulation. Uses `Math.random()` and therefore cannot provide provably-fair proofs.

**Cashout window:** Between deliveries (during `waiting` phase after each ball), matching the realtime session model. A player who completes all 6 balls without cashing out is automatically paid at the accumulated display multiplier.

---

## 3. Canonical Economic Model

Canonical economic constants now live in `packages/fairness/src/economicModel.ts`, and Stake round decomposition logic lives in `packages/fairness/src/perBallDecomposer.ts`.

### 3.1 Outcome table (standard mode)

| Outcome | Multiplier | Probability |
|---------|------------|-------------|
| Six | 2.00x | 5% |
| Four | 1.75x | 7% |
| Triple | 1.36x | 9% |
| Double | 1.16x | 13% |
| Single | 1.08x | 15% |
| Dot Ball | 0.90x | 20% |
| Good Fielding | 0.70x | 16% |
| Catch Out | 0x | 15% |

Analytical RTP (`Σ probability × multiplier`) is maintained inside a 94%–96% target band by CI invariants.

### 3.2 Sky override model

- Standard sky chance: 2%
- Bonus/Powerplay sky chance: 12%
- Distribution: Jetpack 75%, Small Plane 22%, Big Plane 3%
- Sky payouts are **override multipliers** (10x or 100x), not additive.

### 3.3 Boundary streak model

Consecutive boundaries (4/6) apply overrides:

- 3 boundaries: 3x
- 4 boundaries: 4x
- 5 boundaries: 5x
- 6 boundaries: 8x

### 3.4 Stake-native decomposition invariant

For Stake mode, one RGS `payoutMultiplier` is decomposed into per-ball factors deterministically (`decomposeRound`) for presentation pacing. The product of per-ball factors is reconciled to the Stake target with bounded epsilon and telemetry.

Settlement remains Stake-authoritative.

---

## 4. Core User Flows

### Flow A: Realtime Round

1. `ROUND_STATE(waiting)` + server seed hash broadcast. Betting window opens (2 seconds).
2. User sets stake → presses Bet → balance debited → `BET_ACCEPTED` sent to this user only.
3. `ROUND_STATE(locked)` — betting closed (1.5 seconds).
4. `ROUND_STATE(bowling)` — delivery in flight (1.9 seconds).
5. `ROUND_STATE(hitting)` — `MULTIPLIER_UPDATE` stream begins. **Cashout button goes live.**
6. User presses Cashout → `CASHOUT_OK` sent to this user; balance credited.
7. Round ends: `ROUND_STATE(result|wicket)` + `RESULT` with seed reveal.
8. All uncashed bets auto-settled at final multiplier (non-wicket) or lost (wicket).

### Flow B: Local Over

1. `round_state(waiting)` — user places bet.
2. User presses Bowl for each delivery.
3. After each ball: `round_state(waiting)` — cashout available between balls.
4. Over ends (6 balls or wicket). Auto-payout if still holding.

### Flow C: Stake Instant

1. `initGame` → `Authenticate()` → session live.
2. User places bet → `Play()` called → outcome received.
3. Lifecycle phases emitted in order for animation continuity.
4. `result` event fires with RGS outcome; animation plays.
5. `EndRound()` finalizes.

---

## 5. Functional Requirements

- Bet acceptance only during `waiting` phase.
- Idempotency keys required for all wallet-affecting operations.
- Consistent phase model across frontend and backend (same set of phases in same order).
- Explicit reconnect/resync support in realtime mode via `RESYNC` message pair.
- Observable and auditable fairness payloads — outcome must be re-derivable from seeds.
- Stake adapter must not fabricate pseudo-live progression or return synthetic financial outcomes.
- Private events (`BET_ACCEPTED`, `CASHOUT_OK`, `WALLET_UPDATE`) sent only to the originating user.
- Player balance kept current in the client at all times via `WALLET_UPDATE` messages.

---

## 6. Non-Functional Requirements

- P95 cashout acknowledgment < 250ms on healthy network.
- No client-side trust for payout-critical logic.
- Deterministic replay capability for fairness disputes.
- Horizontal scalability via sticky WS + shared Redis pub/sub.
- WebSocket connections authenticated via signed token — no identity by URL parameter.
- Rate limiting: max 10 messages/second per connection.

---

## 7. UX Requirements

- Display multiplier always visible, large, and legible.
- Clear distinct states: "bet open", "bet locked", "cashout live", "round ended".
- Cashout button only interactive when server will accept it (no false-positive hot states).
- Distinct feedback for: win, loss, wicket, and rejected actions.
- Balance updated immediately after every transaction (displayed in bottom bar next to currency).
- Mode label always visible (Local / Live / Stake).
- Controls positioned below arena viewport on all screen sizes.
- Primary arena/WebGL viewport is **full bleed to the top** (no fixed header strip obscuring sky); wallet balance and mute remain accessible in the lower chrome.

---

## 8. Acceptance Criteria (Production Gate)

- [ ] Per-user event privacy enforced for all wallet and bet events.
- [ ] Auto-settlement of uncashed bets at round end implemented and tested.
- [ ] Reconnect + snapshot replay implemented and tested.
- [ ] Single canonical multiplier model used across all modes.
- [ ] Stake lifecycle mapped to explicit domain events.
- [ ] Cashout button state matches server-allowed window exactly.
- [ ] Full fairness verification (hash + outcome re-derivation) implemented.
- [ ] WebSocket authentication implemented.
- [ ] HMAC key encoding standardized to raw bytes (`'hex'`).
- [ ] Player balance propagated to client in realtime mode.
- [ ] Monitoring dashboards: bet rejects, cashout latency, ws disconnect rate, fairness verify failures.
