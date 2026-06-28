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

## Guard Stance (IDLE) — two coupled regressions to never repeat

The IDLE batsman ended up bolt-upright with the bat dangling at his feet. Two
independent edits to `BattingController` caused it:

**1. `_idleArmGuard` must pose the RIGHT arm, not just the left.** The bat is
parented to the `rightHand` bone in the Renderer. On this Meshy rig the right
arm's bind pose hangs ~106° out to the side, so if IDLE leaves the right arm at
bind the bat dangles at the feet, then snaps into a real guard on IDLE→BACKLIFT.
`_idleArmGuard` must apply the SAME rest deltas `_backlift` uses at `lift=0`
(`rightArm -0.32,0,-0.58` · `rightForeArm 0.58,0,-0.24` · `rightHand 0.06,0,-0.16`
plus the left-arm pair). These are PROVEN axes (do not guess) and double as a
seamless IDLE→BACKLIFT hand-off with no right-arm snap.

**2. `_applyGuardWithStance` must supply the ~`+0.10 spine` / `+0.10 head` lean
base.** The CONTACT and FOLLOW_THROUGH code is tuned against that base — its own
inline comments say "guard +0.10 spine base", "guard stance's forward lean
(+0.10 head)". A well-meaning "straight upright stance — bind pose defines lean"
edit removed the base and SILENTLY de-tuned every contact/follow-through pose
(head folded into the chest, etc.), not just idle. Restore: `spine +0.10`,
`chest +0.06`, `head +0.10`, tiny `hips` pelvis tilt — moderate so total world
rotation stays well under the "bowling lean" threshold.

**Lesson:** the guard stance is a shared BASE that the per-phase poses add onto.
Changing it re-tunes every phase. If you flatten it, grep the phase code for
"guard +0.10" comments first.

## Bat Body Clearance — move the bat off the torso WITHOUT breaking contact

The guard bat read as "buried in the body". Source constant in `batGeometry.ts`:

```typescript
BAT_BODY_CLEARANCE = new THREE.Vector3(0.12, -0.08, 0)  // WORLD axes: +X off the
                                                        // torso, −Y down
batClearanceWeight(phase, progress)  // 1 at rest → eased to 0 across BACKLIFT
                                     // → 0 in SWING/CONTACT/FOLLOW_THROUGH
```

**Apply it by moving the right HAND, not the bat mesh.** The bat is rigidly
parented to `rightHand` (Renderer), AND the left-hand weld derives its handle
point from the right-hand pose. So a single right-hand nudge carries the bat out
and BOTH hands follow it. Implemented as a reach post-pass mirroring the left
weld:

- `BatTargetIK.solveRightGripPost()` — `reachTwoBoneInPlace` drives `rightHand`
  to `currentWorldPos + BAT_BODY_CLEARANCE·weight`. MUST run BEFORE
  `solveLeftGripPost` (in `AnimationBrain`) so the top-hand weld reads the
  already-lifted bat. Bones reset to bind next frame → nothing accumulates.
- The Renderer does NOT offset the bat mesh, and `solveLeftGripPost` does NOT
  re-add the clearance — applying it in more than one place would double it.

**Why gated to 0 through SWING/CONTACT:** `batClearanceWeight` zeroes the reach
before the swing, so it never fights the contact IK (blade-on-ball) or perturbs
the sweet-spot telemetry. The right-hand reach and the contact reach are thus
fully time-disjoint.

**Why NOT offset the bat mesh directly (the rejected first attempt):** the bat is
rigid to the right hand, which is a raw animation bone (not IK-welded). Offsetting
the mesh moves it relative to the bottom hand → at 0.12 the grip sat ~13 cm off
the right palm (detached). Moving the hand instead keeps `rightHand→grip` at the
correct `BAT_GRIP_SEAT` (0.085 m) — verify with `window.__anim.dumpBat()`
(`rightHand` vs `grip` ≈ 0.085).

**Live tuning:** `window.__batClear = [x, y, z]` (sole consumer is
`solveRightGripPost`; bat + both hands move together).

## Idle Bat Carry — four anatomical setters, dialed live by the user

The resting bat hold went through several wrong guesses (dangling down; raised
up-and-FORWARD; raised up-and-BACK — "at the back"; up-and-to-the-off-side at 45° —
"not precise"). What finally worked: stop guessing the *pose* and instead expose the
four arm joints as independent setters so the user dials it themselves.

**The four axes (each found EMPIRICALLY on this Meshy rig via the close-up +
`dumpBat()` — never guessed):**
  - **SHOULDER = `−rightArm.z`** (`window.__guardLift`) — raises/lowers the bat.
  - **ELBOW = `rightForeArm.x`** (`window.__guardElbow`) — bends the elbow; negative
    EXTENDS the arm so the bat drops down in front.
  - **WRIST = `−rightHand.z`** (`window.__guardCock`) — tilts the blade up/down.
  - **SWEEP = `rightHand.y`** (`window.__guardYaw`) — rotates the bat HORIZONTALLY
    around the vertical/head axis. This is the ONLY arm axis that sweeps sideways
    (blade height stays ~constant while X/Z swing); `rightArm.y` looks like it should
    but just adds another vertical tilt. Key lesson: for a horizontal sweep use the
    WRIST (`rightHand.y`), not the shoulder.

`_idleArmGuard` applies the proven flat rest deltas, then these four. Defaults (the
user's chosen guard — bat down in front of the body): `IDLE_RAISE_DEFAULT 0.00`,
`IDLE_ELBOW_DEFAULT −1.50`, `IDLE_COCK_DEFAULT −1.50`, `IDLE_YAW_DEFAULT 0.00`.

**Tuning method that ended the guessing loop:** a DEV-only on-screen slider panel
(`buildBatTunePanel`, since removed) writing the `window.__guard*` knobs that
`_idleArmGuard` reads each frame. The user dragged the sliders in their own preview
and sent back the `{lift, elbow, cock, yaw}` JSON; those were baked as the defaults.
Far faster than trading annotated screenshots. The `window.__guard*` console knobs
remain for future tuning.

**Kill the IDLE→BACKLIFT snap by EASING all four out across the backlift** (not a
value remap — the idle pose is not a sub-pose of the backlift). The BACKLIFT case
adds each setter scaled by `idleOut = 1 − fsm.eased.backlift` on top of the normal
`_backlift(fsm.eased.backlift, …)`: entry (`eased=0`) = idle pose, `eased=1` = pure
backlift. `_captureBackliftFinal` (t=1) and the swing are untouched (verified: a full
delivery runs with `rigMax` stable at 2.70 and contact metrics in range).

**Close-up debugging tool (essential — the batsman is a thumbnail at gameplay
distance).** The bat hold is impossible to judge from the broadcast camera. Renderer
exposes (DEV only) `window.__cam` / `window.__scene` / `window.__renderOnce()`. To
inspect: lock the camera by overriding `cam.updateMatrixWorld` to re-assert a chosen
`position`+`lookAt` every frame (the game loop sets the camera each frame, so a plain
`position.set` gets overwritten; the override wins). Restore by putting the original
`updateMatrixWorld` back. GOTCHA: after an HMR reload the Renderer re-instantiates, so
re-grab `window.__cam` (a stale closure locks an orphaned, un-rendered camera).

**Grip-tightness gotcha — `dumpBat().handGap_m` is the wrong metric.** It measures
wrist-BONE to wrist-BONE distance, which is dominated by `BAT_GRIP_SEAT` (0.085 m,
bone→grip), NOT by how close the hands look on the handle. The visual grip-point
spacing is `LEFT_GRIP_GAP` plus `LEFT_GRIP_WORLD_OFFSET` (tightened toward 0). Judge
grip by eye + `window.__leftGripDbg.dist_m`, not `handGap_m`.

## Left (top) hand grip — orientation MIRROR + clavicle reach (the "right hand is ok,
left needs fixing" pass)

The right hand always looks right because the bat is PARENTED to it (its world quat IS
the bat). The left hand is IK-welded and was wrong two ways — both fixed in
`BatTargetIK.solveLeftGripPost`:

**1. Orientation: mirror the right hand, don't use a static wrap.** The old code only
added a fixed `LEFT_HAND_WRAP` euler to the left wrist, so the palm faced the wrong
way. Now the left hand's WORLD quaternion is set FROM the right-hand world quat:
`leftHand.quaternion = inv(parentWorldQuat) · (rightHandWorldQuat · LEFT_HAND_MIRROR_OFFSET)`,
then `updateMatrixWorld`. `LEFT_HAND_MIRROR_OFFSET` (default `[0,0,0]`) is a corrective
euler, live-tunable via `window.__lgTune.handRot`. Now both palms wrap the handle the
same way.

**2. Reach: the left arm CLAMPS at max extension in the down-bat pose** → the hand
floats ~6 cm short (`__leftGripDbg.dist_m ≈ 0.065`, `handGap ≈ 0.18`). Tightening
`LEFT_GRIP_GAP` alone makes it WORSE (target moves but the hand can't follow). FIX:
pull the left shoulder IN harder via the clavicle so the reach lands —
`LEFT_CLAV_LIFT [0,−0.10,0] → [0,−0.38,0]`. That dropped the residual to 0.04 and gave
the reach headroom, after which `LEFT_GRIP_GAP −0.02` brought the hands together
(`handGap 0.18 → 0.12`, `leftToGrip 0.11 → 0.06`). Verified: a full delivery runs with
`rigMax` stable at 2.70 and the weld holding through swing/contact.

**RIG LIMITATION — no finger bones.** The Meshy rig has only single `LeftHand` /
`RightHand` bones (~24 bones/char, confirmed by scene traversal — NO finger/thumb
bones). The hand meshes are rigid OPEN palms; fingers cannot curl around the bat. So a
literal wrapped grip is impossible — the most you can do is ORIENT the palm toward the
handle (the mirror above) and seat both hands adjacent. Don't chase finger curl; it's
not in the rig.

**Console knobs:** idle bat hold — `window.__guardLift` (shoulder up/down),
`window.__guardElbow` (elbow bend), `window.__guardCock` (wrist/blade tilt),
`window.__guardYaw` (horizontal sweep); grip — `window.__gripGap` (left-hand handle
spacing, m), `window.__lgTune.off` (top-hand world stretch), `window.__lgTune.clav`
(left-shoulder pull-in / reach), `window.__lgTune.handRot` (left-hand orientation
offset euler); `window.__batClear` (body clearance). Bake chosen values into the
defaults.

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

## ⚠ Mesh-collapse over long autoplay — TWO distinct bugs

The batsman mesh collapsing into a blob after ~10–60 autoplay deliveries had **two**
independent causes. Both are fixed; if it ever returns, the watchdog below names the bone.

**Bug A — `neck` accumulation (the actual collapse).** `neck` was excluded from `ROLE_BONES`
so it was never reset to bind. But `BattingController` (lines ~482/550/568/585/606) and
`fxBus` (`addRot('neck', 0.18·d, …)`) write small per-swing deltas to it. With no reset they
compounded ~0.1–0.3 rad/delivery → drifted past 3.6 rad → rig collapse. **Fix:** added `'neck'`
to `ROLE_BONES` (AnimationBrain) so it's captured in the bind pose and reset every frame; the
swing deltas now apply transiently. **Lesson:** any bone receiving `addRot` MUST be in a
per-frame reset set (`LOCO_BONES`/`ROLE_BONES`/`head`) or it accumulates forever.

**Watchdog:** `AnimationBrain._sanitizeRig()` scans batsman bones each frame, logs
`[RIG-DIVERGE]` for the first bone past a sane bound (4.5 rad), exposes
`window.__anim.rigMax()` (poll for the worst bone/magnitude live), and self-heals non-finite /
>6 rad bones back to bind. This is how Bug A was pinpointed (`rigMax()` → `bone: 'neck'`).

**Bug B — spring integration (separate, also fixed; see below).**

## ⚠ Spring integration MUST be semi-implicit (mesh-collapse bug)

**Symptom:** during long autoplay the whole batsman mesh collapses into a blob after ~10–20
deliveries; a page refresh fixes it (stateful, not a load bug).

**Root cause:** the contact lock multiplies spring damping up to ×10
(`springDampingMult = 1 + lockWeight*9` in AnimationBrain). The springs (`springs.ts`,
`BatContact.ts`) used **explicit Euler**: `vel += (−vel·d)·dt`. With `d = 30×10 = 300` and
`dt` clamped to `1/30`, that's `vel *= (1 − d·dt) = (1 − 10) = −9` PER FRAME → exponential
blow-up. The exploded value persists in the spring state (`_stateMap` WeakMap / BatContact
fields) which is **never reset between deliveries** (only on character bind), so each contact
kicks it further until the extremity bones (hands/forearms/head) get garbage rotations.

**Fix:** semi-implicit / implicit-damping integration —
`vel = (vel + stiffness·(target−cur)·dt) / (1 + d·dt)`. Unconditionally stable for any
damping; high damping now FREEZES (the intended impact-lock behaviour) instead of exploding.
Plus a self-heal guard: if a follower goes non-finite or > 1.5 rad from the pose, snap it back.
`BatContact` additionally clamps its step (`min(dt, 1/60)`) against autoplay dt spikes.

**Rule:** never integrate a damped spring with explicit Euler when the damping coefficient can
be scaled at runtime — `damping·dt` can exceed 2 and the scheme goes unstable. Use the implicit
form. (Ruled out as NON-causes: FootGroundingIK isn't wired in; BatRig is dead code; per-frame
LOCO/ROLE/HEAD bind-pose `setRot` and layer-accumulator `begin()` already reset rotations
correctly; all `addPos` is on `hips`, which `applyBPToLoco` resets.)

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
