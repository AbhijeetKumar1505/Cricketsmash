# V5 Bat Stance Refinement Review

## What Changed
Two corrections to seat the bat naturally in the batsman's grip: grip offset adjustment and wrist pronation correction.

### 1. Grip Offset (Renderer.ts)
**Before**: `0.10` (bat offset along handle from right hand position)  
**After**: `0.085` (reduced by 1.5cm)

The grip offset is the distance the bat is positioned along its handle axis (+Y in bat local space) from the right hand's world position. Reducing from 0.10→0.085 moves the bat 1.5cm closer to the hand, seating the grip deeper in the palm instead of floating at the wrist joint.

### 2. Wrist Pronation (BattingController.ts:_applyGuardWithStance)
**Added**: `acc.addRot('rightHand', 0, 0, -0.05)`

A -2.9° Z rotation on the right hand corrects the wrist angle so the bat handle sits naturally in the palm. Pronation rotates the palm downward/outward — the natural hand position for gripping a cricket bat handle.

### Combined Effect at Idle
The right hand now has:
- GUARD_POSE: (0.06, 0, -0.14) — base wrist angle
- _idleArmGuard: (0.04, 0, -0.08) — idle arm guard
- _applyGuardWithStance: (0, 0, -0.05) — V5 pronation correction
- **Total**: (0.10, 0, -0.27) = 5.7° flexion + 15.5° pronation

During batting phases (backlift/swing/contact/follow-through), the stance correction stacks additively on the phase-specific hand rotations, maintaining consistent bat angle throughout the swing cycle.
