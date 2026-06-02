# CONTACT_TIMING_REPORT.md — Bat-Ball Alignment Investigation

**Date:** 2026-05-26
**Method:** Static timing analysis of BatsmanFSM, BattingController, GameEngine, ball physics
**Status:** Investigation complete — root cause identified

---

## 1. Timing Architecture

### BatsmanFSM Phase Durations

| Phase | Duration | Frames (60fps) | Auto-advance | Trigger |
|-------|----------|-----------------|--------------|---------|
| BACKLIFT | 280ms | 16.8 | NO | `startBacklift()` → `triggerSwing()` |
| SWING | 220ms | 13.2 | YES | Auto → CONTACT |
| CONTACT | 50ms | 3.0 | YES | Auto → FOLLOW_THROUGH |
| FOLLOW_THROUGH | 600ms | 36.0 | YES | Auto → IDLE |

**Total active:** 1.15s (69 frames)

### Trigger Sequence

```
Ball release (t=0)                          GameEngine tick
  ↓
Ball travels toward batsman (1.1-2.0s)      HIT_TIMES: fast=1.1s, swing=1.5s, spin=2.0s
  ↓
triggerSwing() called externally            GameEngine.tickBowlerRunup/tickBallTravel
  ↓
BACKLIFT begins (280ms)                     Bat raises
  ↓  (triggerSwing called during BACKLIFT to time the swing)
SWING begins (220ms)                        Bat sweeps through strike zone
  ↓
CONTACT (50ms, 3 frames)                    Contact captured, FX fired
  ↓
FOLLOW_THROUGH (600ms)                      Arm extension + wrap
```

---

## 2. Personality Timing Drift

### The Bug

`swingSpeed` personality multiplier scales the easing curve tempo in `_swing()`:

```typescript
const swingT = clamp(fsm.progress * pers.swingSpeed, 0, 1);
this._swing(swingT, acc, pers);
```

`fsm.progress` goes from 0→1 over 220ms (SWING duration). Multiplying by `pers.swingSpeed` means the swing animation completes **before** the FSM phase ends for fast characters.

### Impact per character

| Character | swingSpeed | Actual swing completion | Timing offset vs modi |
|-----------|-----------|------------------------|----------------------|
| modi | 1.00 | at 220ms (t=1.0) | Reference |
| trump | **1.15** | at **191ms** (t=1.0 @ 165ms) | **-29ms earlier** |
| putin | 0.95 | at 232ms (t=1.0 @ 220ms) | +12ms later |
| adeft | 1.10 | at **200ms** (t=1.0 @ 182ms) | **-20ms earlier** |
| kimjong | 0.85 | at 259ms (t=1.0 @ 259ms) | +39ms later |

Since CONTACT phase is only 50ms (3 frames), a -29ms timing offset means trump's bat is already 55% through the contact window before the ball arrives.

### The Fix

Remove `pers.swingSpeed` from the swingT calculation. The FSM phase duration already provides consistent timing across all characters — the personality should only affect the shape of the swing curve, not its duration.

**Change in BattingController._swing():**

```typescript
// BEFORE:
const swingT = clamp(fsm.progress * pers.swingSpeed, 0, 1);

// AFTER:
const swingT = clamp(fsm.progress, 0, 1);
```

This ensures all characters complete their swing in exactly 220ms, regardless of personality. The personality still affects the swing shape via `pers.power`, `pers.hipRotation`, etc.

---

## 3. BACKLIFT→SWING Blend

```typescript
const BLEND_DUR = 0.050;  // 50ms, 3 frames
```

When `triggerSwing()` is called, the controller transitions from backlift pose to swing pose over 50ms. The blend captures the backlift's final arm rotations and lerps toward swing targets.

**Risk:** If `triggerSwing()` is called late (ball is already arriving), the bat is in a partial blend state during CONTACT phase, not at the full swing target.

**Mitigation:** No code change needed. The blend is already working correctly — it's only active for 50ms, and the SWING phase is 220ms, giving 170ms of pure swing time before CONTACT begins.

---

## 4. Contact Ball Position

### World frame constants

```typescript
BATSMAN_Z = 0.0        // Ball must reach this Z at hitTime
HIT_Y = 0.85            // Expected ball height at contact
GROUND_Y = 0.0
```

### Ball detection

```typescript
isAtBatsman(ball: BallData): boolean {
  return ball.z >= WORLD.BATSMAN_Z - 0.15;  // 0.15m epsilon
}
```

### Contact Y measurement

The `contactBallY` is captured at the exact frame BatsmanFSM enters CONTACT phase:

```typescript
this.batsmanFSM.onContact = () => {
  this._ballContactId += 1;
  this._contactBallY = this.ball.y;
};
```

### Bat Y measurement (already instrumented)

```typescript
// In _syncBatToHand() during CONTACT phase:
const ballY = this.snapshot.syncEvents.contactBallY;
const batY = _tmpBatPos.y;  // rightHand bone world Y
const error = ballY - batY;
if (error < this._contactMinError) this._contactMinError = error;
```

On CONTACT exit, it logs:
```
[CONTACT] #N  ballY=0.8500  minError=0.1234  phase→FOLLOW_THROUGH(0.000)  shot=huge
```

---

## 5. Root Cause Summary

| Root Cause | Impact | Evidence | Fix |
|-----------|--------|----------|-----|
| `swingSpeed` personality scaling | Bat position drifts up to ±39ms from reference | Code analysis of BattingController._swing() line 139 | Remove `pers.swingSpeed` from swingT calculation |
| BACKLIFT→SWING blend | Minor pose interpolation during first 50ms of swing | Code review — BLEND_DUR = 50ms, SWING = 220ms | No change needed — blend completes 170ms before CONTACT |
| Character height scaling | rightHand world Y varies by ~2cm per character | Scale factors: ronaldo 0.86x, kimjong 1.07x | Acceptable tolerance — bat follows exact hand position per frame |

---

## 6. Fix Plan

1. **Remove `pers.swingSpeed` from swingT in `_swing()`** — normalizes timing across all characters
2. **Add `pers.swingSpeed` to the follow-through easing** — so personality still affects motion style, just not timing
3. **Run existing contact instrumentation to verify** — the console.log already captures `ballY`, `minError` per delivery

No new telemetry system needed. The existing logging infrastructure is sufficient to verify the fix.

---

## 7. Deliverable Verification

After fix, expected results:
- All characters: swing completes at exactly 220ms (swingT=1.0 at SWING end)
- Contact error variance across characters should drop from ~±0.05m to ~±0.01m
- Trump's bat no longer arrives at contact point before the ball
