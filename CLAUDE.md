# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cricket Crash** — a cricket-themed crash/multiplier game. Monorepo with pnpm workspaces. Primary mode is Stake RGS integration; architecture also anticipates real-time WebSocket and local single-over modes.

## Commands

```bash
# Install dependencies and build all shared packages
npm run bootstrap

# Run frontend dev server (port 5173)
npm run dev

# Type-check entire monorepo
npm run typecheck

# Build all packages/apps
npm run build

# Build shared packages only (required before app dev)
npm run build:packages
```

Infrastructure (local dev, if backend is active):

```bash
docker compose up -d      # Start MongoDB 7 + Redis 7
```

## Architecture

### Monorepo Layout

```
apps/
  backend/     Fastify v5 HTTP + WebSocket server, game loop, wallet (optional/in-progress)
  frontend/    Svelte 5 + Vite + Three.js WebGL simulation + CSS 2.5D overlay
packages/
  types/       Shared TypeScript types (CricketOutcome, GameMode, CricketPhase, WS messages)
  fairness/    HMAC-SHA256 provably-fair RNG — dual Node/browser entries
  game-engine/ Cricket outcome probability, multiplier mapping, round resolution
  sdk-wrapper/ Thin adapter; currently re-exports from fairness
```

### Frontend Source Layout (`apps/frontend/src/`)

```
core/
  gameController.svelte.ts   Main Svelte $state store + Stake coordinator (PUBLIC API)
  stakeClient.ts             Thin wrapper around stake-engine SDK (only Stake integration point)
  modeEngine.ts              Expands final multiplier → 6-delivery Delivery[] sequence
  devMock.ts                 Dev-mode fallback client
bridge/
  EngineBridge.ts            Boundary between Svelte and 3D engine (ONLY crossing point)
engine/
  GameEngine.ts              Single source of truth for simulation state; tick = update(dt)
  loop/GameLoop.ts           Single rAF loop: engine.update → snapshot → renderer.render
  state/StateMachine.ts      Phase FSM (IDLE → BETTING → BOWLER_RUNUP → … → RESET)
  events/EventBus.ts         Typed pub/sub for engine → controller events
  systems/                   ECS-style subsystems (BallSystem, HitSystem, AnimationSystem, …)
  rng/OutcomeSystem.ts       Maps DeliveryOutcome → physics ShotResult
  arena/                     Procedural stadium helpers (lighting, spectators, shaders, banners)
  objects/                   Mesh primitives (players, ball, pitch, stumps, sky)
  animations/                Delivery animation sequences (bowling, hitting, wicket)
  animation/playerAnimator.ts  Skeletal blink/pose animator
  constants.ts               ALL magic numbers (world coords, physics params, timings)
render/
  Renderer.ts                Three.js WebGL renderer; owns Scene, Camera, DoodleAssets, entities
  entities/                  Ball, Stadium — scene objects with update/setSnapshot API
  doodle/                    DoodleAssets loader, SpriteCharacter
lib/
  CricketSimulation.svelte   Canvas host; mounts EngineBridge + ResizeObserver
  GameArena.svelte           Stadium chrome, HUD, multiplier (CSS 2.5D overlay)
  gameAudio.ts               Web Audio API synthesis — no static audio files
  ui/                        BetPanel, MultiplierDisplay, OverTimeline, CommentaryBanner, …
pages/
  GamePage.svelte            Shell layout — full-bleed arena (`main-layout` inset `0 0 44px`); balance + mute in footer `.bb-left`; bet panel overlays; fixed Stake-style bottom bar (44px)
App.svelte / main.ts         Root mount, auth gate
```

### Backend Game State Machine (`apps/backend/src/game/roundLoop.ts`)

```
waiting → locked → bowling → hitting → result → wicket/over_ended → waiting
```

Two independent round loops run in parallel: `regular` (6 deliveries) and `bonus` (1 delivery).
WebSocket messages handled in `apps/backend/src/ws/registerWs.ts`: `PLACE_BET`, `CASHOUT`, `PING`, `RESYNC`.

### Stake Integration Data Flow

A complete round in Stake mode:

```
gameController.placeBet()
  → stakeClient.play(amount, mode)          # Calls Stake RGS; returns payoutMultiplier
  → modeEngine.generateDeliveries(mult, mode)  # Expands multiplier → Delivery[6]
  → _bridge.triggerBowl(delivery.outcome)   # Starts delivery in 3D engine
  → engine emits bowlStart
  → gameController schedules auto-swing at ~60% of hitTime
  → _bridge.triggerSwing()  (or user taps Swing)
  → engine emits hit → multiplier → roundEnd
  → gameController callbacks update game.$state
  → next delivery or session end
```

Key constants: `API_MULTIPLIER = 1_000_000` (Stake returns integers; divide to get float).

### Game Phases (`gameController.svelte.ts`)

```
initializing → idle → betting → animating → broadcast → (back to idle or error)
```

`game.visualPhase`: `idle | bowl | hit | wicket | celebrate` — drives overlay animations.

### Fairness System

- Server generates seed; client provides seed + nonce
- `HMAC-SHA256(server_seed, client_seed:nonce)` → outcome
- Server seed hash is published pre-round; full seed revealed after
- Package `fairness` must not import `node:crypto` — uses `js-sha256` for browser safety. Server-side code uses `crypto.ts` (HMAC via Node's `node:crypto`).

### Database (MongoDB) — backend

Collections in `apps/backend/src/db/mongo.ts` and `apps/backend/src/wallet/mongoWallet.ts`:

- `users` — UUID (`_id`), `external_ref`, `balance_minor` (bigint, 100 units = $1)
- `idempotency_ledger` — deduplication for all bet/cashout ops
- `bets` — `round_id`, `status` (`open` / `cashed_out` / `lost`), amounts in minor units

MongoDB is **optional**: backend falls back to `memoryWallet` if `MONGO_URI` is absent.
Redis is **optional**: falls back to no-op pub-sub if `REDIS_URL` is absent.

### Frontend Architecture Details

- **`EngineBridge`** — single integration boundary: **`GameEngine`** ticks simulation state, **`Renderer`** draws the WebGL scene, **`GameLoop`** owns the single `requestAnimationFrame` loop (`engine.update` → snapshot → `renderer.render`). UI must not import `engine/` or `render/` directly; go through the bridge.
- **`gameController.svelte.ts`** — main reactive store and Stake coordinator; consumes bridge callbacks (`onHitResult`, `onMultiplier`, etc.). `bindBridge(b)` wires callbacks after the canvas mounts.
- **`stakeClient.ts`** and **`modeEngine.ts`** are the only files that touch Stake API and delivery sequencing — change these when modifying game logic.
- **Three.js coordinate system** — crease along **+Z**, pitch length along **+X**; Y = height. Key values in `engine/constants.ts`: bowler at Z ≈ −9, batsman at Z ≈ 0, bat contact height Y ≈ 0.85.
- **Player visuals (doodle, stability-first)** — face is entirely **local and static**: no ball/head/eye tracking, no `lookAt` on facial features; optional deterministic **blink** only scales `eyePivots` in `playerAnimator.ts`. Root **yaw** is set in `Renderer.ts` (`setYawToTarget` with per-role yaw offset).
- **CSS 2.5D** (`GameArena.svelte`) — stadium chrome, HUD, multiplier. There is **no fixed top HUD strip** (removed for maximum viewport / sky): currency label, formatted **balance**, and **audio toggle** live in **`GamePage.svelte`** footer (`bottom-bar`, left cluster).
- **Web Audio API** (`gameAudio.ts`) — gameplay sounds via synthesis; no static audio files needed (except `gameBGsound.mpeg`).
- **Legacy:** `CricketStage.svelte` (Pixi) remains in-repo but is **not** wired into the main app.

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

- Packages must be built before apps (`npm run build:packages` or `npm run bootstrap`).
- `packages/fairness` has two export conditions: `node` (uses `node:crypto`) and default/browser (uses `js-sha256`). Vite config in frontend sets `resolve.conditions` to ensure the browser path is used.
- `stake-engine` is excluded from Vite esbuild optimization (`optimizeDeps.exclude`) — it's an external polyfill-based SDK.
- Shared types in `packages/types` are the source of truth for all WS message shapes and `CricketOutcome` — change there first.
- Svelte 5 runes are enabled globally (`compilerOptions: { runes: true }` in `svelte.config.js`).

## Spec Compliance (Stake-native decomposition)

- Canonical economic constants now live in `packages/fairness/src/economicModel.ts` (outcome table, sky rates/weights, streak ladder, risk caps).
- Per-ball deterministic decomposition of Stake `payoutMultiplier` is handled by `packages/fairness/src/perBallDecomposer.ts` (`decomposeRound`).
- Frontend delivery generation (`apps/frontend/src/core/modeEngine.ts`) must delegate to fairness decomposition and avoid local ad-hoc multiplier math.
- `apps/frontend/src/core/gameController.svelte.ts` emits decomposition telemetry (`sky_override_applied`, `streak_bonus_applied`, `cap_clamped`, `decomposer_residual_flagged`) via Stake `Event`.
- Dev forcing (`force`, `forceSky`, `forceStreak`) is gated to mock mode in `apps/frontend/src/core/devMock.ts`.

For deeper diagrams and math notes, see `docs/COMPREHENSIVE_ARCHITECTURE.md` and `docs/game.md`.
