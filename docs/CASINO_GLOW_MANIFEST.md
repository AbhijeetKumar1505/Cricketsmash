# Visual & UX Manifest: The "Glow & Tension" System

This document provides the high-level context, design philosophy, and technical implementation targets to transform **Cricket Crash** from a "simulation" into a high-stakes, addictive, and visually stunning "Casino-Grade" experience.

---

## 1. Vision: "The High-Stakes Stadium"
The goal is to move away from a flat, static UI and towards an immersive, reactive environment. Every increase in the multiplier should feel like a build-up of energy that eventually "crashes" (Wicket) or is "harvested" (Cashout).

### Core Philosophy
- **temporal Momentum**: The faster the multiplier grows, the more "alive" the stadium becomes.
- **Spatial Reactivity**: The game world (Three.js) and the HUD (Svelte) are not separate; they react in sync.
- **Visceral Feedback**: Use subtle distortions, camera shakes, and lighting shifts to communicate risk and reward.

---

## 2. Design System: "Neon-Noir Premium"
Avoid generic colors. Use deep, saturated tones with high-contrast glows.

### Color Palette Transitions
| Multiplier | Theme | Tone | Visual Effect |
|------------|-------|------|---------------|
| **1.0x - 1.9x** | **Violet Baseline** | `#8b5cf6` | Calm, steady scanlines. |
| **2.0x - 4.9x** | **Emerald Surge** | `#10b981` | Vibrant growth, subtle lens flare. |
| **5.0x - 9.9x** | **Gold Ambition** | `#fbbf24` | Sparkling particles, intense gold glow. |
| **10.0x+** | **Ruby Extremity** | `#f43f5e` | Extreme tension, CRT distortion, red stadium lights. |

### Typography
- **Primary**: *Inter* or *Outfit* (Black/900 weight) for numbers.
- **Style**: Tabular nums to prevent shifting, high-contrast drop shadows to pull numbers forward from the 3D world.

---

## 3. The "Tension Cycle" (Key Features)

### A. Dynamic Lighting (Three.js)
As the multiplier crosses thresholds (**2x, 5x, 10x**), the stadium lights should shift.
- **Implementation**: Sync `PointLight` and `SpotLight` intensity/color with the `liveMultiplier` value.
- **Effect**: At 10x, the stadium should be bathed in a rhythmic red strobe pulsated by the "Tension Hum" frequency.

### B. Reactive Camera (The "Heartbeat" Shake)
Instead of a static view, the camera should feel like it's vibrating with the energy of the ball.
- **Logic**: Camera `shakeIntensity` = `Math.pow(multiplier, 1.2) / 100`.
- **Implementation**: Add a small GSAP random jitter to the camera position during the `hitting` phase.

### C. Glassmorphism HUD
The Bet Panel and Sidebar should feel like premium AR overlays sitting on the stadium glass.
- **Style**: `backdrop-filter: blur(12px) saturate(180%)`; thin border-gradient; radial transclucent background.

---

## 4. Animation Guidelines (GSAP)

| Action | Easing | Style |
|--------|--------|-------|
| **Multiplier Pulse** | `elastic.out(1, 0.3)` | Sharp hit on 0.10x increments, slow settle. |
| **Cashout Button Hover** | `power4.out` | Intense scale-up with an "aura" pulse. |
| **Wicket Crash** | `expo.in` | Rapid red flash + screen shake + desaturation. |
| **Win Celebration** | `back.out(1.7)` | Explosive confetti-like UI scale-up. |

---

## 5. Audio-Visual Synesthesia
- **The Hum**: The high-frequency `tensionNode` in `gameAudio.ts` should drive the `bloom` strength in the WebGL post-processing.
- **The Crack**: Every bat hit triggers a radial "shockwave" overlay on the HUD.

---

## 6. Checklist for "Stitch" UI Redesign

- [ ] **HUD Overhaul**: Apply glassmorphism to `BetPanel` and `LiveBetsSidebar`.
- [ ] **Dynamic Backgrounds**: Map `MultiplierDisplay` color state to a global CSS variable used for stadium ambient light.
- [ ] **Motion Graphics**: Add SVG "speed lines" to the game arena that appear as the multiplier accelerates.
- [ ] **State Transitions**: Implement a "Match Over" overlay that uses the Ruby theme with a full-screen desaturation effect.
- [ ] **Particle Systems**: Add 3D "energy trails" to the ball that get longer and more vibrant as the multiplier rises.
