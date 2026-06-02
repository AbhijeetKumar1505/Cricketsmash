# V4 Real Weight Transfer Review

## What Changed
Added visible body mass transfer cues across all batting phases so the viewer feels weight moving from back foot → front foot through the shot.

### Phase Changes

#### BACKLIFT — Rear Leg Loading
```
rightUpLeg:  -0.06*e  — rear knee compresses (weight settles back)
rightLeg:     0.06*e  — more rear knee bend
leftUpLeg:    0.03*e  — front leg relaxes (weight leaves front foot)
leftLeg:     -0.03*e  — front knee straightens slightly
```

At e=1 (fully loaded):
- Rear knee: +0.06 rad (3.4°) more compression
- Front knee: -0.03 rad (1.7°) relaxation
- Net effect: visible sinking into back foot, front leg lightens

#### SWING — Forward Drive
```
leftLeg:     -0.08*hipE  — front knee straightens as weight transfers forward
rightFoot:    0.12*hipE  — rear heel lifts as weight leaves back foot
```

At hipE=1 (contact):
- Front leg: -0.08 rad (4.6°) straightening — lead leg firms
- Rear heel: 0.12 rad (6.9°) lift — toe pivot, weight off back foot

Hip Z opening increased from 0.12→0.18*hipE (pelvis opens through the shot — the rear hip drives through and the front hip braces).

#### CONTACT — Front Stabilisation
```
leftLeg:     -0.08 (big) / -0.10 (huge)  — lead leg firm brace
rightFoot:    0.15 (big) /  0.20 (huge)  — rear heel up, weight through
```

For huge hits: rightFoot Z = 0.06 — rear foot pivots (showing the rotation)

### Visual Flow
```
LOAD (backlift) → rear knee bends, front leg lightens
DRIVE (swing)   → front knee braces, rear heel lifts, hips open
IMPACT (contact) → lead leg firm, rear foot pivots, body mass through
```

The viewer sees weight move from back foot → front foot across ~500ms of phase time, with each leg's role clearly distinct.
