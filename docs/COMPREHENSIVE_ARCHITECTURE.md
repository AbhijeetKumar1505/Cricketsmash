# Cricket Crash Architecture & Internal Mechanics

This document provides an in-depth breakdown of the technical logic that powers **Cricket Crash**: the game math, WebGL physics, camera rendering, and the Stake RGS integration.

---

## 1. Core Physics vs Visual Pseudo-Physics

One of the most defining aspects of the game engine is that **it does not use a typical Physics Rigidbody engine (like Cannon.js, Rapier, or Ammo.js).** 
Because this is a high-speed "Crash" multiplier betting game, the outcome must be mathematically determined instantly. The front-end renders these outcomes purely via deterministic "pseudo-physics" (easing functions, linear interpolation).

### The Translation Pipeline (`screenToWorld`)
The game calculates the ball trajectory in a raw 2D pixel space (mapped internally via `layout.ts` measuring distances like `CX_BOWL` and `CX_HIT`).
Once the 2D coordinate is determined for the current frame step via an easing curve (`easeOut`, `clamp`), the engine calls `screenToWorld(bx, by)` to automatically project that pixel vector into the 3D stadium environment mapping depth (`Z_NEAR` vs `Z_FAR`).

Because `Three.js` already runs a `PerspectiveCamera`, adjusting the raw 3D z-depth scales the ball logically as it flies from the bowler down the pitch towards the batter.

---

## 2. 3D Engine & Rendering (Three.js)

The visual world is driven by `CricketWebGLEngine`, operating a heavy 60+ FPS `requestAnimationFrame` render loop isolated carefully inside a Svelte context.

### Lighting & Atmospheric Effects
- **Primary Stage Lighting**: Real-time shadows provided by a sweeping `DirectionalLight` simulating stadium floods.
- **Micro Lighting**: The glowing multiplier ball carries a `PointLight` directly attached to its mesh group (`objects/ball.ts`). As the ball builds up speed or the multiplier escalates, this light changes color (to hot oranges running into white) and pulses alongside the UI.

### The Camera System
The camera acts exactly like a drone or live sport broadcast camera with three distinct profiles: `broadcast`, `bowler`, and `batsman`. 
Instead of snapping cameras manually, the `StadiumCameraRig` moves its `basePosition` and uses the robust `GSAP` animation library to physically push its `lookAtTarget` matrix vector globally. This creates organic cinematic sweeps. On high boundaries (like a SIX), it hooks the target specifically onto the flying ball mesh!

### Procedural Characters
No external `.glb` models are requested. The engine spins up entirely generated voxel-like figures composed of segmented `Three.Group` hierarchies linking Torso, Arms, and Legs. 
During the game loop (`ph === 'bowl'`), the engine feeds a normalized phase percentage (`pp`) driving localized pivot rotations: executing continuous sine sweeps for running-legs and steep vector rotations for the bowling arm wind-up.

---

## 3. Stake RGS Integration & Playback Engine

The game is a Stake-native application. All game logic resides on the Stake server, and the frontend acts as a high-fidelity playback engine.

### Game Controller State (`gameController.svelte.ts`)
The `gameController` manages the reactive state of the game using Svelte 5 runes (`$state`). It coordinates with the `StakeGameClient` to initialize the game, place bets, and cash out.

### Playback Engine (`playbackEngine.ts`)
The `playbackEngine` is responsible for translating the server-provided outcome into a frame-accurate 3D sequence. 
- **Sequence Generation**: `modeEngine.ts` takes the final payout multiplier and distributes the growth across up to 6 deliveries (an "over").
- **Frame Synchronization**: The engine computes the current `VisualPhase` (waiting, bowling, hitting, result) and calculates the interpolated multiplier for every frame.

---

## 4. Fairness & Outcome Mapping

The `payoutMultiplierToCricketOutcome` function in `@cricket-crash/fairness` is the canonical mapping between a raw payout multiplier and a cricket-themed event.
- **Runs Mapping**: Multipliers are mapped to 1s, 2s, 3s, 4s, and 6s to drive the 3D shot animations.
- **Wicket Mapping**: A multiplier of 0 (or less) is mapped to a `wicket` outcome, ending the session visually.
