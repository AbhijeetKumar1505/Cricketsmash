# Cricket Crash

Cricket-themed crash / multiplier game — **pnpm** monorepo with **`apps/backend`** (optional realtime + wallet), **`apps/frontend`** (Svelte 5 + Vite + Three.js), and shared **`packages/*`**.

## Quick start

```bash
npm run bootstrap    # install + build shared packages
npm run dev          # frontend 5173; backend 8787 if present in workspace scripts
npm run typecheck
npm run build
```

Detailed commands, env vars, and architecture (including **`EngineBridge` → `GameEngine` → `Renderer`**) are documented in **[`CLAUDE.md`](./CLAUDE.md)**. Codex/agent notes for Stake-centric work: **[`AGENTS.md`](./AGENTS.md)**.

## Documentation index

| | |
|--|--|
| [`docs/game.md`](./docs/game.md) | Index of gameplay / design docs |
| [`docs/COMPREHENSIVE_ARCHITECTURE.md`](./docs/COMPREHENSIVE_ARCHITECTURE.md) | Simulation loop, WebGL layering, procedural characters |
| [`docs/PRD.md`](./docs/PRD.md) | Product requirements |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Refactor roadmap |

## Frontend runtime (high level)

1. **`CricketSimulation.svelte`** mounts the canvas.
2. **`EngineBridge`** runs **`GameLoop`**: **`GameEngine.update`** → snapshot → **`Renderer.render`**.
3. **Stadium / crowd** assemble under **`render/entities/Stadium.ts`** + **`engine/arena/*`**.
4. **Pitch primitives** (`bowler`, `batsman`, **fielders**) are built in **`engine/objects/players.ts`** — static doodle faces (no facial `lookAt`); root yaw lives in **`render/Renderer.ts`**.
