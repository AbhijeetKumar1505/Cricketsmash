# Hit Animation Fix Report

## Summary

Three files modified across the batting animation pipeline to fix contact timing, bat orientation, and swing athleticism. All changes are character-agnostic and work identically across all 7 Meshy AI rigs.

## Changes

### 1. `apps/frontend/src/game/animation/BattingReference.ts` — Constants

| Constant | Before | After | Rationale |
|----------|--------|-------|-----------|
| `MAX_SWING_RAD` | 1.90 | 2.10 | +10% total hip rotation for deeper body coil |
| `HIP_SHARE` | 0.20 | 0.22 | More hip rotation authority |
| `SPINE_SHARE` | 0.18 | 0.20 | More spine separation in kinetic chain |
| `CHEST_SHARE` | 0.15 | 0.16 | Slightly more chest rotation |
| `BACKLIFT_ELBOW_EXTRA` | 1.10 | 1.30 | Deeper elbow cock during backlift |
| `BACKLIFT_WRIST_EXTRA` | 0.55 | 0.65 | More wrist loading |
| `SWING_ELBOW_EXTEND` | 1.27 | 1.40 | Stronger elbow extension through contact |
| `SWING_WRIST_SNAP` | 0.68 | 0.80 | Sharper wrist snap at impact |
| `HUGE_HIT_RIGHT_ARM_Z` | -1.90 | -2.10 | ~10% more arm swing-through |
| `HUGE_HIT_RIGHT_FORE_Z` | -0.70 | -0.80 | ~14% more forearm follow-through |
| `HUGE_HIT_RIGHT_HAND_Z` | -0.48 | -0.55 | ~15% more hand wrap |
| `HUGE_HIT_HEAD_Y` | 0.32 | 0.40 | More head tracking of the ball |

All `HUGE_HIT` targets increased to produce deeper athletic wrap in the follow-through while maintaining consistent bat face angle through contact.

### 2. `apps/frontend/src/game/animation/BattingController.ts` — Logic + Pose Values

**Root cause fix:** Removed `pers.swingSpeed` multiplier from `swingT` calculation:

```
- const swingT = clamp(fsm.progress * pers.swingSpeed, 0, 1);
+ const swingT = clamp(fsm.progress, 0, 1);
```

This eliminates ±39ms timing drift across characters (trump 1.15x → 15% faster swing, kimjong 0.85x → 15% slower). All characters now complete the SWING phase in exactly the 220ms FSM duration, and the ball arrives at a fixed game-engine-determined time. Personality still affects motion shape via `power`, `hipRotation`, `followThrough` — just not swing timing.

**Backlift improvements:**
- Hip load increased: `-0.03→-0.05` (tilt), `-0.18→-0.22` (weight shift)
- Spine counter-rotation added: `0, -0.24*e, 0 → 0.02, -0.30*e, 0.04*e` (coils torso like a spring)
- Shoulder rotation added: left/right shoulders rotate independently for loading
- Right arm lift: `1.68→1.80`, forearm cock: `1.10→1.30`
- Left arm lift: `1.05→1.15`, guide arm extension: `0.68→0.75`
- Head tracking increased: `0.12→0.15`

**Swing improvements:**
- Root step Z: `-0.20→+0.20 → -0.20→+0.25` (more forward drive through contact)
- Hip forward drive: `0.04→0.06`
- Spine Z rotation added: `0→0.04` (spine now contributes lateral bend)
- Neck rotation added: `0, share, 0 → 0.02, share, 0` (head rotates with body)
- Right arm swing-through: `0.40→0.50`
- Left arm guide: `0.30→0.35`
- Head Y tracking: `0.10→0.12`

**Contact improvements:**
- Hip forward drive per outcome: `0→0.02` (weight is through the shot)
- Spine Z rotation added per outcome for lateral bend
- All forearm/hand Z values updated to match new HUGE_HIT targets
- Miss: additional spine Z 0.08 (dropped shoulder)
- Small: spine Z 0.10

**Follow-through improvements (athletic wrapping):**
- Big: `ftExtra` 0.32→0.35, right arm wrap 0.90→1.00, elbow 0.40→0.45, wrist 0.20→0.22
- Huge: `ftExtra` 0.45→0.50, right arm wrap 1.40→1.60, elbow 0.60→0.70, wrist 0.35→0.40
- Head track: big 0.20→0.22, huge 0.30→0.35
- Spine lateral bend: big 0.20→0.22, huge 0.35→0.40

### 3. `apps/frontend/src/render/Renderer.ts` — BAT_QUAT_OFFSET

**Before:** `Euler(-PI/2, 0, PI/2)` — produced a sword-like forward-pointing bat with the thin edge facing down and broad face sideways.

**After:** `Euler(PI/2, PI/2, PI/2)` — bat hangs below hand (blade down), face faces forward toward bowler, edge is lateral.

**Grip offset added:** +0.08m along bat handle direction to seat the grip in the palm instead of floating at the wrist joint. Zero-allocation using existing `_tmpBatScale` scratch vector.

See `BAT_ALIGNMENT_REPORT.md` for full mathematical proof.

## Verification

Existing contact instrumentation in `_syncBatToHand` (line 554+) logs per-delivery `ballY`, `batY`, `minError` to console:

```
[CONTACT] #5 ballY=0.85 batY=0.91 minError=0.07 phase=CONTACT shot=huge
```

To verify the timing fix:
1. Run the game with 3+ characters at the same difficulty
2. Compare `minError` values per character — they should now be similar (±~5ms vs previous ±39ms)

To verify bat alignment:
1. Pause at BACKLIFT phase — bat handle should be in the right hand, blade should hang below
2. Bat face should be visible from camera (broadside), not edge-on

## Remaining Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bat GLB face convention may be Z not X | Bat rotated 90° on long axis | Verify in GLB viewer; change to `Euler(PI/2, 0, PI)` if needed |
| Grip offset (0.08m) may need tuning | Handle visible above hand or still floating | Adjust offset value per visual check |
| `huge` follow-through may clip body | Arm passes through torso | Adjust HUGE_HIT values or cap at 0.95 of max |
| All values chosen analytically, not empirically | May need visual tuning | Iterate via playtest, adjust constants in BattingReference.ts |
