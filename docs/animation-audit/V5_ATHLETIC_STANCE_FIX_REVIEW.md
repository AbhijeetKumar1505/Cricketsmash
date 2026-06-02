# V5 Athletic Stance Fix Review

## What Changed
Further deepened the athletic stance from V4 with a more forward pelvis hinge, softer knees, and reduced backward spine lean.

### V4 → V5 Changes

| Bone | V4 | V5 | Effect |
|------|----|----|--------|
| hips X | -0.18*c | -0.20*c | Deeper pelvis hinge (11.5°→13°) |
| spine X | -0.10 | -0.14 | More forward lean eliminates backward spine lean |
| chest X | -0.08 | -0.10 | Chest pitches forward further |
| leftUpLeg X | -0.28*c | -0.32*c | Softer knees (1.7° more hip flex) |
| leftLeg X | 0.16*c | 0.20*c | Softer knees (2.3° more knee bend) |
| rightUpLeg X | -0.28*c | -0.32*c | Softer knees |
| rightLeg X | 0.16*c | 0.20*c | Softer knees |
| rightHand Z | — | -0.05 | Wrist pronation (bat seated in palm) |

### Goals Met
- **Hips lower**: Already -0.055 from V4, maintained
- **Pelvis hinge**: -0.20*c gives 11-17° of pelvic tilt across personality range
- **Knees softer**: 0.20*c knee bend (11-17°) vs 0.16*c in V4 (9-14°)
- **Chest forward**: -0.10 (5.7°) lean from vertical
- **COG over feet**: Combined hip drop + forward tilt + knee bend centres mass between front and back foot
- **Reduce backward spine lean**: The GUARD_POSE spine (0.25) is counteracted by -0.14 addRot, resulting in net 0.11 (6.3°) forward — reduced from net 0.15 (8.6°) in V4

### Readability
At idle, the silhouette now reads as coiled, loaded, and ready to spring — the viewer sees a batter about to face a delivery rather than a character model in a waiting state.
