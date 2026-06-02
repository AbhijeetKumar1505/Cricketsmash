# Bat Alignment Report

## Before / After

| Axis | Before (`Euler(-PI/2, 0, PI/2)`) | After (`Euler(PI/2, PI/2, PI/2)`) |
|------|----------------------------------|------------------------------------|
| **Bat long axis (GLB Y)** | → World Z (forward, like a sword) | → World -Y (hangs below hand) |
| **Face normal (GLB X)** | → World X (lateral, edge-on to bowler) | → World Z (faces bowler) |
| **Edge (GLB Z)** | → World -Y (pointing at ground) | → World X (sideways, correct) |
| **Grip offset** | Wrist position only (handle floating) | +0.08m along handle direction (seated in palm) |

## Rationale

The previous `_BAT_QUAT_OFFSET` was chosen "roughly correct" without verification against actual rig geometry. Proof shows it produced a sword-like forward-pointing bat with the thin edge facing the ground and the broad face sideways — fundamentally wrong orientation.

### Mathematical Verification

Let the offset quaternion Q satisfy:
- `Q * GLB_X = World_Z` (face points forward toward bowler)
- `Q * GLB_Y = World_-Y` (blade hangs below hand)
- `Q * GLB_Z = World_X` (edge is lateral, not visible from front)

Solving the rotation matrix yields `Q = Euler(PI/2, PI/2, PI/2)` in `XYZ` order.

**Proof (quaternion form, `Q = (0, √2/2, 0, √2/2)`):**

Q applied to GLB X (1,0,0):
```
cross(q.xyz, v) = cross((√2/2,0,√2/2), (1,0,0)) = (0, √2/2, 0)
2 * cross(q.xyz, (0, √2/2, 0)) = 2 * (-1/2, 0, 1/2) = (-1, 0, 1)
v' = (1,0,0) + (-1,0,1) = (0,0,1) = World_Z  ✓
```

Q applied to GLB Y (0,1,0):
```
cross(q.xyz, v) = cross((√2/2,0,√2/2), (0,1,0)) = (-√2/2, 0, √2/2)
2 * cross(q.xyz, (-√2/2, 0, √2/2)) = 2 * (0, -1, 0) = (0, -2, 0)
v' = (0,1,0) + (0,-2,0) = (0,-1,0) = World_-Y  ✓
```

### Grip Offset

Bat GLB origin is at the grip/blade junction. Hand bone `matrixWorld` origin is at the wrist joint. Without offset the handle floats above the palm by ~8cm. Offset along the bat's local +Y (handle direction) by 0.08m seats the grip in the palm. Reuses `_tmpBatScale` as scratch — zero allocation overhead.

## All-Character Safe

Validated against all 7 Meshy AI rigs in `AUDIT_RIGS.md` — identical hand bone axes across all characters. No per-character offset needed.

## Remaining Risk

The offset has not been visually verified against a real cricket bat GLB mesh. If the face normal or edge axis in the GLB is different from the convention assumed above, the offset should be adjusted. To verify:

1. Load the bat GLB in a viewer, note which axis the flat face faces
2. If face = ±Z instead of ±X, change to `Euler(PI/2, 0, PI)`
3. If there's a different convention, recalculate using the same methodology above

The current best-guess convention (face = X, long axis = Y, edge = Z) is based on the dimensions table in `AUDIT_BAT.md` which shows the 0.104m (X) dimension as the width (face) and 0.044m (Z) as the thickness (edge).
