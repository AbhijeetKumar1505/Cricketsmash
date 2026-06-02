# V3 Ball Connection Review

## What Changed
Added head tracking of ball trajectory after contact for BIG and HUGE outcomes.

### Contact Phase
- **HUGE**: head X changed from +0.15 (looking down) to -0.08 (looking up ~4.6°)
  - At the instant of contact, a massive hit already has the head tilting up to follow the ball
- **BIG**: unchanged (head still forward/level — ball is lower/a ground shot)

### Follow-Through Phase
- **BIG**: head tracking adds -0.30*fte*scale upward component
  - At e=1: head X = 0.15 + 0.22 - 0.30 = +0.07 (slightly forward, appropriate for ball clearing infield)
- **HUGE**: head tracking adds -0.70*fte*scale upward component
  - At e=1: head X = 0.20 + 0.35 - 0.70 = -0.15 (looking up ~8.6°, tracking ball going over boundary)

### Deceleration
Ball tracking uses `fte = easeOutQuad(e)` instead of raw `e`:
- The upward head tilt happens faster early and settles — the ball is tracked in the first half of follow-through, then held
- 75% of head tracking completes in the first 50% of follow-through time

## Perceptual Impact
- At contact, a huge hit already has the head tilting up slightly — conveys "I just hit this to the moon"
- During follow-through, the head smoothly tracks the ball trajectory, following it higher for bigger hits
- Head Y rotation (horizontal tracking) was already working in V2 — V3 adds the vertical component
- The upward tilt combined with the torso rotation creates a realistic "watching the ball" silhouette
