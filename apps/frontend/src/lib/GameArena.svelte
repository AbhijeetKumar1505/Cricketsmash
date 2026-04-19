<script lang="ts">
  import type { Snippet } from 'svelte';
  import MultiplierDisplay from './ui/MultiplierDisplay.svelte';
  import OverTimeline from './ui/OverTimeline.svelte';
  import MatchOverOverlay from './ui/MatchOverOverlay.svelte';
  import RiskIndicator from './ui/RiskIndicator.svelte';
  import CommentaryBanner from './ui/CommentaryBanner.svelte';
  import ScorecardOverlay from './ui/ScorecardOverlay.svelte';

  import type { DeliveryOutcome } from '../core/gameController.svelte.js';

  type ArenaBroadcastStatus = 'waiting' | 'bowling' | 'hitting' | 'result' | 'wicket' | 'over_ended';

  let {
    arenaStatus = 'waiting' as ArenaBroadcastStatus,
    overHistory = [] as DeliveryOutcome[],
    currentBallIdx = 0,
    accumulatedMult = 1,
    commentaryText = '',
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
    children: Snippet;
  } = $props();

  const isCrashed  = $derived(arenaStatus === 'wicket');
  const isLive     = $derived(arenaStatus === 'hitting' || arenaStatus === 'bowling');
  const isHitting  = $derived(arenaStatus === 'hitting');

  // Color reactivity spectrum — neon stadium palette
  const accentColor = $derived(
    isCrashed                ? '#ff1e3c' :
    accumulatedMult >= 10    ? '#ff00ff' : // Neon Magenta
    accumulatedMult >= 5     ? '#00ffff' : // Neon Cyan
    accumulatedMult >= 2     ? '#00ff88' : '#6366f1' // Indigo default
  );

  const accentRgb = $derived(
    isCrashed                ? '255,30,60' :
    accumulatedMult >= 10    ? '255,0,255' :
    accumulatedMult >= 5     ? '0,255,255' :
    accumulatedMult >= 2     ? '0,255,136' : '99,102,241'
  );

  // Glow intensity: 0→1 as multiplier goes 1→10
  const glowIntensity = $derived(Math.min(1, (accumulatedMult - 1) / 9));

  // Edge glow spread: grows with multiplier
  const edgeGlow = $derived(
    isCrashed ? 100 : Math.min(120, 18 + accumulatedMult * 10)
  );

  // Tension zoom: 1.0 → 1.04 as multiplier 1 → 15
  const tensionScale = $derived(
    isLive ? 1 + Math.min(0.045, (accumulatedMult - 1) * 0.003) : 1
  );

  // Pulse speed string (inherited from parent via CSS var, used here too)
  const pulseDur = $derived(Math.max(0.22, 1.4 - glowIntensity * 1.18));

  // Pre-computed particle positions — split into two groups for layering
  const arenaParticles = Array.from({ length: 28 }, (_, i) => ({
    ax:    `${3 + (i * 3.57) % 94}%`,
    ay:    `${20 + (i * 6.1) % 68}%`,
    sz:    `${0.8 + (i * 0.6) % 2.8}px`,
    dur:   `${4.5 + (i * 1.4) % 9}s`,
    delay: `${-(i * 0.48)}s`,
    drift: `${-26 + (i * 5.3) % 52}px`,
  }));



  // Stadium light flicker timing (only at mid-high multipliers)
  const flickerActive = $derived(isLive && accumulatedMult >= 4);
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
  <!-- ─── Stadium Background ─── -->
  <div class="absolute inset-0 z-0">
    <img
      src="/stadium/stadium_main.png"
      alt=""
      class="stadium-img"
      class:desaturated={isCrashed}
      style="transform: scale({tensionScale}); transition: transform 0.8s ease;"
    />
    <!-- Vignette -->
    <div class="absolute inset-0 bg-gradient-to-t from-[#0b1326] via-transparent to-transparent opacity-80"></div>
    <!-- Dynamic color tint — more saturated at higher multipliers -->
    <div
      class="absolute inset-0 transition-all duration-700"
      style="background: radial-gradient(ellipse at 50% 75%, rgba({accentRgb}, {(glowIntensity * 0.14).toFixed(3)}) 0%, transparent 65%)"
    ></div>
    <!-- Secondary color wash at high tension -->
    {#if accumulatedMult >= 5}
      <div
        class="absolute inset-0"
        style="
          background: radial-gradient(ellipse at 50% 20%, rgba({accentRgb}, {(glowIntensity * 0.08).toFixed(3)}) 0%, transparent 55%);
          transition: opacity 1s ease;
        "
      ></div>
    {/if}
  </div>

  <!-- ─── Always-on atmospheric fog ─── -->
  <div class="arena-fog arena-fog-bottom" aria-hidden="true"></div>
  <div class="arena-fog arena-fog-top"    aria-hidden="true"></div>

  <!-- ─── Stadium light flicker (mid-high tension) ─── -->
  {#if flickerActive}
    <div
      class="absolute inset-0 z-[20] pointer-events-none"
      style="
        background: rgba({accentRgb}, 0.03);
        animation: neon-flicker {Math.max(1.5, 5 - accumulatedMult * 0.3)}s ease-in-out infinite;
      "
    ></div>
  {/if}

  <!-- ─── Always-on floating particles ─── -->
  <div class="absolute inset-0 z-[22] overflow-hidden pointer-events-none" aria-hidden="true">
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
    style="box-shadow: inset 0 0 {edgeGlow}px rgba({accentRgb}, {(isLive ? 0.28 + glowIntensity * 0.32 : 0.07).toFixed(3)})"
  ></div>

  <!-- ─── Breathing glow (always on, dims when not live) ─── -->
  <div class="absolute inset-0 z-[23] pointer-events-none rounded-[2.5rem] overflow-hidden">
    <div
      class="absolute inset-[-20%] rounded-full"
      style="
        background: radial-gradient(circle, rgba({accentRgb}, {isLive ? 0.09 : 0.03}) 0%, transparent 60%);
        animation: glow-breathe var(--pulse-dur, 1.4s) ease-in-out infinite;
        will-change: opacity, transform;
      "
    ></div>
  </div>

  <!-- ─── Risk indicator vignette (from RiskIndicator component) ─── -->
  <RiskIndicator multiplier={accumulatedMult} status={arenaStatus} />

  <!-- ─── CRT Scanlines ─── -->
  <div class="absolute inset-0 z-[26] crt-overlay opacity-[0.035] pointer-events-none"></div>

  <!-- ─── 3D Content Slot ─── -->
  <div class="absolute inset-0 z-10">
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
  <div class="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-6 md:p-8">

    <!-- Top row: broadcast pill + cam toggle + risk bar -->
    <div class="flex justify-between items-start gap-4">
      <div></div>

      <div></div>

      <!-- Scoreboard Pill -->
      <div class="flex flex-col items-end gap-2">
        {#if arenaStatus !== 'waiting' && arenaStatus !== 'over_ended' && !isCrashed}
          <div class="pointer-events-auto">
             <MultiplierDisplay value={accumulatedMult} status={arenaStatus} />
          </div>
        {/if}
      </div>
    </div>

    <!-- Center: Commentary / waiting state -->
    <div class="flex-1 flex items-center justify-center">
      {#if arenaStatus === 'waiting'}
        <div class="flex flex-col items-center gap-4">
          <div class="px-6 py-3 glass-panel rounded-2xl border border-white/10 animate-pulse">
            <span class="text-xs font-label font-black text-on-surface-variant/40 uppercase tracking-[0.4em]">
              Waiting for First Bet
            </span>
          </div>
        </div>
      {:else if arenaStatus === 'bowling' || arenaStatus === 'hitting' || arenaStatus === 'result'}
        <CommentaryBanner
          text={commentaryText}
          {commentaryKey}
          {streak}
        />
      {/if}
    </div>

    <!-- Bottom: Over Timeline -->
    <div class="flex flex-col items-center">
      <OverTimeline currentBall={currentBallIdx} history={overHistory} />
    </div>
  </div>

  <!-- ─── Wicket Overlay (during wicket animation phase only) ─── -->
  {#if isCrashed}
    <MatchOverOverlay multiplier={accumulatedMult} lossAmount={lossAmount} onClose={onRestart} />
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
      onRestart={onRestart}
    />
  {/if}
</div>

<style>
  .arena-root {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 2.5rem;
    overflow: hidden;
    background: #060e20;
    border: 1px solid rgba(255,255,255,0.04);
    box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    transition: border-color 0.5s ease;
  }
  .arena-root:not(.crashed) {
    border-color: rgba(var(--accent-rgb, 167,139,250), calc(var(--glow-intensity, 0) * 0.25 + 0.04));
  }

  .stadium-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.45;
    transition: filter 1s ease, opacity 1s ease, transform 0.8s ease;
    transform-origin: center center;
  }
  .desaturated {
    filter: grayscale(1) brightness(0.18);
    opacity: 0.28;
  }

  /* ─── Crash shake ─── */
  .crashed {
    animation: crash-shake 0.45s cubic-bezier(.36,.07,.19,.97) both;
  }

  /* ─── Fog layers ─── */
  .arena-fog {
    position: absolute;
    left: 0; right: 0;
    z-index: 21;
    pointer-events: none;
    animation: fog-breathe 7s ease-in-out infinite;
    will-change: opacity;
  }
  .arena-fog-bottom {
    bottom: 0;
    height: 30%;
    background: linear-gradient(to top, rgba(6,14,32,0.7) 0%, transparent 100%);
    animation-delay: 0s;
  }
  .arena-fog-top {
    top: 0;
    height: 20%;
    background: linear-gradient(to bottom, rgba(6,14,32,0.5) 0%, transparent 100%);
    animation-delay: 3.5s;
  }

  /* ─── Impact flash ─── */
  .impact-flash {
    animation: impact-flash 0.6s ease-out forwards;
  }

</style>
