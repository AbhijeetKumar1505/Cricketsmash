# V4 Follow-Through Momentum Review

## What Changed
Transformed follow-through from target-pose interpolation to momentum continuation with natural energy decay.

### Additions to Big/Huge Outcomes

#### Chest Continuation
Chest Y rotation now persists and slightly increases through follow-through:
```
chest: totalRot * CHEST_SHARE + ftExtra * CHEST_SHARE
```
The `ftExtra` component adds ~15° extra chest rotation (scaled by outcome × personality) so the torso doesn't stop at contact — it keeps rotating from momentum.

#### Shoulder + Wrist Continuation
Arms continue their arc past the contact position:
```
rightArm: base + ftExtra continuation (1.00 for big, 1.60 for huge)
rightForeArm: base + 0.45/0.70 continuation
rightHand: base + 0.22/0.40 continuation (wrist fully releases)
```

#### Rear Foot Pivot
```
big:  rightFoot Z = 0.12*fte*scale  (foot spins 7°)
huge: rightFoot Z = 0.20*fte*scale  (foot spins 11°)
huge: rightFoot X = 0.08*fte*scale  (heel stays up)
```

The rear foot pivot shows weight has fully transferred — the foot rotates to track the follow-through arc.

#### Torso Rotation Persistence
The spine Z (side bend) continues:
```
big:  spine Z = 0.22*fte*scale
huge: spine Z = 0.40*fte*scale
```

### Deceleration Curve
V3's easeOutQuad re-easing already front-loads 75% of motion into the first 50% of follow-through time. V4 adds momentum continuation on top — the bones don't just move toward a target pose, they continue rotating past the contact position and only settle as energy bleeds away.

### Perception
Instead of seeing the batsman hit a pose and hold it, the viewer sees:
1. Torso keeps rotating through contact (momentum carry)
2. Arms wrap around (follow-through arc completes)
3. Rear foot pivots (weight fully committed)
4. Body settles into finish (energy dissipated)

This creates the "hit and watch" feel — the batsman's body language says the ball has already left and they're along for the ride.
