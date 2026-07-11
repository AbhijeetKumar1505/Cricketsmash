<script lang="ts">
  import type { Snippet } from "svelte";
  import MultiplierDisplay from "./ui/MultiplierDisplay.svelte";
  import { game } from "../core/gameController.svelte.js";

  const ARENA_CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", INR: "₹", CAD: "CA$", AUD: "A$",
    JPY: "¥", BRL: "R$", BTC: "₿", ETH: "Ξ",
  };
  const arenaCurr = $derived(ARENA_CURRENCY_SYMBOLS[game.currency] ?? game.currency);

  import type { SkyObjectType } from "../engine/sky/types.js";

  type ArenaBroadcastStatus =
    | "waiting"
    | "bowling"
    | "hitting"
    | "result"
    | "wicket"
    | "over_ended";

  let {
    arenaStatus = "waiting" as ArenaBroadcastStatus,
    accumulatedMult = 1,
    commentaryText = "",
    commentaryKey = 0,
    streak = 0,
    rewardToast = null as null | { text: string; color: string; key: number },
    skyHitToast = null as null | {
      type: SkyObjectType;
      multiplier: number;
      key: number;
    },
    /** Whether this result is a special event (boundary, wicket, sky hit). Non-special → compact badge. */
    isSpecialResult = true,
    /** Shorter hold for autobet (ms) before showing multiplier stage. */
    resultStage1HoldMs = 1400,
    children,
  }: {
    arenaStatus?: ArenaBroadcastStatus;
    accumulatedMult?: number;
    commentaryText?: string;
    commentaryKey?: number;
    streak?: number;
    rewardToast?: null | { text: string; color: string; key: number };
    skyHitToast?: null | {
      type: SkyObjectType;
      multiplier: number;
      key: number;
    };
    isSpecialResult?: boolean;
    resultStage1HoldMs?: number;
    children: Snippet;
  } = $props();

  const isCrashed = $derived(arenaStatus === "wicket");

  const simOpacity = $derived(
    // Three.js canvas is alpha:false (opaque) — no blending needed.
    isCrashed ? 0.85 : 1,
  );

  // Neutral, constant stadium ambiance — no multiplier-reactive neon coloring.
  const accentColor = "#ffe1aa";
  const accentRgb = "255, 225, 170";

  // Glow intensity: 0→1 as multiplier goes 1→10
  const glowIntensity = $derived(Math.min(1, (accumulatedMult - 1) / 9));

  // Edge glow spread: grows with multiplier
  const edgeGlow = $derived(
    isCrashed ? 100 : Math.min(120, 18 + accumulatedMult * 10),
  );

  // Pulse speed string (inherited from parent via CSS var, used here too)
  const pulseDur = $derived(Math.max(0.22, 1.4 - glowIntensity * 1.18));

  // Pre-computed particle positions — split into two groups for layering
  const arenaParticles = Array.from({ length: 28 }, (_, i) => ({
    ax: `${3 + ((i * 3.57) % 94)}%`,
    ay: `${20 + ((i * 6.1) % 68)}%`,
    sz: `${0.8 + ((i * 0.6) % 2.8)}px`,
    dur: `${4.5 + ((i * 1.4) % 9)}s`,
    delay: `${-(i * 0.48)}s`,
    drift: `${-26 + ((i * 5.3) % 52)}px`,
  }));

  // ─── Between-ball broadcast: two-stage result card ───
  let resultStage = $state(0); // 0=off, 1=show result text, 2=show multiplier

  $effect(() => {
    if (arenaStatus !== "result") {
      resultStage = 0;
      return;
    }
    resultStage = 1;
    const t = setTimeout(() => {
      resultStage = 2;
    }, resultStage1HoldMs);
    return () => clearTimeout(t);
  });

  const resultIsSix = $derived(
    commentaryText.includes("SIX") || commentaryText.includes("MAXIMUM"),
  );
  const resultIsFour = $derived(
    commentaryText.includes("FOUR") || commentaryText.includes("BOUNDARY"),
  );
  const resultIsWicket = $derived(
    commentaryText.includes("BOWLED") ||
      commentaryText.includes("OUT") ||
      commentaryText.includes("STUMPS"),
  );
  const resultColor = $derived(
    resultIsWicket
      ? "#ff1e3c"
      : resultIsSix
        ? "#ffc800"
        : resultIsFour
          ? "#00ff88"
          : "rgba(255,255,255,0.85)",
  );
  const resultColorRgb = $derived(
    resultIsWicket
      ? "255,30,60"
      : resultIsSix
        ? "255,200,0"
        : resultIsFour
          ? "0,255,136"
          : "255,255,255",
  );
</script>

<div
  class="arena-root"
  class:crashed={isCrashed}
  style="
    --accent: {accentColor};
    --accent-rgb: {accentRgb};
    --glow-intensity: {glowIntensity};
    --edge-glow: {edgeGlow}px;
    --pulse-dur: {pulseDur}s;
  "
>
  <!-- ─── Stadium Background & Atmosphere ─── -->
  <div class="arena-background-layer absolute inset-0 z-0">
    <!-- Daytime chrome (canvas is opaque; softens bezel / rounded corners) -->
    <div class="absolute inset-0 bg-[#0a1624] z-0"></div>

    <!-- Mega Neon Gradient Washes -->
    <div
      class="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
    >
      <div
        class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-electric-blue/10 to-transparent"
      ></div>
      <div
        class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-neon-pink/5 to-transparent"
      ></div>
    </div>

    <!-- Vignette & HUD Occlusion -->
    <div
      class="absolute inset-0 bg-radial-[ellipse_at_center,_transparent_42%,_#0a1624_115%] opacity-75"
    ></div>
  </div>

  <!-- ─── Always-on atmospheric fog ─── -->
  <div class="arena-fog arena-fog-bottom" aria-hidden="true"></div>
  <div class="arena-fog arena-fog-top" aria-hidden="true"></div>

  <!-- ─── Always-on floating particles ─── -->
  <div
    class="absolute inset-0 z-[22] overflow-hidden pointer-events-none"
    aria-hidden="true"
  >
    {#each arenaParticles as p}
      <div
        class="arena-particle"
        style="--ax:{p.ax}; --ay:{p.ay}; --sz:{p.sz}; --dur:{p.dur}; --delay:{p.delay}; --drift:{p.drift}"
      ></div>
    {/each}
  </div>

  <!-- ─── Tension vignette (reactive radial pulse from edges) ─── -->
  <div
    class="tension-vignette z-[23]"
    style="
      --glow-intensity: {glowIntensity};
      --accent-rgb: {accentRgb};
    "
  ></div>

  <!-- ─── Edge glow (constant, subtle — no colored neon light-up on hit) ─── -->
  <div
    class="absolute inset-0 z-[24] pointer-events-none transition-all duration-300"
    style="box-shadow: inset 0 0 24px rgba({accentRgb}, 0.07)"
  ></div>

  <!-- ─── Breathing glow (constant, subtle) ─── -->
  <div
    class="absolute inset-0 z-[23] pointer-events-none rounded-[2.5rem] overflow-hidden"
  >
    <div
      class="absolute inset-[-20%] rounded-full"
      style="
        background: radial-gradient(circle, rgba({accentRgb}, 0.03) 0%, transparent 60%);
        animation: glow-breathe var(--pulse-dur, 1.4s) ease-in-out infinite;
        will-change: opacity, transform;
      "
    ></div>
  </div>

  <!-- ─── CRT Scanlines ─── -->
  <div
    class="absolute inset-0 z-[26] crt-overlay opacity-[0.02] pointer-events-none"
  ></div>

  <!-- ─── PERMANENT BROADCAST OVERLAYS (Svelte Layer) ─── -->
  {#if arenaStatus === "waiting"}
    <div class="broadcast-overlay absolute inset-0 z-[50] pointer-events-none">
      <!-- Blue: badgelogo3D — top-left holographic badge -->
      <img src="/badgelogo3D_t.png" alt="Badge" class="bo-badge" />

      <!-- Black: logo — top-center House AlwaysWinz sponsor brand -->
      <img src="/logo_t.png" alt="House AlwaysWinz" class="bo-logo" />

      <!-- Yellow: cricketcrash — top-right game brand -->
      <img src="/cricketcrash_t.png" alt="Cricket Crash" class="bo-cc" />
    </div>
  {/if}

  <!-- ─── 3D Content Slot ─── -->
  <div
    class="simulation-layer absolute inset-0 z-10"
    style="--sim-opacity: {simOpacity}"
  >
    {@render children()}
  </div>

  <!-- ─── Floating HUD Shell ─── -->
  <div
    class="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-5 md:p-7"
  >
    <!-- Top spacing for layout balance -->
    <div class="mt-[12px]"></div>

    <!-- Center: Commentary / waiting state / between-ball broadcast -->
    <div class="flex-1 flex items-center justify-center">
      {#if arenaStatus === "waiting"}
        <div class="flex flex-col items-center">
          <div class="waiting-chip px-7 py-3.5 rounded-2xl">
            <span class="waiting-text">TAP&nbsp;<span class="waiting-accent">PLACE BET</span>&nbsp;TO PLAY</span>
          </div>
        </div>
      {:else if arenaStatus === "result" && resultStage === 1}
        {#key commentaryKey}
          {#if isSpecialResult}
            <div class="broadcast-card bc-stage bc-stage-enter">
              <div class="bc-ball-label">
                RESULT
              </div>
              <div
                class="bc-outcome"
                style="color: {resultColor}; border-color: rgba({resultColorRgb},0.3); text-shadow: 0 0 30px rgba({resultColorRgb},0.8), 0 0 60px rgba({resultColorRgb},0.3);"
              >
                {commentaryText}
              </div>
              {#if streak >= 2}
                <div class="bc-streak">🔥 {streak} IN A ROW</div>
              {/if}
            </div>
          {:else if commentaryText}
            <div class="payout-badge">
              {commentaryText}
            </div>
          {/if}
        {/key}
      {/if}
    </div>

    <!-- Bottom spacer (MultiplierDisplay + OverTimeline moved to z-[60] absolute layers) -->
    <div class="h-16"></div>
  </div>

  <!-- ─── Center Multiplier (z-60) ─── -->
  <!-- Only shows after the over-timeline has updated with the ball result
       (result stage 2), so the UX order is: bowl → hit → timeline → multiplier. -->
  {#if !isCrashed && accumulatedMult > 1 && arenaStatus === "result" && resultStage === 2}
    <div class="mult-center-anchor">
      <MultiplierDisplay value={accumulatedMult} status="hitting" pulseKey={rewardToast?.key ?? 0} />
    </div>
  {/if}

  {#if rewardToast}
    <div class="bonus-toast" style="--bonus-color: {rewardToast.color}">
      {rewardToast.text}
    </div>
  {/if}

  {#if skyHitToast}
    <div
      class="bonus-toast sky-toast"
      class:sky-toast--big={skyHitToast.multiplier >= 100}
      style={`--bonus-color: ${skyHitToast.type === "JETPACK" ? "#ffd84e" : skyHitToast.type === "SMALL_PLANE" ? "#58d6ff" : "#ff4fd8"}`}
    >
      MEGA WIN +{arenaCurr}{(game.betAmount * skyHitToast.multiplier).toFixed(2)}
    </div>
  {/if}

  <!-- OverTimeline removed: 1 ball = 1 bet, no over progress to track -->
  <!-- Full-screen ScorecardOverlay removed: result shown by the small return toast
       + the centered MultiplierDisplay (no screen-covering card, no red wicket). -->
</div>

<style>
  .arena-root {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 0;
    overflow: hidden;
    background: transparent;
    border: 0;
    box-shadow: none;
    transition: border-color 0.5s ease;
  }
  .arena-root:not(.crashed) {
    border-color: rgba(
      var(--accent-rgb, 167, 139, 250),
      calc(var(--glow-intensity, 0) * 0.25 + 0.04)
    );
  }

  /* ─── Crash shake ─── */
  .crashed {
    animation: crash-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  /* ─── Fog layers ─── */
  .arena-fog {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 21;
    pointer-events: none;
    animation: fog-breathe 7s ease-in-out infinite;
    will-change: opacity;
  }
  .arena-fog-bottom {
    bottom: 0;
    height: 18%;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.14) 0%,
      transparent 100%
    );
    animation-delay: 0s;
  }
  .arena-fog-top {
    top: 0;
    height: 12%;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 100%
    );
    animation-delay: 3.5s;
  }

  /* ─── Between-ball broadcast card ─── */
  .broadcast-card {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  .simulation-layer {
    opacity: var(--sim-opacity, 1);
  }

  .bc-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  .bc-stage-enter {
    animation: bc-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes bc-in {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(22px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .bc-ball-label {
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.32);
  }

  .bc-outcome {
    font-size: 2rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.7rem 1.8rem;
    background: rgba(2, 5, 12, 0.76);
    border-radius: 1rem;
    border: 1px solid;
    backdrop-filter: blur(12px);
    line-height: 1.1;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .bc-streak {
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #ffc800;
    text-shadow: 0 0 12px rgba(255, 200, 0, 0.7);
  }

  @keyframes bc-blink {
    0%,
    100% {
      opacity: 0.2;
    }
    50% {
      opacity: 0.6;
    }
  }

  /* ── LED Ribbon ── */

  @keyframes ribbon-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  @keyframes ribbon-gradient {
    from {
      background-position: 0% 50%;
    }
    to {
      background-position: 200% 50%;
    }
  }

  :global(.ticker-seg) {
    font-size: 11px;
    font-weight: 900;
    font-family: "Orbitron", monospace;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    padding: 0 20px;
    white-space: nowrap;
  }
  :global(.ticker-seg.green) {
    color: #00ff88;
    text-shadow: 0 0 12px rgba(0, 255, 136, 0.7);
  }
  :global(.ticker-seg.pink) {
    color: #ff2bd6;
    text-shadow: 0 0 12px rgba(255, 43, 214, 0.7);
  }
  :global(.ticker-seg.white) {
    color: rgba(255, 255, 255, 0.55);
  }
  :global(.ticker-seg.stake-brand) {
    font-family: Georgia, serif;
    font-style: italic;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
  }
  :global(.ticker-sep) {
    color: rgba(255, 255, 255, 0.2);
    font-size: 8px;
    padding: 0 6px;
  }

  /* ── Broadcast Overlays ── */
  .broadcast-overlay {
    transition: opacity 0.6s ease;
    opacity: 0.78;
  }

  /* Blue: badgelogo3D — left panel, flanking the banner */
  .bo-badge {
    position: absolute;
    top: 0;
    left: 0;
    width: 18%;
    max-width: 210px;
    height: auto;
    object-fit: contain;
    animation: broadcast-float 4s ease-in-out infinite;
    filter: drop-shadow(0 0 12px rgba(255, 180, 0, 0.45));
  }

  /* Black: logo — centered brand mark over the banner area */
  .bo-logo {
    position: absolute;
    top: 22px;
    left: 44%;
    transform: translateX(-50%);
    width: 180px;
    height: auto;
    object-fit: contain;
    mix-blend-mode: screen;
    animation: broadcast-float 4s ease-in-out infinite;
    filter: drop-shadow(0 0 10px rgba(255, 210, 0, 0.35));
    z-index: 1;
  }

  /* Yellow: cricketcrash — right panel, flanking the banner */
  .bo-cc {
    position: absolute;
    top: 0;
    right: 0;
    width: 18%;
    max-width: 210px;
    height: auto;
    object-fit: contain;
    animation: broadcast-float 4s ease-in-out infinite;
    filter: drop-shadow(0 0 12px rgba(255, 180, 0, 0.4));
  }

  .waiting-chip {
    background: linear-gradient(180deg,
      rgba(255, 184, 0, 0.12) 0%,
      rgba(4, 10, 30, 0.92) 100%);
    border: 1px solid rgba(255, 184, 0, 0.45) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 10px 28px rgba(0, 0, 0, 0.6),
      0 0 22px rgba(255, 184, 0, 0.22),
      inset 0 1px 0 rgba(255, 241, 163, 0.14);
    animation: waiting-breathe 2.2s ease-in-out infinite;
  }

  .waiting-text {
    font-family: 'Outfit', sans-serif;
    font-size: 0.9rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 241, 205, 0.92);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
    white-space: nowrap;
  }
  .waiting-accent {
    color: var(--gold-bright, #ffc800);
    text-shadow: 0 0 14px rgba(255, 184, 0, 0.6);
  }

  @keyframes waiting-breathe {
    0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 10px 28px rgba(0,0,0,0.6), 0 0 18px rgba(255,184,0,0.18), inset 0 1px 0 rgba(255,241,163,0.14); }
    50%       { box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 10px 28px rgba(0,0,0,0.6), 0 0 30px rgba(255,184,0,0.34), inset 0 1px 0 rgba(255,241,163,0.16); }
  }

  @keyframes broadcast-float {
    0%,
    100% {
      transform: var(--base-transform, translateY(0)) translateY(0);
    }
    50% {
      transform: var(--base-transform, translateY(0)) translateY(-8px);
    }
  }

  /* ─── Absolute overlay anchors (above broadcast crowd at z-50) ─── */
  .mult-center-anchor {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 60;
    pointer-events: none;
  }


  .payout-badge {
    position: absolute;
    top: 42%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 12px;
    padding: 6px 20px;
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.06em;
    animation: payout-fade 1.3s ease forwards;
    pointer-events: none;
    z-index: 60;
    white-space: nowrap;
  }

  @keyframes payout-fade {
    0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
    65%  { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) translateY(-16px); }
  }

  .bonus-toast {
    position: absolute;
    left: 50%;
    top: 34%;
    transform: translateX(-50%);
    z-index: 66;
    padding: 0.55rem 1rem;
    border-radius: 999px;
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #fff;
    border: 1px solid color-mix(in srgb, var(--bonus-color, #ffda6f), #fff 35%);
    background: color-mix(in srgb, var(--bonus-color, #ffda6f), #000 60%);
    box-shadow: 0 0 28px color-mix(in srgb, var(--bonus-color, #ffda6f), transparent 35%);
    animation: bonus-toast-pop 0.9s ease-out forwards;
    pointer-events: none;
  }

  @keyframes bonus-toast-pop {
    0% { opacity: 0; transform: translateX(-50%) translateY(18px) scale(0.85); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.03); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-18px) scale(1); }
  }

  .sky-toast.sky-toast--big {
    font-size: 1.45rem;
    top: 28%;
    letter-spacing: 0.12em;
  }

  @media (max-width: 768px) {
    .broadcast-overlay {
      opacity: 0.66;
    }
    .bo-badge {
      display: none;
    }
    .bo-logo {
      width: 132px;
      top: 12px;
    }
    .bo-cc {
      display: none;
    }
    .bc-outcome {
      font-size: 1.6rem;
      padding: 0.55rem 1.2rem;
    }
  }
</style>
