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

- **`CricketSimulation.svelte`** — canvas host only; **`EngineBridge`** wires **`GameEngine`** + **`Renderer`** + **`GameLoop`** (see `apps/frontend/src/bridge/EngineBridge.ts`). One rAF loop: `engine.update(dt)` → `renderer.setSnapshot(engine.getSnapshot())` → `renderer.render()`.
- **`render/Renderer.ts`** — WebGL draw: positions bowler / batsman / keeper / fielders via layout helpers; per-role **CharacterController** FSMs (Idle/Ready/React/Execute/Recover under `apps/frontend/src/characters/human/controllers/`) translate the engine snapshot into `AnimatorInput` for the layered animation stack.
- **`characters/human/`** — full procedural human pipeline: 6.5-head stylized rig (`proportions.ts` + `HumanSkeleton.ts` with clavicles + hand rig + toe), procedural `SkinnedMesh` body (`skinning/buildBodyGeometry.ts`, `skinning/computeVertexWeights.ts`), rigid kit attachments (`skinning/kitAttachments.ts`), stylized PBR materials with rim+bounce lighting (`render/HumanMaterials.ts` + `render/HumanLighting.ts`), real soft contact shadow plane (`render/ContactShadow.ts`), and 3-tier `HumanLOD`. The face is **entirely local and static** — no `lookAt` on facial features; optional deterministic blink only.
- **Animation stack** — composable layers under `apps/frontend/src/characters/human/animation/` (Base / Additive / Mechanics / Aim / Reaction / Bat / IK). `HumanAnimator.ts` is a thin facade that owns a per-character `AnimationStack` and wires the layers; pose tables live in `animation/poses/`.
- **Mechanics & IK** — `mechanics/{WeightTransfer,SpineDynamics,ShoulderRoll}.ts` + `ik/{TwoBoneIK,FootGroundingIK,BatTargetIK}.ts` (foot grounding is registered but opt-in until terrain raycast lands).
- **Bat as body extension** — `bat/BatRig.ts` drives the bat through the kinetic chain per `ShotType`; `bat/BatContact.ts` applies wrist recoil + torso torque + bat vibration on impact.
- **EngineSnapshot intent** — `snapshot.batsman.shotType`, `snapshot.bowler.bowlerType`, `snapshot.feedback.hitQuality` are populated by `GameEngine` on each delivery and consumed by the controllers (no more hardcoded `'Fast'/'defend'/'none'` in the renderer).
- **Three.js** — stadium/scene entities under `apps/frontend/src/render/entities/` and arena utilities under `apps/frontend/src/engine/arena/` (crease along **+Z**, pitch along **+X**).
- **CSS 2.5D** (`GameArena.svelte`) — stadium chrome, HUD, multiplier.
- **`GamePage.svelte`** — page shell: arena is **full bleed to the top** (no black top bar); **balance** and **mute** sit in the **footer** left section next to the currency pill; main play area uses `inset: 0 0 44px` above a 44px bottom bar.
- **Web Audio API** (`gameAudio.ts`) — synthesized gameplay UI sounds where used.
- **`gameController.svelte.ts`** — main reactive state store and Stake client coordinator; binds to **`EngineBridge`** callbacks (not legacy `playbackEngine.ts`, which has been removed from the codebase). `triggerBowl(outcome, intent?)` forwards the `Delivery.shotType` so the batsman controller picks the correct `Execute` sub-state.

### Frontend CSS (tooling)

- Prefer the standard **`appearance`** property alongside `-webkit-appearance` / `-moz-appearance` (e.g. number inputs: `appearance: textfield` with spinners removed via `appearance: none` on pseudo-elements).
- Tailwind CSS v4 via `@tailwindcss/vite` plugin.

## Package Relationship Notes

- Packages must be built before apps (`npm run build:packages` or `npm run bootstrap`)
- `packages/fairness` exports `payoutMultiplierToCricketOutcome` used by the frontend to visualize results.
- Shared types in `packages/types` define the core domain models.

## Spec Compliance (Stake-native decomposition)

- Canonical economic tables, sky/streak rules, and caps are defined in `packages/fairness/src/economicModel.ts`.
- Per-ball deterministic expansion of Stake `payoutMultiplier` is implemented in `packages/fairness/src/perBallDecomposer.ts` (`decomposeRound`).
- Frontend over sequencing uses `apps/frontend/src/core/modeEngine.ts` and must not reintroduce ad-hoc math outside fairness package.
- Dev forcing controls (`force`, `forceSky`, `forceStreak`) are parsed in `apps/frontend/src/core/devMock.ts` and only applied in mock mode.
- Decomposition risk telemetry is emitted from `apps/frontend/src/core/gameController.svelte.ts`.
