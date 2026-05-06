# Cricket Crash Architecture & Internal Mechanics

This document summarizes how **Cricket Crash** combines deterministic game math with a lightweight **Three.js** presentation layer. Paths refer to `apps/frontend/` unless noted.

---

## 1. Core Physics vs Visual Pseudo-Physics

The game does **not** rely on a full rigid-body engine (no Cannon/Rapier for gameplay outcomes). Crash-style outcomes are decided by **server / RGS rules** or local adapters; the client **animates** those results with eased curves and interpolation (“pseudo-physics”) so motion feels physical without simulation instability.

Historical 2D screen mapping (`worldMapping` / layout constants) still informs how logical positions relate to the 3D stage where applicable.

---

## 2. 3D Rendering & Simulation Loop

### Runtime wiring

```
CricketSimulation.svelte
    → EngineBridge (bridge/EngineBridge.ts)
        → GameEngine        (engine/GameEngine.ts)   — authoritative sim tick, snapshot
        → Renderer          (render/Renderer.ts)     — WebGL scene graph + draw
        → GameLoop          (engine/loop/GameLoop.ts) — single requestAnimationFrame
```

Each frame:

1. `GameEngine.update(dt)` advances bowler/batsman/ball/feedback state.
2. `renderer.setSnapshot(engine.getSnapshot())` publishes the latest `EngineSnapshot`.
3. `renderer.render()` updates meshes from the snapshot and calls `WebGLRenderer.render`.

Svelte UI must **not** import `engine/` or `render/` directly — only **`EngineBridge`** and **`gameController.svelte.ts`**.

### Page shell (`pages/GamePage.svelte`)

The play viewport is **full height minus the bottom chrome**: `.main-layout` uses `inset: 0 0 44px` so the WebGL canvas and `GameArena` framing use the full width and all space above a fixed **44px** Stake-style footer. There is **no fixed top bar** (no separate LIVE/title/balance strip), which keeps the upper third of the frame clear for sky and stadium rim. **Balance** and **audio mute** were moved into the footer’s left cluster (`.bb-left`) alongside the currency pill.

### Camera

Camera behavior lives in **`render/Camera.ts`** (with shake from snapshot feedback). The rig follows gameplay “broadcast” framing over the pitch; exact presets evolve with product needs.

### Stadium & environment

Heavy stadium geometry and instanced crowd live under **`render/entities/Stadium.ts`**, which composes **`engine/arena/*`** helpers (spectators, sponsor banners, structure, fog, scoreboard overlays, etc.).

### Characters on the pitch

Primitive **Google-doodle-style** figures are built in **`engine/objects/players.ts`**:

- Modular torso, limbs, bat attachment, blob shadow.
- **Face discipline:** features are parented in **local head space** — no `lookAt`, no ball tracking on eyes or head — to avoid jitter. A small **deterministic blink** scales `eyePivots` in **`engine/animation/playerAnimator.ts`** (time-based cycle, no world→local coupling).
- **World yaw** (which way the figure faces relative to batsman/bowler/field slots) is applied at the figure **root** in **`render/Renderer.ts`** via `setYawToTarget(...)`, with optional per-role yaw offsets.

---

## 3. Stake RGS & Frontend Timing

Stake-native flows use **`gameController.svelte.ts`** plus the **`@cricket-crash/sdk-wrapper`** / adapters to coordinate bets, payouts, and phase UX.

**There is no `playbackEngine.ts` in the frontend** — pacing is owned by **`GameEngine`** ticks and whatever timeline the active mode attaches to snapshots (Stake events, realtime WS payloads, or local `modeEngine`).

---

## 4. Fairness & Outcome Mapping

The function **`payoutMultiplierToCricketOutcome`** in **`@cricket-crash/fairness`** maps a payout multiplier to cricket-flavored visuals (runs bands, wicket, etc.). In realtime mode, **`HMAC-SHA256(server_seed, client_seed:nonce)`** derives outcomes server-side (`packages/fairness` browser-safe path avoids `node:crypto`).

- **Runs:** drive shot / celebration pacing in the animator and UI.
- **Wicket:** ends the interactive segment and triggers wicket visuals/state.

---

## 5. Further Reading

| Document | Contents |
|---------|----------|
| Root `CLAUDE.md` | Monorepo commands, backend WS + DB, frontend stack summary |
| Root `AGENTS.md` | Stake-focused Codex/agent notes |
| `docs/game.md` | Index of product/design docs |
| `docs/PRD.md`, `docs/ROADMAP.md` | Product and refactor roadmap |

---

## 5.1 Spec-to-Code Map (Compliance Layer)

The repository now includes a dedicated economic compliance layer for the Stake-native visualization pipeline:

| Spec area | Canonical implementation |
|---------|---------------------------|
| Outcome probabilities + multipliers | `packages/fairness/src/economicModel.ts` (`STANDARD_PROFILE`, `BONUS_BUY_PROFILE`) |
| Sky chance/weights/multipliers | `packages/fairness/src/economicModel.ts` (`sky`, `weightedPickSkyType`) and `apps/frontend/src/engine/sky/config.ts` (spawn coordinates) |
| Boundary streak ladder | `packages/fairness/src/economicModel.ts` (`STREAK_OVERRIDE_MULTIPLIERS`) |
| Per-ball deterministic decomposition | `packages/fairness/src/perBallDecomposer.ts` (`decomposeRound`) |
| Stake round → delivery sequence | `apps/frontend/src/core/modeEngine.ts` (`generateDeliveries`) |
| Telemetry for overrides/caps/residuals | `apps/frontend/src/core/gameController.svelte.ts` (`emitDecomposerTelemetry`) |
| Debug force controls (`force`, `forceSky`, `forceStreak`) | `apps/frontend/src/core/devMock.ts` (`getForcedDecomposeOptions`) |
| Debug trajectory/sky overlay (`?debug=1`) | `apps/frontend/src/lib/CricketSimulation.svelte` + `apps/frontend/src/render/Renderer.ts` |
| Replay tooling | `tools/replay-decomposition.mjs` |

Design invariant:

- Stake `payoutMultiplier` remains the settlement source of truth.
- `decomposeRound` deterministically expands this into representational per-ball factors and reconciles product-to-target with bounded error telemetry.

## 6. Bonus Balls Mechanism (6+n Over)

The frontend now supports a physics-triggered bonus extension path where a standard 6-ball over can become `6+n`.

### Product behavior

- Base over remains 6 deliveries.
- If the ball physically touches a configured bonus object, extra balls are awarded (`+1`, `+2`, etc.).
- Trigger is pure collision logic (no extra RNG gate after collision).
- Extra balls are real gameplay extension, not visual-only.
- Extra balls use auto same-stake flow: controller reuses `game.betAmount` and requests Stake outcomes for each awarded bonus ball.

### Runtime flow

1. `GameEngine.tickBallResult` checks ball position against `BONUS_OBJECTS` placement data.
2. On collision, engine emits `bonusAwarded` via `EventBus`.
3. `EngineBridge` forwards `bonusAwarded` through callback wiring.
4. `gameController.svelte.ts` queues Stake `play()` calls (serialized) and appends resulting deliveries.
5. `currentDeliveries.length` becomes dynamic and scoreboard updates use `totalBallCount`.

### Main files

- `apps/frontend/src/engine/worldLayout.ts`
  - Defines `BONUS_OBJECTS` with position, zone, radius, and awarded balls.
- `apps/frontend/src/engine/GameEngine.ts`
  - Collision detection, one-trigger-per-object guard, `activeBonusHit` snapshot feedback.
- `apps/frontend/src/engine/events/EventBus.ts`
  - Adds typed `bonusAwarded` event payload.
- `apps/frontend/src/bridge/EngineBridge.ts`
  - Bridges `bonusAwarded` from engine to controller callback.
- `apps/frontend/src/core/gameController.svelte.ts`
  - Queues extra-ball Stake requests, appends deliveries, tracks `baseBallCount` / `bonusBallCount` / `totalBallCount`.
- `apps/frontend/src/render/Renderer.ts`
  - Renders bonus-target props and applies hit highlight feedback using `activeBonusHit`.
