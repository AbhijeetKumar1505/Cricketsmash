# V3 Pre-Swing Anticipation Review

## What Changed
Added a micro-adjustment burst at the end of the BACKLIFT phase (`e > 0.70`, the last ~80ms) so the batsman "loads up" visibly before the swing launches.

### Implementation (`BattingController.ts:_backlift`)
```
if (e > 0.70):
  ant = (e - 0.70) / 0.30  // 0→1 over final 30%
  rightShoulder: add Z -0.06*ant  — bat pulls back a final degree
  rightHand:      add Z -0.05*ant  — wrist cocks final amount
  hips:           add X -0.03*ant  — front foot pressure, forward lean
  spine:          add Y -0.04*ant  — extra torso coil release
```

## What This Fixes
- Previously the batsman held a static backlift pose at the peak — no visible "loading" before the swing
- Now the final 80ms shows: shoulder compression (bat pulled back), wrist set, hip lean forward, spine coil — all tiny but perceptible at 60fps
- Creates anticipation: the viewer sees the batsman "fire" slightly before the swing animation begins

## Perceptual Impact
- Shoulder Z: ~3.4° pull-back (visible as bat head moving another 2-3cm back)
- Wrist Z: ~2.9° extra cock (visible as bat angle change)
- Hip X: ~1.7° forward lean (weight shift readies)
- These are sub-5° values — not cartoonish, just enough to remove the "static" feel

## Overlap Caution
The anticipation burst blends into the SWING phase start via the existing _blendVec3 mechanism (swing blends from captured backlift final pose). The burst values are additive on top of the backlift pose, and the swing starts from that adjusted pose.
