# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Cricket Crash** — a cricket-themed crash/multiplier game. Pure Stake-native architecture using Stake RGS for all game outcomes and RNG.

## Commands

```bash
# Install dependencies and build all shared packages
npm run bootstrap

# Run frontend (port 5173)
npm run dev

# Run frontend individually
npm run dev:frontend

# Type-check entire monorepo
npm run typecheck

# Build all packages/apps
npm run build
```

## Architecture

### Monorepo Layout

```
apps/
  frontend/    Svelte 5 + Vite + Three.js WebGL (simulation)
packages/
  types/       Shared TypeScript types (GameMode, CricketPhase)
  fairness/    HMAC-SHA256 provably-fair RNG — exports browser-safe code only
  sdk-wrapper/ Stake RGS adapter and playback mapping
```

### Stake Native mode

The game operates in a pure Stake-native mode where all bets and outcomes are processed by the Stake RGS.

| Mode | RNG source | Persistence |
|------|-----------|-------------|
| Stake RGS | Stake engine (external) | External |

### Fairness System

- Stake provides the outcome multiplier.
- `packages/fairness/src/stakeMapping.ts` maps the payout multiplier to cricket-specific outcomes (runs/wickets) for visualization.
- Package `fairness` must not import `node:crypto` — uses `js-sha256` for browser safety.

### Frontend Architecture

- **Three.js** (`CricketSimulation.svelte`, `apps/frontend/src/engine/`) — stadium camera, pitch, players, ball, stumps (crease along **+Z**, pitch length along **+X**)
- **CSS 2.5D** (`GameArena.svelte`) — stadium chrome, HUD, multiplier.
- **Web Audio API** (`gameAudio.ts`) synthesizes all sounds — no static audio files.
- **`gameController.svelte.ts`** is the main reactive state store and Stake client coordinator.
- **`playbackEngine.ts`** handles the frame-accurate timing of the 3D simulation.

### Frontend CSS (tooling)

- Prefer the standard **`appearance`** property alongside `-webkit-appearance` / `-moz-appearance` (e.g. number inputs: `appearance: textfield` with spinners removed via `appearance: none` on pseudo-elements).
- Tailwind CSS v4 via `@tailwindcss/vite` plugin.

## Package Relationship Notes

- Packages must be built before apps (`npm run build:packages` or `npm run bootstrap`)
- `packages/fairness` exports `payoutMultiplierToCricketOutcome` used by the frontend to visualize results.
- Shared types in `packages/types` define the core domain models.
