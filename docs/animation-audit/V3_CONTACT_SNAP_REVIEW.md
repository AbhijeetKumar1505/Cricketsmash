# V3 Contact Snap Review

## What Changed
The contact snap feel comes from the **combination** of widened kinetic chain leads + compressed wrist window — not from changing easing functions or increasing rotation values.

## Why No Easing Change Needed
The existing easing functions already provide correct acceleration profiles:
- `easeSwingAccel` = `easeInQuad` (t²) for hips/spine/chest — accelerates through contact
- `easeWhip` = `easeInCubic` (t³) for shoulder/forearm — even stronger late whip

The key insight is that with widened leads, the **forearm/wrist are far behind the torso at swingT 0.45-0.60**, creating a natural "whip" as they catch up through contact.

## Timing at Contact Zone (swingT 0.80-1.00)

| swingT | Hip  | Spine | Chest | Shoulder | Forearm | Wrist |
|--------|------|-------|-------|----------|---------|-------|
| 0.80   | 64%  | 54%   | 44%   | 17%      | 13%     | 0%    |
| 0.90   | 81%  | 75%   | 69%   | 47%      | 42%     | 0%    |
| 0.95   | 90%  | 86%   | 82%   | 65%      | 61%     | 22%   |
| 1.00   | 100% | 100%  | 100%  | 100%     | 100%    | 100%  |

At swingT=0.80 (well into the contact zone):
- Hips are 64% done — torso rotation is mostly complete
- Forearm is only 13% done — hasn't fired yet
- Wrist hasn't started

At swingT=0.95:
- Hips 90%, Spine 86%, Chest 82% — torso has finished rotating
- Forearm 61% — firing hard (cubic velocity at t=0.61 → ~1.1)
- Wrist 22% — just snapped, velocity ramping up

At swingT=1.00: everything converges. The wrist snaps from 22%→100% in the last 5% of swing time (~11ms).

## Result
The bat accelerates sharply through contact because the distal segments (forearm/wrist) are still ramping up when the proximal segments (hips/spine) are already near full rotation. This is realistic biomechanics — the energy from the torso "whips" through the arm at impact.
