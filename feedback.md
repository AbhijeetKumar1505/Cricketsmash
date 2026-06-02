# Cricket Crash — Agent Feedback & Lessons Learned

**READ THIS BEFORE STARTING ANY WORK ON THIS PROJECT.**

This file records what was tried, what broke, what fixed it, and what must never be repeated.
It is the highest-priority reference for any agent working in this codebase.

---

## Animation System — Meshy AI GLB Rigs

All player characters are Meshy AI biped rigs loaded as GLB files.
These rigs differ fundamentally from Mixamo rigs. Ignoring these differences
will break the animation system immediately.

### Meshy AI rig facts (verified in production)

- **Bone bind-pose rotations are large** — arms, legs, and spine can have 90°+ local rotations
  in bind pose. Values like `rightArm.z = 1.20` or `leftUpLeg.x = 2.30` are normal.
- **Walk animation frame 0 = prone/flat** — the walk clip starts from a character lying on the
  ground. Any `freeze()` call or `time = 0` locks characters into a face-down pose. Never freeze.
- **`skeleton.pose()` is broken for repositioned characters** — it sets `bone.matrixWorld` to
  absolute bind-time world coordinates. Characters placed at non-origin positions disappear
  completely. Never call `skeleton.pose()`.
- **Neck bone local axes don't match expected conventions** — the neck's local Y axis does NOT
  correspond to a left/right turn in world space. Applying Y-axis rotation to neck for ball
  tracking causes the neck to swing sideways. See neck section below.
- **Head bone accumulates rotation across frames** — `addRot('head', ...)` stacks on the
  persisted bone value from the previous frame. Without a per-frame bind-pose reset via
  `setRot`, the head drifts to extreme angles within seconds. Fix: call `applyBPToHead`
  before every `updateHeadTracking` call so the HEAD accumulator has an absolute base each frame.

---

## The Bind-Pose Anchor Pattern (the correct approach)

**Problem solved:** Without an absolute base, `addRot` stacks frame-over-frame on bone values
that persist between frames. After 60 frames at 60fps, bones drift to extreme angles.

**Solution:** Capture each character's bone rotations BEFORE any animation plays, then write
them back to the correct layer accumulator as `setRot` every frame. Controllers then use
`addRot` (delta from bind pose) rather than `setRot` (absolute value).

```
captureBP(inst)        — call BEFORE any clipPlayer.play()
applyBPToLoco(bp, acc) — write hips/legs to LOCOMOTION layer each frame
applyBPToRole(bp, acc) — write spine/chest/arms/forearms/hands to ROLE layer each frame
applyBPToHead(bp, acc) — write head to HEAD layer each frame (must be called before updateHeadTracking)
```

Layer bone ownership:
- **LOCOMOTION**: hips, leftUpLeg, rightUpLeg, leftLeg, rightLeg, leftFoot, rightFoot
- **ROLE**: spine, chest, upperChest, leftShoulder, rightShoulder, leftArm, rightArm,
  leftForeArm, rightForeArm, leftHand, rightHand
- **HEAD**: head
- **neck**: excluded from bind pose — see below

When to apply each:
| Character | LOCO bind pose | ROLE bind pose |
|-----------|---------------|----------------|
| Batsman   | always        | always         |
| Bowler IDLE/GATHER/ARM_SWING/RELEASE/FOLLOW_THROUGH | yes | yes |
| Bowler RUN_UP | **NO** — run clip owns both layers | **NO** |
| Fielder idle/gather | yes | yes |
| Fielder chase | **NO** (walk clip drives legs) | yes |

---

## setRot vs addRot in Controllers

**RULE: All bone operations in BattingController, BowlingController, FieldingController
must use `addRot`, not `setRot`.**

Why: `setRot` writes an absolute value. For Mixamo rigs (near-zero bind pose), the
authored values like `setRot('rightArm', -1.30, 0, -1.80)` happen to be near the correct
absolute position. For Meshy AI rigs (large bind-pose angles), those same values snap the
arm to completely wrong orientations.

`addRot` writes a delta. Because `applyBPToRole` writes the actual bind pose as a base
each frame via `setRot`, any `addRot` from a controller means "delta from bind pose".
The result is rig-agnostic: the arm moves by that amount from wherever it naturally rests.

This applies to:
- All arm/forearm/hand bones in all batting phases (BACKLIFT, SWING, CONTACT, FOLLOW_THROUGH)
- All spine/chest bones in all batting/bowling/fielding phases
- All arm bones in BowlingController (GATHER, ARM_SWING, RELEASE, FOLLOW_THROUGH)
- All arm/spine/hand bones in FieldingController (idle, chase, dive, gather)
- The `_blendVec3` helper in BattingController (uses `addRot` internally)

---

## Neck Bone — Special Case

**DO NOT include neck in `ROLE_BONES` for bind-pose application.**

The Meshy AI rig's neck bone has unusual local-axis orientation. Locking it to its
bind-pose Y rotation via `setRot` causes the neck to appear sideways in world space.

**DO NOT add `neckFraction` to `updateHeadTracking` for batsman.**
Even a small neckFraction (0.4) rotates the neck sideways when the ball is active,
because the local Y axis on this rig's neck ≠ world yaw. The head bone alone handles
ball tracking.

The neck retains the rig's natural resting value and only receives:
- Small addRot deltas from the kinetic chain during SWING phase (Y-axis, tiny)
- No ball-tracking rotation at all

---

## ClipPlayer Rules

- `play('walk')` — walks the clip; frame 0 is prone — only use for fielder chase
- `play('run')` — used for bowler RUN_UP
- Never call `play()` during character init/bind — capture the bind pose first, then play
- `freeze()` locks to time=0 = prone pose — never call it on these rigs
- Silent failure: `play(name)` does nothing if the clip name doesn't exist in the GLB

---

## Character Clip Usage by Phase

| Character | Clip active? | When |
|-----------|-------------|------|
| Batsman (procedural) | none | LOCOMOTION + ROLE bind pose + addRot deltas |
| Bowler idle/gather/swing | none | same as above |
| Bowler RUN_UP | `run` | full clip drives everything |
| Fielder idle/gather | none | bind pose + ROLE addRot |
| Fielder chase | `walk` | walk clip drives legs; ROLE bind pose + addRot drives arms |

---

## Head Tracking

`updateHeadTracking()` signature:
```typescript
updateHeadTracking(char, root, ballWorld, acc, enabled, damping=0.15, neckFraction=0)
```

- `neckFraction` defaults to `0` and must stay `0` for Meshy AI rigs (see neck section)
- Only the `head` bone is modified by head tracking
- `enabled` flag: batsman only tracks when `ball.active || phase === BACKLIFT || SWING`

---

## BattingReference Constants (current tuned values)

```typescript
MAX_SWING_RAD = 2.10   // (was 1.90 → 2.10 for readability at gameplay distance)
HIP_SHARE     = 0.26   // 31° hip pivot — pelvis-led initiator (was 0.20)
SPINE_SHARE   = 0.19   // 23° local (was 0.18)
CHEST_SHARE   = 0.15   // 18° local
NECK_SHARE    = 0.06   // 7° local (was 0.08)

HIP_LEAD   = 0.00   // hips fire at t=0
SPINE_LEAD = 0.25   // spine follows at t=0.25
CHEST_LEAD = 0.40   // chest follows at t=0.40
ARM_LEAD   = 0.55   // shoulder follows at t=0.55
FOREARM_START = 0.62 // forearm fires after shoulder
```

World rotation at arms ≈ 72° (1.26 rad) — readable athletic cricket drive.
Previous values (SPINE/CHEST = 0.47 each) gave 147° total — the "bowling around the waist" bug.

---

## Contact Point Calibration

### contactPointWorld.y — dynamic, not hardcoded

**WRONG:** `contactPointWorld: new Vec3(0, WORLD.HIT_Y, WORLD.BATSMAN_Z)` — the 0.85m
hardcoded value assumes a flat-bounced ball at standard waist height. In practice the ball
arrives at 0.93–1.05m for most deliveries, and up to 1.79m for full-tosses.

100-delivery audit: `minError = ballY − batY` in the Renderer was −0.13 to −0.68m across all
shots. Negative = bat is above ball (bat sweet spot overshoots the ball vertically).

**FIXED:** `BallPredictor.predictContact()` now takes `ball.y` and `ball.vy` and uses a
ballistic projection: `contactY = ball.y + ball.vy * t − 0.5 * WORLD.GRAVITY * t²`.
Clamped to [0.25m, 2.50m] for IK stability.

### BatTargetIK targets the BLADE (Option A — fixed)

The IK end-effector is the `rightHand` bone, but the bat blade extends ~0.5m past the wrist
(local −Y). `BatTargetIK` now offsets the hand goal by `bladeOffsetFromHand(handQuat)` so the
**blade sweet spot** — not the wrist — lands on `contactPointWorld`. Iterative (uses the prior
frame's hand orientation), converges across the CONTACT window. Bat geometry constants
(`BAT_QUAT_OFFSET`, `BAT_GRIP_SEAT`, `BAT_SWEET_OFFSET`) live in
`characters/human/bat/batGeometry.ts` — shared by the Renderer and the IK so they agree on
where the blade is.

Also fixed in Option A: `BallPredictor` now projects the ball's real x/y/z to `contactPointWorld`
(was hardcoded `(0, contactY, WORLD.BATSMAN_Z)`, which aimed ~0.5m behind the actual ball).

**Architecture note:** contact is event-driven — `GameEngine.batsmanFSM.onContact` latches the
ball Y and immediately `resolveSwing()` relaunches the ball with the hit velocity. Nothing forces
the bat and ball to physically coincide; the IK above is what closes the spatial gap. Debug spheres
(`window.__anim.contactDebug`) draw 🔴 ball / 🟢 contactPointWorld / 🔵 blade sweet spot to verify.

### `BatRig` is dead code (never instantiated)

`BatRig.getContactPoint()` looks like the canonical sweet-spot accessor, but `grep "new BatRig"`
returns nothing — it is never constructed and its `_sweepSpot` is never attached to a live bat.
The actual rendered bat lives only in `Renderer._syncBatToHand()`. Do NOT assume `BatRig` is
wired; if you need the sweet spot, compute it from `this._batsmanBat` (bat origin = grip,
sweet spot = grip + 0.468m along `(0,1,0)·batQuat`).

### Contact-error metric was measuring the WRONG origin (fixed)

Until this fix, `window.__anim.lastContactError` / `getContactStats()` measured the **wrist bone**
distance to the target (`BatTargetIK.ts` wrote `rightHand.distanceTo(target)`). That produced a flat
~0.40m across every shot type — an anatomical constant (hand→sweet-spot), not contact accuracy.
The metric now lives in `Renderer._syncBatToHand()` and measures the real **bat sweet spot** against
two references (see Telemetry Dashboard below). If you ever see a contact metric clustered at a fixed
value independent of shot type, suspect a wrong measurement origin before tuning the IK.

---

## IK Layer (L7) — implemented

The IK layer (LayerId.IK = 5) is now active. Key files:

```
apps/frontend/src/characters/human/ik/
  TwoBoneIK.ts      — analytic world-space→local Euler solver; 60/40 root/mid split
  BatTargetIK.ts    — arm IK during CONTACT phase (blend in 0.05s, out 0.10s)
                       + soft reach in late SWING (max weight 0.30, toward ballWorld)
                       + torso compensation (chest 15%, spine 8% of IK delta)

apps/frontend/src/characters/human/bat/
  BatRig.ts         — per-character socket calibration table (getBatSocketConfig)
  BatContact.ts     — spring deflection on rightHand at contact (k=280, d=26)
```

IK rules:
- IK layer is **always additive** — never uses `setRot`, only `addRot`
- `BatTargetIK` must be called BEFORE `layerSet.applyAll()` so its deltas are included
- `BatContact` runs in the spring post-step (same pattern as `springs.ts`)
- Torso compensation threshold: only fire when `|rootDeltaY| > 0.08 rad`

---

## Gaze System — predictive lerp blend

Head tracking target during batting now uses a predictive blend:

```
IDLE / FOLLOW_THROUGH : ballWorld (track live ball)
BACKLIFT              : lerp(ballWorld, contactPoint, 0.30 × eased.backlift)
SWING                 : lerp(ballWorld, contactPoint, 0.30 + 0.50 × progress)
CONTACT               : contactPointWorld (full lock)
```

Module-level `_predContactTarget` vector in AnimationBrain.ts holds the interpolated target.
`neckFraction` remains 0 on all calls (Meshy AI neck Y-axis convention issue still applies).

---

## Secondary Motion & Balance Recovery

`springs.ts` — personality scaling: `stiffness *= 0.8 + 0.4 * personality.power`.
Power hitters (trump=1.35) get stiffness ×1.34; technical batsmen (putin=0.75) get ×1.10.

`BattingController._tickBalance()` — post-swing momentum persistence:
- Fires on FOLLOW_THROUGH→IDLE transition
- `power = hp.scale / 1.8` (huge=1.0, dot=0.28)
- `mag = power * dir * exp(−t×5.5) * sin(t×π×2.5)`
- Applies to spine (×0.10), chest (×0.06), hips.z (×0.018), rootZ (×0.04)
- Duration: 0.40s (dot) to 0.65s (huge)

---

## Telemetry Dashboard

`animTelemetry.ts` — singleton `anim_telemetry` collects per-delivery records.
Mounted on `window.__anim` by the AnimationBrain initialization block.

**⚠ HMR WARNING:** `window.__anim` is set at module initialization (side effect, not
function). After any code change to `AnimationBrain.ts`, do a **hard refresh**
(Ctrl+Shift+R) before calling the telemetry methods — HMR updates the module code but
does NOT re-run module-level side effects. For changes to `gameController.svelte.ts` or
`Renderer.ts` (module-level singletons), prefer a **dev-server restart** too.

**Contact-error feed:** the contact metric is fed by `Renderer._syncBatToHand()` (the only
place with the real bat mesh), NOT by AnimationBrain/BatTargetIK. It measures the bat sweet
spot against two references and reports both as parallel series:
- `vsBall`   — sweet spot → actual ball world position (true visual contact accuracy)
- `vsTarget` — sweet spot → predicted `contactPointWorld` (IK target-tracking accuracy)

Available after hard refresh:
```javascript
window.__anim.getContactStats()   // → { vsBall, vsTarget }, each with p50/p95/p99/max + byShotType
window.__anim.getPhaseStats()     // FSM phase durations per shot type
window.__anim.getBalanceStats()   // balance amplitude per outcome
window.__anim.resetStats()        // clear all data
window.__anim.lastContactError    // last delivery's vsBall min distance (metres)
```
Console `[CONTACT]` log prints `vsBall`, `vsTarget`, and the legacy Y-only `minErrorY` per delivery.

---

## INTEGRITY SPLIT — false positive fixed

`[INTEGRITY] SPLIT` fired on every wicket in mock mode. Root cause: the check
`if (isWicket && serverPayout > 0)` incorrectly flagged stake-return on wicket as a
split. A wicket returning the original stake (1× = no profit) is correct behaviour.

**Fix:** condition changed to `if (isWicket && serverPayout > stake)`. The warning now
only fires when a wicket delivery actually paid OUT MORE than the original bet.

---

## Things That Were Tried and Broke Everything

| Approach | What happened | Why |
|----------|--------------|-----|
| `freeze()` on fielders/batsman | All characters lie flat on ground | Walk clip frame 0 is prone pose |
| `skeleton.pose()` | Characters completely disappeared | Sets world coords using bind-time origin; repositioned chars vanish |
| `play('walk', 0)` in character init | Characters walking + flipping | Starts walk clip before bind pose is captured; frame 0 = prone |
| `setRate(0.08)` slow walk | Characters still walking AND flipping | Low-speed clip still cycles through prone frame 0 |
| `setRot` with Mixamo-style absolute values | Arms snap to wrong positions | Meshy AI arm bind pose ≠ near-zero |
| `addRot` without bind pose base | Bones drift to extreme angles over seconds | addRot stacks on persisted bone values across frames |
| `neckFraction=0.4` in headTracking | Neck swings sideways during play | Neck local Y ≠ world yaw on this rig |
| `addRot('head', ...)` without bind-pose reset | Head rotates to extreme angles over time | addRot stacks on persisted bone value each frame; needs `applyBPToHead` before headTracking |
| `play('run')` for fielder chase | Walk clip never stopped playing | `play()` fails silently if clip not in GLB; `_currentAction` unchanged |

---

## Files Central to the Animation System

```
apps/frontend/src/game/animation/
  AnimationBrain.ts        — top-level orchestrator; bind pose capture + layer dispatch
  BoneLayer.ts             — layer enum + BONE_OWNERSHIP map
  BoneAccumulator.ts       — per-frame accumulator; setRot/addRot → apply to bones
  BattingController.ts     — batsman phase controllers (IDLE/BACKLIFT/SWING/CONTACT/FOLLOW_THROUGH)
                             + delivery-speed anticipation (contactSolution.requiredSwingDuration)
                             + ball-height torso adaptation (snap.ball.y in backlift)
                             + dynamic balance recovery (_tickBalance)
                             + shot-type follow-through variants (pull/cut/defend)
  BowlingController.ts     — bowler phase controllers
  FieldingController.ts    — fielder idle/chase/gather/dive
  BattingReference.ts      — canonical rotation constants (MAX_SWING_RAD, shares, leads)
  headTracking.ts          — ball look-at with damping; HEAD layer only; neckFraction=0
  LayerResolver.ts         — applyAll() in layer priority order
  personality.ts           — per-character motion traits (power, speed, bob, etc.)
  animTelemetry.ts         — per-delivery measurement (contact error, phase durations, balance amp)
  springs.ts               — L6 secondary lag (personality-scaled stiffness)

apps/frontend/src/characters/human/ik/
  TwoBoneIK.ts             — analytic two-bone IK solver (world→local Euler deltas)
  BatTargetIK.ts           — arm chain IK: late-SWING soft reach + CONTACT correction + torso comp

apps/frontend/src/characters/human/bat/
  BatRig.ts                — per-character socket calibration (getBatSocketConfig table)
  BatContact.ts            — spring deflection on rightHand at impact

apps/frontend/src/engine/physics/
  BallPredictor.ts         — contact solution with dynamic Y projection (was hardcoded 0.85m)
```
