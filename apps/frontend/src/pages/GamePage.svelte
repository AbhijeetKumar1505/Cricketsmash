<script lang="ts">
  import {
    game,
    placeBet,
    cashout,
    getEffectiveTicketMultiplier,
    swing,
    type VisualPhase,
    type DeliveryOutcome,
  } from '../core/gameController.svelte.js';
  import { navigationState } from '../core/navigation.svelte.js';
  import CricketSimulation from '../lib/CricketSimulation.svelte';
  import GameArena from '../lib/GameArena.svelte';
  import {
    playBlip,
    playClick,
    playBetConfirm,
    playCrack,
    playCrowdShout,
    playWicketClatter,
    playCrowdSwell,
    playCrowdGroan,
    playCashoutWin,
    playMilestone,
    startTensionHum,
    updateTensionPitch,
    stopTensionHum,
  } from '../lib/gameAudio';
  import BetPanel from '../lib/ui/bet/BetPanel.svelte';
  import GameInfoPanel from '../lib/ui/GameInfoPanel.svelte';
  import TopHUD from '../lib/ui/TopHUD.svelte';
  import RightPanel from '../lib/ui/RightPanel.svelte';
  import CharacterOverlay from '../lib/ui/overlays/CharacterOverlay.svelte';
  import DifficultyOverlay from '../lib/ui/overlays/DifficultyOverlay.svelte';
  import SettingsOverlay from '../lib/ui/overlays/SettingsOverlay.svelte';
  import AutobetOverlay from '../lib/ui/overlays/AutobetOverlay.svelte';
  import MissionsOverlay from '../lib/ui/overlays/MissionsOverlay.svelte';
  import LeaderboardOverlay from '../lib/ui/overlays/LeaderboardOverlay.svelte';
  import { gameBus } from '../game/GameEventBus';
  import { onMount } from 'svelte';
  import AnimDebugOverlay from '../lib/ui/overlays/AnimDebugOverlay.svelte';

  function ballTickerSym(entry: DeliveryOutcome | null | undefined): string {
    if (!entry) return '·';
    if (entry.kind === 'wicket') return 'W';
    return String(entry.runs);
  }

  const ballTicker = $derived.by(() => {
    if (!game.overSummary.length) return '';
    return game.overSummary.map(ballTickerSym).join(' · ');
  });

  const showBallTicker = $derived(
    game.sessionActive || game.phase === 'broadcast' || game.autoPlayOn,
  );

  let mult = $derived(game.displayMultiplier * game.bonusProfitMultProduct);
  let soundOn = $state(true);
  let lastCashout = $state<string | null>(null);
  let pageEl = $state<HTMLElement | undefined>(undefined);
  let passedPageMilestones = new Set<number>();
  let showInfoPanel = $state(false);

  // ─── Locale detection ───
  const locale = $derived.by(() => {
    const lang = navigator.language?.slice(0, 2) ?? 'en';
    if (['en', 'es', 'pt', 'hi'].includes(lang)) return lang;
    return 'en';
  });

  // ─── Spacebar → main action ───
  function handleGlobalKeydown(e: KeyboardEvent) {
    if (showInfoPanel) return;
    // Close overlay on Escape
    if (e.code === 'Escape' && navigationState.activeOverlay) {
      navigationState.activeOverlay = null;
      return;
    }
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (game.visualPhase === 'bowl') {
        swing();
        return;
      }
      handleMainAction();
    }
  }

  // ─── Streak ───
  const streak = $derived.by(() => {
    let s = 0;
    const results = [...game.overSummary].reverse();
    for (const entry of results) {
      if (!entry) break;
      if (entry.kind === 'runs' && entry.runs >= 4) s++;
      else break;
    }
    return s;
  });

  // ─── Commentary ───
  const commentaryKey = $derived(game.deliveryKey * 10);
  const commentaryText = $derived.by(() => {
    const phase = game.visualPhase;
    if (phase !== 'celebrate' && phase !== 'wicket') return '';
    const outcome = game.currentDeliveries[0]?.outcome;
    if (!outcome) return '';
    const seed = game.deliveryKey * 7;
    if (outcome.kind === 'wicket') {
      return (['BOWLED OUT!', 'CLEAN BOWLED!', 'STUMPS SHATTERED!', 'OUT!!'] as const)[seed % 4]!;
    }
    if (outcome.runs === 6) return (['MAXIMUM! SIX!', 'OVER THE ROPE!', "THAT'S A SIX!", 'HUGE MAXIMUM!'] as const)[seed % 4]!;
    if (outcome.runs === 4) return (['BOUNDARY! FOUR!', 'TO THE FENCE!', 'CRACKING DRIVE!', 'MAGNIFICENT FOUR!'] as const)[seed % 4]!;
    if (outcome.runs === 3) return (['THREE RUNS!', 'GOOD RUNNING!', 'THREE!'] as const)[seed % 3]!;
    if (outcome.runs === 2) return (['TWO RUNS!', 'QUICK TWO!', 'WELL RUN!'] as const)[seed % 3]!;
    if (outcome.runs === 1) return (['QUICK SINGLE!', 'ONE RUN!', 'GOOD CALL!'] as const)[seed % 3]!;
    return (['DOT BALL.', 'WELL DEFENDED!', 'TIGHT BOWLING!'] as const)[seed % 3]!;
  });

  // ─── Scorecard ───
  const scorecardData = $derived.by(() => {
    if (game.phase !== 'broadcast') return null;
    if (!game.showResultCard) return null;
    const mult_val = game.lastSettledMultiplier > 0 ? game.lastSettledMultiplier : getEffectiveTicketMultiplier();
    const bet = game.lastSettledBetAmount > 0 ? game.lastSettledBetAmount : game.betAmount;
    const payout = game.lastSettledPayout > 0 ? game.lastSettledPayout : bet * mult_val;
    const wasWicket = game.overSummary.some(s => s?.kind === 'wicket');
    return {
      multiplier: mult_val,
      betAmount:  bet,
      profit:     mult_val > 0 ? payout - bet : -bet,
      wasWicket,
    };
  });

  // ─── CSS accent color reactivity ───
  const accentColor = $derived(
    mult >= 10 ? '#ff00ff' :
    mult >= 5  ? '#00ffff' :
    mult >= 2  ? '#00ff88' : '#6366f1'
  );
  const accentRgb = $derived(
    mult >= 10 ? '255,0,255' :
    mult >= 5  ? '0,255,255' :
    mult >= 2  ? '0,255,136' : '99,102,241'
  );

  $effect(() => {
    if (!pageEl) return;
    const intensity = Math.max(0, Math.min(1, (mult - 1) / 9));
    pageEl.style.setProperty('--accent',     accentColor);
    pageEl.style.setProperty('--accent-rgb', accentRgb);
    pageEl.style.setProperty('--intensity',  intensity.toFixed(3));
  });

  const sfx = {
    blip:      (hz: number) => soundOn && playBlip(hz),
    click:     ()           => soundOn && playClick(),
    betConfirm: ()          => soundOn && playBetConfirm(),
    crack:     ()           => soundOn && playCrack(),
    wicket:    ()           => soundOn && playWicketClatter(),
    swell:     (i: 'boundary' | 'mild') => soundOn && playCrowdSwell(i),
    groan:     ()           => soundOn && playCrowdGroan(),
    cashout:   ()           => soundOn && playCashoutWin(),
    milestone: (t: 1|2|3)  => soundOn && playMilestone(t),
    humUpdate: (m: number)  => soundOn && updateTensionPitch(m),
  };

  const codeCrash = $derived(game.displayMultiplier <= 0 && game.sessionActive);
  const canBet = $derived(
    !game.betActive && game.phase !== 'broadcast' && game.phase === 'idle',
  );
  const isAnimating = $derived(game.sessionActive);
  const isBroadcast = $derived(game.phase === 'broadcast');
  const actionState = $derived.by(() => {
    if (game.betActive && game.canCashout) return 'cashout';
    if (isAnimating) return 'bet';
    if (isBroadcast) return 'waiting';
    return 'bet';
  });

  const currentPayout = $derived.by(() => {
    if (!game.betActive) return 0;
    return game.betAmount * getEffectiveTicketMultiplier();
  });

  // ─── Phase audio/events ───
  let lastTriggeredVPhase = $state<VisualPhase | 'idle'>('idle');

  $effect(() => {
    const vp = game.visualPhase;
    if (vp === lastTriggeredVPhase) return;
    lastTriggeredVPhase = vp;

    if (vp === 'bowl') {
      startTensionHum();
      sfx.betConfirm();
      passedPageMilestones.clear();
      lastCashout = null;
    }
  });

  $effect(() => {
    const vp = game.visualPhase;
    if (vp === 'celebrate') {
      stopTensionHum();
      const outcome = game.currentDeliveries[0]?.outcome;
      if (outcome && outcome.kind === 'runs') {
        if (outcome.runs >= 4) sfx.swell('boundary');
        else sfx.swell('mild');
      }
    }
    if (vp === 'wicket') {
      stopTensionHum();
      sfx.wicket();
      sfx.groan();
    }
  });

  async function handleMainAction() {
    sfx.click();
    if (canBet) {
      await placeBet();
      return;
    }
    if (game.betActive && game.canCashout) {
      cashout();
    }
  }

  // ─── Mini-player viewport support ───
  function handleResize() {
    // reserved for future viewport-aware adjustments
  }

  // ─── Hit-flash overlay (driven by AnimationBrain via gameBus) ─────────────
  let hitFlashIntensity = $state(0);
  let hitFlashKey = $state(0);
  onMount(() => gameBus.on('HIT_FLASH', ({ intensity, key }) => {
    hitFlashIntensity = intensity;
    hitFlashKey = key;
  }));

  // Direct contact audio — fires at exact contact frame, bypasses $effect latency
  onMount(() => gameBus.on('HIT_AUDIO', ({ intensity }) => {
    if (!soundOn) return;
    playCrack();
    // Heavy hits get crowd burst in sync with impact
    if (intensity >= 0.7) playCrowdShout(intensity);
  }));
</script>

<svelte:window onkeydown={handleGlobalKeydown} onresize={handleResize} />

<div
  class="page"
  class:crashed={codeCrash}
  bind:this={pageEl}
>
  <!-- Subtle scanline background -->
  <div class="page-bg" aria-hidden="true">
    <div class="scanlines"></div>
    <div class="vignette"></div>
  </div>

  <!-- ─── TopHUD row ─── -->
  <div class="topbar-cell">
    <TopHUD
      bind:soundOn
      onMuteToggle={() => { soundOn = !soundOn; playBlip(soundOn ? 440 : 220, 0.05); }}
      multiplier={mult}
      onInfo={() => { showInfoPanel = true; }}
    />
  </div>

  <!-- ─── Arena row (fills remaining height) ─── -->
  <div class="arena-row">
    <GameArena
      arenaStatus={isBroadcast ? 'over_ended' : (game.visualPhase === 'celebrate' ? 'result' : game.visualPhase === 'bowl' ? 'bowling' : game.visualPhase === 'hit' ? 'hitting' : game.visualPhase === 'wicket' ? 'wicket' : 'waiting')}
      accumulatedMult={mult}
      {commentaryText}
      {commentaryKey}
      {streak}
      rewardToast={game.pendingRewardToast}
      skyHitToast={game.skyHitToast}
      {scorecardData}
      resultStage1HoldMs={game.turboPlay || game.autoPlayOn ? 400 : 1400}
    >
      <CricketSimulation />
    </GameArena>

    <!-- Floating notifications anchored to bottom of arena -->
    <div class="arena-float">
      {#if lastCashout}
        <div class="win-toast-float" style="--accent: {accentColor}">
          <div class="win-ring"></div>
          <span>WIN +${lastCashout}</span>
        </div>
      {/if}
      {#if showBallTicker && ballTicker}
        <div class="ball-ticker" aria-label="Current over ball results">
          {ballTicker}
        </div>
      {/if}
      {#if game.autoPlayOn && commentaryText}
        <div class="micro-comment" aria-hidden="true">{commentaryText}</div>
      {/if}
    </div>
  </div>

  <!-- ─── Right panel ─── -->
  <div class="right-cell">
    <RightPanel multiplier={mult} />
  </div>

  <!-- ─── BetPanel row ─── -->
  <div class="bet-row">
    <BetPanel
      disabled={!canBet && !game.betActive}
      {actionState}
      onCashout={cashout}
      payout={currentPayout}
      onMainAction={handleMainAction}
    />
  </div>

  <!-- ─── Info panel and dialog (modal, above everything) ─── -->
  <GameInfoPanel
    open={showInfoPanel}
    onClose={() => showInfoPanel = false}
    {locale}
  />

  <!-- ─── Hit-flash overlay (fires on bat contact) ─── -->
  {#key hitFlashKey}
    {#if hitFlashIntensity > 0}
      <div
        class="hit-flash"
        style="--intensity: {hitFlashIntensity}"
        aria-hidden="true"
      ></div>
    {/if}
  {/key}

  <!-- ─── Animation Debug HUD (Ctrl+Shift+A) ─── -->
  <AnimDebugOverlay />

  <!-- ─── Overlay Manager ─── -->
  {#if navigationState.activeOverlay === 'character'}
    <CharacterOverlay />
  {:else if navigationState.activeOverlay === 'difficulty'}
    <DifficultyOverlay />
  {:else if navigationState.activeOverlay === 'settings'}
    <SettingsOverlay
      bind:soundOn
      onSoundToggle={() => { soundOn = !soundOn; playBlip(soundOn ? 440 : 220, 0.05); }}
    />
  {:else if navigationState.activeOverlay === 'autobet'}
    <AutobetOverlay />
  {:else if navigationState.activeOverlay === 'missions'}
    <MissionsOverlay />
  {:else if navigationState.activeOverlay === 'leaderboard'}
    <LeaderboardOverlay />
  {/if}
</div>

<style>
  :global(body) {
    background: #02020e;
    color: #fff;
    margin: 0;
    font-family: "Trebuchet MS", Verdana, sans-serif;
  }

  .page {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr 260px;
    grid-template-rows: 72px 1fr 110px;
    grid-template-areas:
      "topbar   topbar"
      "arena    right"
      "betpanel betpanel";
    overflow: hidden;
    background: var(--bg-deep);
    --accent: #6366f1;
    --accent-rgb: 99,102,241;
  }

  .topbar-cell {
    grid-area: topbar;
    min-width: 0;
  }

  .right-cell {
    grid-area: right;
    overflow: hidden;
  }

  /* Subtle background texture */
  .page-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .scanlines {
    position: absolute;
    inset: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
                linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    background-size: 100% 2px, 3px 100%;
    opacity: 0.025;
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%);
  }

  /* ─── Arena row ─── */
  .arena-row {
    grid-area: arena;
    position: relative;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    z-index: 10;
    box-shadow: inset 0 0 0 1px rgba(255, 184, 0, 0.09);
  }

  /* Bottom fade — blends canvas into the bet panel below */
  .arena-row::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 52px;
    background: linear-gradient(to bottom, transparent, var(--bg-deep, #02020e));
    pointer-events: none;
    z-index: 45;
  }

  /* Floating notifications at the bottom of the arena */
  .arena-float {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 6px;
    z-index: 35;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    pointer-events: none;
    filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.45));
  }

  /* ─── Bet row ─── */
  .bet-row {
    grid-area: betpanel;
    z-index: 20;
    padding: 6px 12px;
    display: flex;
    justify-content: center;
    align-items: stretch;
    border-top: 1px solid rgba(255, 184, 0, 0.10);
    box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.55), 0 -1px 0 rgba(255, 184, 0, 0.07);
  }

  /* ─── Floating UI ─── */
  .ball-ticker {
    pointer-events: none;
    text-align: center;
    font-family: ui-monospace, 'Orbitron', monospace;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: rgba(255, 255, 255, 0.55);
    text-shadow: 0 0 12px rgba(0, 212, 255, 0.25);
  }

  .micro-comment {
    pointer-events: none;
    text-align: center;
    font-size: 0.7rem;
    font-weight: 950;
    letter-spacing: 0.06em;
    color: color-mix(in srgb, var(--accent, #6366f1) 75%, #fff);
    text-shadow: 0 0 14px color-mix(in srgb, var(--accent, #6366f1) 40%, transparent);
    animation: micro-pop 0.45s ease-out;
  }

  @keyframes micro-pop {
    from { transform: translateY(6px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  .win-toast-float {
    position: relative;
    pointer-events: none;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid color-mix(in srgb, var(--accent), transparent 55%);
    color: color-mix(in srgb, var(--accent), #fff 15%);
    padding: 10px 16px;
    border-radius: 14px;
    text-align: center;
    font-weight: 900;
    font-size: 0.95rem;
    animation: slide-up 0.4s ease-out;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 0 28px color-mix(in srgb, var(--accent), transparent 72%);
  }

  .win-ring {
    pointer-events: none;
    position: absolute;
    inset: 0;
    border-radius: 14px;
    box-shadow: inset 0 0 22px color-mix(in srgb, var(--accent), transparent 40%);
    opacity: 0.85;
  }

  @keyframes slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  /* ─── Hit-flash overlay ─── */
  .hit-flash {
    position: fixed;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    z-index: 9999;
    animation: hit-flash-pulse 160ms ease-out forwards;
    mix-blend-mode: screen;
  }
  @keyframes hit-flash-pulse {
    0%   { opacity: 0; }
    18%  { opacity: calc(var(--intensity, 0.5) * 0.55); }
    100% { opacity: 0; }
  }

  /* ─── Responsive collapse ─── */
  @media (max-width: 1100px) {
    .page { grid-template-columns: 1fr 220px; }
  }

  @media (max-width: 900px) {
    .right-cell { display: none; }
    .page {
      grid-template-columns: 1fr;
      grid-template-areas:
        "topbar"
        "arena"
        "betpanel";
    }
  }

  @media (max-width: 540px) {
    .page {
      grid-template-rows: 60px 1fr 140px;
      grid-template-columns: 1fr;
      grid-template-areas:
        "topbar"
        "arena"
        "betpanel";
    }
  }
</style>
