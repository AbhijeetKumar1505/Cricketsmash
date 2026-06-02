# AUDIT_BAT.md — Bat Attachment Investigation

**Generated:** 2026-05-26
**Method:** Static analysis of Renderer.ts, engine/physics/animationFSM.ts, engine/GameEngine.ts, character scales

---

## 1. Bat Attachment Architecture

The bat is a **world-space child of the THREE.Scene** — NOT a child of the skeleton or any bone.

**Per-frame sync** (`Renderer._syncBatToHand()`, line 519):
```
rightHand.updateWorldMatrix(true, false)
rightHand.matrixWorld.decompose(pos, quat, scale)
bat.position = pos
bat.quaternion = quat × BAT_QUAT_OFFSET
```

**BAT_QUAT_OFFSET:** `Euler(-PI/2, 0, PI/2)` = `Euler(-1.5708, 0, 1.5708)`

**Legacy (deleted) system** used different offset: `Euler(0.18, 0.10, 0.42)` with position `(0.018, -0.055, 0.025)` as child of `handR` bone.

---

## 2. Bat Geometry

Local space where `+Y = bat long axis` (tip toward knob):

| Part | Position (Y) | Size | Material |
|------|-------------|------|----------|
| Grip tape | +0.05m | 0.030 × 0.14 × 0.030 | Dark, rough |
| Handle | -0.12m | 0.026 × 0.22 × 0.026 | Willow, 0.88 rough |
| Blade | -0.50m | 0.104 × 0.52 × 0.044 | Willow, 0.70 rough |

Total bat length: ~0.79m (from grip top at ~+0.12 to blade bottom at ~-0.76)

---

## 3. Bat Position Determinants

The bat's world position depends on:
1. **`rightHand` bone world position** — determined by the chain of bone lengths from `hips → spine → chest → upperChest → rightShoulder → rightArm → rightForeArm → rightHand`
2. **Character scale** — all characters uniformly scaled to 1.6m, but proportional differences preserved
3. **Animation state** — the bat moves with the `rightHand` bone which is driven by the animation pipeline

**Critical: The bat is NOT independently positioned.** It follows the rightHand bone exactly. Any offset error between bat and ball contact is a function of:
- The rightHand bone being in the wrong world position at contact time
- The `_BAT_QUAT_OFFSET` being wrong for the rig's hand orientation
- The ball height prediction being wrong

---

## 4. Contact Timing Architecture

### BatsmanFSM Phase Durations

| Phase | Duration | Auto-advance |
|-------|----------|-------------|
| BACKLIFT | 280ms | NO — waits for `triggerSwing()` |
| SWING | 220ms | YES |
| CONTACT | 50ms (3 frames) | YES |
| FOLLOW_THROUGH | 600ms | YES |

### Contact Detection

**BatsmanFSM** fires `onContact` callback synchronously when entering CONTACT phase:
```typescript
private _enter(phase: BatsmanPhase): void {
  this._phase = phase;
  this._elapsed = 0;
  if (phase === 'CONTACT') this.onContact?.();
}
```

**GameEngine** captures ball Y at the exact frame:
```typescript
this.batsmanFSM.onContact = () => {
  this._ballContactId += 1;
  this._contactBallY = this.ball.y;
};
```

**Ball arrival detection:**
```typescript
isAtBatsman(ball: BallData): boolean {
  return ball.z >= WORLD.BATSMAN_Z - 0.15;  // WORLD.BATSMAN_Z = 0.0
}
```

**Expected hit Y:** `WORLD.HIT_Y = 0.85`

---

## 5. Existing Contact Tracking (already instrumented)

The Renderer already logs contact error per delivery:

```typescript
// On CONTACT entry:
this._contactMinError = Infinity;

// Each CONTACT frame:
const ballY = this.snapshot.syncEvents.contactBallY;
const batY = _tmpBatPos.y;
const error = ballY - batY;
if (error < this._contactMinError) this._contactMinError = error;

// On CONTACT exit:
console.log(
  `[CONTACT] #${n} ballY=${ballY} minError=${_contactMinError} ` +
  `phase→${phase}(${progress}) shot=${shotType}`
);
```

**This means contact error data is already being collected without any code changes.**

---

## 6. Bat Offset Error Sources

### Source A: rightHand bone position variance by character

Since all characters are uniformly scaled to 1.6m but have different proportions, the `rightHand` world position at identical pose will differ:

| Character | Scale | Proportional Arm Length | Expected rightHand Y offset from modi |
|-----------|-------|----------------------|--------------------------------------|
| modi | 1.00x | Reference | 0.00m |
| trump | 0.93x | ~Same proportion | Small |
| putin | 1.03x | ~Same proportion | Small |
| adeft | 0.97x | ~Same proportion | Small |
| meloni | 1.00x | ~Same proportion | 0.00m |
| ronaldo | 0.86x | Longer legs, shorter torso | **Largest deviation** |
| kimjong | 1.07x | ~Same proportion | Small |

**Estimated impact:** < 0.03m for most characters. The fixed `_BAT_QUAT_OFFSET` should work across all Meshy AI rigs since they share identical local axes.

### Source B: Personality multiplier impact on swing timing

| Character | swingSpeed | backliftHeight | followThrough | Impact on contact |
|-----------|-----------|---------------|---------------|-------------------|
| modi | 1.0 | 1.0 | 1.0 | Reference |
| trump | **1.15** | **1.40** | **1.60** | **Faster swing + higher backlift → bat arrives earlier at contact point** |
| putin | 0.95 | 0.65 | 0.65 | Slower, lower swing |
| adeft | 1.10 | 1.15 | 1.25 | Slightly fast |
| kimjong | 0.85 | 0.85 | 0.85 | Slower overall |

**Trump's 1.15× swingSpeed means his bat arrives at the contact point ~15% earlier than modi.** With SWING duration of 220ms, this means the bat passes through the contact zone ~33ms earlier. Since `triggerSwing()` is called externally (not synchronized to personality speed), the bat may have moved past the contact point before the ball arrives.

### Source C: BACKLIFT→SWING blend capture

```typescript
const BLEND_DUR = 0.050;  // 50ms, 3 frames at 60fps
```

When `triggerSwing()` is called during BACKLIFT, the controller transitions from backlift pose to swing pose over 50ms. If `triggerSwing()` is called close to the expected contact time, the bat may still be in the blend (part-way between backlift and swing) when CONTACT phase begins.

### Source D: Hardcoded `_BAT_QUAT_OFFSET`

`Euler(-PI/2, 0, PI/2)` assumes the rightHand bone's local Z axis points in a specific direction for all Meshy AI rigs. The phase0_rig_audit.cjs confirmed all rigs share identical axes, so this offset should be correct for all characters. However, the offset was never verified against a real cricket bat grip — it was chosen to make the bat appear "roughly correct" visually.

---

## 7. Bat Vibration

| Parameter | Value |
|-----------|-------|
| Duration | 100ms |
| Frequency | ~12.7 Hz (80 rad/s) |
| Amplitude | 0.10 rad (5.7°) |
| Axis | Local Y (bat long axis) |
| Decay | Linear over duration |

Applied after `_BAT_QUAT_OFFSET`:
```typescript
this._batsmanBat.quaternion.multiply(this._batVibrateQuat);
```

---

## 8. Summary

| Factor | Mod Impact | Trump Impact | Fix |
|--------|-----------|-------------|-----|
| rightHand bone position variance | None | Low | None needed — axes identical |
| Personality swingSpeed | Reference | HIGH | Normalize swing speed or adjust triggerSwing() timing per character |
| BACKLIFT→SWING blend | Low | Medium (faster swing = less blend time) | Verify triggerSwing() timing or reduce BLEND_DUR |
| _BAT_QUAT_OFFSET correctness | See recommendation | See recommendation | Verify against real rig geometry |

**Recommendation:** The highest-impact investigation target is **personality swingSpeed affecting contact timing**. Run the built-in contact tracking and compare `minError` across characters at the same difficulty level to quantify the timing shift.
