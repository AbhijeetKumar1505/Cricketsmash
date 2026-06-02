# Animation Architecture Specification — Cricket Crash

**Status:** Pre-Audit Working Draft
**Strategy:** Audit-first → Root Cause → Salvage Assessment → Design → Implement

---

# Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Phase 0 — Stabilization](#2-phase-0--stabilization)
3. [Phase A — Forensic Audit](#3-phase-a--forensic-audit)
4. [Root Cause Determination](#4-root-cause-determination)
5. [Salvage Assessment](#5-salvage-assessment)
6. [Post-Audit Phases (Preliminary)](#6-post-audit-phases-preliminary)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Execution Schedule](#8-execution-schedule)
9. [Migration Plan](#9-migration-plan)

---

## 1. Current State Summary

### 1.1 Active Pipeline (GLB-based)

```
GameLoop
  ↓ render()
EngineSnapshot
  ↓ _updateGlbAnims(dt)
AnimationBrain.update(snap, dt, ballWorld)
  ├─ _updateBowler(snap, dt, ballWorld)
  │    ├─ mixer.update(dt)
  │    ├─ layerSet.beginFrame()
  │    ├─ applyBPToLoco/Role(bp, acc)
  │    ├─ BowlingController.update(snap, dt, acc, pers)
  │    ├─ AnimationFX.consume(snap, dt)
  │    ├─ updateHeadTracking()
  │    └─ layerSet.applyAll(inst)
  ├─ _updateBatsman(snap, dt, ballWorld)
  │    └─ (same pattern with BattingController)
  └─ _updateFielders(snap, dt, ballWorld)
       └─ (same pattern with FieldingController)
AnimationBrain.batsmanRootZ → mount.root.position.z
_syncBatToHand()
  └─ rh.matrixWorld.decompose → bat.position + bat.quaternion × _BAT_QUAT_OFFSET
```

### 1.2 Key Files

| File | Lines | Role |
|------|-------|------|
| `game/animation/AnimationBrain.ts` | 609 | Central orchestrator, ClipPlayer (inline), bind-pose capture, per-role update methods |
| `game/animation/BattingController.ts` | 516 | All batsman bone motion, 5 phases, 4 hit personalities, kinetic chain, BACKLIFT→SWING blend |
| `game/animation/BowlingController.ts` | 114 | Simplified arm-drive bowling (6 phases) |
| `game/animation/BowlingProtoController.ts` | 305 | Legacy migration bowling with lean distribution + arm sweep |
| `game/animation/FieldingController.ts` | 217 | Per-fielder chase/dive/gather, per-fielder time state |
| `game/animation/StagingController.ts` | 151 | Idle stances + breathing (used when STAGING_ENABLED and !ANIM_PROCEDURAL_ENABLED) |
| `game/animation/fxBus.ts` | 147 | Frame-perfect sync event bundles, body recoil + bat vibration decay |
| `game/animation/headTracking.ts` | 79 | LookAt(ball) with damped yaw/pitch limits |
| `game/animation/springs.ts` | 88 | Critical-damped spring lag on extremities |
| `game/animation/personality.ts` | 143 | Per-character scale multipliers |
| `game/animation/BoneAccumulator.ts` | 130 | setRot/addRot/setPos/addPos per-bone per-layer |
| `game/animation/BoneLayer.ts` | 100 | LayerId enum (0-5), BONE_OWNERSHIP map, canSetRot() |
| `game/animation/LayerResolver.ts` | 57 | LayerSet: beginFrame() + applyAll() in priority order |
| `game/animation/BattingReference.ts` | 56 | MAX_SWING_RAD, per-bone shares, kinetic chain leads |
| `render/Renderer.ts` | 909 | `_syncBatToHand()` at 519, `_updateGlbAnims()` at 791 |
| `engine/physics/animationFSM.ts` | 328 | BowlerFSM + BatsmanFSM pure state containers |
| `game/CharacterManager.ts` | 292 | GLB loading, BONE_ALIASES map, instantiation |
| `game/AnimationManager.ts` | 473 | LEGACY — direct bone slerp, 14-state AnimState enum |

### 1.3 Bone Canonical Names (21 Bones)

Resolved via `BONE_ALIASES` in `CharacterManager.ts:125`:

```
hips, spine, chest, upperChest, neck, head,
leftShoulder, rightShoulder,
leftArm, rightArm,
leftForeArm, rightForeArm,
leftHand, rightHand,
leftUpLeg, rightUpLeg,
leftLeg, rightLeg,
leftFoot, rightFoot
```

### 1.4 Layer System (6 Layers, Priority-Ordered)

| LayerId | Name | Owned Bones | setRot Authority | Purpose |
|---------|------|-------------|------------------|---------|
| 0 | LOCOMOTION | hips + all leg bones | ✓ | Mixer-driven walk/run base |
| 1 | ROLE | spine+chest+upperChest+neck+all arm bones | ✓ | Cricket action (bowl/bat/field) |
| 2 | REACTION | (none — additive only) | ✗ | Contact recoil, bat vibration |
| 3 | HEAD | head | ✓ | Ball tracking lookAt |
| 4 | SPRING | (none — additive only) | ✗ | Secondary motion lag |
| 5 | IK | (none — additive only) | ✗ | Future foot/bat IK |

### 1.5 Animation Files by Directory

```
game/animation/               # Active animation pipeline (16 files)
  AnimationBrain.ts           #   Orchestrator 609L
  BattingController.ts        #   Batsman 516L
  BattingReference.ts         #   Constants 56L
  BowlingController.ts        #   Bowler 114L
  BowlingProtoController.ts   #   Legacy migration 305L
  FieldingController.ts       #   Fielders 217L
  StagingController.ts        #   Idle stances 151L
  fxBus.ts                    #   FX events + decay 147L
  headTracking.ts             #   Head lookAt 79L
  springs.ts                  #   Secondary motion 88L
  personality.ts              #   Character scales 143L
  BoneAccumulator.ts          #   Per-layer targets 130L
  BoneLayer.ts                #   Layer enum + ownership 100L
  LayerResolver.ts            #   LayerSet 57L
  RigMapper.ts                #   (future — not yet created)
  poses.ts                    #   Easing functions 104L
  animDebugState.svelte.ts    #   Debug state 60L

characters/human/              # Legacy/dead human pipeline (10+ files)
  HumanAnimator.ts            #   Stub — evaluate() does nothing
  HumanSkeleton.ts            #   33-bone procedural rig (unused by GLB path)
  controllers/
    CharacterController.ts    #   Idle→Ready→React→Execute→Recover FSM (partially active stub)
    BowlerController.ts       #   13L stub
    FielderController.ts      #   31L stub
    (BattingController — not in this dir; lives in game/animation/)
  animation/                   #   Animation stack layers (unused)
  skinning/                    #   Procedural skinning (unused)
  render/                      #   Procedural materials + lighting (unused)

engine/characters/             # Doodle sprite layer (legacy)
  BaseCharacter.ts             #   Base class 135L
  Batsman.ts                   #   39L
  Bowler.ts                    #   41L
  Fielder.ts                   #   45L

engine/systems/
  AnimationSystem.ts           #   Pure state management (kept — engine fsms need it)

game/
  AnimationManager.ts          #   LEGACY slerp system, 14 AnimState states, 473L
  CharacterManager.ts          #   Active — GLB loading + bone aliasing 292L
```

---

## 2. Phase 0 — Stabilization

### 2.1 Goal
No gameplay changes. Add safe guards and documentation to make the audit safe and repeatable. Reduce risk of misunderstanding what is active vs dead.

### 2.2 Actions

#### 2.2.1 Mark Active vs Legacy Files

Add file headers categorizing every animation-related file into one of:

- **`@active`** — drives current gameplay. Do not modify without understanding the full pipeline.
- **`@deprecated`** — not used by the active pipeline. May reference dead concepts. Safe to remove after audit.
- **`@stub`** — partially implemented or no-op. Does not affect gameplay.
- **`@unknown`** — purpose or activity status uncertain. Requires audit.

Provisional categorization (to be verified during Phase A):

| File | Provisional Status |
|------|-------------------|
| `game/animation/AnimationBrain.ts` | `@active` |
| `game/animation/BattingController.ts` | `@active` |
| `game/animation/BowlingController.ts` | `@active` |
| `game/animation/BowlingProtoController.ts` | `@active` (debug/test mode only) |
| `game/animation/FieldingController.ts` | `@active` |
| `game/animation/StagingController.ts` | `@active` (staging-only mode) |
| `game/animation/fxBus.ts` | `@active` |
| `game/animation/headTracking.ts` | `@active` |
| `game/animation/springs.ts` | `@active` |
| `game/animation/personality.ts` | `@active` |
| `game/animation/BoneAccumulator.ts` | `@active` |
| `game/animation/BoneLayer.ts` | `@active` |
| `game/animation/LayerResolver.ts` | `@active` |
| `game/animation/BattingReference.ts` | `@active` |
| `game/animation/poses.ts` | `@active` |
| `game/animation/animDebugState.svelte.ts` | `@active` |
| `characters/human/HumanAnimator.ts` | `@deprecated` |
| `characters/human/HumanSkeleton.ts` | `@deprecated` |
| `characters/human/controllers/CharacterController.ts` | `@stub` |
| `characters/human/controllers/BowlerController.ts` | `@stub` |
| `characters/human/controllers/FielderController.ts` | `@stub` |
| `characters/human/animation/` | `@deprecated` |
| `characters/human/skinning/` | `@deprecated` |
| `characters/human/render/` | `@deprecated` |
| `engine/characters/BaseCharacter.ts` | `@deprecated` |
| `engine/characters/Batsman.ts` | `@deprecated` |
| `engine/characters/Bowler.ts` | `@deprecated` |
| `engine/characters/Fielder.ts` | `@deprecated` |
| `engine/systems/AnimationSystem.ts` | `@active` (engine state, not animation) |
| `game/AnimationManager.ts` | `@deprecated` |

#### 2.2.2 Runtime Bone Validation

Add validation pass in `AnimationBrain.update()` that checks 21 canonical bones exist for the active character. Log clear errors on mismatch.

```typescript
const ALL_CANONICAL_BONES = [
  'hips','spine','chest','upperChest','neck','head',
  'leftShoulder','rightShoulder',
  'leftArm','rightArm',
  'leftForeArm','rightForeArm',
  'leftHand','rightHand',
  'leftUpLeg','rightUpLeg',
  'leftLeg','rightLeg',
  'leftFoot','rightFoot',
];

function validateBones(inst: CharacterInstance): string[] {
  const missing: string[] = [];
  for (const name of ALL_CANONICAL_BONES) {
    if (!inst.bones.has(name)) missing.push(name);
  }
  return missing;
}
```

#### 2.2.3 Animation Ownership Document

Create a living document (`ANIMATION_ARCHITECTURE.md` or extended `AGENTS.md` section) that answers:

- **What drives each character?** (AnimationBrain vs doodle sprite vs legacy)
- **What state machines exist?** List every state enum, its file, its states, and who owns it
- **What is the per-frame execution order?** From rAF → Renderer.render() → bone.rotation.set()
- **What is the bat's relationship to the skeleton?** (world-space sync, not hierarchical)
- **Which animation clips exist?** List every GLB clip per character
- **Which controllers are real?** Map each game phase to the controller method that drives it

### 2.3 Deliverables

- File headers updated with status tags across ~30 files
- Runtime bone validation active during development
- Animation ownership document committed to repository

---

## 3. Phase A — Forensic Audit

**No code changes.** Read-only instrumentation and measurement. The objective is to produce evidence for every root cause claim, not to fix anything yet.

### 3.1 Repository Audit

Systematically verify which files are actually loaded and executed at runtime. This is not about reading imports — it is about proving execution.

#### 3.1.1 Execution Trace

Instrument `requestAnimationFrame` → `Renderer.render()` → bone write to produce a real execution trace:

```
rAF (t=12345.67)
  → Renderer.render()
    → _updateGlbAnims(dt=0.016)
      → AnimationBrain.update(snap, dt, ballWorld)
        → _updateBatsman(snap, dt, ballWorld)         # ← always called? Only when batsman bound?
          → b.instance.mixer.update(dt)                # ← does mixer update happen?
          → applyBPToLoco(bp, acc)                     # ← which bones get setRot?
          → BattingController.update(snap, dt, acc, p) # ← which phase dispatched?
            → _swing(0.73, acc, p)                     # ← which internal method called?
            → acc.addRot('rightArm', -1.2, 0, -1.4)   # ← which accumulator targets set?
          → LayerSet.applyAll(b.instance)              # ← bones actually written?
            → bone.rotation.set(...)                   # ← which bones, what values?
    → _syncBatToHand()
      → rh.matrixWorld.decompose(pos, quat, scale)
      → batsmanBat.position.copy(pos)
      → batsmanBat.quaternion.copy(quat).multiply(OFFSET)
    → composer.render()
```

For each step, record:
- Was it reached? (yes/no)
- How many times per frame? (some fielding code iterates 11 times)
- What were the parameters? (dt, phase, progress values)
- What was the output? (bone rotation values, bat world position)

#### 3.1.2 Dead Code Confirmation

For every file marked `@deprecated` or `@stub`, verify at runtime:

1. Is the file imported anywhere that is reachable from the active execution path?
2. If yes, do any of its exported functions/methods actually execute? (console.trace or call-count instrumentation)
3. If no import path exists, confirm the file can be deleted without breaking builds.

**Expected outcome:** A definitive table showing which files are truly dead vs partially active.

#### 3.1.3 Import Graph

Generate the full import graph for animation-related files:

```
Renderer.ts
  → AnimationBrain.ts
    → BattingController.ts
    → BowlingController.ts
    → FieldingController.ts
    → StagingController.ts
    → fxBus.ts
    → headTracking.ts
    → springs.ts
    → personality.ts
    → LayerResolver.ts
      → BoneAccumulator.ts
      → BoneLayer.ts
    → BowlingProtoController.ts
    → CapabilityTest.ts
    → poses.ts
    → animDebugState.svelte.ts
  → CharacterManager.ts
    → BONE_ALIASES
```

Verify no unexpected imports from `characters/human/` or `engine/characters/` reach this graph.

### 3.2 Rig Audit

For every character GLB (modi, trump, putin, adeft, meloni, ronaldo, kimjong), export:

#### 3.2.1 Bone Hierarchy

```
Character: modi
Rig type: meshy_ai (Spine01 pattern detected)
Bones resolved: 21/21

Hierarchy (depth-first):
  Hips
    Spine
      Spine01 (canonical: chest)
        Spine02 (canonical: upperChest)
          Neck
            Head
          LeftShoulder
            LeftArm
              LeftForeArm
                LeftHand
          RightShoulder
            RightArm
              RightForeArm
                RightHand
    LeftUpLeg
      LeftLeg
        LeftFoot
    RightUpLeg
      RightLeg
        RightFoot
```

#### 3.2.2 Bone Local Axes

For critical bones (rightHand, rightArm, rightForeArm, head, hips), measure and record:

```
Bone: rightHand
  Local position relative to parent: (0.02, -0.31, 0.01)
  Local rotation (Euler XYZ): (0.12, -0.08, 0.05)
  Local X axis in world: (1.00, 0.00, 0.00)  → finger-to-finger
  Local Y axis in world: (0.00, 1.00, 0.00)  → wrist-to-fingertip
  Local Z axis in world: (0.00, 0.00, 1.00)  → palm direction
```

This answers the question: **Is `Euler(-π/2, 0, π/2)` wrong because of rig differences?**

#### 3.2.3 Bone Rest Pose

Capture rest pose (bind pose) rotation for every canonical bone on every character. This reveals:

- Whether `applyBPToLoco`/`applyBPToRole` values differ significantly between characters
- Whether the same `addRot` delta produces visually different results on different rigs
- Whether leg bind poses are consistent enough that walk clips produce similar results

#### 3.2.4 Bone Length Consistency

```
Bone: rightArm
  modi:   0.38m
  trump:  0.42m (+10.5%)
  putin:  0.36m (-5.3%)
  adeft:  0.40m (+5.3%)
  meloni: 0.37m (-2.6%)
  ronaldo:0.43m (+13.2%)
  kimjong:0.34m (-10.5%)
```

Large variance means the same rotation delta produces different bat tip positions on different characters — a root cause of per-character inconsistency.

#### 3.2.5 Scale Consistency

Check whether `GlbMount.scaleGroup.scale` normalizes characters to uniform height. If scale varies per character, `addRot` values produce different world-space bat arcs.

### 3.3 Animation Asset Audit

For every GLB-loaded animation clip, record:

#### 3.3.1 Clip Inventory

```
Character: modi
  Clips: 2 (walk, celebrate)
    walk:       duration 1.033s, 20 tracks, loop=true
    celebrate:  duration 2.500s, 20 tracks, loop=false
  
  Missing clips:
    idle:       ✗
    run:        ✗  
    bat_swing:  ✗
    bowl:       ✗
    backlift:   ✗
```

Confirm the audit's finding that **no batting, bowling, or idle animation clips exist** across all characters.

#### 3.3.2 Track Coverage

For each clip, record which bones are keyframed:

```
Character: modi, clip: walk
  Tracks (20):
    Hips.quaternion         — full rotation
    Hips.position           — root motion
    Spine.quaternion        — torso twist
    Spine01.quaternion      — chest
    Spine02.quaternion      — upper chest
    Neck.quaternion         — head follow
    Head.quaternion         — head
    LeftShoulder.quaternion — arm swing
    LeftArm.quaternion      — arm swing
    LeftForeArm.quaternion  — elbow follow
    LeftHand.quaternion     — hand follow
    RightShoulder.quaternion
    RightArm.quaternion
    RightForeArm.quaternion
    RightHand.quaternion
    LeftUpLeg.quaternion    — leg cycle
    LeftLeg.quaternion      — knee
    LeftFoot.quaternion     — foot
    RightUpLeg.quaternion
    RightLeg.quaternion
    RightFoot.quaternion
```

Are all 21 canonically-mapped bones covered? Are any bones in the GLB skeleton NOT mapped (extra twist bones, IK targets, etc.)?

#### 3.3.3 Root Motion

Does the walk/run clip contain root motion (Hips.position keyframes)? How does `batsmanRootZ` from `BattingController` interact with clip-driven root position?

### 3.4 Bat Attachment Audit

Instrument `_syncBatToHand()` to measure frame-by-frame:

#### 3.4.1 Per-Frame Bat Transform

```
Frame 1234:
  rightHand matrixWorld:
    position: (0.35, 0.92, -0.12)
    quaternion: (0.00, -0.71, 0.00, 0.71)  [180° Y rotation]
  
  After decompose + _BAT_QUAT_OFFSET:
    bat position: (0.35, 0.92, -0.12)      ← same as hand — correct
    bat quaternion: (0.50, -0.50, 0.50, 0.50)  ← Euler(-π/2, 0, π/2) applied
  
  Expected bat position at blade tip:
    blade_local = (0, -0.35, 0)
    blade_world = blade_local × bat_matrix = (0.12, 0.57, -0.31)
    
  Expected ball position at contact frame:
    ball: (0.15, 0.65, -0.25)
    
  Error: blade_world.y (0.57) - ball.y (0.65) = -0.08m
```

#### 3.4.2 Offset Error by Character

```
Character: modi
  Mean offset error: -0.08m (bat below ball)
  Std dev: 0.03m
  Min: -0.14m
  Max: -0.02m

Character: trump
  Mean offset error: -0.15m
  Std dev: 0.04m

Character: putin
  Mean offset error: +0.05m (bat above ball)
```

This directly measures whether the bat grip offset is character-dependent.

#### 3.4.3 Frame Lag

Measure the delta between `rightHand.updateWorldMatrix(true, false)` output and the bat's actual world position after `_syncBatToHand()`:

```
Frame 1234:
  rightHand world pos:  (0.35, 0.92, -0.12)
  bat world pos:        (0.35, 0.92, -0.12)
  lag: 0.000ms (same frame — matrixWorld is already up to date from previous operations)
```

Validate the claim that world-space sync introduces frame lag. If `updateWorldMatrix(true, false)` recomputes from the current bone local rotation (which was set by `LayerSet.applyAll` earlier in the same frame), there should be zero frame lag.

#### 3.4.4 Quaternion Drift

Compare `rightHand.matrixWorld.decompose().quaternion` against the cumulative local bone rotation over 1000 frames. If decompose→recompose introduces drift, it will show as a growing quaternion magnitude error.

#### 3.4.5 Contact Event Timing Audit

Beyond measuring *where* the bat and ball are, measure *when* contact is declared relative to actual intersection.

**Data to capture per delivery:**

```
Delivery #7:
  Ball trajectory: parabolic, bounce at t=0.42s, arriving at crease Z at t=0.58s
  Bat trajectory: swing start t=0.35s, bat at crease Z at t=0.52s

  Frame-by-frame bat-ball gap:
    t=0.48s: batY=0.92  ballY=1.05  gap=0.13m
    t=0.50s: batY=0.86  ballY=0.94  gap=0.08m
    t=0.52s: batY=0.80  ballY=0.85  gap=0.05m
    t=0.54s: batY=0.76  ballY=0.78  gap=0.02m  → closest approach
    t=0.56s: batY=0.74  ballY=0.72  gap=-0.02m (past)

  Contact DECLARED at: t=0.52s (timer-based, from BatsmanFSM phase timing)
  Contact ACTUAL at:    t=0.54s (minimum bat-ball gap)
  Error:                EARLY by 2 frames (33ms)
```

**Result classification:**

| Condition | Label | Impact |
|-----------|-------|--------|
| Contact declared before minimum gap | `EARLY` | Ball hasn't arrived yet — swing completes before ball reaches bat |
| Contact declared at minimum gap ±1 frame | `CORRECT` | Visually aligned |
| Contact declared after minimum gap | `LATE` | Bat has already passed through — ball appears to hit after bat |

**Root cause:**
- If consistently `EARLY`: BatsmanFSM phase durations need adjustment (SWING phase too short, or backlift timing off)
- If consistently `LATE`: SWING phase too long, or swing trigger too late
- If variable: No single timing fix will work — spatial detection (Phase 3) is needed

### 3.8 Animation Correctness Audit

The architecture audit answers "what runs where." The correctness audit answers "does it look right?" These are separate concerns — a system can be architecturally sound but produce wrong-looking animation.

#### 3.8.1 Pose Capture

For every character and every game-visible pose, capture:

**Pose inventory:**

| Pose | Controller Method | Game Phase | Purpose |
|------|------------------|------------|---------|
| Guard stance | `_applyGuardWithStance` | IDLE | Batsman ready position |
| Backlift | `_backlift` | BACKLIFT | Bat raised, weight back |
| Swing contact | `_contact` | CONTACT | Bat-ball impact frame |
| Miss swing | `_contact` (miss personality) | CONTACT | Whiffed swing |
| Follow-through (dot) | `_followThrough` (dot/small) | FOLLOW_THROUGH | After small hit |
| Follow-through (big) | `_followThrough` (big) | FOLLOW_THROUGH | After big hit |
| Follow-through (huge) | `_followThrough` (huge) | FOLLOW_THROUGH | After maximum hit |
| Head shake miss | `_headShake` | FOLLOW_THROUGH (miss) | Disappointment |
| Bowling run-up | `_runUp` | RUN_UP | Bowler approach |
| Bowling gather | `_gather` | GATHER | Arm cocks back |
| Bowling release | `_release` | RELEASE | Ball release frame |
| Bowling follow-through | `_followThrough` | FOLLOW_THROUGH | After release |
| Fielding idle | `_idle` | idle | Ready stance |
| Fielding chase | `_chase` | chase | Running after ball |
| Fielding dive | `_dive` | chase (dist < 0.5) | Diving stop |
| Fielding gather | `_gather` | gather | Bending to pick up |

**Per-pose measurements:**

For each pose above, export:

```
Pose: Swing contact (huge)
Character: modi
  rightArm rotation:  (-0.95 * 1.0, 0, -1.80 * 1.0) rad
    → local:    (-0.95, 0, -1.80)
    → world:    shoulder aim = (0.12, 0.88, -0.45)  (forward, up, right)
  rightForeArm rotation: (0.58 + 1.10 - 1.27, 0, -0.80) rad
    → world tip position: (0.35, 0.75, -0.22)
  spine rotation: (0.22, 0.34, 0) rad
    → torsion: 19° (healthy cricket drive)
  head rotation: (0.15, 0.40, 0) rad
    → looking at: (35°, 23°) (yaw, pitch from forward)
  bat direction: (0.22, -0.05, 0.97) normalized
    → swing arc: 62° from vertical
  
  Screenshot: [attachment]
```

#### 3.8.2 Motion Trajectory Capture

For animated transitions between poses, capture the continuous path:

**Swing arc (BACKLIFT → SWING → CONTACT → FOLLOW_THROUGH):**

Sample bat tip position every rendered frame (16.67ms at 60fps) through the full swing:

```
t=0ms (BACKLIFT start):   batTip = (0.20, 1.45, -0.30)  — bat high behind head
t=17ms (frame 1):         batTip = (0.19, 1.48, -0.32)  — backlift rising
t=33ms (frame 2):         batTip = (0.18, 1.52, -0.35)  — peak backlift
t=50ms (frame 3):         batTip = (0.16, 1.46, -0.31)  — starts forward
t=67ms (frame 4):         batTip = (0.18, 1.38, -0.26)
t=83ms (frame 5):         batTip = (0.20, 1.28, -0.21)
t=100ms (frame 6):        batTip = (0.23, 1.16, -0.17)
t=117ms (frame 7):        batTip = (0.26, 1.03, -0.14)
t=133ms (frame 8):        batTip = (0.30, 0.90, -0.17)  — approaching contact
t=150ms (frame 9):        batTip = (0.35, 0.75, -0.22)  — CONTACT
t=167ms (frame 10):       batTip = (0.40, 0.67, -0.30)  — wrap around
t=183ms (frame 11):       batTip = (0.45, 0.60, -0.38)
t=200ms (frame 12):       batTip = (0.48, 0.55, -0.48)  — continued rotation
t=217ms (frame 13):       batTip = (0.42, 0.58, -0.42)
t=233ms (frame 14):       batTip = (0.35, 0.60, -0.35)
t=250ms (frame 15):       batTip = (0.30, 0.60, -0.30)  — settling
```

**Bowling arm path (GATHER → ARM_SWING → RELEASE → FOLLOW_THROUGH):**

```
t=0ms (GATHER):     handPos = (0.10, 1.20, -0.50)  — arm cocked back
t=60ms (SWING mid): handPos = (0.05, 1.60, -0.30)  — overhead
t=120ms (SWING late): handPos = (-0.05, 1.40, 0.00) — coming forward
t=180ms (RELEASE):  handPos = (-0.10, 1.20, 0.15)  — ball release point
t=240ms (FT):       handPos = (-0.15, 0.90, 0.35)  — follow through
```

**Bat-ball gap during SWING phase:**

```
Frame 1:  batY=1.40  ballY=2.10  gap=0.70m
Frame 2:  batY=1.30  ballY=1.95  gap=0.65m
Frame 3:  batY=1.18  ballY=1.80  gap=0.62m
...
Frame 22: batY=0.78  ballY=0.85  gap=0.07m  (near contact)
Frame 23: batY=0.76  ballY=0.75  gap=-0.01m (contact frame)
Frame 24: batY=0.74  ballY=0.65  gap=-0.09m (past)
```

#### 3.8.3 World-Space Swing Metrics

From the bat tip trajectory, derive kinematic metrics that reveal swing quality:

**Per-swing metrics:**

```
Character: modi
Shot type: huge

Bat tip speed (world-space):
  Peak:         21.4 m/s (frame 8, just before contact)
  At contact:   18.1 m/s
  Follow-through: 9.2 m/s (slowing after impact)
  Average (SWING phase): 14.7 m/s

Swing plane:
  Entry angle:  8° upward (bat approaching from below)
  Exit angle:   22° upward (follow-through rising)
  Plane tilt:   14° from horizontal

Arc geometry:
  Radius:       1.04m (approx shoulder-to-bat-tip distance)
  Arc length:   1.82m (bat tip path during SWING phase)
  Duration:     0.22s (SWING phase)
  Angular velocity: 8.3 rad/s (peak)

Follow-through:
  Extension:    1.35m (bat tip displacement from contact to max extension)
  Wrap angle:   68° (shoulder rotation past contact)
  Deceleration: 42 m/s² (how quickly bat slows after impact)
```

**Comparison against cricket norms:**

| Metric | Controller Output | Pro Cricket | Plausible? |
|--------|-------------------|-------------|------------|
| Bat speed at contact | 18.1 m/s | 18-25 m/s (club cricket) | ✓ (slightly low = arcade feel) |
| Swing duration | 0.22s | 0.15-0.25s | ✓ |
| Angular velocity | 8.3 rad/s | 10-15 rad/s | ✓ (arcade-appropriate) |
| Follow-through wrap | 68° | 45-90° | ✓ |
| Arc radius | 1.04m | 0.9-1.1m (arm + bat length) | ✓ |

**Problem detection:**

| Pattern | Likely Cause |
|---------|-------------|
| Peak speed at start of swing, not at contact | Swing accelerating too early — easing curve wrong |
| Two speed peaks | Double-peaked swing — kinetic chain not sequential |
| Arc radius > 1.3m | Bat not staying in hand — wrist too loose |
| Follow-through wrap < 30° | Swing too short — arm chain not completing |
| Angular velocity drop mid-swing | Blend from BACKLIFT to SWIGHT snapping through rest pose |

Capture these metrics for every character and hit personality. A swing that looks "wrong" but has correct metrics means the problem is visual (rig, bat attachment, contact timing), not kinematic.
```

This answers: **Does the bat actually intersect the ball, or does the timer-project contact miss by metres?**

#### 3.8.4 Visual Reference

For each pose, export:
1. Screenshot from stadium camera angle (the player's view)
2. Screenshot from side-on orthographic (for angle measurement)
3. Screenshot from top-down orthographic (for rotation measurement)
4. Wireframe overlay showing bone positions

#### 3.8.5 Expected vs Actual

Compare measured values against the controller's intent:

```
Controller intent:     rightArm addRot = (-0.95, 0, -1.80)  (from _contact, huge)
Actual bone rotation:  rightArm.rotation = (-0.95, 0, -1.80)  (after LayerSet.applyAll)
Error:                 (0.00, 0.00, 0.00) ✓  (exact)
```

If the controller outputs the intended rotation and the bone receives it, the issue is not in the accumulator pipeline — it is in the authored values or the rig's response to those values.

```
Controller intent:     spine addRot = (0.22, 0.34, 0)
Actual bone rotation:  spine.rotation = (0.22, 0.20, 0)
Error:                 (0.00, -0.14, 0.00) ✗
  → Cause: Layer 0 (LOCOMOTION) setRot(spine) overwritten by Layer 1 (ROLE)?
  → Or: spine bone not ROLE-owned per BONE_OWNERSHIP?
```

This catches layer ownership bugs.

### 3.9 Controller Logic Audit

The previous sections audit *what reaches the bones*. This section audits *what the controllers compute* — are the mathematical values themselves correct, regardless of whether they arrive at the skeleton correctly?

#### 3.9.1 BattingController Value Export

For each phase, export every `addRot` call the controller makes:

```
Phase: BACKLIFT (eased=1.0, pers.power=1.0, pers.backliftHeight=1.0)

  hips:           addRot(-0.03, 0, -0.18)
  spine:          addRot(0, -0.24, 0)
  rightArm:       addRot(-0.32 - 1.68*1.0*1.0, 0, -0.58 - 1.10*1.0*1.0)
                  = addRot(-2.00, 0, -1.68)
  rightForeArm:   addRot(0.58 + 1.10*1.0, 0, -0.22)
                  = addRot(1.68, 0, -0.22)
  rightHand:      addRot(0.06 + 0.55*1.0, 0, -0.14)
                  = addRot(0.61, 0, -0.14)
  leftArm:        addRot(-0.28 - 1.05*1.0*1.0, 0, 0.68 + 0.68*1.0*1.0)
                  = addRot(-1.33, 0, 1.36)
  head:           addRot(0.12, 0, 0)
```

Compute the implied joint angles from these deltas:

```
BACKLIFT (at eased=1.0):
  Right arm abduction:  -2.00 rad X ≈ -115°  — bat behind head, plausible
  Right forearm:        1.68 rad X ≈ 96°     — elbow deeply bent, correct
  Right hand:           0.61 rad X ≈ 35°     — wrist cocked, correct
  Spine counter-rotation: -0.24 rad Y ≈ -14° — torso coiled, correct
  Weight shift:         -0.18 rad Z        — hips open, bat loaded
```

#### 3.9.2 Real Cricket Biomechanics Comparison

Compare controller values against known cricket ranges:

| Joint | Controller Value | Cricket Range | Plausible? |
|-------|-----------------|---------------|------------|
| Backlift — shoulder abduction | -115° (addRot) | -90° to -150° | ✓ |
| Backlift — elbow flexion | 96° | 80° to 120° | ✓ |
| Backlift — wrist cock | 35° | 30° to 50° | ✓ |
| Backlift — spine counter-rotation | -14° | -10° to -25° | ✓ |
| Swing — shoulder horizontal adduction | -105° at contact | -60° to -120° | ✓ |
| Swing — elbow extension | 78° at contact | 70° to 120° | ✓ (slightly flexed is correct for cricket) |
| Swing — wrist snap | -0.68 rad at contact | -0.5 to -0.8 rad | ✓ |
| Swing — spine twist | 22° (hip 0.20 × 1.90 = 0.38 rad) + 18° (spine 0.18 × 1.90 = 0.34 rad) ≈ 40° total | 30° to 60° | ✓ |
| Follow-through — shoulder wrap | -1.80 rad Z | -1.5 to -2.5 rad | ✓ |

**If the values match cricket ranges and arrive at the skeleton correctly, the problem is NOT the BattingController — it is the rig response to those values (axis convention) or the bat attachment.**

#### 3.9.3 BowlingController Value Export

```
Phase: ARM_SWING (e=1.0 easeOutExpo, p=1.0)

  rightShoulder:   addRot(2.7 * 0.15, 0, 0) = addRot(0.41, 0, 0)
  rightArm:        addRot(2.7 * 0.55, 0, 0.05) = addRot(1.49, 0, 0.05)
  rightForeArm:    addRot(2.7 * 0.30, 0, 0) = addRot(0.81, 0, 0)
  leftArm:         addRot(0.25, 0, -0.10)
  hips:            addRot(0, 0.08, 0)
  spine:           addRot(0, -0.10 * 0.30...+0, 0) → addRot(0, 0, 0) at e=1.0
```

Comparison:

| Joint | Controller Value | Cricket Range | Plausible? |
|-------|-----------------|---------------|------------|
| Bowling — shoulder elevation | 0.41 rad (23°) | 20° to 40° | ✓ |
| Bowling — arm circumduction | 1.49 rad (85°) | 80° to 120° | ✓ (conservative for arcade) |
| Bowling — forearm extension | 0.81 rad (46°) | 30° to 60° | ✓ |
| Bowling — spine twist | 0° at release | -10° to +10° | ✓ |

#### 3.9.4 FieldingController Value Export

```
Phase: dive (easeB=1.0, p=1.0)

  hips:            addRot(0.30, 0, 0.40)
  spine:           addRot(0.35, 0, 0.20)
  chest:           addRot(0.25, 0, 0.10)
  rightArm:        addRot(-1.50, 0, -0.30)
  leftArm:         addRot(-1.50, 0, 0.30)
  leftUpLeg:       addRot(-0.40, 0, 0.25)
  rightUpLeg:      addRot(0.60, 0, -0.10)
```

| Joint | Controller Value | Cricket Range | Plausible? |
|-------|-----------------|---------------|------------|
| Dive — hip flexion | 0.30 rad (17°) | 10° to 30° | ✓ |
| Dive — spine flexion | 0.35 rad (20°) | 15° to 40° | ✓ |
| Dive — arm reach | -1.50 rad (-86°) | -70° to -110° | ✓ |
| Dive — leg split | 0.60 rad vs -0.40 rad | Asymmetric | ✓ |

#### 3.9.5 Controller Sanity Checks

Beyond individual values, verify:

1. **Symmetry**: Left and right arm values should be roughly mirrored (same magnitude, opposite Z). If one arm produces 0.68 rad and the other 1.10 rad, either asymmetry is intentional (cricket grip) or a bug.

2. **Accumulation sanity**: Verify that kinetic chain accumulation doesn't exceed joint limits:
   - Spine + chest rotation (Y): max ~35° local = ~70° world — plausible for a drive
   - Shoulder + arm X rotation: max ~120° — plausible for overhead swing
   - Hips Z rotation: max ~12° — plausible for stance

3. **Personality scaling limits**: Verify that extreme personality values don't produce impossible poses:
   - trump (power=1.20, backliftHeight=1.40): rightArm addRot = -2.00*1.20*1.40 = -3.36 rad (-193°) — EXCEEDS shoulder range. This could produce an inverted arm.
   - Check for clamping or warn when personality produces values outside cricket range.

4. **BACKLIFT→SWING blend correctness**: Verify `_blendFrom` captures the right values:
   - If `triggerSwing()` is called at BACKLIFT t=0.3 (30% into backlift), does `_captureBackliftFinal()` still compute values at eased=1.0?
   - Current code captures based on `pers.backliftHeight` and `pers.power` at assumption t=1, not the current eased value. This is a confirmed bug if early trigger happens.

### 3.10 Character Compatibility Audit

The ultimate test: does the same animation system produce consistent results across all 7 characters?

#### 3.10.1 Character Baseline Selection

Before comparing characters, select a single reference character that all others are measured against.

**Baseline candidate: `modi`**

Requirements the baseline must meet:
- ≥21/21 canonical bones resolved
- Standard rig hierarchy (no missing bones, no unusual axis conventions)
- Scale variance < 5% from expected (1.60m target)
- Best visual output across all poses (guard, backlift, swing, follow-through)
- No known clipping, flipping, or deformation issues
- Rig type matches the majority of characters (Meshy AI)

**If modi fails baseline criteria**, select the next best candidate (adeft or meloni) and document why modi was rejected.

**Baseline rules:**

1. All metric comparisons use `character_value - baseline_value` format
2. Positive = larger/above baseline. Negative = smaller/below baseline.
3. Any character exceeding ±2 standard deviations from baseline on any metric is flagged for individual investigation
4. Baseline is re-verified at the start of each audit session (code changes may affect it)

**Baseline-relative reporting:**

```
Character: trump  (vs modi baseline)
  Bat offset:     -0.12m  (baseline: -0.03m)  → +0.09m lower than reference
  Swing arc:      48°     (baseline: 62°)      → -14° shorter arc
  Shoulder wrap:  -1.40   (baseline: -1.80)    → -0.40 less rotation
  Follow-through: FAIR    (baseline: GOOD)
  Status:         WARNING — missing upperChest causes ~23% swing reduction
```

This eliminates the "feels different per character" ambiguity by providing exact deltas from a known-good reference.

#### 3.10.2 Per-Character Summary (Baseline-Relative)

```
Character: modi
  Rig type:          meshy_ai (Spine01 detected)
  Bones resolved:    21/21
  Bone count in GLB: 28 (7 unmapped: twist bones, IK targets)
  Height (bind pose): 1.60m
  Scale applied:      1.00x (target = 1.60m, bind = 1.60m)
  Bat alignment:     GOOD (offset error = -0.03m mean)
  Swing quality:     GOOD (arc matches BattingReference values)
  Follow-through:    GOOD (HUGE_HIT targets reached)
  Issues:            none

Character: trump
  Rig type:          meshy_ai
  Bones resolved:    20/21 (missing: upperChest)
  Height:            1.72m
  Scale applied:     0.93x (1.60/1.72)
  Bat alignment:     POOR (offset error = -0.15m mean)
  Swing quality:     FAIR (arc compressed — missing upperChest affects spine chain)
  Follow-through:    FAIR (arm wrap 15% less than modi)
  Issues:            upperChest bone missing; proportions differ significantly

Character: putin
  Rig type:          mixamo
  Bones resolved:    21/21
  Height:            1.55m
  Scale applied:     1.03x
  Bat alignment:     POOR (offset error = +0.05m — bat above ball)
  Swing quality:     POOR (Mixamo local axes differ from Meshy AI — addRot values wrong)
  Follow-through:    POOR (same axis issue)
  Issues:            Mixamo rig has different bone axis conventions
```

#### 3.10.3 Compatibility Matrix

| Metric | modi | trump | putin | adeft | meloni | ronaldo | kimjong |
|--------|------|-------|-------|-------|--------|---------|---------|
| Rig type | meshy | meshy | mixamo | meshy | meshy | custom | mixamo |
| Bones resolved | 21/21 | 20/21 | 21/21 | 21/21 | 21/21 | 18/21 | 20/21 |
| Height variance | 1.00x | 1.08x | 0.97x | 1.03x | 0.99x | 1.12x | 0.95x |
| Bat offset error | -0.03m | -0.15m | +0.05m | -0.04m | -0.06m | -0.22m | +0.08m |
| Swing arc (deg) | 62° | 48° | 55° | 60° | 58° | 42° | 52° |
| Contact height error | 0.02m | 0.11m | 0.08m | 0.03m | 0.05m | 0.18m | 0.10m |
| Follow-through quality | GOOD | FAIR | POOR | GOOD | FAIR | POOR | FAIR |
| Visible issues | none | upperChest | axis mismatch | none | minor | sparse rig | axis mismatch |

#### 3.10.4 Grouping

Group characters by rig type and within-group variance:

```
Group A: Meshy AI (modi, trump, adeft, meloni)
  Variance: LOW — same bone conventions
  Bat offset: modi/adef t/meloni OK (-0.03 to -0.06m)
  Exception: trump (-0.15m) — upperChest missing shifts spine chain
  
Group B: Mixamo (putin, kimjong)
  Variance: MODERATE — different axis conventions than Meshy AI
  Consistent within group? Check putin vs kimjong
  
Group C: Custom (ronaldo)
  Variance: HIGH — only 18/21 bones, large offset
  Needs individual handling
```

#### 3.10.5 Battery Test

Run a standardized delivery sequence on every character and capture:

1. Guard stance frame
2. Backlift peak frame
3. Contact frame (same timer position)
4. Follow-through mid frame
5. Bowling release frame

Export as side-by-side comparison images. This is the ultimate visual validation that every character produces acceptable cricket motion.

#### 3.10.6 Rig Risk Classification

After completing the rig audit (3.2), classify every character into one of three categories:

**Classification rules:**

| Class | Criteria | Action |
|-------|----------|--------|
| `SAFE` | ≥20/21 bones resolved, axis convention matches reference (Meshy AI), scale variance < 10%, bat offset error < 0.05m | No special handling needed |
| `WARNING` | 19-20/21 bones resolved OR axis convention partially matches OR scale variance 10-20% OR bat offset error 0.05-0.10m | May need per-character bone mapping or offset |
| `CRITICAL` | <19 bones resolved OR axis convention differs OR scale variance > 20% OR bat offset error > 0.10m | Requires individual rig profile or exclusion |

**Provisional classification (to be confirmed by audit data):**

```
SAFE:
  modi     — 21/21 bones, meshy_ai, baseline
  adeft    — 21/21 bones, meshy_ai, offsets within range
  meloni   — 21/21 bones, meshy_ai, offsets within range

WARNING:
  trump    — 20/21 bones (missing upperChest), meshy_ai, offset -0.15m
  kimjong  — 20/21 bones, mixamo, axis conventions differ from reference

CRITICAL:
  putin    — 21/21 bones BUT mixamo axis mismatch invalidates addRot values
  ronaldo  — 18/21 bones, custom hierarchy, offset -0.22m, sparse rig
```

**Implications:**

If any character is classified `CRITICAL`, a unified `RigMapper` (Phase 1) is required — the current system cannot produce correct results for all characters without per-rig transformations.

If all characters are `SAFE` or `WARNING`, a per-character grip offset + bone fallback table is sufficient. No architectural change required.

**Threshold:** If ≥2 characters are `CRITICAL`, Phase 1 (RigMapper) becomes mandatory. If 0-1 characters are `CRITICAL`, the minimal fix path is preferred (handle the outlier individually).

#### 3.10.7 Quantitative Visual Error Scoring

Replace all qualitative labels (GOOD/FAIR/POOR) with a numeric 0-100 score per character.

**Scoring dimensions:**

| Dimension | Weight | Data Source | Scoring Logic |
|-----------|--------|-------------|---------------|
| Bat alignment | 25% | AUDIT_BAT (§3.4.2) | 100 - (abs(offset_error) × 500). Cap at 0. 0.00m = 100, 0.05m = 75, 0.10m = 50, 0.20m+ = 0 |
| Swing arc | 20% | AUDIT_MOTION world-space (§3.8.3) | (measured_arc / expected_arc) × 100. Cap at 100. Expected from BattingReference MAX_SWING_RAD × rig arm length |
| Contact timing | 20% | AUDIT_BAT (§3.4.5) | CORRECT=100, 1-frame EARLY/LATE=70, 2-frame=40, 3+ frame=0. Average across 10 deliveries |
| Follow-through completion | 15% | AUDIT_MOTION (§3.8.5) | (measured_arm_wrap / HUGE_HIT_rightArm_Z) × 100. Cap at 100. Expected: rightArm.Z = -1.80 |
| Joint plausibility | 10% | AUDIT_MOTION controller values (§3.9.5) | Sum of plausible joints / total checked joints × 100. Joint is plausible if within ±20% of pro cricket range |
| Bone count penalty | 10% | AUDIT_RIGS (§3.2.1) | (resolved_bones / 21) × 100. Missing upperChest = 20/21 = 95. Missing upperChest + swapped forearms = 19/21 = 90 |

**Score interpretation:**

| Range | Label | Meaning |
|-------|-------|---------|
| 90-100 | `PRODUCTION` | Ready for release. No animation changes needed. |
| 75-89 | `ACCEPTABLE` | Fine for beta. Minor tuning recommended before launch. |
| 60-74 | `NEEDS_WORK` | Visible issues. Requires investigation and targeted fix. |
| <60 | `BROKEN` | Unusable in current state. Requires architectural fix or exclusion. |

**Example output:**

```
CHARACTER VISUAL ERROR SCORES
─────────────────────────────
  modi     89/100  ACCEPTABLE  (bat alignment 92, swing arc 88, contact 95, follow-through 90, plausibility 85, bones 100)
  adeft    86/100  ACCEPTABLE  (bat alignment 85, swing arc 90, contact 80, follow-through 88, plausibility 83, bones 100)
  meloni   84/100  ACCEPTABLE  (bat alignment 82, swing arc 85, contact 85, follow-through 80, plausibility 88, bones 100)
  trump    71/100  NEEDS_WORK  (bat alignment 42, swing arc 78, contact 70, follow-through 65, plausibility 81, bones 95)
  kimjong  68/100  NEEDS_WORK  (bat alignment 55, swing arc 72, contact 65, follow-through 70, plausibility 80, bones 95)
  putin    56/100  BROKEN      (bat alignment 30, swing arc 50, contact 55, follow-through 45, plausibility 60, bones 100)
  ronaldo  42/100  BROKEN      (bat alignment 10, swing arc 40, contact 40, follow-through 35, plausibility 55, bones 80)

SUMMARY:
  PRODUCTION:  0/7 characters
  ACCEPTABLE:  3/7 characters
  NEEDS_WORK:  2/7 characters
  BROKEN:      2/7 characters

OVERALL SCORE: 70.9/100 (below ACCEPTABLE threshold)
→ Architectural investigation required
```

**Decision rule:** If the median character score is below 75 (ACCEPTABLE threshold), the system does not meet the minimum quality bar and requires architectural changes (Full Rebuild Path). If the median score is ≥75 with only individual outliers below 60, the Minimal Fix Path (per-character grip offsets + bone fallback) is sufficient.

**Score updates:** Recalculate scores after every significant code change. The score serves as the primary regression metric.

#### 3.10.8 Golden Capture Dataset (REFERENCE_CAPTURE_SET)

After the audit establishes `modi` as the baseline character, freeze a reference capture set into the repository for permanent regression use.

**Capture scope (6 poses × 3 angles = 18 images + data files):**

| Pose | Screenshots | Bone Transforms | Bat Transform | Metrics |
|------|-------------|-----------------|---------------|---------|
| Guard | front/side/top | 21 canonical bones | position + quaternion | offset error, spine angle, knee bend |
| Backlift | front/side/top | 21 canonical bones | position + quaternion | bat lift height, weight transfer, elbow angle |
| Swing contact | front/side/top | 21 canonical bones | position + quaternion | bat speed, arc radius, wrist uncock |
| Follow-through (big) | front/side/top | 21 canonical bones | position + quaternion | arm wrap angle, shoulder rotation, follow-through extension |
| Bowling release | front/side/top | 21 canonical bones | N/A | arm speed, release height, front foot position |
| Fielding dive | front/side/top | 21 canonical bones | N/A | dive distance, reach extension |

**Storage location:**

```
packages/fairness/src/reference/
  REFERENCE_CAPTURE_SET/
    README.md              — metadata: character, rig type, date, tool version, camera params
    guard/
      screenshot_front.png
      screenshot_side.png
      screenshot_top.png
      bone_transforms.json
      bat_transform.json
      metrics.json
    backlift/
      ...
```

**Bone transforms format (bone_transforms.json):**

```json
{
  "meta": {
    "character": "modi",
    "rig_type": "meshy_ai",
    "date": "2026-05-26",
    "tool_version": "apex-audit-v1",
    "snapshot_frame": 47
  },
  "bones": {
    "hips": {
      "position": [0.0, 0.85, 0.0],
      "quaternion": [0.0, 0.0, 0.0, 1.0],
      "euler": [0.0, 0.0, 0.0]
    },
    "spine": {
      "position": [0.0, 1.05, -0.02],
      "quaternion": [0.01, 0.0, 0.0, 0.99],
      "euler": [0.02, 0.0, 0.0]
    }
  }
}
```

**Metrics format (metrics.json):**

```json
{
  "pose": "swing_contact",
  "bat_tip_speed": 18.1,
  "swing_arc_rad": 1.04,
  "angular_velocity_rad_s": 8.3,
  "follow_through_extension_m": 1.35,
  "arm_wrap_deg": 68,
  "contact_gap_m": 0.02,
  "addRot_rightArm": [-0.95, 0.0, -1.80],
  "addRot_spine": [0.22, 0.34, 0.0],
  "addRot_rightForeArm": [-0.35, 0.15, -0.82],
  "addRot_rightHand": [-0.05, 0.10, -0.08]
}
```

**Regression usage:**

After any code change, run the capture script on the same character + same pose. Compare:

```bash
# Automated comparison script (pseudo)
compare_pose("REFERENCE_CAPTURE_SET/guard", "CURRENT_CAPTURE/guard")
  - bone_transforms:  per-bone quaternion dot-product (threshold: >0.99 = PASS)
  - bat_transform:    position RMSE (threshold: <0.01m = PASS)
  - metrics:          per-metric delta (threshold: <5% = PASS)
  - screenshots:      pixel-diff histogram (threshold: <2% different = PASS)

Result: 6/6 tests PASSED → no regression
Result: 2/6 tests FAILED → regression detected, cite specific bones/quaternions
```

**Update procedure:**

| Trigger | Action |
|---------|--------|
| First audit completion | Save initial REFERENCE_CAPTURE_SET |
| Baseline character changes | Update reference captures to match new baseline |
| Intentional system change | Re-capture after change is verified correct |
| Regression detected by CI | Compare against reference to quantify drift |

**Versioning:** The REFERENCE_CAPTURE_SET directory is checked into version control alongside the fairness package. A mismatch between current and reference is a blocking CI failure.

**Supplement: Automated Audit Scripts**

Each audit domain should have a companion script that generates its markdown report from runtime instrumentation:

| Report | Script | Method |
|--------|--------|--------|
| AUDIT_REPOSITORY.md | `scripts/audit/repository.js` | Static analysis (import graph, file scan) |
| AUDIT_RIGS.md | `scripts/audit/rigs.js` | Load each GLB, enumerate bone tree, export hierarchy |
| AUDIT_BAT.md | `scripts/audit/bat.js` | Instrument _syncBatToHand, log per-frame offset |
| AUDIT_MOTION.md | `scripts/audit/motion.js` | Pose capture + controller addRot export + side-by-side |
| AUDIT_STATE_MACHINES.md | Static | Already code-review based |
| AUDIT_PERFORMANCE.md | `scripts/audit/perf.js` | performance.now() wrappers around each subsystem |
| ANIMATION_ROOT_CAUSE_REPORT.md | `scripts/audit/compile.js` | Aggregate all above reports, compute confidence, output prioritized list |

Scripts are optional but strongly recommended for repeatability. If omitted, re-auditing requires manual re-instrumentation.

For each state machine in the codebase:

#### 3.11.1 State Inventory

| Machine | File | States | Transitions | Active? | Owner |
|---------|------|--------|-------------|---------|-------|
| GameState | `engine/state/StateMachine.ts` | IDLE, BOWL, BALL_RELEASE, BALL_TRAVEL, HIT, BALL_RESULT, RESET | 7 explicit | Yes | GameEngine |
| BowlerFSM | `engine/physics/animationFSM.ts` | IDLE, RUN_UP, GATHER, ARM_SWING, RELEASE, FOLLOW_THROUGH | 5 auto-advance | Yes | GameEngine |
| BatsmanFSM | `engine/physics/animationFSM.ts` | IDLE, BACKLIFT, SWING, CONTACT, FOLLOW_THROUGH | 3 auto + 1 manual (BACKLIFT→SWING) | Yes | GameEngine |
| AnimPhase | `engine/systems/AnimationSystem.ts` | idle, run, swing, celebrate, stumped | 5 engine-driven | Yes | AnimationSystem (engine state) |
| AnimState | `game/AnimationManager.ts` | 14 states | ? | ? | AnimationManager (legacy) |
| CharacterState | `characters/human/controllers/CharacterController.ts` | Idle, Ready, React, Execute, Recover | 5 | Partially | CharacterController |

#### 3.11.2 Mapping: Which Machine Drives What?

For each character role at each game phase, determine which state machine controls the animation output:

```
Game Phase: BALL_TRAVEL
  Bowler animation driven by: BowlerFSM (FOLLOW_THROUGH phase)
  Batsman animation driven by: BatsmanFSM (BACKLIFT or SWING)
  Fielder animation driven by: FielderState (idle/chase)
  AnimState contribution: NONE (confirmed dead)
```

Prove that `AnimState` (14-state enum in `AnimationManager.ts`) does not influence any active animation path. If it does, determine which states are reachable and through what call chain.

#### 3.11.3 Duplicate States

Find states with the same name in different machines and verify they represent the same concept:

```
"FOLLOW_THROUGH":
  - BowlerFSM: after release, arm decelerates
  - BatsmanFSM: after contact, bat completes arc
These are DIFFERENT concepts sharing a name.
```

```
"IDLE":
  - GameState: waiting for next delivery
  - BowlerFSM: waiting for start()
  - BatsmanFSM: waiting for startBacklift()
These are the SAME concept but tracked in 3 places.
```

#### 3.11.4 Runtime State Desynchronization Audit

The most common cause of animation glitches that aren't rig or controller bugs: state machines that disagree about what phase the game is in.

**Per-frame state snapshot:**

```
Frame 123:

  GameEngine.GameState:     BALL_TRAVEL
  BowlerFSM.phase:          FOLLOW_THROUGH
  BatsmanFSM.phase:         SWING
  BattingController phase:  SWING (matched)
  FXBus.lastEvent:          ballRelease (id=4)

  → SYNCHRONIZED ✓
```

```
Frame 456:

  GameEngine.GameState:     HIT
  BowlerFSM.phase:          IDLE
  BatsmanFSM.phase:         CONTACT
  BattingController phase:  CONTACT (matched)
  FXBus.lastEvent:          ballContact (id=7)

  → SYNCHRONIZED ✓
```

```
Frame 789:

  GameEngine.GameState:     BALL_RESULT
  BowlerFSM.phase:          IDLE
  BatsmanFSM.phase:         FOLLOW_THROUGH
  BattingController phase:  IDLE ← DESYNC
  FXBus.lastEvent:          ballContact (id=9)

  → DESYNC DETECTED:
      BatsmanFSM says FOLLOW_THROUGH
      BattingController says IDLE
      Effect: batsman snaps to guard pose during follow-through
      Cause: reset() call in AnimationBrain.setBatsman() clears controller state
             while BatsmanFSM still has an active phase
```

**Valid transition table:**

For each state machine, define valid (phase, phase) pairs that should never be desynchronized:

| GameState | → Valid BatsmanFSM | → Valid BowlerFSM |
|-----------|-------------------|-------------------|
| IDLE | IDLE | IDLE |
| BOWL | BACKLIFT | RUN_UP → GATHER → ARM_SWING |
| BALL_RELEASE | BACKLIFT | RELEASE |
| BALL_TRAVEL | BACKLIFT → SWING | FOLLOW_THROUGH |
| HIT | CONTACT | FOLLOW_THROUGH |
| BALL_RESULT | FOLLOW_THROUGH | IDLE |
| RESET | IDLE | IDLE |

**Instrumentation:**

Every frame, log a single-line desync check:

```
[DESYNC] t=12.345 G=BALL_TRAVEL Bw=FOLLOW_THROUGH Bt=SWING Ctl=SWING ✓
[DESYNC] t=14.567 G=BALL_RESULT Bw=IDLE Bt=FOLLOW_THROUGH Ctl=IDLE ✗ BAT_FT_MISSING
```

If desync is detected on >5% of frames during active gameplay, the state machine architecture is the primary root cause — fix the state ownership, not the animation values.

**Common desync patterns:**

| Pattern | Symptom | Likely Cause |
|---------|---------|-------------|
| Controller phase lags FSM by 1+ phases | Animation plays old phase while game advances | Controller not reading snapshot every frame, or FSM update order wrong |
| Controller phase resets to IDLE mid-delivery | Snap to guard pose during swing | `reset()` called externally (e.g., character swap during active delivery) |
| FXBus misses contact event | No recoil/vibration/flash | Sync event counter advances between FSM phase entry and controller consume() call |
| Bowler and Batsman FSMs disagree | Both characters animate wrong phase | GameEngine tick order: bowler advanced, batsman didn't, or vice versa |

### 3.12 Runtime Flow Audit

Instrument every function in the AnimationBrain→Controller→Accumulator→LayerResolver→Skeleton chain to capture:

#### 3.12.1 Execution Sequence

```
Frame 1 (t=0.016):
  1. AnimationBrain.update() start
  2. _updateBatsman() start
  3. mixer.update(0.016) — walk clip advances by 0.016s
  4. beginFrame() — all 6 layer accumulators cleared
  5. applyBPToLoco — 7 bones setRot to bind pose
  6. applyBPToRole — 11 bones setRot to bind pose
  7. BattingController.update()
     a. fsm.phase = 'SWING', fsm.progress = 0.73
     b. _swing(0.73, acc, pers)
     c. acc.addRot('rightArm', -1.20, 0, -1.40)
     d. acc.addRot('spine', 0.22, 0.10, 0)
     e. ... 18 more addRot calls
  8. fx.contributeBoneDeltas → acc.addRot('spine', 0, 0, 0)  [no active effect]
  9. applyBPToHead → acc.setRot('head', bp values)
  10. updateHeadTracking → acc.addRot('head', 0.05, 0.12, 0)
  11. LayerSet.applyAll()
      a. Layer 0 (LOCOMOTION): 7 bones setRot(bind pose) — LOCOMOTION owns these
      b. Layer 1 (ROLE): 11 bones setRot(bind pose) — but 4 have addRot from controller
         - spine:  setRot(0.12, 0, 0) + addRot(0.22, 0.10, 0) = (0.34, 0.10, 0)
         - rightArm: setRot(-0.58, 0, -1.10) + addRot(-1.20, 0, -1.40) = (-1.78, 0, -2.50)
         - ... etc
      c. Layer 2 (REACTION): no setRot bones, addRot only
      d. Layer 3 (HEAD): head setRot(bp) + addRot(0.05, 0.12, 0)
      e. Layer 4 (SPRING): no setRot bones, addRot only (springs applied later)
      f. Layer 5 (IK): no setRot bones, addRot only
  12. springs.begin() + applySprings() + springs.apply()
      a. rightForeArm: addRot(0.01, -0.02, 0)
      b. rightHand: addRot(0.03, -0.01, 0)
  13. _updateBatsman() end
  14. _updateBowler() start
  ...
  15. AnimationBrain.update() end
  16. _syncBatToHand()
  17. composer.render()
```

#### 3.12.2 Per-Function Timing

```
BattingController.update():  0.08ms
  _swing():                  0.04ms
  _applyGuardWithStance():   0.02ms

LayerSet.applyAll():         0.12ms
  6 layers × ~20 bones each

_syncBatToHand():            0.01ms

mixer.update():              0.03ms

Total animation cost:        0.45ms  (out of ~10ms budget at 60fps)
```

### 3.13 Layer Conflict Audit

The accumulator architecture (6 layers summing into BoneDNA.rotations before final resolve) should be mathematically clean. In practice, 4 common conflict patterns can produce incorrect output even when each individual layer is correct.

#### Conflict Pattern A: Set vs Add Race

If one layer does `setRot(boneName, euler)` and another does `addRot(boneName, euler)`, the layer with the lower priority "wins" because `setRot` clobbers all previous accumulation but `addRot` only contributes to a running sum.

**Detection script:**

```
For each frame, for each bone, for each layer:
  If layer[i].state[b] == 'set' AND layer[j].state[b] == 'add':
    Log CONFLICT: upperChest set by LOCOMOTION, add by ROLE
    → ROLE (priority 2) overrides LOCOMOTION (priority 0)
    → LOCOMOTION's set is clobbered entirely
    → Is this intentional? Most of the time, no.

If CONFLICT found:
  Check whether priority ordering is intended:
    - LOCOMOTION setRot(spine) → ROLE addRot(spine): OK if role wants relative adjustment
    - LOCOMOTION addRot(spine) → ROLE setRot(spine): WRONG if role expected additive
```

#### Conflict Pattern B: Ownership Violation

The `BONE_OWNERSHIP` map in `BoneLayer.ts` declares which layer owns each bone. If layer A writes a bone that layer B owns, that's a violation.

**Detection:**

```
BONE_OWNERSHIP:
  upperChest → ROLE (layer 2)
  spine      → ROLE (layer 2)

Script: for each write to upperChest or spine:
  If writer != ROLE:
    Log VIOLATION: LOC writes upperChest but owner is ROLE
```

**Severity:** If violations are consistently low-priority layers (LOCOMOTION layer 0 or MECHANICS layer 1) writing to ROLE-owned bones, the fix is trivial (remove the double-write). If every layer writes every bone, the ownership map is aspirational and the accumulator needs a rewrite.

#### Conflict Pattern C: Silent Overwrite

Two layers both `setRot` the same bone but only the higher priority takes effect. The lower priority's output is silently discarded.

```
Layer 0 (LOCOMOTION):   setRot(hips, idle_pose)     ← executes, then...
Layer 2 (ROLE):          setRot(hips, batting_guard) ← overwrites
Net result: hips = batting_guard
             LOCOMOTION's idle_pose CONTRIBUTION IS ZERO
```

This is OK if intentional (layers are meant to fully replace), but problematic if LOCOMOTION was supposed to contribute.

**Detection:**

```
For each bone where setRot appears at >1 layer priority:
  Log SILENT_OVERWRITE: hips set by LOC(lv0) and ROLE(lv2)
  → LOC contribution = ZERO
  → Recovery: change LOC setRot to addRot if partial contribution intended
```

#### Conflict Pattern D: Accumulator Carryover (frame leak)

BoneDNA.rotations should be cleared per-frame. If `beginFrame()` doesn't reset a bone's accumulator, last frame's rotation carries over.

**Detection:**

```
Frame N:   rightWrist = LOC(0,0.5,0) + ROLE(0.2,0,0) = (0.2, 0.5, 0)
Frame N+1: rightWrist = (should be empty) + ROLE(0.2,0,0) = (0.2, 0, 0)
                                                                  ^
                                                                  0.5 Y should be gone

If frame N+1 rightWrist.y ≈ 0.5 despite no LOC contribution:
  Log ACCUMULATOR_LEAK: rightWrist.y carried 0.5 from frame N
  → beginFrame() doesn't zero accumulator → BUG
```

**Conflict report format:**

```
--- Layer Conflict Report ---
Pattern A (Set vs Add):
  upperChest: LOCOMOTION set, ROLE add  → OK (intentional relative)
  hips: LOCOMOTION add, ROLE set        → WRONG (LOC contribution lost)

Pattern B (Ownership):
  leftToe: 3 writes from non-owner layers  → WARNING (toe not in ownership map)
  spine: 0 violations                      → CLEAN

Pattern C (Silent Overwrite):
  hips: LOCOMOTION→ROLE                   → 100% LOC loss (change to addRot?)
  leftWrist: LOC→(none→)→ROLE             → 100% LOC loss

Pattern D (Leak):
  rightWrist: 3 frames with carryover      → CONFIRMED BUG

Overall: CONFLICTED / CLEAN / MIXED
```

**Threshold:** If any Pattern D (leak) is confirmed OR Pattern C shows >50% bone loss on any single bone, the accumulator architecture needs rewrite (Phase 6 scope). If only Pattern A/B found with <5 bones affected, fix is targeted (change set→add or remove double-write).

#### Bone Ownership Heatmap

Beyond conflict detection, generate a per-bone ownership heatmap showing total writes by layer:

```
SPINE
  LOCOMOTION:   23 writes
  ROLE:        412 writes
  REACTION:     18 writes
  HEAD:          0 writes
  SPRING:       51 writes
  IK:            0 writes
  ─────────────────────
  Total:       504 writes
  Owner:       ROLE
  Non-owner:   92 writes (18.3%)  → WARNING
```

**Heatmap target bones** (the kinetic chain where batting issues originate):

```
  hips
  spine
  chest
  upperChest
  leftShoulder/rightShoulder (or collarbone equivalents)
  leftArm/rightArm
  leftForeArm/rightForeArm
  leftHand/rightHand
```

**Per-bone classification:**

| Non-owner share | Label | Meaning |
|----------------|-------|---------|
| 0% | `CLEAN` | Only the declared owner writes this bone |
| 1-10% | `LOW` | Occasional extra writes — check if intentional |
| 11-25% | `WARNING` | Significant non-owner contribution — likely unexpected |
| >25% | `CRITICAL` | Ownership map is aspirational — accumulator needs rewrite |

**Example aggregated report:**

```
BONE OWNERSHIP HEATMAP
──────────────────────
  hips          CLEAN        (0% non-owner)
  spine         WARNING      (18.3% non-owner from SPRING)
  chest         CRITICAL    (31.2% non-owner from LOCOMOTION + REACTION)
  upperChest    CLEAN        (0% non-owner — but missing on trump rig!)
  rightArm      WARNING      (14.7% non-owner from LOCOMOTION)
  rightForeArm  CLEAN        (0% non-owner)
  rightHand     WARNING      (22.1% non-owner from SPRING + REACTION)

OVERALL: 2 CLEAN, 3 WARNING, 1 CRITICAL → MODERATE RISK
```

**Usage:** If ≥3 bones are `CRITICAL`, layer ownership is non-functional and Phase 6 (accumulator rewrite) is mandatory regardless of other evidence. The accumulator is not being used as designed.

### 3.14 Performance Audit

Measure per-frame cost of each animation subsystem:

| Subsystem | Time (ms) | % of frame budget | Notes |
|-----------|-----------|-------------------|-------|
| `mixer.update` (×13) | 0.39 | 3.9% | 13 mixers: 1 bowler + 1 batsman + 11 fielders |
| `LayerSet.applyAll` (×13) | 1.56 | 15.6% | Each: 6 layers × ~20 entries per layer → 260 iterations × 13 = 3380 iterations |
| `BoneAccumulator.apply` per layer | 0.10 | 1.0% | Map iteration + bone.rotation.set |
| `BattingController.update` | 0.08 | 0.8% | addRot calls + logic |
| `BowlingController.update` | 0.03 | 0.3% | Simpler than batting |
| `FieldingController.update` (×11) | 0.22 | 2.2% | 11 fielders × 0.02ms each |
| `headTracking` (×13) | 0.26 | 2.6% | 13 characters × getWorldPosition + quaternion math |
| `springs` (×13) | 0.13 | 1.3% | 5 bones × 3 axes = 15 spring states per character |
| `_syncBatToHand` | 0.01 | 0.1% | Matrix decompose + copy + quaternion multiply |
| **Total animation** | **2.78** | **27.8%** | Leaves ~7ms for rendering |

Verify each measurement with `performance.now()` or `console.time` wrappers. Identify which operations scale with character count and which are constant.

### 3.15 Audit Deliverables

After completing Phase A, produce:

| Report | Contents |
|--------|----------|
| `AUDIT_REPOSITORY.md` | File status table (active/deprecated/stub), import graph, execution trace |
| `AUDIT_RIGS.md` | Per-character bone hierarchy, local axes, rest pose, bone length comparison |
| `AUDIT_CLIPS.md` | Per-character clip inventory, track coverage, root motion analysis |
| `AUDIT_BAT.md` | Bat offset per character, frame lag measurement, quaternion drift, contact event timing per-delivery (early/correct/late), world-space swing metrics (speed, plane, arc radius, angular velocity) |
| `AUDIT_STATE_MACHINES.md` | Complete state inventory, ownership map, duplicate state analysis, desync log |
| `AUDIT_FLOW.md` | Full execution trace with per-call parameters and outputs |
| `AUDIT_PERFORMANCE.md` | Per-function timing, budget analysis, scaling costs |
| `AUDIT_MOTION.md` | Combined Animation Correctness + Controller Logic audit report: Intent→Values→Bones→World→Visual chain. For each of the 16 captured poses, traces from `BattingController.addRot` intent values → Layer accumulator → bone quaternion → world-space swing metrics → screenshot. Directly answers: "does the controller value produce the intended bone rotation, and does that rotation produce the intended visual outcome?" Also includes the per-controller addRot value export (12 joint ranges per batting/bowling/fielding), cricket biomechanics comparison table, controller sanity checks, and visual error scores from Character Compatibility Audit. |
| `ANIMATION_ROOT_CAUSE_REPORT.md` | Final aggregation report. For each confirmed defect: Issue, Evidence (cites specific audit report + item number), Impact, Root Cause, Fix Options, Recommendation, Priority (P0-P3). Consolidates all audit findings into a prioritized implementation plan. |

---

## 4. Root Cause Determination

After Phase A delivers evidence, produce a Root Cause Report that answers:

### 4.1 Bat Orientation Issue

- Is the hardcoded `Euler(-π/2, 0, π/2)` wrong for some or all characters?
- Does each character need its own grip offset?
- Or does the `rightHand` bone have different local axes per rig, requiring axis remapping?
- **Evidence threshold:** If per-character bat offset error variance < 0.02m, grip offset is not the primary issue. If variance > 0.05m, per-rig offset is required.

### 4.2 Swing Issue

- Is the swing visually incorrect due to bone axis assumptions (RigMapper needed)?
- Or due to the procedural `addRot` values being wrong for the specific rig proportions?
- Or due to the BACKLIFT→SWING blend not capturing the right state?
- **Evidence threshold:** Compare swing arc in local bone space vs world space. If world-space arc is correct but local deltas differ per character, RigMapper is needed. If world arc is consistently wrong, fix the hardcoded rotation values.

### 4.3 Follow-Through Issue

- Are follow-through poses defined correctly in `BattingController`?
- Does the personality system scale them correctly?
- Are the HUGE_HIT targets reached during full swings?
- **Evidence threshold:** Measure maximum arm rotation at contact frame. If it matches `HUGE_HIT_RIGHT_ARM_Z = -1.80` across all characters, the poses are applied correctly and the issue is elsewhere.

### 4.4 Contact Mismatch

- Is the timer-based contact timing wrong (ball and bat not spatially aligned)?
- Or does the bat grip offset compound the error (bat not where animation thinks it is)?
- Or does `contactBallY` capture at the wrong frame?
- **Evidence threshold:** Log `ballY - batY` at each frame during SWING phase. If error is < 0.03m at the timer-projected contact frame, spatial detection won't help. If error > 0.10m, spatial detection is needed.

### 4.5 Performance Issues

- Does the animation pipeline actually consume 27.8% of frame budget? Or is the estimate wrong?
- Are there N-squared patterns (looping over all fielders for every operation)?
- Does `LayerSet.applyAll` iterate 260 entries per character × 13 characters = 3380 iterations per frame unnecessarily?

### 4.6 Root Cause Report Format

Output goes to `ANIMATION_ROOT_CAUSE_REPORT.md` — the final aggregation report consolidating all audit findings into a prioritized implementation plan.

Each root cause entry includes a **Confidence Score** (0-100%) that quantifies how strongly the evidence supports the claim. This prevents weak hypotheses from being treated as facts during the decision gate.

**Confidence scoring rules:**

| Condition | Contribution |
|-----------|-------------|
| 2+ independent evidence sources cite the same cause | +30% |
| Evidence includes direct measurement (not inference) | +25% |
| Reproducible across multiple frames/deliveries | +20% |
| No conflicting evidence | +15% |
| Can be demonstrated by disabling one system | +10% |
| ────────────────────────────────────── | ─── |
| Base confidence for any single observation | 20% |
| **Maximum** | **100%** |

**Confidence interpretation:**

| Range | Label | Action |
|-------|-------|--------|
| 90-100% | CONFIRMED | Proceed with fix — no further investigation needed |
| 75-89% | LIKELY | Proceed with fix but monitor for side effects |
| 50-74% | PLAUSIBLE | Investigate further before committing to fix |
| <50% | SPECULATIVE | Do not act — gather more evidence first |

**How to compute:**
- Count independent evidence sources (different audit reports citing the same cause): +30% if ≥2
- Check if at least one source is a direct measurement (e.g., bat offset logged to console) vs inference (e.g., "the swing looks wrong"): +25%
- Check if the issue reproduces across 3+ deliveries or time-adjacent frames: +20%
- Check for contradictory evidence (e.g., another rig shows correct behavior for the same controller values): if none, +15%; if conflicting evidence exists, -20%
- Check if you can toggle the suspected cause on/off (e.g., disable the bat grip offset) and observe the issue appear/disappear: +10%

```markdown
## Root Cause #N: [Title]

**Evidence:** (reference to specific audit report + item number)
  - AUDIT_RIGS §3.2.2: rightHand local Z varies 30° between modi and trump
  - AUDIT_BAT §3.4.2: bat offset error: modi = -0.08m, trump = -0.15m

**Confidence:** 89% (2 independent sources + direct measurement + reproducible across 10 deliveries + no conflicting evidence)

**Impact:** 
  - Bat appears rotated in trump's hand by ~30° compared to modi
  - Contact height error varies by character
  - Visual error score drop: modi 89→71, trump 71→56

**Fix options:**
  1. Per-character bat grip offset (1-2 hours) — sufficient if only grip varies
  2. Full RigMapper (2-3 days) — needed if bone axes also vary

**Recommendation:** (based on evidence severity and confidence)

**Priority:** P0 (blocking release) / P1 (high impact) / P2 (nice to have) / P3 (deferred)
```

---

## 5. Salvage Assessment

After root causes are proven, determine what to keep and what to replace. Each decision must cite audit evidence.

### 5.1 Decision Matrix

| Component | Keep | Replace | Evidence Required |
|-----------|------|---------|-------------------|
| Layer system (BoneAccumulator + LayerResolver + BoneLayer) | ✓ | | Layer resolution cost < 2ms total |
| BattingController procedural logic | ✓ | | Swing arc is correct in local space |
| Bat orientation math | | ✓ | Per-character error > 0.05m (evidence: AUDIT_BAT) |
| Timer-based contact | | ✓ | ballY-batY error > 0.10m at projected contact (evidence: AUDIT_FLOW) |
| ClipPlayer + mixer pipeline | ✓ | | Mixer cost < 0.5ms total |
| AnimationBrain giant update methods | | Partial | Extract into focused classes if complexity proves maintenance burden |
| Spring system | ✓ | | Springs cost < 0.2ms |
| Head tracking | ✓ | | Head tracking cost < 0.3ms |
| EnvironmentSensor | | ? | Only if ball velocity awareness is needed for gameplay feel |
| State machines | | Consolidate | Only if duplicate state management causes bugs (evidence: AUDIT_STATE_MACHINES) |
| characters/human/ pipeline | | Delete | Proven dead (evidence: AUDIT_REPOSITORY) |
| engine/characters/ pipeline | | Delete | Proven dead (evidence: AUDIT_REPOSITORY) |
| AnimationManager (legacy) | | Delete | Proven dead (evidence: AUDIT_REPOSITORY) |

### 5.2 Minimal Fix Path

The smallest possible intervention based on audit findings. Example:

```markdown
## Minimal Fix

If audit finds:
- Bat orientation error is per-character
- Contact timing error is small (< 0.03m)
- No performance bottlenecks
- State machines are correctly wired

Then the minimal fix is:
1. Per-character bat grip offset (5 lines in CharacterManager)
2. Fix BACKLIFT→SWING blend to capture at transition, not at t=1
3. Remove dead code headers (documentation only)

Estimated effort: 1-2 days
No architectural changes needed.
```

### 5.3 Full Rebuild Path

```markdown
## Full Rebuild

If audit finds:
- Bone axes differ per rig (axis remapping required)
- Bat offset error is large and inconsistent
- Contact timing is unreliable
- State machines conflict
- Performance is poor

Then follow the post-audit phases in Section 6.

Estimated effort: 15-23 days
Architectural changes required.
```

---

## 6. Post-Audit Phases (Preliminary)

**These phases are conditional.** Their priority, scope, and even inclusion depend on audit findings. This section is a framework, not a commitment.

### 6.1 Phase 1 — Rig Mapping Layer (conditional)

**Condition:** Rig audit shows bone axis variance > 15° between characters, OR bat offset error variance > 0.05m.

**If condition is false:** Implement per-character bat grip offset only (5 lines, no architecture change). Skip Phase 1.

#### 6.1.1 Scope

Only if rig axis variance is proven:

- Create `RigMapper` class with axis remapping per canonical bone
- Define 3 profiles: Meshy AI, Mixamo, Custom
- Detect rig type automatically in `CharacterManager`
- Modify all controllers to pass through RigMapper
- Grip offset moves from `_BAT_QUAT_OFFSET` to per-character value

### 6.2 Phase 2 — Bat Attachment Rewrite (conditional)

**Condition:** Bat offset error > 0.05m, OR frame lag > 1 frame (16ms) in `_syncBatToHand()`, OR quaternion drift > 0.01° per 1000 frames.

**If condition is false:** Keep `_syncBatToHand()` but use per-character grip offset from Phase 1. Close to zero effort.

#### 6.2.1 Scope

Only if lag or drift is proven:

- Parent bat to `rightHand` bone
- Remove `_syncBatToHand()` entirely
- Apply grip offset as local transform on bat group
- Bat vibration becomes local-space quaternion

### 6.3 Phase 3 — Contact Detection Rewrite (conditional)

**Condition:** `ballY - batY` error > 0.10m at timer-projected contact frame.

**If condition is false:** Keep timer-based contact. The timing is already correct.

#### 6.3.1 Scope

Only if spatial error is proven:

- Create `BatVolume` (bat geometric model)
- Create `BallBatContact` (sphere-cylinder intersection)
- Create `ContactSystem` (FSM-aware spatial detection)
- Add fallback timer for missed detections

### 6.4 Phase 4 — State Machine Consolidation (conditional)

**Condition:** Audit proves state conflicts or duplicated state leading to bugs.

**If condition is false:** Mark `AnimState` as deprecated. Keep other machines as-is.

#### 6.4.1 Scope

- Remove `AnimState` enum (14 states) if proven unused
- Add transition validation to `GameState`
- Document ownership

### 6.5 Phase 5 — Environment Sensor (conditional)

**Condition:** Audit proves animations feel disconnected from gameplay AND ball velocity/prediction data is available but unused.

**If condition is false:** Skip. Not needed for current game feel requirements.

#### 6.5.1 Scope

- Create `EnvironmentSensor` providing ball velocity, trajectory prediction
- Pass context to controllers
- Phase 7 uses it for motion polish

### 6.6 Phase 6 — Role-Based Runtime Extraction (conditional)

**Condition:** `AnimationBrain` (609 lines) is proven to be a maintenance bottleneck, OR adding new roles (keeper, umpire) is planned.

**If condition is false:** Keep `AnimationBrain` as-is. It works.

#### 6.6.1 Scope

- Create `AnimationRuntime` base class
- Extract `BatsmanRuntime`, `BowlerRuntime`, `FielderRuntime`
- `AnimationBrain` becomes dispatcher

### 6.7 Phase 7 — Motion Polish (conditional)

**Condition:** All previous phases are complete and visual quality is still below target.

**Scope:**
- Ball-velocity-responsive swing timing
- Personality-driven follow-through consistency
- Head tracking includes neck
- Spring parameter tuning
- BACKLIFT→SWING blend capture at transition, not t=1
- Fielder dive anticipatory weight shift

---

## 7. Data Flow Diagrams

### 7.1 Current (as built — to verify during audit)

```
requestAnimationFrame
  ↓
EngineBridge.tick()
  ↓
GameEngine.tick(dt)
  ├─ StateMachine.advance()
  ├─ BowlerFSM.update(dt)
  ├─ BatsmanFSM.update(dt)
  ├─ BallSystem.updatePreHit()
  ├─ + systems
  └─ → EngineSnapshot
  ↓
Renderer.setSnapshot(snap)
  ↓
Renderer.render()
  ├─ scene updates (ball, bowler pos, batsman pos, fielders)
  ├─ _updateGlbAnims(dt)
  │   └─ AnimationBrain.update(snap, dt, ballWorld)
  │       ├─ _updateBowler()
  │       ├─ _updateBatsman()
  │       └─ _updateFielders()
  ├─ _syncBatToHand()
  └─ composer.render()
```

### 7.2 Per-Character Update Detail (to verify during audit)

```
AnimationBrain._updateBatsman(snap, dt, ballWorld)
  │
  ├─ 1. CLIP
  │     clipPlayer.play('walk') — only if !ANIM_PROCEDURAL_ENABLED
  │     b.instance.mixer.update(dt) — always
  │
  ├─ 2. BIND POSE ANCHOR (only if ANIM_PROCEDURAL_ENABLED)
  │     applyBPToLoco(bp, acc(LOCOMOTION))
  │       → setRot for 7 loco bones to bind pose
  │     applyBPToRole(bp, acc(ROLE))
  │       → setRot for 11 role bones to bind pose
  │
  ├─ 3. CONTROLLER
  │     BattingController.update(snap, dt, acc(ROLE), pers)
  │       → addRot calls: ~20 bone rotations accumulated
  │       → returns { rootZ }
  │     this.batsmanRootZ = rootZ
  │
  ├─ 4. FX (only if ANIM_PROCEDURAL_ENABLED)
  │     batsmanFx.consume(snap, dt) — check for release/contact events
  │     batsmanFx.contributeBoneDeltas(acc(REACTION))
  │       → body recoil: acc.addRot('spine', ...)
  │
  ├─ 5. HEAD (always, with phase gating)
  │     applyBPToHead(bp, acc(HEAD))
  │     updateHeadTracking(inst, root, ballWorld, acc(HEAD), enabled)
  │       → acc.addRot('head', pitch, yaw, 0)
  │
  ├─ 6. APPLY LAYERS
  │     layerSet.applyAll(b.instance)
  │       → for each layer (0→5):
  │           acc.apply(char, layerId)
  │             → for each bone target:
  │                 bone.rotation.set(
  │                   setRot ? target : bone.rotation.x + addRotX,
  │                   ...)
  │
  └─ 7. SPRINGS (post-apply)
        springAcc.begin()
        applySprings(b.instance, dt, springAcc)
          → 5 bones, critical-damped spring, acc.addRot per bone
        springAcc.apply(b.instance)
```

---

## 8. Execution Schedule

Recommended day-by-day schedule for Phase 0 + Phase A + decision gate.

### Day 1 — Phase 0: Stabilization

**Output:** All files tagged, bone validation running, ownership document started.

- Add `@active` / `@deprecated` / `@stub` headers to ~30 files
- Implement `validateBones()` in `AnimationBrain.update()`
- Begin animation ownership document in `AGENTS.md` or `ANIMATION_ARCHITECTURE.md`
- Set up console-toggle debug flags for all instrumentation (use `__anim` pattern from AnimationBrain)

**Risk:** Low. No gameplay code is modified.

### Day 2 — Repository Audit

**Output:** `AUDIT_REPOSITORY.md` — file status table, import graph, execution trace, dead code confirmation.

- Trace `requestAnimationFrame` → `Renderer.render()` → `AnimationBrain.update()` → `bone.rotation.set()`
- Verify every `@deprecated` file is truly unreachable
- Generate import graph for animation pipeline
- Confirm `engine/systems/AnimationSystem.ts` is used only as engine state (not animation)
- Confirm `engine/characters/` and `characters/human/` are dead

**Risks:**
- Medium: A file marked `@deprecated` might be reachable through an unexpected import path. This is caught here.

### Day 3 — Rig Audit + Animation Asset Audit

**Output:** `AUDIT_RIGS.md` + `AUDIT_CLIPS.md`

- Per-character bone hierarchy tree + local axis measurement
- Bind pose capture (21 canonical bones × 7 characters = 147 measurements)
- Bone length consistency check
- Clip inventory per character (what exists, what's missing)
- Track coverage analysis

**Risks:**
- Low: Pure measurement. No code changes.
- Time: 7 characters × ~30 minutes each = ~3.5 hours minimum for rig audit alone.

### Day 4 — Bat Audit + Animation Correctness + Contact Event + World-Space Swing

**Output:** `AUDIT_BAT.md` + world-space swing metrics + contact event timing + per-pose screenshots

- Per-character bat offset measurement (mean, stddev, min, max)
- Frame lag measurement (prove whether `_syncBatToHand` has 0-frame or 1-frame lag)
- Quaternion drift check over 1000 frames
- Contact event timing: per-frame bat-ball gap measurement, classify as EARLY/CORRECT/LATE per delivery
- Pose capture: guard, backlift, swing contact, follow-through (all personalities)
- Motion trajectory: swing arc sampled every rendered frame (16.67ms at 60fps), bowling arm path, bat-ball gap during SWING
- World-space swing metrics (bat speed, swing plane, arc radius, follow-through wrap, angular velocity) compared against cricket norms

**Risks:**
- Low: Instrumentation only. No system changes.
- High value: Determines whether bat attachment rewrite is needed.
- Medium: World-space metrics require bat tip world position per frame — add temporary tracking to _syncBatToHand

### Day 5 — Performance Audit + State Machine Audit + Layer Conflict

**Output:** `AUDIT_STATE_MACHINES.md` + `AUDIT_PERFORMANCE.md` + Layer Conflict Report + Desync Log

- State inventory (all 5+ machines, all transitions, all owners)
- Duplicate state analysis (3-way: GameEngine vs BowlerFSM vs BatsmanFSM)
- Runtime state desync instrumentation: 1-line-per-frame desync check, compiled to desync log
- Valid transition table: for each (GameState, FSM phase) pair, verify alignment
- `AnimState` reachability confirmation
- Layer conflict detection: Pattern A (set vs add race), Pattern B (ownership violation), Pattern C (silent overwrite), Pattern D (accumulator leak)
- Per-function timing (mixer, accumulator, controller, head tracking, springs, bat sync)
- Budget analysis vs 16ms frame budget

**Risks:**
- Medium: Performance instrumentation may affect timings slightly (use `performance.now` not `console.time`)
- Medium: Layer conflict detection needs per-layer accumulator read access (may need temporary hooks)
- Low: State audit and desync check are pure instrumentation

### Day 6 — Character Compatibility + Controller Logic + Root Cause Report

**Output:** `AUDIT_MOTION.md` + compatibility matrix + `ANIMATION_ROOT_CAUSE_REPORT.md` + Salvage Assessment

- Character baseline selection: verify modi meets 21/21 bones, <5% scale variance, best visual
- Per-character summary (all 7): bone count, rig type, known issues
- Compatibility matrix: 7 characters × 10 metrics, measured against baseline
- Controller logic value export: BattingController addRot values × 12 joint ranges
- Cricket biomechanics plausibility comparison table
- Character grouping: same-rig-type variance vs cross-rig-type variance
- Battery test: run standardized delivery on all characters, capture frames
- Rig Risk Classification: SAFE/WARNING/CRITICAL per character, decision gate
- Compile all 8 audit report domains into a single Root Cause Report
- For each suspected issue (bat orientation, swing quality, contact timing, layer conflict, desync), cite specific evidence
- Evaluate each component as Keep / Replace / Maybe using the decision matrix in section 5
- Estimate minimal fix path effort vs full rebuild path effort

**Risks:**
- Low: Analysis only. No code changes.
- Medium: Battery test output needs standardized format for fair comparison

### Day 7 — Decision Gate

**Input:** `ANIMATION_ROOT_CAUSE_REPORT.md` + Visual Error Scores (§3.10.7) + Salvage Assessment (§5)

**Decision rule:** If median visual error score ≥75 (ACCEPTABLE threshold), proceed with Minimal Fix Path. If median score <75, proceed with Full Rebuild Path. Individual P0 defects override the median rule — any P0 defect forces the Full Rebuild Path regardless of score.

**Output:** Decision document: proceed with Minimal Fix Path or Full Rebuild Path. If Minimal Fix, begin implementation immediately. If Full Rebuild, begin Phase 1 prioritization.

- Present findings to team
- Decision: fix or rebuild per component
- If Minimal Fix: start implementation (can merge into this sprint)
- If Full Rebuild: start Phase 1 planning (likely requires separate sprint)

**Risks:**
- Organizational: Decision must be accepted by stakeholders before proceeding.

### Schedule Summary

| Day | Phase | Focus | Deliverable | Risk |
|-----|-------|-------|-------------|------|
| 1 | Phase 0 | Stabilization | File tags, bone validation | Low |
| 2 | Phase A | Repository audit | `AUDIT_REPOSITORY.md` | Medium |
| 3 | Phase A | Rig + clip audit | `AUDIT_RIGS.md` + `AUDIT_CLIPS.md` | Low |
| 4 | Phase A | Bat + correctness + motion + contact | `AUDIT_BAT.md` + world-space metrics + contact timing | Medium |
| 5 | Phase A | Performance + state + layer conflict | `AUDIT_PERFORMANCE.md` + `AUDIT_STATE_MACHINES.md` + desync log | Medium |
| 6 | Phase A | Compatibility + controller logic + root cause | `AUDIT_MOTION.md` + compatibility matrix + `ANIMATION_ROOT_CAUSE_REPORT.md` | Low |
| 7 | Decision | Decision gate | Decision document | Organizational |

Total audit phase: **6 days** (Phase 0: 1 day + Phase A: 5 days) + **1 day** decision gate.

---

## 9. Migration Plan

### 9.1 Phase Ordering

```
Phase 0: Stabilization     — mandatory (add safety, remove ambiguity)
Phase A: Forensic Audit    — mandatory (prove root causes)
──── then ────
Root Cause Report         — evidence-based decision point
Salvage Assessment        — keep vs replace per component
──── then ────
(Conditional Phases 1-7 as determined by evidence)
```

### 9.2 Decision Gates

```
                    ┌─────────────────────────┐
                    │ Phase 0 (Stabilization) │
                    │ Phase A (Forensic Audit)│
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │   Root Cause Report     │
                    │   Salvage Assessment    │
                    └──────────┬──────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
         ┌──────────────────┐  ┌──────────────────────┐
         │ Minimal Fix Path │  │ Full Rebuild Path    │
         │ (1-2 days)       │  │ (15-23 days)         │
         │ Adjust grip      │  │ Phase 1: RigMapper   │
         │ Fix blend        │  │ Phase 2: Bat Attach  │
         │ Remove dead code │  │ Phase 3: Contact     │
         └──────────────────┘  │ Phase 4: States      │
                               │ Phase 5: Env Sensor  │
                               │ Phase 6: Runtimes    │
                               │ Phase 7: Polish      │
                               └──────────────────────┘
```

### 9.3 Effort Estimates (Conditional)

| Component | Minimal Fix | Full Rebuild |
|-----------|-------------|--------------|
| Phase 0 | 1-2 days | 1-2 days |
| Phase A | 2-3 days | 2-3 days |
| Phase 1 | *skip* | 2-3 days |
| Phase 2 | 0.5 day (per-char grip) | 1-2 days |
| Phase 3 | *skip* | 3-4 days |
| Phase 4 | 0.5 day (deprecation) | 1 day |
| Phase 5 | *skip* | 2-3 days |
| Phase 6 | *skip* | 3-5 days |
| Phase 7 | 1-2 days | 2-3 days |
| **Total** | **5-10 days** | **15-23 days** |

### 9.4 Rollback Strategy

Every Phase 1-7 change (if undertaken) should include:

- A feature flag to disable the new behavior and fall back to the current system
- A single-character test bed (modi recommended — most neutral baseline) for comparing before/after
- Option to land behind `__anim` debug flags (already supported in `AnimationBrain.ts`)

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| addRot | Additive rotation delta stacked on existing bone rotation |
| setRot | Absolute rotation that replaces existing bone rotation |
| BoneAccumulator | Per-layer per-frame target container for bone rotations/positions |
| LayerSet | Collection of 6 BoneAccumulators, one per layer |
| BONE_OWNERSHIP | Map from canonical bone name to LayerId that owns its setRot |
| BindPose | Initial bone rotations captured at character load (before animation) |
| ClipPlayer | Inline class in AnimationBrain that manages mixer crossfade |
| RigMapper | (Proposed) Per-character axis convention translator |
| AnimationRuntime | (Proposed) Per-role animation class |
| EngineSnapshot | Read-only game state snapshot consumed by renderer each frame |

## Appendix B: Instrumentation Points for Audit

```typescript
// Add to Renderer.ts for bat audit
console.log(`[BAT] frame=${frame} handPos=(${rhPos.x.toFixed(3)}, ${rhPos.y.toFixed(3)}, ${rhPos.z.toFixed(3)}) batPos=(${batPos.x.toFixed(3)}, ${batPos.y.toFixed(3)}, ${batPos.z.toFixed(3)})`);

// Add to AnimationBrain.ts for execution trace
console.log(`[ANIM] ${role} phase=${phase} progress=${progress.toFixed(3)} bones=${bones.size}`);

// Add to BattingController.ts for swing audit
console.log(`[SWING] rightArm addRot=(${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}) at t=${linearT.toFixed(3)}`);
```

## Appendix C: Related Files (Complete List)

```
Active animation pipeline:
  apps/frontend/src/game/animation/          (16 files)
  apps/frontend/src/render/Renderer.ts       (1 file, bat sync)
  apps/frontend/src/game/CharacterManager.ts (1 file, GLB + bones)
  apps/frontend/src/engine/physics/animationFSM.ts (1 file, FSMs)

Engine state (reads by animation, not writes):
  apps/frontend/src/engine/GameEngine.ts
  apps/frontend/src/engine/state/StateMachine.ts
  apps/frontend/src/engine/systems/AnimationSystem.ts

Dead/stub/deprecated:
  apps/frontend/src/characters/human/        (10+ files)
  apps/frontend/src/engine/characters/       (4 files)
  apps/frontend/src/game/AnimationManager.ts (1 file)
```
