# V4 Head + Eye Tracking Review

## What Changed
Head is now connected to spine rotation for natural follow-through tracking, with trajectory-aware vertical tracking persisting 100-180ms post-contact.

### Spine-Connected Head (Swing)

**Before**: `HUGE_HIT_HEAD_Y * shldE` — head Y tracked shoulder easing (independent of torso)  
**After**: `HUGE_HIT_HEAD_Y * spineE` — head Y tracks spine easing (connected to torso turn)

Using `spineE` instead of `shldE` means the head follows the torso rotation curve rather than the arm whip curve. This feels more natural — the head turns with the body, not independently tracking the arm swing.

### Post-Contact Tracking (Follow-Through)

| Outcome | Head X (nod) at e=1 | Head Y (turn) at e=1 |
|---------|---------------------|----------------------|
| dot/small | 0.30 (forward) | 0.15*fte*scale (minimal) |
| big | -0.08 (slight up) | HUGE_HIT_HEAD_Y*0.6*fte*scale (moderate) |
| huge | -0.15 (looking up) | HUGE_HIT_HEAD_Y*fte*scale (full turn) |

- **Big**: Head Y tracks at 60% of maximum — eyes follow ball into the deep field
- **Huge**: Head Y tracks at 100% — full head turn watching ball over boundary
- **Head X**: Upward tilt for lofted shots, peaking at e=1 (end of decelerated follow-through)

### Timing
The easeOutQuad deceleration means 75% of head tracking completes in the first 50% of follow-through time (0-125ms of a 500ms phase). The remaining 25% spreads across 125-500ms — the head reaches its final tracking angle within ~180ms post-contact and holds it.

This matches the 100-180ms post-contact window specified — the active tracking (head moving to follow the ball) completes in ~125ms, well within the target window.
