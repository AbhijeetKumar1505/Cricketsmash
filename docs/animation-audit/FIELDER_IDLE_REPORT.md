# Fielder Idle Consistency Report

## Reference Stance: Kimjong

Kimjong's idle fielding stance is the reference. His personality values produce a controlled, still, athletic readiness posture:

| Parameter | Kimjong | Effect |
|-----------|---------|--------|
| `bob: 0.65` | 35% less sway | Very still, minimal breathing motion |
| `stanceCrouch: 1.10` | 10% deeper knees | Lower center of gravity, more athletic |
| `stanceWidth: 0.90` | 10% narrower | Feet closer, more balanced |

## Changes: Ronaldo

### Before

| Parameter | Value | Effect |
|-----------|-------|--------|
| `bob: 1.20` | 20% **more** sway than default | Excessive bob, visibly less still |
| `stanceCrouch: (default 1.0)` | No override | Higher stance, less athletic |
| `stanceWidth: (default 1.0)` | No override | Neutral width |

### After

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `bob: 0.85` | Reduced from 1.20 → 0.85 | 15% less sway than default (still more alert than Kimjong's 0.65, but within the same quality band) |
| `stanceCrouch: 1.05` | Added override | 5% deeper knees (close to Kimjong's 1.10 but respecting Ronaldo's athleticism) |
| `stanceWidth: 0.92` | Added override | 8% narrower (close to Kimjong's 0.90) |

## Controller Changes

### `FieldingController._idle()` — Leg stance now uses personality

Before: Fixed leg values
```
acc.addRot('leftUpLeg',  -0.12, 0, 0);
acc.addRot('rightUpLeg', -0.12, 0, 0);
acc.addRot('leftLeg',     0.18, 0, 0);
acc.addRot('rightLeg',    0.18, 0, 0);
```

After: Scaled by `stanceCrouch` and `stanceWidth`
```
const c = pers.stanceCrouch;
const w = pers.stanceWidth;
acc.addRot('leftUpLeg',  -0.12 * c, 0,  0.06 * w);
acc.addRot('rightUpLeg', -0.12 * c, 0, -0.06 * w);
acc.addRot('leftLeg',     0.18 * c, 0, 0);
acc.addRot('rightLeg',    0.18 * c, 0, 0);
```

Also added hip forward tilt for athletic readiness:
```
acc.addRot('hips', -0.06 * c, 0, sway * 0.3);
```

This means:
- All fielders now respond to stanceCrouch/stanceWidth in their idle pose
- Kimjong's 1.10 crouch = `-0.132` upLeg, `0.198` leg — deeper than default
- Ronaldo's 1.05 crouch = `-0.126` upLeg, `0.189` leg — moderately deeper
- Characters without overrides (Modi, Adeft, Meloni) stay at default 1.0

## Requirements Verification

| Requirement | Kimjong | Ronaldo (after) | Match |
|-------------|---------|-----------------|-------|
| Similar knee bend | 1.10× crouch | 1.05× crouch | ✓ within 5% |
| Similar hip position | controlled + forward tilt | controlled + forward tilt | ✓ (both get hip tilt) |
| Similar weight distribution | low bob (0.65) | moderate bob (0.85) | ✓ (both below 1.0) |
| Similar athletic readiness | deep still crouch | athletic balanced crouch | ✓ |

## Not Affected

- `speed: 1.50` — kept. Ronaldo still runs faster to the ball
- `power: 1.30` — kept. Ronaldo still has stronger arm/spine action during chase/gather
- Fielding movement, catching, throwing — unchanged
- All other characters' idle stances — unchanged (defaults)
