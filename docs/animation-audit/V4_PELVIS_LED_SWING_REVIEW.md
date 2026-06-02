# V4 Pelvis-Led Swing Review

## What Changed
Two changes make the pelvis the clear swing initiator: rotation share redistribution + easing curve change for hips.

### 1. Rotation Share Redistribution (BattingReference.ts)

| Segment | V3 Share | V4 Share | Local rotation | World rotation |
|---------|----------|----------|----------------|----------------|
| HIPS    | 0.22     | **0.26** | 31° (+18%)     | 31° |
| SPINE   | 0.20     | **0.19** | 23°            | 54° |
| CHEST   | 0.16     | **0.15** | 18°            | 72° |
| NECK    | 0.08     | **0.06** | 7°             | 79° |
| **Total** | 0.66   | **0.66** | —              | 79° (unchanged) |

Total world rotation at shoulders stays ~79° (1.38 rad). Only the distribution changes: the pelvis now does 39% of the work (was 33%).

### 2. Hip Easing Change (BattingController.ts:_swing)

**Before**: `hipE = easeSwingAccel(hipT)` = easeInQuad = t²  
**After**: `hipE = easeOutQuad(hipT)` = 1-(1-t)²

Pelvis now pops open early and coasts while the torso catches up:

| swingT | % V3 hipE | % V4 hipE | % spineE | % chestE | % shldE |
|--------|-----------|-----------|----------|----------|---------|
| 0.25   | 6%        | **44%**   | 0%       | 0%       | 0%      |
| 0.50   | 25%       | **75%**   | 11%      | 3%       | 0%      |
| 0.80   | 64%       | **96%**   | 54%      | 44%      | 17%     |
| 1.00   | 100%      | 100%      | 100%     | 100%     | 100%    |

At swingT=0.25 (55ms into 220ms swing), V4 pelvis is 44% done — the viewer sees immediate hip rotation. At this point no other segment has started (spine lead=0.25). The pelvis clearly fires first.

### Sequencing Perception
- **0-55ms**: pelvis alone rotates (no torso movement visible)
- **55-88ms**: spine follows pelvis (world rotation builds)
- **88-121ms**: chest unwinds (world rotation at 48°)
- **121-136ms**: shoulder fires (cubic easing — accelerates through)
- **136-220ms**: forearm whips, wrist snaps at impact
