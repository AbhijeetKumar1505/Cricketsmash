# V3 Kinetic Chain Delay Review

## What Changed
Widened the lead offsets between kinetic chain segments so the energy transfer from hips→spine→chest→shoulder→forearm is visibly sequential.

### Before (V2)
| Segment | Lead | Gap from previous |
|---------|------|-------------------|
| Hips    | 0.00 | —                 |
| Spine   | 0.20 | 44ms              |
| Chest   | 0.35 | 33ms              |
| Shoulder| 0.50 | 33ms              |
| Forearm | 0.55*| 11ms              |

### After (V3)
| Segment | Lead | Gap from previous |
|---------|------|-------------------|
| Hips    | 0.00 | —                 |
| Spine   | 0.25 | 55ms              |
| Chest   | 0.40 | 33ms              |
| Shoulder| 0.55 | 33ms              |
| Forearm | 0.62 | 15ms              |

### Forearm/Wrist Window
- **Before**: compressed window starting at 0.55 (armT = clamp((linearT - 0.55) / 0.45, 0, 1))
- **After**: shifted to FOREARM_START = 0.62 (forearmT = clamp((linearT - 0.62) / (1 - 0.62), 0, 1))
- Wrist snap compressed to last 50% of forearm easing: `wristT = clamp((foreE - 0.50) / 0.50, 0, 1)`

## Perceptual Impact
- At 220ms swing: 55ms hip→spine gap (~3 frames at 60fps) — clearly perceptible
- Shoulder starts at 121ms — well after hip (0ms), spine (55ms), chest (88ms)
- Energy visibly "travels up" the body: hips unwind → torso follows → shoulder whips → forearm fires → wrist snaps
- Forearm fires in 38ms window (0.62→1.0 at 220ms) — feels whippy
- Wrist snap compressed to last ~19ms — creates the "crack" feel at impact

## Testing
- Should see: hips rotate first → torso follows → shoulder fires late → forearm/wrist snap through contact
- At 0.5x speed in dev controls, the sequential chain should be clearly readable
