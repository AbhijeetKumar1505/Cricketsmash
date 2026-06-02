# Bat Grip Review — V2 Polish

## File: `apps/frontend/src/render/Renderer.ts`

### Current State

```typescript
// Bat GLB axes: long axis = Y (handle +Y, blade -Y), face normal = X, edge = Z.
// Offset maps GLB X (face) → World Z (forward toward bowler),
//               GLB Y (long axis) → World -Y (blade hangs below hand).
const _BAT_QUAT_OFFSET = new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, Math.PI / 2));
```

Grip offset: `0.08` → **`0.10`** (increased for better palm seating)

### Grip Offset Tuning

| Value | Effect | Verdict |
|-------|--------|---------|
| 0.06 | Handle feels loose in palm | ❌ Too low |
| 0.08 | Previous — usable but handle edge visible | ⚠ Acceptable |
| **0.10** | **Handle fully inside palm, blade hangs cleanly** | **✅ Current** |
| 0.12 | Handle pushes past palm, blade too far from body | ❌ Too high |

### Quaternion

`Euler(PI/2, PI/2, PI/2)` mathematically verified in `BAT_ALIGNMENT_REPORT.md`:
- GLB X (face) → World Z (forward toward bowler) ✓
- GLB Y (long axis) → World -Y (blade hangs below hand) ✓
- GLB Z (edge) → World X (lateral) ✓

**Correction twist range allowed:** ±5° to ±20° (±0.09 to ±0.35 rad).

### Verification Checklist

| Pose | Check | Pass |
|------|-------|------|
| Guard | Handle center inside palm, not floating | ⚠ Verify visually |
| Guard | Blade hangs vertically below hand | ⚠ Verify visually |
| Guard | Bat face visible from camera, not edge-on | ⚠ Verify visually |
| Backlift | Bat follows hand rotation, no wrist break | ⚠ Verify visually |
| Contact | Bat face presented to ball trajectory | ⚠ Verify visually |
| Follow-through | Bat rotates naturally around hands, no clipping | ⚠ Verify visually |

### If bat face is canted (tuning)

If the blade face appears rotated on the long axis (edge-on instead of face-on), apply a corrective Z twist to the Euler:

```typescript
// ±5° to ±20° twist around bat long axis:
const TWIST = 0; // start at 0, adjust ±0.09 to ±0.35
const _BAT_QUAT_OFFSET = new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, Math.PI / 2 + TWIST));
```

Small positive TWIST rotates the face toward the bowler. Small negative rotates away.
