# Cricket Crash System Design (Stake + Realtime Hybrid)

This document is retained for compatibility and now mirrors `docs/system-design.md`.

## Design Position

- Keep hybrid architecture with strict mode boundaries.
- Realtime mode is server-authoritative and crash-like.
- Stake mode is RGS-authoritative and instant-result.
- Local mode is non-authoritative training/sandbox.

## Required Corrections

1. Stop broadcasting private user events globally.
2. Add reconnect/resync protocol for WebSocket clients.
3. Standardize lifecycle events across stake/realtime/local adapters.
4. Tie animation timing to authoritative event timestamps.
5. Add observability for fairness and cashout latency.

## Stake Lifecycle Rule

`AUTH -> BET -> RESULT -> COMPLETE`

No client-side RNG and no pseudo-authoritative simulation in stake mode.

## Production Readiness Checklist

- Privacy-safe event routing
- Idempotent wallet operations
- Deterministic fairness replay
- Horizontal scaling with sticky WS + Redis fanout
- SLO-backed monitoring and alerting

