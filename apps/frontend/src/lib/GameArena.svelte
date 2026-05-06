<script lang="ts">
  import type { Snippet } from "svelte";
  import MultiplierDisplay from "./ui/MultiplierDisplay.svelte";
  import OverTimeline from "./ui/OverTimeline.svelte";
  import MatchOverOverlay from "./ui/MatchOverOverlay.svelte";
  import RiskIndicator from "./ui/RiskIndicator.svelte";
  import ScorecardOverlay from "./ui/ScorecardOverlay.svelte";

  import type { DeliveryOutcome } from "../core/gameController.svelte.js";

  type ArenaBroadcastStatus =
    | "waiting"
    | "bowling"
    | "hitting"
    | "result"
    | "wicket"
    | "over_ended";

  let {
    arenaStatus = "waiting" as ArenaBroadcastStatus,
    overHistory = [] as DeliveryOutcome[],
    currentBallIdx = 0,
    accumulatedMult = 1,
    commentaryText = "",
    commentaryKey = 0,
    streak = 0,
    scorecardData = null as null | {
      history: DeliveryOutcome[];
      multiplier: number;
      betAmount: number;
      profit: number;
      wasWicket: boolean;
      streak: number;
    },
    lossAmount = 0,
    onRestart = () => {},
    onViewStats = () => {},
    children,
  }: {
    arenaStatus?: ArenaBroadcastStatus;
    overHistory?: DeliveryOutcome[];
    currentBallIdx?: number;
    accumulatedMult?: number;
    commentaryText?: string;
    commentaryKey?: number;
    streak?: number;
    scorecardData?: null | {
      history: DeliveryOutcome[];
      multiplier: number;
      betAmount: number;
      profit: number;
      wasWicket: boolean;
      streak: number;
    };
    lossAmount?: number;
    onRestart?: () => void;
    onViewStats?: () => void;
    children: Snippet;
  } = $props();

  const isCrashed = $derived(arenaStatus === "wicket");
  const isLive = $derived(
    arenaStatus === "hitting" || arenaStatus === "bowling",
  );
  const isHitting = $derived(arenaStatus === "hitting");

  const simOpacity = $derived(
    // Three.js canvas is alpha:false (opaque) — no blending needed.
    isCrashed ? 0.85 : 1,
  );

  // Color reactivity spectrum — neon stadium palette
  const accentColor = $derived(
    isCrashed
      ? "#ff1e3c"
      : accumulatedMult >= 10
        ? "#ff00ff" // Neon Magenta
        : accumulatedMult >= 5
          ? "#00ffff" // Neon Cyan
          : accumulatedMult >= 2
            ? "#00ff88"
            : "#6366f1", // Indigo default
  );

  const accentRgb = $derived(
    isCrashed
      ? "255,30,60"
      : accumulatedMult >= 10
        ? "255,0,255"
        : accumulatedMult >= 5
          ? "0,255,255"
          : accumulatedMult >= 2
            ? "0,255,136"
            : "99,102,241",
  );

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

  // Stadium light flicker timing (only at mid-high multipliers)
  const flickerActive = $derived(isLive && accumulatedMult >= 4);

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
    }, 1750);
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
    <!-- Darkened Base Stadium -->
    <div class="absolute inset-0 bg-[#05070d] z-0"></div>

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
      class="absolute inset-0 bg-radial-[ellipse_at_center,_transparent_40%,_#05070d_110%] opacity-90"
    ></div>
  </div>

  <!-- ─── Always-on atmospheric fog ─── -->
  <div class="arena-fog arena-fog-bottom" aria-hidden="true"></div>
  <div class="arena-fog arena-fog-top" aria-hidden="true"></div>

  <!-- ─── Stadium light flicker (mid-high tension) ─── -->
  {#if flickerActive}
    <div
      class="absolute inset-0 z-[20] pointer-events-none"
      style="
        background: rgba({accentRgb}, 0.03);
        animation: neon-flicker {Math.max(
        1.5,
        5 - accumulatedMult * 0.3,
      )}s ease-in-out infinite;
      "
    ></div>
  {/if}

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

  <!-- ─── Edge glow (reactive to multiplier) ─── -->
  <div
    class="absolute inset-0 z-[24] pointer-events-none transition-all duration-300"
    style="box-shadow: inset 0 0 {edgeGlow}px rgba({accentRgb}, {(isLive
      ? 0.28 + glowIntensity * 0.32
      : 0.07
    ).toFixed(3)})"
  ></div>

  <!-- ─── Breathing glow (always on, dims when not live) ─── -->
  <div
    class="absolute inset-0 z-[23] pointer-events-none rounded-[2.5rem] overflow-hidden"
  >
    <div
      class="absolute inset-[-20%] rounded-full"
      style="
        background: radial-gradient(circle, rgba({accentRgb}, {isLive
        ? 0.09
        : 0.03}) 0%, transparent 60%);
        animation: glow-breathe var(--pulse-dur, 1.4s) ease-in-out infinite;
        will-change: opacity, transform;
      "
    ></div>
  </div>

  <!-- ─── Risk indicator vignette (from RiskIndicator component) ─── -->
  <RiskIndicator multiplier={accumulatedMult} status={arenaStatus} />

  <!-- ─── CRT Scanlines ─── -->
  <div
    class="absolute inset-0 z-[26] crt-overlay opacity-[0.035] pointer-events-none"
  ></div>

  <!-- ─── PERMANENT BROADCAST OVERLAYS (Svelte Layer) ─── -->
  {#if !scorecardData}
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

  <!-- ─── Impact flash on hit ─── -->
  {#if isHitting}
    <div
      class="impact-flash absolute inset-0 z-[100] pointer-events-none"
      style="background: radial-gradient(ellipse at 50% 65%, rgba({accentRgb}, 0.55) 0%, transparent 70%)"
    ></div>
  {/if}

  <!-- ─── Floating HUD Shell ─── -->
  <div
    class="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-5 md:p-7"
  >
    <!-- Top spacing for layout balance -->
    <div class="mt-[12px]"></div>

    <!-- Center: Commentary / waiting state / between-ball broadcast -->
    <div class="flex-1 flex items-center justify-center">
      {#if arenaStatus === "waiting"}
        <div class="flex flex-col items-center gap-4">
          <div
            class="px-6 py-3 glass-panel rounded-2xl border border-white/10 animate-pulse"
          >
            <span
              class="text-xs font-label font-black text-on-surface-variant/40 uppercase tracking-[0.4em]"
            >
              Waiting for First Bet
            </span>
          </div>
        </div>
      {:else if arenaStatus === "result" && resultStage === 1}
        {#key commentaryKey}
          <div class="broadcast-card bc-stage bc-stage-enter">
            <div class="bc-ball-label">
              BALL {currentBallIdx + 1} &nbsp;·&nbsp; RESULT
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
        {/key}
      {/if}
    </div>

    <!-- Bottom spacer (MultiplierDisplay + OverTimeline moved to z-[60] absolute layers) -->
    <div class="h-16"></div>
  </div>

  <!-- ─── Center Multiplier (z-60) ─── -->
  <!-- Only shows after the over-timeline has updated with the ball result
       (result stage 2), so the UX order is: bowl → hit → timeline → multiplier. -->
  {#if !scorecardData && !isCrashed && arenaStatus === "result" && resultStage === 2}
    <div class="mult-center-anchor">
      <MultiplierDisplay value={accumulatedMult} status="hitting" />
    </div>
  {/if}

  <!-- ─── Over Timeline — visible from first bowl so ball count is always trackable ─── -->
  {#if !scorecardData && !isCrashed && (arenaStatus === "bowling" || arenaStatus === "hitting" || arenaStatus === "result")}
    <div class="over-tl-anchor">
      <OverTimeline currentBall={currentBallIdx} history={overHistory} />
    </div>
  {/if}

  <!-- ─── Wicket Overlay (during wicket animation phase only) ─── -->
  {#if isCrashed}
    <MatchOverOverlay
      multiplier={accumulatedMult}
      {lossAmount}
      onClose={onRestart}
      {onViewStats}
    />
  {/if}

  <!-- ─── Post-round Scorecard (during broadcast phase) ─── -->
  {#if scorecardData}
    <ScorecardOverlay
      history={scorecardData.history}
      multiplier={scorecardData.multiplier}
      betAmount={scorecardData.betAmount}
      profit={scorecardData.profit}
      wasWicket={scorecardData.wasWicket}
      streak={scorecardData.streak}
      {onRestart}
    />
  {/if}
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
    height: 24%;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.22) 0%,
      transparent 100%
    );
    animation-delay: 0s;
  }
  .arena-fog-top {
    top: 0;
    height: 18%;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 100%
    );
    animation-delay: 3.5s;
  }

  /* ─── Impact flash ─── */
  .impact-flash {
    animation: impact-flash 0.6s ease-out forwards;
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
    background: rgba(0, 0, 0, 0.55);
    border-radius: 1rem;
    border: 1px solid;
    backdrop-filter: blur(12px);
    line-height: 1.1;
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
  }

  /* Blue: badgelogo3D — left panel, flanking the banner */
  .bo-badge {
    position: absolute;
    top: 0;
    left: 0;
    width: 25%;
    max-width: 280px;
    height: auto;
    object-fit: contain;
    animation: broadcast-float 4s ease-in-out infinite;
    filter: drop-shadow(0 0 20px rgba(255, 180, 0, 0.6));
  }

  /* Black: logo — centered brand mark over the banner area */
  .bo-logo {
    position: absolute;
    top: 28px;
    left: 43%;
    transform: translateX(-50%);
    width: 200px;
    height: auto;
    object-fit: contain;
    mix-blend-mode: screen;
    animation: broadcast-float 4s ease-in-out infinite;
    filter: drop-shadow(0 0 14px rgba(255, 210, 0, 0.5));
    z-index: 1;
  }

  /* Yellow: cricketcrash — right panel, flanking the banner */
  .bo-cc {
    position: absolute;
    top: 0;
    right: 0;
    width: 25%;
    max-width: 280px;
    height: auto;
    object-fit: contain;
    animation: broadcast-float 4s ease-in-out infinite;
    filter: drop-shadow(0 0 20px rgba(255, 180, 0, 0.5));
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

  .over-tl-anchor {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    pointer-events: none;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .bo-badge {
      width: 20%;
    }
    .bo-logo {
      width: 160px;
      top: 48px;
    }
    .bo-cc {
      width: 20%;
    }
  }
</style>
