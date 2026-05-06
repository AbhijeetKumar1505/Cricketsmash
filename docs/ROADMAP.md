# Cricket Crash — Refactor Roadmap (v2 — Audit-Aligned)
*Last updated: 2026-05-02*

## Phase 1 — Critical Fixes (production blocker)

1. **[C1] Auto-settle open bets at round end.** `roundLoop.ts` — iterate open connections at `result` phase; credit payout at final multiplier; emit `CASHOUT_OK` + `WALLET_UPDATE` per user.
2. **[C2] Unify multiplier model.** `localOverAdapter.ts` — replace multiplicative `RUNS_MULTIPLIER` accumulation with additive `RUNS_DISPLAY_BUMP`. Align run distribution with `sampleRuns` weights (38/28/18/12/4).
3. **[C3] Route BET_ACCEPTED unicast.** `roundLoop.ts` — replace `this.broadcast(BET_ACCEPTED)` with targeted loop over connections matching `req.userId`.
4. **[C5] Fix cashout button state.** `App.svelte` — remove `phaseUI === 'bowling'` from `canCashOut` in server mode.
5. **[C6] Add WebSocket authentication.** `registerWs.ts` + `realtimeAdapter.ts` — token-based identity; reject on missing/invalid token with close code 4001.
6. **[C4] Complete fairness verification.** `fairness/src/verify.ts` — add `resolveRound` re-derivation step; add `spin_modifier` to `FairnessVerifyPayload` type.
7. **[C8] Fix HMAC key encoding.** `fairness/src/crypto.ts` — `Buffer.from(serverSeed, 'hex')` not `'utf8'`. Document as breaking change for existing fairness records.
8. **[C9] Add WALLET_UPDATE message.** `types/index.ts` + `roundLoop.ts` + `registerWs.ts` + `realtimeAdapter.ts` — emit balance after every bet/cashout/loss.
9. **[H2] Mark lost bets in DB.** `pgWallet.ts` (`settleLostBets`) + `roundLoop.ts` — call after wicket.
10. **[H4] Cap maxDeliveries at 6.** `resolveRound.ts` — change default from 24 to 6.

## Phase 2 — Architecture (multi-player production)

11. Implement WS `RESYNC` protocol (`types/index.ts`, `roundLoop.ts`, `realtimeAdapter.ts`).
12. Persist nonce across server restarts (DB or append-only file).
13. Unify wicket probability cap to 0.35 (`probability.ts`).
14. Add bowler type to realtime server round state (`roundLoop.ts`, `phaseTimeline.ts`).
15. Add `CORS` origin whitelist (`server.ts`).
16. Add per-connection rate limiting (`registerWs.ts` — token bucket, 10 msg/sec).
17. Fix WS setup race condition — move `addConnection` before `ws.on('message')` (`registerWs.ts`).
18. Replace `stake-engine` placeholder with real Stake SDK or documented mock.
19. Add `mode` field to `RoundStateSnapshot`.
20. Add `round_seq` monotonic counter to all server messages.

## Phase 3 — UX (player-facing)

21. Add Stake lifecycle phase events for animation continuity (`stakeAdapter.ts`).
22. Tie `hitTrajectory` to actual delivery outcome, not hardcoded `'four'` (`App.svelte`).
23. Add mode label + per-mode cashout hint copy.
24. Add WS loading/connecting state with spinner (`App.svelte`).
25. Replace synthetic `speedKmh = Math.random()` with deterministic bowler-type seeding (`App.svelte`).
26. Add `WALLET_UPDATE` balance display feedback after loss (wicket).
27. **Pixi cleanup:** `CricketSimulation.svelte` is the active 3D host (`EngineBridge` → `GameEngine` + `Renderer`). Remove or archive legacy `CricketStage.svelte` (Pixi) if still unused.

## Phase 4 — Performance and Polish

28. Implement ease-out interpolation in delivery multiplier ticks (`roundLoop.ts`).
29. Server-time-anchored animation progress using `elapsed_ms` from `MULTIPLIER_UPDATE`.
30. Remove `crashCurve.ts` dead code (`packages/fairness/src/`).
31. Telemetry dashboard: cashout latency, reject reasons, reconnect rate, fairness mismatches.
32. Load test WebSocket fanout + Redis pub/sub at 5,000 concurrent connections.
33. Optimize Three.js / particle-field cost on low-end devices.
34. E2E test scenarios: disconnect mid-round, duplicate bet, duplicate cashout, fairness replay verification.
35. Fairness replay viewer UI: input seeds → re-derive round → display outcome timeline.
