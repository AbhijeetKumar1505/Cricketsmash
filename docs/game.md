# Cricket Crash Gameplay Docs

This file is now the navigation entry-point for gameplay documentation.

## Canonical documents

- `docs/PRD.md`
- `docs/system-design.md`
- `docs/simulation-engine.md`
- `docs/visual-engine.md`

## Repository / agent guidance

- Root `CLAUDE.md` — commands, architecture, frontend stack (Three.js + `GameArena`), and CSS conventions (e.g. standard `appearance` with vendor prefixes).

## Scope

These documents define the product behavior for:

- Local single-over mode (`mode: "local"`)
- Realtime WebSocket mode (`mode: "realtime"`)
- Stake-integrated mode (`mode: "stake"`)

They also include the complete audit findings, fix procedures, and phased refactor roadmap used to move this project to production readiness.