# Design System Document: Neon-Noir Premium

## 1. Overview & Creative North Star: "The Kinetic AR Overlay"
This design system is built to transcend the static "web app" feel. Our Creative North Star is **The Kinetic AR Overlay**. Imagine a high-stakes cricket stadium at midnight, where the UI isn't a series of boxes, but a luminous, heads-up display (HUD) projected into the humid air. 

We reject the rigid, boxy constraints of traditional dashboard design. Instead, we embrace **Intentional Asymmetry** and **Tonal Depth**. Elements should feel like they are floating at different depths within a 3D space, utilizing light and blur rather than lines and strokes to define reality. This is an immersive, high-energy environment where the UI reacts to the game’s intensity, shifting from calm violets to volatile rubies as the stakes climb.

---

### 2. Colors: The Spectrum of Intensity
The palette is rooted in `surface` (#0b1326), a deep, obsidian-like navy that provides the void for our neon elements to breathe.

#### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined through:
1.  **Background Shifts:** Distinguish a sidebar from a main feed by placing `surface-container-low` against `surface`.
2.  **Tonal Transitions:** Use soft gradients between `primary` (#d0bcff) and `primary-container` (#a078ff) to define functional areas.

#### Surface Hierarchy & Nesting
Treat the UI as physical layers of frosted glass. 
*   **Base:** `surface` (The stadium floor).
*   **Sectioning:** `surface-container-low` (The viewing deck).
*   **Active HUD Elements:** `surface-container-highest` (Floating glass panels).
Each inner container must use a tier shift to define importance—never use the same color for nested containers.

#### The "Glass & Gradient" Rule
Floating elements (Betting panels, live stats) must utilize **Glassmorphism**: 
*   `background-color`: Semi-transparent `surface-variant` (#2d3449) at 60% opacity.
*   `backdrop-filter`: `blur(12px) saturate(180%)`.
*   **Signature Textures:** Main CTAs should not be flat. Apply a radial gradient from `secondary` (#4edea3) to `secondary-container` (#00a572) to create a "pulsing" energy core.

---

### 3. Typography: Authority Through Weight
Our typography strategy centers on high-contrast hierarchy. We use **Inter** as our workhorse, but we treat it with editorial intent.

*   **Display (The Multiplier):** `display-lg` (Inter, 900 weight). This is the heartbeat of the game. Use `primary-fixed` for the number, paired with a high-contrast glow (`text-shadow: 0 0 20px #d0bcff`).
*   **Headlines:** `headline-lg` to `headline-sm`. These define the narrative. Use tight letter-spacing (-0.02em) to maintain a "heavy" premium feel.
*   **Labels:** `label-md` (Space Grotesk). Use this for technical data points (e.g., "Total Stakes"). The monospace-leaning feel of Space Grotesk reinforces the AR/HUD aesthetic.
*   **Body:** `body-md` (Inter). Reserved for chat logs and betting history. Use `on-surface-variant` (#cbc3d7) to keep the text legible but secondary to the action.

---

### 4. Elevation & Depth: Tonal Layering
We do not use structural lines to separate content; we use light.

*   **The Layering Principle:** To lift a card, place a `surface-container-lowest` card on top of a `surface-container-high` section. This creates a "recessed" or "elevated" look through value alone.
*   **Ambient Shadows:** For floating HUD panels, use "Atmospheric Shadows."
    *   `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 15px rgba(208, 188, 255, 0.1);`
    *   The shadow is tinted with the `surface_tint` to ensure it feels like light passing through purple glass, not a grey smudge.
*   **The "Ghost Border" Fallback:** If a boundary is required for accessibility, use a **Ghost Border**: `outline-variant` (#494454) at 15% opacity. It should be felt, not seen.

---

### 5. Components

#### Buttons (The "Trigger")
*   **Primary (Place Bet):** High-saturation `secondary` (#4edea3). Roundedness: `md`. No border. Transition to `secondary_fixed_dim` on hover with a 10px outer glow.
*   **Tertiary (Secondary Actions):** `surface-container-highest` background with a `ghost border`. Text in `primary`.

#### Chips (The "History")
*   **Crash History Chips:** Use `surface-container-low` as the base. The text color shifts based on the multiplier:
    *   < 2x: `error` (#ffb4ab)
    *   2x - 10x: `secondary` (#4edea3)
    *   10x+: `tertiary` (#f9bd22) with a subtle outer glow.

#### Cards & Lists
*   **Activity Feed:** Strictly no dividers. Use `8px` vertical spacing. Alternate row backgrounds between `surface` and `surface-container-low` only if data density is extremely high; otherwise, allow whitespace to act as the separator.

#### Input Fields (The "Stake")
*   **Text Inputs:** `surface-container-lowest` background. On focus, the `outline-variant` becomes a thin gradient stroke (Violet to Emerald). Labels use `label-sm` in `on-surface-variant`.

#### Specialized Component: The "Intensity Meter"
*   A radial translucent background behind the main multiplier that shifts from `primary` (Violet) at 1x to `tertiary` (Gold) at 10x, and finally `error_container` (Ruby) as the "Crash" becomes imminent.

---

### 6. Do's and Don'ts

#### Do:
*   **Use Asymmetry:** Place the chat HUD off-center or at a slight "tilt" via CSS transforms to mimic a floating AR display.
*   **Embrace Glow:** Use subtle text-shadows on all `display` and `headline` elements.
*   **Layer with Purpose:** Ensure that every "glass" panel has a `backdrop-filter: blur`.

#### Don't:
*   **No "Flat" Defaults:** Never use a single flat hex code for a large background; always use a subtle radial gradient (e.g., `surface` to `surface-container-low`).
*   **No High-Contrast Borders:** Never use #000 or #FFF 1px borders. It breaks the "light-based" HUD immersion.
*   **No Default Inter Weight:** Avoid using "Regular/400" for anything other than long-form body text. This system lives in the "Medium/500" to "Black/900" range.