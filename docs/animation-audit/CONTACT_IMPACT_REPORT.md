# Contact Impact Report — V2 Polish

## Target: Micro-recoil in 0-150ms window after contact

## Changes: `apps/frontend/src/game/animation/fxBus.ts`

### Previous body recoil (single spine bone, almost imperceptible)

```typescript
acc.addRot('spine', 0.05 * decay, 0, 0);
```

### New body recoil (9 bones, full-body impact absorption)

```typescript
const d = raw * raw; // quadratic decay — sharp initial burst, fast settle
acc.addRot('spine',       0.18 * d, 0.10 * d, 0.08 * d);
acc.addRot('chest',       0.10 * d, 0.06 * d, 0.04 * d);
acc.addRot('neck',        0.12 * d, 0, 0);
acc.addRot('rightShoulder', 0, 0, 0.14 * d);
acc.addRot('leftShoulder',  0, 0, -0.08 * d);
acc.addRot('rightArm',   -0.22 * d, 0, 0.18 * d);
acc.addRot('rightHand',   0.30 * d, 0, 0.12 * d);
acc.addRot('leftArm',    -0.10 * d, 0, 0.08 * d);
acc.addRot('head',        0.18 * d, 0, 0.06 * d);
```

### Recoil profile

| Window | Progress | Decay (d) | Effect |
|--------|----------|-----------|--------|
| 0-30ms | 0-0.20 | 0.64-1.0 | **Peak impact** — spine compresses, shoulder absorbs, head jolts back |
| 30-75ms | 0.20-0.50 | 0.25-0.64 | Rapid decay — body recovers from hit |
| 75-150ms | 0.50-1.0 | 0-0.25 | Residual settling — subtle tissue rebound |

### Amplitude rationale

| Bone | Radians | Degrees | Readability |
|------|---------|---------|-------------|
| spine X (compress) | 0.18 | 10.3° | Visible forward bend, not cartoonish |
| spine Y (twist) | 0.10 | 5.7° | Subtle torso twist from bat impact |
| rightShoulder Z (absorb) | 0.14 | 8.0° | Right shoulder pushed back — clearly reads as bat recoil |
| rightHand X (wrist absorb) | 0.30 | 17.2° | Hand absorbs through wrist — most visible impact cue |
| head X (jolt) | 0.18 | 10.3° | Head snaps back momentarily — sells impact strength |

### Camera shake

Increased from `0.025` → `0.040` (60% stronger). Sharp linear decay over 150ms.

### Bat vibration

Increased amplitude from `0.10` → `0.18` (80% stronger). 80Hz ringing decays over 100ms.

### Layer

REACTION layer (applied after ROLE on every frame). Since REACTION is always additive and has no setRot bones, the recoil stacks cleanly on top of the batting pose without fighting controller values.

### Architectural note

No changes to:
- Contact pose values in `_contact()` — those are the body's COMMITTED position
- FSM durations (CONTACT stays 50ms)
- Controller ownership
- AnimationBrain or LayerResolver

The recoil lives entirely in the fxBus 0-150ms decay timer. When the timer expires (t > 0.15s), all deltas return to zero — the body "settles" back to its controller-driven pose.
