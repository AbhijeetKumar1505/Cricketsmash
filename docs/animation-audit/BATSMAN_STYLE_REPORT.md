# Batsman Style Report — V2 Polish

## Roster

- Modi
- Putin
- Trump
- Adeft

## Personality Profiles

### Modi — Textbook Reference

| Field | Before | After | Change |
|-------|--------|-------|--------|
| power | 1.00 | **1.00** | — |
| followThrough | 1.00 | **1.00** | — |
| backliftHeight | 1.00 | **1.00** | — |
| hipRotation | 1.00 | **1.00** | — |
| stanceWidth | 1.00 | **1.00** | — |
| stanceCrouch | 1.00 | **1.00** | — |
| bob | 1.00 | **1.00** | — |
| reactionFlair | 1.00 | **1.00** | — |

Modi IS the baseline. Every other batsman is defined as a delta from Modi. When Modi looks correct and balanced, all others are correctly positioned.

---

### Putin — Compact Controller

| Field | Before | After | Change | Effect |
|-------|--------|-------|--------|--------|
| power | 0.85 | **0.75** | -12% | Shortest arm reach, smallest silhouette |
| followThrough | 0.65 | **0.50** | -23% | Minimal finish — bat stops almost immediately |
| backliftHeight | 0.65 | **0.55** | -15% | Low backlift — barely above shoulder |
| hipRotation | 0.75 | **0.70** | -7% | Minimal torso pivot |
| stanceWidth | 0.85 | **0.80** | -6% | Narrow stance, feet close together |
| stanceCrouch | 1.15 | **1.25** | +9% | Deepest crouch — lowest center of gravity |
| reactionFlair | 0.50 | **0.40** | -20% | Almost no emotional reaction |

**Silhouette:** Narrow, deep crouch, short backlift, compact swing, minimal follow-through. The "technician" — no wasted motion. At contact, the bat travels the shortest possible arc. The follow-through barely wraps.

**Readability:** Immediately distinguishable from Modi by shorter bat arc, lower backlift height, and faster return to neutral.

---

### Trump — Power Hitter

| Field | Before | After | Change | Effect |
|-------|--------|-------|--------|--------|
| power | 1.20 | **1.35** | +13% | Biggest arm swing, maximum rotation |
| followThrough | 1.60 | **2.00** | +25% | Massive wrap — bat finishes behind head |
| backliftHeight | 1.40 | **1.50** | +7% | Highest backlift — bat reaches vertical |
| hipRotation | 1.35 | **1.50** | +11% | Most torso rotation — full body pivot |
| stanceWidth | 1.30 | **1.40** | +8% | Widest stance — feet far apart |
| reactionFlair | 1.60 | **2.00** | +25% | Most expressive finish |

**Silhouette:** Wide stance, high backlift (bat vertical), massive torso rotation (hips + spine + chest each turn further), huge follow-through (bat wraps around back). The "slugger" — every visible cue says POWER.

**Readability:** Unmistakable from Modi — shoulder rotation is 35% stronger, backlift 50% higher, follow-through 2× larger.

---

### Adeft — Athletic Aggressor

| Field | Before | After | Change | Effect |
|-------|--------|-------|--------|--------|
| power | 1.10 | **1.20** | +9% | Strong reach, fluid motion |
| followThrough | 1.25 | **1.50** | +20% | Athletic finish, good wrap |
| backliftHeight | 1.15 | **1.25** | +9% | Higher backlift, aggressive wind-up |
| hipRotation | 1.10 | **1.20** | +9% | Athletic torso rotation |
| reactionFlair | 1.15 | **1.40** | +22% | Expressive, confident finish |

**Silhouette:** Athletic stance (slightly wider, slight crouch), high-ish backlift, strong rotation, clean follow-through. More extreme than Modi but less than Trump. The "modern aggressor" — looks like a limited-overs batsman.

**Readability:** Between Modi and Trump. Higher backlift than Modi, more rotation, larger follow-through. But not as extreme as Trump.

---

### Differentiation heatmap

| Cue | Modi | Putin | Trump | Adeft |
|-----|------|-------|-------|-------|
| Stance width | 1.00 | 0.80 | **1.40** | 1.05 |
| Crouch depth | 1.00 | **1.25** | 0.85 | 1.00 |
| Backlift height | 1.00 | 0.55 | **1.50** | 1.25 |
| Rotation power | 1.00 | 0.70 | **1.50** | 1.20 |
| Follow-through | 1.00 | 0.50 | **2.00** | 1.50 |
| Flair | 1.00 | 0.40 | **2.00** | 1.40 |

All four silhouettes use only existing personality fields. No new code. No timing changes.
