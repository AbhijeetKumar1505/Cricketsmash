# Cricket Crash Gameplay Docs

Navigation entry-point for gameplay and product documentation in this repo.

## Canonical documents (present in `docs/`)

| File | Topic |
|------|--------|
| `docs/PRD.md` | Product requirements |
| `docs/ROADMAP.md` | Refactor / audit-aligned roadmap |
| `docs/COMPREHENSIVE_ARCHITECTURE.md` | Frontend loop, rendering, characters, fairness summary |
| `docs/implementation_plan.md` | Living stadium layer (crowd, banners, activities) implementation notes |
| `docs/cricket_crash_system_design_stake_grade.md` | System design (Stake-grade) |
| `docs/CASINO_GLOW_MANIFEST.md` | Visual / tone reference |
| `docs/cricket_crash_ui_ux_addictive_design_plan_stake_inspired_funky_approach.md` | UX design notes |

## UI shell (viewport)

- **`apps/frontend/src/pages/GamePage.svelte`** — Arena is **full bleed to the top** (no top black HUD strip). A **44px** bottom bar holds Stake-style chrome; **balance** and **mute** are on the **left** of that bar. See also **`docs/COMPREHENSIVE_ARCHITECTURE.md`** §2 “Page shell”.

## Latest gameplay addition

- **Bonus Balls (`6+n` over extension)**:
  - Physics-only collision trigger against configured bonus targets.
  - Extra balls are real round extensions (not cosmetic only).
  - Awarded extra balls are auto-bet with the same stake amount.
  - Core implementation lives in:
    - `apps/frontend/src/engine/worldLayout.ts` (`BONUS_OBJECTS`)
    - `apps/frontend/src/engine/GameEngine.ts` (collision + `bonusAwarded`)
    - `apps/frontend/src/bridge/EngineBridge.ts` (event passthrough)
    - `apps/frontend/src/core/gameController.svelte.ts` (extra-ball queueing and delivery extension)
    - `apps/frontend/src/render/Renderer.ts` (showable bonus targets + hit feedback)

## Older / adjunct references

Some historical filenames (`simulation-engine.md`, `visual-engine.md`, `system-design.md`) are **not** currently in `docs/`; use **`COMPREHENSIVE_ARCHITECTURE.md`** and **`apps/frontend/src/engine/GameEngine.ts`** / **`apps/frontend/src/render/Renderer.ts`** as the live technical source of truth for the simulation + WebGL pipeline.

## Repository / agent guidance

- **`CLAUDE.md`** (repo root) — commands, backend architecture, **`EngineBridge`** + **`GameEngine`** + **`Renderer`** frontend wiring, doodle player stability rules.
- **`AGENTS.md`** — Codex/agent notes (Stake-centric).

## Supported modes (`sdk-wrapper`)

Product behavior spans:

- **`stake`** — Stake RGS
- **`realtime`** — WebSocket + server RNG + optional Mongo/Redis (`apps/backend/`)
- **`local`** — client-only over (`modeEngine` timeline)
