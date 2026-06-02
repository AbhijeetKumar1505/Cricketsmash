# Weight Transfer Report — V2 Polish

## Target: Visible weight moving through the shot

## Problem

Previously weight transfer was primarily horizontal (rootZ shifts -0.20 → +0.25). No vertical component. The batsman appeared to slide laterally without visibly loading and unloading through the legs.

## Solution: Hip Y bobbing

Three-phase vertical weight transfer via `addPos('hips', 0, … , 0)`:

| Phase | Hip Y | Signal |
|-------|-------|--------|
| BACKLIFT | **-0.04 * e * reach** | Weight sinks into rear foot — compressed spring |
| SWING | **+0.05 * hipE** | Weight drives up and forward — spring unloads |
| CONTACT | (carried from swing) | Peak of transfer — weight fully into front foot |
| FOLLOW_THROUGH | (e returns to neutral) | Weight settles, body recovers |

### Root Z (horizontal) — unchanged from V1

| Phase | Before | After |
|-------|--------|-------|
| BACKLIFT rootZ | -0.20 | -0.20 |
| SWING rootZ | -0.20 → +0.25 | -0.20 → +0.25 |
| CONTACT rootZ | 0.20-0.25 | 0.20-0.25 |
| FOLLOW_THROUGH rootZ | lerp(forward, 0) | lerp(forward, 0) |

### Visual arc

The combined horizontal + vertical creates an arc:

```
BACKLIFT:  Z -0.20, Y -0.04  →  "Loading rear foot"
SWING:     Z -0.20→+0.25, Y -0.04→+0.05  →  "Transfer forward + up"
CONTACT:   Z +0.25, Y +0.05  →  "Peak of stroke"
FOLLOW_THROUGH:  Z +0.25→0, Y +0.05→0  →  "Settle"
```

The hip Y rise (+0.05 ≈ 5cm) combined with the rootZ shift (+0.25 ≈ 25cm) produces an unmistakable forward-unloading arc. The batsman doesn't just slide — they push off the back foot, drive through the hips, and rise into the shot.

### How to observe

Watch the batsman's waist height:
- **Backlift:** waist drops 5cm as weight loads onto back foot
- **Swing initiation:** waist rises as hips drive forward
- **Contact:** waist at or above neutral — weight fully transferred
- **Follow-through:** waist returns to neutral as momentum settles

No architecture changes. No new systems. Two `addPos` calls added to existing methods.
