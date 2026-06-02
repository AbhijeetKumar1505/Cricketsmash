# Backlift Review — V2 Polish

## Target: Visible stored energy at top of backlift

## Changes: `apps/frontend/src/game/animation/BattingController.ts`

### Shoulder separation — increased 125%

| Bone | Before | After | Effect |
|------|--------|-------|--------|
| `leftShoulder Y` | 0.08 | **0.18** | Left shoulder rotates back — opens the chest, visible torso wind |
| `rightShoulder Y` | -0.10 | **-0.22** | Right shoulder pulls bat further back — deeper cocking position |

The 0.10 rad difference between left and right shoulders creates clear separation that reads as "stored energy." Previously the shoulders barely moved (0.08/0.10 = mild rotation).

### Torso coil — deepened 50%

| Bone | Before | After | Effect |
|------|--------|-------|--------|
| `spine Y` | -0.30 | **-0.40** | Spine counter-rotates deeper — more spring tension |
| `chest Y` | -0.12 | **-0.20** | Chest follows spine — upper body fully coiled |

The spine Y counter-rotation now reaches -0.40 rad (23°) at full backlift. This is the primary "coil" visual — the batsman's back faces the bowler more clearly.

### Wrist loading — progressive at top

```
Before: BACKLIFT_WRIST_EXTRA * lift
After:  BACKLIFT_WRIST_EXTRA * lift * (0.8 + 0.2 * lift)
```

The wrist loads 20% more aggressively in the last ~40% of the backlift rise. At the top (lift=1), the multiplier is 1.0× normal. But at lift=0.5, it's 0.9×. The wrist progressively cocks more as the bat reaches its apex, creating a "loading up" feel.

### Head focus

| Bone | Before | After | Effect |
|------|--------|-------|--------|
| `head X` | 0.15 | **0.18** | Head tilts forward slightly more — locked on ball |

### Hip drop (weight loading)

| Bone | Before | After | Effect |
|------|--------|-------|--------|
| `hips pos Y` | 0 | **-0.04 * e * reach** | Hips drop as weight loads onto rear foot |

This is the visible signal of weight transfer: the batsman's center of gravity lowers as they press into the back foot. Combined with the rootZ shift (-0.20m back), the silhouette clearly shows a loaded ready position.

### Energy storage checklist

| Cue | Before | After | Visible? |
|-----|--------|-------|----------|
| Shoulders wind back | ⚠ Mild | ✅ Clear separation | Both shoulders rotate asymmetrically |
| Spine counter-rotates | ⚠ -0.30 | ✅ -0.40 | Torso fully coiled |
| Wrist cocks at top | ✅ Linear | ✅ Progressive | Extra loading in last phase of lift |
| Head locked in | ✅ 0.15 | ✅ 0.18 | Forward tilt, fixed gaze |
| Weight drops | ❌ None | ✅ -0.04 | Hips lower, rear foot loads |
| Root shifts back | ✅ -0.20 | ✅ -0.20 | Weight clearly behind |
