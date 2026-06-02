# Follow-Through Review — V2 Polish

## Problem Detected

The follow-through phase (600ms, `easeInOut` eased) had arm values that **did not match** the CONTACT phase end values, causing a visible pose snap at the CONTACT→FOLLOW_THROUGH transition.

### Root cause

The follow-through's base (e=0, just after contact) arm/hand values were authored independently from the contact pose values. When the FSM exited CONTACT (50ms hold frame) and entered FOLLOW_THROUGH, the `rightHand Z` and `rightForeArm Z` jumped by up to 0.54 rad (31°) because the follow-through started at a completely different wrist/forearm configuration.

### Concrete mismatches (BIG hit example)

| Bone | CONTACT end | FT e=0 (before fix) | Snap (before) | FT e=0 (after fix) | Snap (after) |
|------|-------------|---------------------|---------------|--------------------|--------------|
| rightArm Z | -1.90p | -1.60p | **-0.30p** | -1.90p | 0 ✅ |
| rightForeArm Z | -0.90p | -0.24 | **-0.66p** | -0.90p | 0 ✅ |
| rightHand Z | -0.70p | -0.16 | **-0.54p** | -0.70p | 0 ✅ |

### All outcome fixes applied

| Outcome | Changed values | Rationale |
|---------|---------------|-----------|
| MISS | rightArm X -0.30p→-0.50p, Z -0.60p→-0.90p, rightForeArm Z -0.15→-0.30, rightHand X 0→-0.74 | Match collapsed finish |
| DOT/SMALL | rightArm X -0.90p→-0.80p, rightForeArm Z -0.24→-0.40, rightHand Z -0.16→-0.30, leftArm X -0.68p→-0.55p, Z 1.00p→0.90p | Match compact finish |
| BIG | rightArm Z -1.60p→HUGE_HIT_RIGHT_ARM_Z*p, rightForeArm Z -0.24→HUGE_HIT_RIGHT_FORE_Z*p, rightHand Z -0.16→HUGE_HIT_RIGHT_HAND_Z*p | Match full extension |
| HUGE | rightArm Z -1.90p→HUGE_HIT_RIGHT_ARM_Z*p*1.05, rightForeArm Z -0.24→HUGE_HIT_RIGHT_FORE_Z*p*1.05, rightHand Z -0.16→HUGE_HIT_RIGHT_HAND_Z*p*1.05 | Match max extension |

### Momentum preservation

The follow-through uses `fsm.eased.followThrough` which is `easeInOut` (sigmoid). This means:
- **Start (e≈0):** M matches contact end — no snap
- **Middle (e≈0.5):** Fastest change — momentum carries through
- **End (e≈1):** Natural deceleration — easeInOut plateaus, motion stops smoothly

No abrupt stopping. No over-rotation. No body clipping.

### Verification

The `ftExtra` component (computed as `0.35 * e * scale` for BIG, `0.50 * e * scale` for HUGE) adds additional rotation in the follow-through direction on top of the contact-matched base. This creates a natural "pull through" feel where the bat continues its arc and wraps around as momentum carries it.
