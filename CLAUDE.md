# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cricket Crash** — a cricket-themed crash/multiplier game. Monorepo with pnpm workspaces supporting three game modes: Stake RGS integration, real-time WebSocket gameplay, and local single-over mode.

## Commands

```bash
# Install dependencies and build all shared packages
npm run bootstrap

# Run backend + frontend in parallel (ports 8787 and 5173)
npm run dev

# Run individually
npm run dev:backend       # port 8787, tsx watch (hot reload)
npm run dev:frontend      # port 5173, proxied WS to 8787

# Type-check entire monorepo
npm run typecheck

# Build all packages/apps
npm run build

# Ensure MongoDB indexes (requires MONGO_URI env var)
npm run db:migrate
```

Infrastructure (local dev):

```bash
docker compose up -d      # Start MongoDB 7 + Redis 7
```

## Architecture

### Monorepo Layout

```
apps/
  backend/     Fastify v5 HTTP + WebSocket server, game loop, wallet
  frontend/    Svelte 5 + Vite + Three.js WebGL (simulation) + Pixi (legacy helper)
packages/
  types/       Shared TypeScript types (GameMode, CricketPhase, WS messages)
  fairness/    HMAC-SHA256 provably-fair RNG — exports browser-safe code only
  game-engine/ Cricket outcome probability, multiplier mapping, round resolution
  sdk-wrapper/ Unified adapter: selects stake / realtime / local mode at init
```

### Three Game Modes (SDK Wrapper)

The `@cricket-crash/sdk-wrapper` package provides a single factory that abstracts all three modes:

| Mode | `mode` value | RNG source | Persistence |
|------|-------------|-----------|-------------|
| Stake RGS | `'stake'` | Stake engine (external) | External |
| Real-time | `'realtime'` | Server HMAC-SHA256 | MongoDB + Redis |
| Local over | `'local'` | Client-side | None |

### Backend Game State Machine (`apps/backend/src/game/roundLoop.ts`)

```
waiting → locked → bowling → hitting → result → wicket/over_ended → waiting
```

Two independent round loops run in parallel: `regular` (6 deliveries) and `bonus` (1 delivery).
WebSocket messages handled in `apps/backend/src/ws/registerWs.ts`: `PLACE_BET`, `CASHOUT`, `PING`, `RESYNC`.

### Fairness System

- Server generates seed; client provides seed + nonce
- `HMAC-SHA256(server_seed, client_seed:nonce)` → outcome
- Server seed hash is published pre-round; full seed revealed after
- Package `fairness` must not import `node:crypto` — uses `js-sha256` for browser safety. Server-side code uses `crypto.ts` (HMAC via Node's `node:crypto`).

### Database (MongoDB)

Collections in `apps/backend/src/db/mongo.ts` and `apps/backend/src/wallet/mongoWallet.ts`:

- `users` — UUID (`_id`), `external_ref`, `balance_minor` (bigint, 100 units = $1)
- `idempotency_ledger` — deduplication for all bet/cashout ops
- `bets` — `round_id`, `status` (`open` / `cashed_out` / `lost`), amounts in minor units

Indexes are created via `npm run db:migrate` (calls `ensureIndexes()` in `src/db/migrate.ts`).
MongoDB is **optional**: the backend falls back to `memoryWallet` if `MONGO_URI` is absent.
Redis is **optional**: falls back to no-op pub-sub if `REDIS_URL` is absent.

### Frontend Architecture

- **Three.js** (`CricketSimulation.svelte`, `apps/frontend/src/engine/`) — stadium camera, pitch, players, ball, stumps (crease along **+Z**, pitch length along **+X**)
- **CSS 2.5D** (`GameArena.svelte`) — stadium chrome, HUD, multiplier; top bar padding matches arena inset so mode/audio controls align with the game frame
- **Web Audio API** (`gameAudio.ts`) synthesizes all sounds — no static audio files
- **`useCricketGame.ts`** is the game-event hook wired into `App.svelte`
- **Legacy:** `CricketStage.svelte` (Pixi) is retained in-repo but not wired into the main app

### Frontend CSS (tooling)

- Prefer the standard **`appearance`** property alongside `-webkit-appearance` / `-moz-appearance` (e.g. number inputs: `appearance: textfield` with spinners removed via `appearance: none` on pseudo-elements) so `svelte-check` / stylelint vendor-prefix rules stay clean.
- Tailwind CSS v4 via `@tailwindcss/vite` plugin (not PostCSS). PostCSS config only runs `autoprefixer`.

### Key Environment Variables (backend)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | HTTP/WS listen port |
| `MONGO_URI` | — | MongoDB connection string (optional, falls back to in-memory) |
| `REDIS_URL` | — | Redis connection (optional, falls back to no-op) |
| `SPIN_MODIFIER` | `0` | Set to `1` to add +3% wicket probability (spin conditions) |
| `AUTH_SECRET` | — | If set, WS clients must pass `?token=HMAC-SHA256(secret, userId)` |

## Package Relationship Notes

- Packages must be built before apps (`npm run build:packages` or `npm run bootstrap`)
- `packages/fairness` has two export conditions: `node` (uses `node:crypto`) and default/browser (uses `js-sha256`). Vite config in frontend sets `resolve.conditions` to ensure the browser path is used.
- Shared types in `packages/types` are the source of truth for all WS message shapes — change there first when adding new message types.
