# Player Animation — Game-Feel Pass (v2)

> Supersedes the v1 plan. Where v1 was about animation correctness (per-bone keyframes, ActionClips, easing curves), v2 is about **game feel**: anticipation, impact, follow-through, character personality, multi-channel sync. Players will watch the bowler and batsman hundreds of times in a session — anatomically perfect arm rotation is invisible to them; the *recoil after impact* is not.

## Context

A bet-driven crash game lives or dies on its core loop "feel." For Cricket Crash that loop is **bowl → swing → result**, played 6 times per over, dozens of times per session. The current animation system slerps to a single static pose per state — bowlers freeze with the arm at release, batsmen freeze with the bat at contact, and nothing else in the frame reacts. Players read that as "fake" within 3 deliveries.

The fix isn't bigger pose tables or more keyframes. It is six things, in this order of impact:

1. **Readability from the broadcast camera** — silhouette and momentum must be visible at 1080p from `[0, 3.6, 11.5]`.
2. **Anticipation before release / contact** — a beat of "wind-up" that signals "something is about to happen."
3. **Multi-channel impact** at the sync frames — bone motion + camera + audio + particle + brief slow-mo all fire on the same frame.
4. **Follow-through** — the brain judges realism from what happens *after* the event, not the event itself.
5. **Personality** — Modi vs Trump vs Putin should be distinguishable from their swing alone, using the same rig.
6. **Frame-accurate sync** with engine events (ball spawn, ball contact). Even 100ms slip reads as fake.

Crucially, **the engine already has the infrastructure we need**. `apps/frontend/src/engine/physics/animationFSM.ts` ships a `BowlerFSM` with phases `RUN_UP → GATHER → ARM_SWING → RELEASE → FOLLOW_THROUGH`, eased progress accessors (`runUpEased`, `gatherEased`, `armSwingEased`, `followThroughEased`), and `onRelease` / `onComplete` callbacks. The `BatsmanFSM` has `IDLE → BACKLIFT → SWING → CONTACT → FOLLOW_THROUGH` with `onContact` callback. None of this is exposed to the renderer today — `EngineSnapshot` only carries the legacy `CharacterAnimState { runT, phase }`. **Exposing those FSM snapshots and consuming them from a new layered animation brain is the smallest change with the biggest game-feel payoff.**

## Design principles

- **Game-feel over animation purity.** If two approaches look the same on screen, ship the simpler one.
- **Drive animation from engine signals, not wall-clock time.** Every action must lock to the gameplay event that caused it, so fast/spin/swing bowlers stay in sync without retuning.
- **Layer everything additively.** No layer overwrites a bone; each writes its delta into an accumulator that gets applied once per frame. Means we can mix run-cycle + delivery + secondary motion without the run-cycle clobbering the arm sweep.
- **Sync frames are sacred.** Release frame and contact frame fire a *bundle* of effects atomically. Never schedule one with `setTimeout` — every channel must consume the same engine event.
- **Personality is multipliers, not new clips.** One canonical bowling/batting motion, scaled per character. Free differentiation, no asset cost.

## Architecture — 8-layer animation stack

Per character, per frame, in this evaluation order. Each layer reads from the engine snapshot and writes deltas into a `BoneAccumulator` keyed by canonical bone name. A final pass writes the accumulator to `bone.quaternion` / `bone.position`.

```
Character per-frame pipeline
│
├── L0  Root Motion       — root.position (run-up drift, front-foot trigger, fielder chase)
├── L1  Hip Layer         — sway, load, drive — wrote first so later layers compose over it
├── L2  Spine Layer       — twist, tilt, anticipation stretch
├── L3  Arm Layer         — bowl arc / swing arc with phase-driven easing
├── L4  Hand Layer        — wrist snap / grip lock at sync frames
├── L5  Head Tracking     — lookAt(ball) clamped to ±20° yaw / ±15° pitch
├── L6  Secondary Motion  — spring lag on forearms, hands, head, bat
└── L7  FX Bus            — not bones; fires camera shake / trail / flash / sound on phase edges
```

L0–L4 are the **primary action**, driven by FSM phase + eased progress. L5–L6 are **always-on polish** that runs on every character every frame. L7 is **event-driven**, listening to `onRelease` / `onContact` and frame edges.

## Engine snapshot extensions (prerequisite)

Surface the FSM data so the renderer can stop guessing.

```ts
// CharacterAnimState becomes:
interface CharacterAnimState {
  // ── existing legacy fields, kept for compat ─
  runT:        number;
  phase:       string;
  bowlerType?: BowlerType;
  shotType?:   ShotType;
  celebration?: string;

  // ── new FSM mirror ─
  fsm: {
    phase:    'IDLE' | 'RUN_UP' | 'GATHER' | 'ARM_SWING' | 'RELEASE' | 'FOLLOW_THROUGH'
            | 'BACKLIFT' | 'SWING' | 'CONTACT';
    progress: number;   // 0..1 within current phase
    runT:     number;   // 0..1 across full action
    eased: {            // pre-computed by FSM, cheap to ship
      runUp:         number;
      gather:        number;
      armSwing:      number;
      backlift:      number;
      swing:         number;
      contact:       number;
      followThrough: number;
    };
  };
}
```

Populated in `GameEngine.snapshot` getter from `BowlerFSM.snapshot` and `BatsmanFSM.snapshot`. Touch `apps/frontend/src/engine/GameEngine.ts` once; nothing else changes server-side.

Also expose **sync event tokens** so L7 can consume them deterministically:

```ts
interface SyncEvents {
  ballReleaseId: number;   // increments when BowlerFSM enters RELEASE
  ballContactId: number;   // increments when BatsmanFSM enters CONTACT
}
// added to EngineSnapshot top-level
```

Renderer compares `ballReleaseId` against `_lastSeenReleaseId`; if different, fire the release bundle. Simple, frame-perfect, no callbacks across the engine/render boundary.

## Bowling sequence (5 phases)

Driven entirely from `bowler.fsm`. Each phase composes specific layers. All values are deltas added to the IDLE base pose; personality multipliers scale the final result.

### Phase 1 — Run-up (`RUN_UP`, 0.55s, `runUpEased: 0→1`)

L0 — Root Motion advances Z from `BOWLER_RUN_START_Z` toward `BOWLER_RELEASE_Z` (already handled in Renderer; keep).
L1 — Hip:  `hip.position.y = sin(t * 12) * 0.03 * runUpEased`  (bounce)
L1 — Hip:  `hip.rotation.z = sin(t * 6)  * 0.05 * runUpEased`  (sway)
L2 — Spine: `spine.rotation.z = sin(t * 8) * 0.08 * runUpEased`
L3 — Arms: alternating pump driven by the same `t * 6` phase — opposite-arm-to-leg cadence.
L4 — Hands: no-op.

**Why this matters:** even before anything dramatic happens, the body is alive. Stops the "frozen until release" feeling.

### Phase 2 — Gather (`GATHER`, 0.20s, `gatherEased: 0→1`)

L1 — Hip rotation loads back (`+0.20 * eased` on Y axis) and weight shifts (`x -= 0.05 * eased`).
L2 — Spine twists toward stumps (`-0.25 * eased` on Y).
L3 — Bowling arm pulls back and up: `rightArm.x: 0 → -1.2 * eased`, `rightArm.z: -0.22 → -1.5 * eased` with `outQuad` ease for spring-loaded feel.
L3 — Non-bowling arm rises for balance: `leftArm.z: 0.22 → +1.0 * eased`.

**Why this matters:** anticipation. The pause and load create dopamine. Without it the release looks robotic.

### Phase 3 — Arm swing (`ARM_SWING`, 0.18s, `armSwingEased: 0→1`)

L2 — Spine flexes forward (`+0.25 * eased`).
L3 — Bowling arm whips overhead with `easeOutExpo` curve (key choice — `easeOutExpo` accelerates then snaps, matching real arm motion). `rightArm.x` sweeps from `-1.2` through `-2.4` (overhead) to `-1.4` (release angle), `rightArm.z` from `-1.5` toward `-0.3`.
L3 — Non-bowling arm pulls down for counter-balance: `leftArm.x: 0 → +0.6 * eased`.
L4 — Wrist starts snap in last 25% of phase: `rightHand.x: 0 → -0.3 * eased^2`.

**Why this matters:** the *whip* is what reads as power. Linear motion looks weak.

### Phase 4 — Release (`RELEASE`, 0.06s — single sync frame)

**THIS IS THE ONLY FRAME WHERE ALL CHANNELS MUST FIRE TOGETHER.** L7 FX Bus consumes `ballReleaseId` change and fires this bundle synchronously:

| Channel        | Effect                                                                |
|----------------|------------------------------------------------------------------------|
| Hand pose      | `rightHand.x: -0.3 → -0.5` (final wrist snap)                          |
| Ball spawn     | Already engine-driven via `BowlerFSM.onRelease` — no change            |
| Camera         | Impulse `+0.015` on Z, decays 0.4s (subtle, not seasick-inducing)      |
| Ball trail     | Emit start; trail color by bowler type (fast=cyan, spin=amber, swing=teal) |
| Audio          | Whip-sound oneshot                                                     |
| Crowd reaction | Optional micro "ooh" (skip unless trivial)                             |

Implementation: `Renderer._fxBus.emitRelease({ bowlerType, ballPos, ballVel })`. The bus owns the per-channel dispatch.

### Phase 5 — Follow-through (`FOLLOW_THROUGH`, 0.55s, `followThroughEased: 0→1`)

L1 — Hip rotation continues forward (`+0.6 * eased`); weight transfers (`x: -0.05 → +0.10`).
L2 — Spine bends sharply forward (`+0.4 * eased`) — this is the iconic "bowler folded over" silhouette.
L3 — Bowling arm crosses body: `rightArm.x: -1.4 → 0`, `rightArm.z: -0.3 → +0.4`.
L3 — Back leg swings up: `rightUpLeg.x: 0 → +0.5 * eased`, `rightLeg.x: 0 → +0.4`.
L5 — Head drops to watch the ball: `head.x: 0 → +0.15`.

**Why this matters:** people judge realism from follow-through, not release. A bowler that just stops dead after release looks like a vending machine.

## Batting sequence (5 phases)

Driven from `batsman.fsm`. Same layer model. The contact frame (`CONTACT` phase entry) is the sync moment.

### Phase 1 — Backlift (`BACKLIFT`, 0.28s, `backliftEased: 0→1`)

L1 — Hip weight shifts back (`x: 0 → -0.05`).
L2 — Spine subtle counter-rotation (`y: 0 → -0.10`) to prep for forward rotation.
L3 — Both arms raise together: `rightArm.z: -0.58 → -1.30 * eased`, `leftArm.z: +0.68 → +1.10 * eased`.
L5 — Head **locks on ball** — fixed lookAt for the entire phase (visible "eye on the ball" tell).

### Phase 2 — Trigger movement (sub-phase inside BACKLIFT, last 0.10s)

L0 — Root Motion: front foot translates ~3cm toward the bowler. Implemented as `root.position.z -= 0.03 * triggerEased` where `triggerEased = max(0, (backliftEased - 0.6) / 0.4)`. **Visually small, perceptually huge** — makes the batsman look skilled.

### Phase 3 — Downswing (`SWING`, 0.16s)

**Kinetic chain**: hips initiate, then chest, then arms — staggered, not simultaneous. Use phase-progress sub-windows:

| Bone group | Active over `swingEased` range | Target delta |
|-----------|--------------------------------|--------------|
| hip       | 0.00 → 1.00                    | `y += +0.95 * hipRotation`  (full rotation) |
| chest     | 0.30 → 1.00                    | `y += +0.70 * hipRotation` |
| arms      | 0.55 → 1.00                    | `swing arc — see below`     |

Arm sweep uses `easeOutQuad` (already in FSM): `rightArm.z: -1.30 → -1.4`, `leftArm.z: +1.10 → +1.2`, both rotating through the ball plane.

**Why staggered:** simultaneous = robot. Hip→shoulder→arm staggered = professional cricketer. Costs nothing extra to implement.

### Phase 4 — Contact (`CONTACT`, 0.017s — single sync frame)

L7 FX Bus consumes `ballContactId` change. Synchronous bundle:

| Channel          | Effect                                                              |
|------------------|---------------------------------------------------------------------|
| Bat vibration    | `bat.rotation.z += sin(time * 80) * 0.03` for 0.10s (handles ringing) |
| Body recoil      | `spine.rotation.x += 0.05`, decays over 0.15s                       |
| Camera shake     | `0.02` intensity, scaled by outcome (six = 0.04, dot = 0.01)         |
| Hit flash        | Full-screen white CSS overlay, 0.04s up + 0.10s down                |
| Ball velocity    | Visual-only `+15%` velocity burst for first 0.20s (renderer reads `ball.vel * 1.15` for the burst window; physics untouched) |
| Hit-stop pause   | Already implemented (`TIMING.HIT_PAUSE = 0.12`); keep                |
| Audio            | Bat-thwack oneshot (already exists)                                 |
| Particle         | Spark burst at bat tip for perfect timing; smaller for good          |

This bundle is **the most important code in the whole feature**. If it doesn't all fire on the same render frame, the impact reads as fake.

### Phase 5 — Follow-through (`FOLLOW_THROUGH`, 0.60s, `followThroughEased: 0→1`)

Same canonical motion; **outcome scales it via `followThroughPower`**:

| Outcome | followThroughPower |
|---------|-------------------|
| dot     | 0.5  (compact, defensive look) |
| single  | 0.8  |
| double  | 1.0  |
| triple  | 1.2  |
| four    | 1.4  |
| six     | 1.8  (full overhead finish) |
| wicket  | 0.3  (missed swing — angry/short) |

L1 — Hip rotation continues: `y += +0.4 * eased * followThroughPower`.
L2 — Spine bends to side: `z += +0.2 * eased * followThroughPower`.
L3 — Arms continue past contact: `rightArm.x: 0 → -0.8 * followThroughPower`, `leftArm` mirrors.
L5 — Head turns to track outgoing ball (off the lookAt clamp briefly).

`shotType` adds modifiers post-sample: `loft` → `+0.3` arm elevation; `pull` → `+0.15` hip lateral, more horizontal arm path.

## Head tracking layer (L5) — always on

```ts
function updateHead(char, ballWorldPos) {
  const headWorld = new Vector3();
  char.bones.get('head').getWorldPosition(headWorld);

  // Compute local-space lookAt delta
  const target = ballWorldPos.clone().sub(headWorld);
  const yaw   = Math.atan2(target.x, target.z);
  const pitch = Math.atan2(target.y, Math.hypot(target.x, target.z));

  // Subtract parent yaw (character is rotated to face opponent)
  const parentYaw = char.root.rotation.y;
  const localYaw  = clamp(yaw - parentYaw, -Math.PI/9, Math.PI/9);  // ±20°
  const localPitch = clamp(pitch, -Math.PI/12, Math.PI/12);          // ±15°

  // Damped follow
  const head = char.bones.get('head');
  head.rotation.y = lerp(head.rotation.y, localYaw,   0.15);
  head.rotation.x = lerp(head.rotation.x, localPitch, 0.15);
}
```

Applied to **batsman, bowler, all 11 fielders** every frame. Single biggest "alive stadium" upgrade in the whole feature, ~30 lines of code.

Exception: during bowler `FOLLOW_THROUGH`, head ducks instead of tracking (override with explicit pose).

## Secondary motion layer (L6) — spring lag

For each follower bone, run a critically-damped spring toward the parent bone's target rotation. Creates the *weight* that distinguishes posed characters from puppets.

```ts
class BoneSpring {
  current = new Quaternion();
  velocity = new Quaternion();  // angular velocity (stored as small-angle quat)
  constructor(public stiffness: number, public damping: number) {}

  step(target: Quaternion, dt: number) {
    // Standard spring-damper toward target; details in springs.ts
  }
}
```

Per-bone parameters (lag in seconds is the visible delay):

| Bone     | Lag    | Stiffness | Damping |
|----------|--------|-----------|---------|
| forearm  | 0.03s  | 350       | 30      |
| hand     | 0.05s  | 220       | 25      |
| head     | 0.08s  | 140       | 22      |
| bat      | 0.04s  | 300       | 28      |

Bat spring is the most visible — without it the bat snaps with the wrist; with it the bat trails through contact like it has mass.

## Personality system (Phase 5 — last to ship)

Per-character multiplier table applied during action sampling. **Free differentiation**, no extra art assets.

```ts
const PERSONALITY: Record<PlayerId, Personality> = {
  modi:    { swingPower: 1.0, followThrough: 1.0, headBob: 1.0, stance: 'balanced' },
  trump:   { swingPower: 1.2, followThrough: 1.5, headBob: 1.3, stance: 'wide'    },  // exaggerated
  putin:   { swingPower: 0.9, followThrough: 0.7, headBob: 0.6, stance: 'compact' },  // technical
  adeft:   { swingPower: 1.1, followThrough: 1.2, headBob: 1.0, stance: 'balanced'},
  kimjong: { swingPower: 0.95,followThrough: 0.9, headBob: 0.7, stance: 'compact' },
  meloni:  { bowlSpeed: 1.05, bowlFollowThrough: 1.1 },                                // bowler
  ronaldo: { runSpeed:  1.4,  divePower: 1.5 },                                        // fielder
};
```

Applied at the layer-write step: `acc.add('rightArm', delta.multiplyScalar(personality.swingPower))`. Note: personality must NOT scale head tracking or contact-frame poses — only the action arc — or characters lose their eye-on-ball discipline at extremes.

## FX Bus (L7) — event-driven, frame-perfect

```ts
class AnimationFX {
  private lastReleaseId = -1;
  private lastContactId = -1;

  consume(snapshot: EngineSnapshot, dt: number) {
    if (snapshot.syncEvents.ballReleaseId !== this.lastReleaseId) {
      this.lastReleaseId = snapshot.syncEvents.ballReleaseId;
      this.fireReleaseBundle(snapshot);
    }
    if (snapshot.syncEvents.ballContactId !== this.lastContactId) {
      this.lastContactId = snapshot.syncEvents.ballContactId;
      this.fireContactBundle(snapshot);
    }
    this.tickActiveEffects(dt);  // bat vibration, recoil decay, etc.
  }
}
```

This is the **only correct way to do sync frames**. No setTimeout, no callbacks across boundaries, no schedule arrays. Frame N has `ballReleaseId == K`; frame N-1 had `K-1`; we fire on the diff. Frame-rate independent, scrub-safe, deterministic.

## File structure

New files:

- `apps/frontend/src/game/animation/AnimationBrain.ts` — top-level orchestrator. Per character per frame: runs all layers L0–L7.
- `apps/frontend/src/game/animation/BowlingController.ts` — bowler-specific phase → layer mapping (replaces the bowler branch of `_updateGlbAnims`).
- `apps/frontend/src/game/animation/BattingController.ts` — batsman-specific phase → layer mapping.
- `apps/frontend/src/game/animation/FieldingController.ts` — fielder pickup/throw chain (Phase 3 of roadmap).
- `apps/frontend/src/game/animation/BoneAccumulator.ts` — per-frame delta accumulator + final apply.
- `apps/frontend/src/game/animation/springs.ts` — `BoneSpring` class + per-bone parameter table.
- `apps/frontend/src/game/animation/headTracking.ts` — clamped lookAt.
- `apps/frontend/src/game/animation/personality.ts` — multiplier table + apply helper.
- `apps/frontend/src/game/animation/fxBus.ts` — release/contact bundles + tick.
- `apps/frontend/src/game/animation/poses.ts` — IDLE base pose + utility easing functions (moved from `AnimationManager.ts`).

Modified files:

- `apps/frontend/src/engine/GameEngine.ts` — extend `CharacterAnimState` with `fsm` sub-object; populate from `BowlerFSM.snapshot` / `BatsmanFSM.snapshot`. Add `syncEvents` to `EngineSnapshot`; increment counters from existing `onRelease` / `onContact` callbacks.
- `apps/frontend/src/render/Renderer.ts` — replace the body of `_updateGlbAnims(dt)` with a call into `AnimationBrain.update(snapshot, dt)`. Drop the bowler/batsman/fielder branches (logic moves to controllers).
- `apps/frontend/src/game/CharacterManager.ts` — verify bat is a child of `rightHand` bone on each batsman GLB at load time. If a model has the bat as a free mesh, parent it (one-line fix). Log warnings on missing canonical bones.

Retired (gradually):

- `apps/frontend/src/game/AnimationManager.ts` — kept for fielders during transition, then deleted in Phase 3 when `FieldingController` lands. Idle / celebrate / dive / catch pose data moves to `poses.ts`.

## Roadmap (5 phases — incremental, each ships independently)

### Phase 1 — Core motion + sync (HIGHEST PRIORITY)

- Extend snapshot with `fsm` + `syncEvents`.
- Build `BoneAccumulator`, `AnimationBrain`, `BowlingController`, `BattingController`.
- Wire L0–L4 + L7 for bowler and batsman.
- Verify: release frame and contact frame fire all-channel bundles, visible on screen, on the same frame for all bowler types.

### Phase 2 — Always-on polish

- Add `headTracking.ts` (L5) for all 13 characters.
- Add `springs.ts` (L6) for forearm/hand/head/bat on bowler+batsman.
- Verify: stadium feels alive; bat trails through contact with visible weight.

### Phase 3 — Fielding chain

- `FieldingController` with states `Idle → Ready → Run → Slow → PlantFoot → Bend → Grab → Rise → Throw → Celebrate`.
- Each transition has its own L1/L2/L3 deltas; no shortcuts.
- Retire `AnimationManager.ts` once fielders are migrated.

### Phase 4 — FX polish

- Ball trails (bowler-type colored), motion streaks on six, spark on perfect timing.
- Camera reactions tuned per outcome bucket.
- Bat vibration ringing (already in L7 bundle; tune amplitude/decay).
- Crowd burst on six (optional, only if cheap).

### Phase 5 — Personality

- Populate `personality.ts` table.
- Apply multipliers in `AnimationBrain` at the layer-write step.
- Verify: a player can tell Trump from Putin from Modi by their swing alone within 5 deliveries.

## Verification (game-feel oriented)

Different from v1 — we test how it *feels*, not how it *measures*.

1. **The "10 in a row" test.** Watch 10 consecutive deliveries. Does it feel different each time? Is there visible anticipation before each release? If you can predict the exact frame of release without timing it, that's good — the anticipation is reading.
2. **The "punch" test.** Pause the recording at the exact contact frame. Multiple sensory channels should all be peaking: bat at contact, body recoiled, camera offset, flash overlay, particle burst. If any one channel is missing or slightly off, the impact dies.
3. **The "personality" test.** Switch through all 5 batsmen at the same bet level. Without looking at the avatar, can you tell who is at the crease from the swing? If yes, personality multipliers are tuned correctly.
4. **The "casino distance" test.** Frame the canvas at 1080p and sit ~24" back. Animation must read at that distance — silhouette, weight transfer, follow-through all visible. Detail-only motion (e.g. wrist snap) is wasted at this scale; gross body motion is what reads.
5. **The "frame-by-frame" test.** Record 30fps gameplay, scrub. On the release frame, the hand should be at world Y ≈ 1.8m (matching `WORLD.RELEASE_Y`) and the ball should be at exactly that position. On the contact frame, the bat tip should be at `BATSMAN_Z` and the ball should be on it.
6. **The "different bowler" test.** Watch fast → spin → swing in sequence. Each should feel paced differently (the FSM durations create this for free since they're not retimed). Critical: release frame still aligns to ball spawn for all three.
7. **Type & build.** `npm run typecheck` clean. `npm run dev` no console errors.
8. **Regression check.** Idle, prepare, celebrate, angry should look unchanged from today. Only bowl, swing, and (Phase 3) fielding paths visibly differ.

## Risks

- **Bat parenting unknown across 5 batsman models.** First implementation step is to log bat-mesh parent for each GLB on load. If any model has the bat unparented, we patch in `CharacterManager.instantiateCharacter`.
- **Bone alias coverage.** Some GLBs may use non-standard bone names. `buildBoneMap` already handles Mixamo/Unity/plain — if a canonical lookup returns `undefined`, we log a warning per model so we can extend the alias table.
- **Performance.** 13 characters × 8 layers + springs + head lookAt per frame. Should be well under 1ms at 60fps, but instrument and confirm.
- **Snapshot growth.** Adding `fsm` sub-object grows the per-frame snapshot by ~80 bytes per character. Trivial.
- **FX bus race.** If `ballReleaseId` and `ballContactId` both increment on the same frame (theoretically possible if the renderer skips a frame), both bundles fire that frame — which is correct, not a bug.
- **Backwards compat.** Legacy `CharacterAnimState.phase` / `runT` stay; only additive changes to types. `AnimationManager.ts` is kept until Phase 3 — fielders keep working unchanged until their controller lands.
