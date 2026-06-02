# V5 Contact Snap Zone Review

## What Changed
Added an explosive acceleration burst in the swingT 0.48-0.62 window that ramps up quickly and fades to zero by contact — creating impact feel without increasing max rotation values.

### Implementation (`BattingController.ts:_swing`)

```typescript
const snapT = clamp((linearT - 0.48) / 0.14, 0, 1);     // 0→1 over 31ms
const snapE = snapT * snapT;                              // easeInQuad onset
const snapFade = 1 - clamp((linearT - 0.62) / (1 - 0.62), 0, 1);
const snap = snapE * snapFade;

hips:     +0.08 * snap    (pelvis Z snap — 4.6° peak)
spine:    +totalRot*0.02  (spine Y burst — ~2.4° peak)
chest:    +totalRot*0.02  (chest Y burst — ~2.4° peak)
rightArm: -0.05 * snap    (bat begins arc — 2.9° bat-drop)
```

### Timing Profile

| swingT | snapT | snapE | snapFade | snap | Effect |
|--------|-------|-------|----------|------|--------|
| 0.45   | 0     | 0     | 1.0      | 0    | Burst off |
| 0.48   | 0     | 0     | 1.0      | 0    | Burst begins |
| 0.55   | 0.50  | 0.25  | 0.89     | 0.22 | Build-up phase |
| 0.62   | 1.0   | 1.0   | 0        | 0    | Burst ends |
| 0.80   | 1.0   | 1.0   | 0        | 0    | Fully faded |
| 1.00   | 1.0   | 1.0   | 0        | 0    | No residual |

### Effect on Energy Feel
At swingT 0.48, the pelvis (easeOutQuad) is at 73% completion and decelerating. The snap burst injects a fresh +4.6° Z rotation into the pelvis just as the chest and spine are starting their acceleration (chestT=0.133, chestE=1.8%). This creates a second "push" that's felt as the bat whips through the strike zone.

The burst is fully zero by contact (swingT=1.0), so max rotation values are unchanged — only the rate of change in the snap zone increases.
