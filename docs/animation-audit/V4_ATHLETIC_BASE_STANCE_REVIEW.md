# V4 Athletic Base Stance Review

## What Changed
Complete stance retune in `_applyGuardWithStance` for a lower, more athletic ready position.

### Body Position Changes (V3 → V4)

| Bone | V3 | V4 | Effect |
|------|----|----|--------|
| hips Y pos | — | -0.055 | Lowered centre of gravity ~5.5cm |
| hips X | -0.15*c | -0.18*c | More forward hip tilt (10°→13°) |
| spine X | -0.08 | -0.10 | More forward lean |
| chest X | -0.04 | -0.08 | Pronounced chest lean |
| upperChest X | -0.02 | -0.04 | Ready upper body pitch |
| leftShoulder Z | — | 0.03 | De-squared shoulders (coil ready) |
| rightShoulder Z | — | -0.03 | De-squared shoulders |
| leftUpLeg X | -0.22*c | -0.28*c | Softer knees (deeper crouch) |
| leftLeg X | 0.12*c | 0.16*c | More knee bend |
| rightLeg X | 0.12*c | 0.16*c | More knee bend |

### Silhouette Goals
- **Lower COG**: body crouches into the crease, ready to spring forward or back
- **Forward lean**: weight over front foot, bat ready to come down
- **Soft knees**: suspension for rapid direction change (dance down the pitch or back)
- **De-squared shoulders**: subtle coil creates asymmetry — reads as athletic tension, not static square-on

### Perception
At idle, the batsman now reads as coiled and explosive rather than upright and waiting. The 5.5cm hip drop is sub-threshold on its own but combined with knee bend + forward lean creates a qualitatively different silhouette — "ready to launch" vs "waiting to bat."
