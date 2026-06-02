# V3 Follow-Through Deceleration Review

## What Changed
Applied `easeOutQuad` re-easing to the follow-through progression value `e`, so the follow-through motion front-loads ~75% of its travel into the first half of the phase and decelerates visibly in the second half.

### Before
```
const ftExtra = 0.XX * e * scale;  // e = easeInOut(t)
```
All follow-through motion progressed linearly with `e` — the easeInOut already provided soft start/end, but the motion was spread evenly.

### After
```
const fte = easeOutQuad(e);
const ftExtra = 0.XX * fte * scale;
```
At t=0.25: e≈0.15 → fte≈0.28 (1.9× faster)
At t=0.50: e=0.50 → fte=0.75 (1.5× faster)
At t=0.75: e≈0.85 → fte≈0.98 (nearly done)

### Timing Change

| Time % | Old (easeInOut e) | New (easeOutQuad∘e) | Change |
|--------|------------------|---------------------|--------|
| 0%     | 0.00             | 0.00                | —      |
| 25%    | 0.15             | 0.28                | +87%   |
| 50%    | 0.50             | 0.75                | +50%   |
| 75%    | 0.85             | 0.98                | +15%   |
| 100%   | 1.00             | 1.00                | —      |

## Perceptual Impact
- The batsman rushes through the early follow-through (bat continues momentum)
- Then settles into the finish pose quickly and holds it
- Creates a "momentum lost" feel — the bat decelerates and the body settles
- Without this, the follow-through felt linear and floaty — no sense of gravity or momentum
- The hold at the end (last 25% of time only completes ~2% of travel) gives the eye time to read the finish pose

## Applied To
All follow-through outcomes (dot/small/big/huge) uniformly — the deceleration ratio is constant; what varies is the amplitude (scale × personality).
