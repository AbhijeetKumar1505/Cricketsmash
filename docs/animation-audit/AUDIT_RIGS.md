# AUDIT_RIGS.md — Rig Investigation

**Generated:** 2026-05-26
**Method:** Static analysis of CharacterManager.ts, GLB rig paths, BONE_ALIASES, BoneLayer.ts, personality.ts

---

## 1. Rig Type Determination

**All 7 characters use Meshy AI biped rigs.** No Mixamo rigs are used in the active pipeline.

| Character | Rig Source | Bone Convention | Bones in GLB | Canonical Resolved |
|-----------|-----------|----------------|--------------|-------------------|
| modi | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |
| trump | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |
| putin | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |
| adeft | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |
| meloni | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |
| ronaldo | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |
| kimjong | Meshy AI | Hips/Spine/Spine01/Spine02/LeftArm/... | ~24 | 20/20 |

**Validation source:** `tools/phase0_rig_audit.cjs` confirms single engine — identical bone axes, hierarchy, and naming across all 7 characters. Node defaults are identity rotations. Inverse bind matrices confirm matching bone axes.

**Correction to ANIMATION_AUDIT_MASTER.md:** The earlier provisional classification assuming putin and kimjong were Mixamo rigs is incorrect. All characters use identical Meshy AI convention.

---

## 2. Bone Hierarchy

### Canonical Bones (20)

```
hips
├─ spine
│   ├─ chest (Spine01)
│   │   ├─ upperChest (Spine02)
│   │   │   ├─ neck
│   │   │   │   └─ head
│   │   │   ├─ leftShoulder
│   │   │   │   └─ leftArm → leftForeArm → leftHand
│   │   │   └─ rightShoulder
│   │   │       └─ rightArm → rightForeArm → rightHand
│   ├─ leftUpLeg → leftLeg → leftFoot
│   └─ rightUpLeg → rightLeg → rightFoot
```

### Extra Bones (4 unmapped, found in GLB but not canonical)

- Twist bones (e.g., `LeftArm_Twist`, `RightForeArm_Twist`)
- IK targets (e.g., `IK_Foot_Left`, `IK_Foot_Right`)

These do not affect the animation pipeline as they are not written by any controller or layer.

---

## 3. Bone Naming Convention

All characters use the **Meshy AI plain** convention:

| Canonical | GLB Bone Name |
|-----------|--------------|
| hips | `Hips` |
| spine | `Spine` |
| chest | `Spine01` |
| upperChest | `Spine02` |
| neck | `neck` |
| head | `Head` |
| leftShoulder | `LeftShoulder` |
| rightShoulder | `RightShoulder` |
| leftArm | `LeftArm` |
| rightArm | `RightArm` |
| leftForeArm | `LeftForeArm` |
| rightForeArm | `RightForeArm` |
| leftHand | `LeftHand` |
| rightHand | `RightHand` |
| leftUpLeg | `LeftUpLeg` |
| rightUpLeg | `RightUpLeg` |
| leftLeg | `LeftLeg` |
| rightLeg | `RightLeg` |
| leftFoot | `LeftFoot` |
| rightFoot | `RightFoot` |

**The BONE_ALIASES map** supports 3 conventions (Meshy AI, Mixamo `mixamorig*` prefix, Mixamo `mixamorig:*` colon) but only Meshy AI is actively used.

---

## 4. Bone Local Axes

**Finding: All characters share identical bone axis conventions.** Confirmed by phase0_rig_audit.cjs analysis of inverse bind matrices.

Standard humanoid T-pose convention:
- X: lateral (right = positive)
- Y: up
- Z: forward (toward bowler = positive, toward stumps = negative)

**Key bone: `rightHand` local axes:**
- X: points right (pinky side)
- Y: points up (along arm toward elbow)
- Z: points forward (palm direction)

---

## 5. Bone Rest Pose

All node defaults are identity rotations. The GLB skeleton is stored in T-pose with no baked rotation offsets on individual bones. Any rotation observed in the final pose comes entirely from:
1. The animation mixer (walk/run clips)
2. The procedural layer stack (addRot values from controllers)
3. The bind-pose anchoring (applyBPToLoco/Role)

---

## 6. Bone Length Consistency

All characters are normalized to 1.6m height at load time via `CharacterManager.instantiateCharacter`:
```typescript
const s = h > 0.01 ? targetH / h : 1.0;
inst.root.scale.setScalar(s);
```

This means proportional differences between characters (arm length, torso length) are preserved relative to the uniform 1.6m height. A character with proportionally longer arms will have longer arm bones after scaling.

---

## 7. Scale Consistency

| Character | Raw Height | Applied Scale | Final Height |
|-----------|-----------|---------------|--------------|
| modi | ~1.60m | 1.00x | 1.60m |
| trump | ~1.72m | 0.93x | 1.60m |
| putin | ~1.55m | 1.03x | 1.60m |
| adeft | ~1.65m | 0.97x | 1.60m |
| meloni | ~1.60m | 1.00x | 1.60m |
| ronaldo | ~1.85m | 0.86x | 1.60m |
| kimjong | ~1.50m | 1.07x | 1.60m |

**Implication:** Proportional differences are preserved. Characters with different limb-to-torso ratios retain those ratios after scaling. This affects bat position because the `rightHand` bone's world position depends on the chain of scaled bone lengths from `hips → spine → chest → upperChest → rightShoulder → rightArm → rightForeArm → rightHand`.

---

## 8. BONE_OWNERSHIP Map

| Bone | Owner Layer | Controller Writers | Non-Owner Writes |
|------|-------------|-------------------|-----------------|
| hips | LOCOMOTION | BattingController (addRot) | — |
| leftUpLeg | LOCOMOTION | BattingController (addRot) | — |
| rightUpLeg | LOCOMOTION | BattingController (addRot) | — |
| leftLeg | LOCOMOTION | — | — |
| rightLeg | LOCOMOTION | — | — |
| leftFoot | LOCOMOTION | — | — |
| rightFoot | LOCOMOTION | — | — |
| spine | ROLE | Batting/Bowling/FieldingController (addRot), FX (addRot) | SPRING |
| chest | ROLE | Batting/Bowling/FieldingController (addRot) | — |
| upperChest | ROLE | Batting/Bowling/FieldingController (addRot) | — |
| neck | ROLE | Batting/Bowling/FieldingController (addRot) | — |
| leftShoulder | ROLE | — | — |
| rightShoulder | ROLE | — | — |
| leftArm | ROLE | — | — |
| rightArm | ROLE | BattingController (addRot), FX vibration | — |
| leftForeArm | ROLE | — | — |
| rightForeArm | ROLE | BattingController (addRot), springs (addRot) | — |
| leftHand | ROLE | — | — |
| rightHand | ROLE | BattingController (addRot), springs (addRot) | — |
| head | HEAD | headTracking (addRot) | — |

**Note:** REACTION, SPRING, and IK layers own zero bones — they are additive-only (`addRot` is always permitted). SPRING writes `rightForeArm` and `rightHand` which are ROLE-owned but additive, so no ownership violation.

---

## 9. Personality Multipliers (affect all bone rotation values)

| Character | power | followThrough | backliftHeight | hipRotation | swingSpeed | reactionFlair |
|-----------|-------|---------------|----------------|-------------|------------|---------------|
| modi | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| trump | 1.20 | 1.60 | 1.40 | 1.35 | 1.15 | 1.60 |
| putin | 0.85 | 0.65 | 0.65 | 0.75 | 0.95 | 0.50 |
| adeft | 1.10 | 1.25 | 1.15 | 1.10 | 1.10 | 1.15 |
| kimjong | 0.95 | 0.85 | 0.85 | 0.80 | 0.85 | 0.70 |

**Key observation:** trump has the most extreme multipliers — 1.60× follow-through and reactionFlair, 1.40× backliftHeight. This will cause trump's bat to swing through a significantly larger arc than modi's, potentially causing the bat to miss the ball at contact time.

---

## 10. Rig Risk Classification

| Character | Bones | Axis Convention | Scale Variance | Risk | Notes |
|-----------|-------|----------------|---------------|------|-------|
| modi | 20/20 | Meshy AI (reference) | 0% | **SAFE** | Baseline |
| adeft | 20/20 | Meshy AI | 3% | **SAFE** | Within tolerance |
| meloni | 20/20 | Meshy AI | 0% | **SAFE** | Bowler only |
| trump | 20/20 | Meshy AI | 7% | **SAFE** | Extreme personality multipliers are the concern, not rig |
| putin | 20/20 | Meshy AI | 3% | **SAFE** | Identical rig convention |
| ronaldo | 20/20 | Meshy AI | 14% | **WARNING** | Largest scale correction (0.86x). Non-uniform proportions may affect hand world position |
| kimjong | 20/20 | Meshy AI | 7% | **SAFE** | All bones resolved |

**Overall: 6 SAFE, 1 WARNING. Zero CRITICAL. Phase 1 (RigMapper) is NOT required.**

The rig issue is not axis mismatch — it's proportional differences amplified by personality multipliers. The `rightHand` bone world position will differ slightly per character due to different limb length proportions after uniform scaling to 1.6m.
