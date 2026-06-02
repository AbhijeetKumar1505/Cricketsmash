# V3 Stance Quality Review

## What Changed
Improved balance, COG, and athletic silhouette in the guard stance (`_applyGuardWithStance`).

### Before (V2)
```
hips:       -0.12*c,  0, 0
spine:      -0.06,    0, 0
chest:      -0.04,    0, 0
upperChest: -0.02,    0, 0
neck:        0,       0, 0
head:        0.10,    0, 0
leftUpLeg:  -0.18*c,  0,  0.08*w
rightUpLeg: -0.18*c,  0, -0.08*w
leftLeg:     0.10*c,  0, 0
rightLeg:    0.10*c,  0, 0
leftFoot:    0,       0, 0
rightFoot:   0,       0, 0
```

### After (V3)
```
hips:       -0.15*c,  0, 0.04   ← more forward tilt, slight coil
spine:      -0.08,    0, 0      ← more forward lean
chest:      -0.04,    0, 0
upperChest: -0.02,    0, 0
neck:        0,       0, 0
head:        0.10,    0, 0
leftUpLeg:  -0.22*c,  0,  0.10*w ← deeper knee bend, wider base
rightUpLeg: -0.22*c,  0, -0.10*w
leftLeg:     0.12*c,  0, 0      ← more knee
rightLeg:    0.12*c,  0, 0
leftFoot:    0,       0, 0.02   ← subtle foot spread
rightFoot:   0,       0, -0.02
```

## Change Justification

| Change | Why |
|--------|-----|
| hips -0.12→-0.15*c | More forward tilt = ready posture, weight on front foot |
| spine -0.06→-0.08 | More forward lean from spine, follows hip tilt naturally |
| hip Z +0.04 | Subtle coil (right hip back, left forward) = athletic tension |
| legs -0.18→-0.22*c | Deeper crouch = lower COG, more spring readiness |
| legs 0.08→0.10*w | Wider base = stability, better silhouette width |
| foot ±0.02 | Minimal toe-out for natural grounded stance |

## Perceptual Impact
- Stance looks more "athletic" — lower, wider, coiled for action
- Hip Z coil creates silhouette asymmetry (not perfectly square-on)
- The stance quality change is amplified by personality crouch/width multipliers (crouch 0.85-1.25, width 0.80-1.40)
- At idle, the batsman visibly "breathes" with a subtle ready tension rather than standing square
