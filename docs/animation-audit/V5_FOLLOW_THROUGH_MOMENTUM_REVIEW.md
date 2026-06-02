# V5 Follow-Through Momentum Review

## What Changed
Strengthened V4's momentum continuation — increased arm/wrist continuation rates and foot pivot angles for a more natural energy-decay feel.

### V4 → V5 Continuation Changes

| Parameter | V4 Big | V5 Big | V4 Huge | V5 Huge |
|-----------|--------|--------|---------|---------|
| ftExtra base | 0.35 | 0.40 | 0.50 | 0.55 |
| rightArm continuation | 1.00 | 1.15 | 1.60 | 1.75 |
| rightForeArm continuation | 0.45 | 0.50 | 0.70 | 0.80 |
| rightHand continuation | 0.22 | 0.28 | 0.40 | 0.45 |
| rightFoot Z | 0.12 | 0.12 | 0.20 | 0.22 |

### Deceleration Curve (easeOutQuad)
All continuation values use `fte = easeOutQuad(e)` — the front-loaded deceleration from V3:
- 0-50% of follow-through time: 75% of continuation completes
- 50-100% of follow-through time: 25% of continuation completes

### Per-Phase Momentum
**BIG**: Shoulder wraps +3.3° more, forearm extends +2.9° more, wrist snaps +1.6° more than V4. Rear foot pivot unchanged (already sufficient at 6.9°).

**HUGE**: Shoulder wraps +5.7° more, forearm extends +4.6° more, wrist snaps +2.9° more than V4. Rear foot pivot increased 0.20→0.22 (12.6° total).

The stronger continuation creates a "body swept along by the swing" feel — the batsman doesn't stop at contact, the momentum carries the chest, shoulders, arms, and bat through the full arc before the body settles into the finish pose.
