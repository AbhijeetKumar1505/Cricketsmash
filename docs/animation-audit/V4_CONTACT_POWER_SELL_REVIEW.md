# V4 Contact Power Sell Review

## What Changed
Contact frame now matches swing end values for seamless power transfer, with leg/hip adjustments that sell the force of impact.

### Torso Value Matching (Swing End → Contact)

| Bone | Swing t=1.0 | V3 Contact | V4 Contact | Snap fixed? |
|------|-------------|------------|------------|-------------|
| hips X | 0.04 | 0.02 | **0.04** | ✅ Fixed |
| hips Z | 0.12 | 0 | **0.12** | ✅ Fixed |
| spine X | 0.24 | 0.22 | **0.24** | ✅ Fixed |
| spine Z | 0.04 | 0.12 | **0.04** | ✅ Fixed |
| chest X | 0 | 0 | 0 | — |
| neck X | 0.02 | 0.04 | **0.02** | ✅ Fixed |

Previously the contact frame had different torso values than the swing end, creating a 3-7° snap between the last swing frame and the contact frame. Now they match exactly — the kinetic chain flows uninterrupted into the impact frame.

### Power Sell Additions

At the IMPACT frame (big/huge), four things happen simultaneously:

1. **Pelvis at full rotation**: `hips: totalRot * HIP_SHARE` — pelvis is snapped open (31° local rotation for default personality)

2. **Front leg firms**: `leftLeg: -0.08 (big) / -0.10 (huge)` — lead knee straightens to brace against the impact force

3. **Rear heel lifts**: `rightFoot: 0.15 (big) / 0.20 (huge)` — weight fully on front foot, heel up shows drive-through
   - For huge: `rightFoot Z: 0.06` — rear foot begins to pivot (rotation follow-through)

4. **Wrists at full snap**: `rightHand: 0.06 - SWING_WRIST_SNAP` — wrist is fully through the ball

### Perceptual Impact
Rather than the swing ending → contact starting as separate events, the viewer sees the swing flow into impact with:
- No torso snap (matching values)
- Leg firming (force absorption)
- Heel lift (mass transfer)
- Pelvis openness (power channeled through)

The contact frame now reads as "this is where all the energy arrives" rather than "this is the pose for the hit outcome."
