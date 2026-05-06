# Risk Operations Runbook

This runbook covers economic-risk controls introduced for the Stake-native decomposition path.

## 1. Core invariants

- Settlement source of truth: Stake `payoutMultiplier`.
- Presentation source of truth: `decomposeRound(...)` in `packages/fairness/src/perBallDecomposer.ts`.
- Product reconciliation tolerance: `DECOMPOSE_EPSILON`.
- Caps:
  - Single ball cap: `CAP_SINGLE_BALL_MULTIPLIER` (100x).
  - Over cap (planning): `CAP_OVER_TOTAL_MULTIPLIER` (200x).

## 2. Telemetry events

The frontend emits decomposition/risk telemetry via `client.sendEvent(...)` from `apps/frontend/src/core/gameController.svelte.ts`.

Expected event kinds:

- `bet_placed`
- `sky_override_applied`
- `streak_bonus_applied`
- `cap_clamped`
- `decomposer_residual_flagged`

Each event should include `betID` and `mode` for correlation.

## 3. Operational checks

### 3.1 Validate economic invariants

```bash
npm run test:fairness
```

### 3.2 Run slow RTP simulation

```bash
SLOW_TESTS=1 npm run test:fairness:slow
```

### 3.3 Replay a suspicious round

```bash
npm run replay:decomposition -- --payout 12.5 --betId 123456 --mode OVER
```

Inspect:

- `product` vs input payout
- `telemetry` events (`cap_clamped`, `decomposer_residual_flagged`)
- per-ball factors and override markers

## 4. Incident response

If `decomposer_residual_flagged` spikes:

1. Pull sample payloads by `betID`.
2. Replay with `tools/replay-decomposition.mjs`.
3. Verify whether over-cap clamping was expected.
4. If not expected, inspect reconciliation branch in `perBallDecomposer.ts`.
5. Add regression test for reproduced payload.

If `cap_clamped` unexpectedly rises:

1. Segment by mode (`OVER` vs `POWERPLAY`).
2. Check recent profile changes in `economicModel.ts`.
3. Confirm sky/streak overrides were not double-applied.
4. Re-run fairness test suite and slow RTP simulation before deploy.

## 5. Change management

When changing economic constants:

1. Update `packages/fairness/src/economicModel.ts`.
2. Run `npm run test:fairness`.
3. Run `SLOW_TESTS=1 npm run test:fairness:slow`.
4. Update `docs/PRD.md` canonical economic section.
5. Announce in release notes with RTP delta and cap-impact assessment.

