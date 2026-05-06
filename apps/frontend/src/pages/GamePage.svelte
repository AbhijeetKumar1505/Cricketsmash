<script lang="ts">
  import {
    game,
    placeBet,
    cashout,
    returnToIdle,
    dismissMatchOverlay,
    setBetAmount,
    setGameMode,
    getEffectiveTicketMultiplier,
    type VisualPhase,
  } from '../core/gameController.svelte.js';
  import CricketSimulation from '../lib/CricketSimulation.svelte';
  import GameArena from '../lib/GameArena.svelte';
  import {
    playBlip,
    playClick,
    playBetConfirm,
    playCrack,
    playWicketClatter,
    playCrowdSwell,
    playCrowdGroan,
    playCashoutWin,
    playMilestone,
    startTensionHum,
    updateTensionPitch,
    stopTensionHum,
  } from '../lib/gameAudio';
  import BetPanel from '../lib/ui/BetPanel.svelte';



  let localBet = $state(game.betAmount || 10);
  let autoCashoutVal = $state<number | null>(null);



  // Sync local → controller only; game.betAmount is never changed externally
  $effect(() => { setBetAmount(localBet); });

  let mult = $derived(game.displayMultiplier * game.bonusProfitMultProduct);
  let soundOn = $state(true);
  let lastCashout = $state<string | null>(null);
  let pageEl = $state<HTMLElement | undefined>(undefined);
  let passedPageMilestones = new Set<number>();

  // ─── Streak: consecutive boundaries (4s/6s) in current over ───
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

  // ─── Commentary: phase + outcome → clean broadcast text ───
  const commentaryKey = $derived(game.deliveryKey * 10 + game.currentBallIdx);
  const commentaryText = $derived.by(() => {
    const phase = game.visualPhase;
    if (phase !== 'celebrate' && phase !== 'wicket') return '';
    const outcome = game.currentDeliveries[game.currentBallIdx]?.outcome;
    if (!outcome) return '';
    const seed = game.deliveryKey * 7 + game.currentBallIdx;
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

  // ─── Scorecard: snapshot at broadcast phase for post-round summary ───
  const scorecardData = $derived.by(() => {
    if (game.phase !== 'broadcast') return null;
    const mult_val = game.lastSettledMultiplier > 0 ? game.lastSettledMultiplier : getEffectiveTicketMultiplier();
    const bet = game.lastSettledBetAmount > 0 ? game.lastSettledBetAmount : game.betAmount;
    const payout = game.lastSettledPayout > 0 ? game.lastSettledPayout : bet * mult_val;
    const wasWicket = game.overSummary.some(s => s?.kind === 'wicket');
    return {
      history:   game.overSummary,
      multiplier: mult_val,
      betAmount:  bet,
      profit:     mult_val > 0 ? payout - bet : -bet,
      wasWicket,
      streak,
    };
  });

  // ─── CSS var system: neon stadium color reactivity ───
  const accentColor = $derived(
    mult >= 10 ? '#ff00ff' : // Neon Magenta
    mult >= 5  ? '#00ffff' : // Neon Cyan
    mult >= 2  ? '#00ff88' : '#6366f1' // Indigo default
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
  const canBet = $derived(!game.betActive && game.phase !== 'broadcast');
  const isBetting = $derived(game.phase === 'betting');
  const isAnimating = $derived(game.sessionActive);
  const isBroadcast = $derived(game.phase === 'broadcast');
  const actionState = $derived.by(() => {
    if (isBetting) return 'betting';
    if (game.betActive && game.canCashout) return 'cashout';
    if (isAnimating) return isBetting ? 'betting' : 'bet';
    if (isBroadcast) return 'waiting';
    return 'bet';
  });

  const currentPayout = $derived.by(() => {
    if (!game.betActive) return 0;
    return game.betAmount * getEffectiveTicketMultiplier();
  });

  // ─── React to visual phase changes for audio/events ───
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
    } else if (vp === 'hit') {
      sfx.crack();
    }
  });

  $effect(() => {
    const vp = game.visualPhase;
    if (vp === 'celebrate') {
      stopTensionHum();
      const outcome = game.currentDeliveries[game.currentBallIdx]?.outcome;
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

  function handleMainAction() {
    sfx.click();
    if (canBet) {
      placeBet();
    } else if (game.betActive && game.canCashout) {
      cashout();
    }
  }

  // ─── Auto-proceed logic removed — handled by handleSessionEnd in controller ───
</script>

<!-- ─── Page Shell ─── -->
<div
  class="page"
  class:crashed={codeCrash}
  bind:this={pageEl}
>
  <!-- ─── Broadcast Background ─── -->
  <div class="page-bg" aria-hidden="true">
    <div class="sky-gradient"></div>
    <div class="sky-glow sky-glow-left"></div>
    <div class="sky-glow sky-glow-right"></div>
    <div class="sky-haze"></div>
    <div class="scanlines"></div>
    <div class="vignette"></div>
  </div>

  <div class="art-overlay" aria-hidden="true">





  </div>

  <!-- ─── Main Layout (full bleed to top — no top HUD strip) ─── -->
  <div class="main-layout">
    <main class="arena-container">
      <GameArena
        arenaStatus={isBroadcast ? 'over_ended' : (game.visualPhase === 'celebrate' ? 'result' : game.visualPhase === 'bowl' ? 'bowling' : game.visualPhase === 'hit' ? 'hitting' : game.visualPhase === 'wicket' ? 'wicket' : 'waiting')}
        overHistory={game.overSummary}
        currentBallIdx={game.currentBallIdx}
        accumulatedMult={game.displayMultiplier * game.bonusProfitMultProduct}
        {commentaryText}
        {commentaryKey}
        {streak}
        rewardToast={game.pendingRewardToast}
        skyHitToast={game.skyHitToast}
        {scorecardData}
        lossAmount={game.betAmount}
        onRestart={returnToIdle}
        onViewStats={dismissMatchOverlay}
      >
        <CricketSimulation />
      </GameArena>

      <!-- Bottom-center dock (all breakpoints — keeps outfield / pitch visible) -->
      <div class="bet-dock-wrap">
        {#if lastCashout}
          <div class="win-toast-float" style="--accent: {accentColor}">
            <div class="win-ring"></div>
            <span>WIN +${lastCashout}</span>
          </div>
        {/if}
        <BetPanel
          bind:amount={localBet}
          bind:autoCashout={autoCashoutVal}
          disabled={!canBet && !game.betActive}
          {actionState}
          onCashout={cashout}
          payout={currentPayout}
          onMainAction={handleMainAction}
        />
      </div>
    </main>
  </div>
  <!-- ─── Stake-style Bottom Bar ─── -->
  <footer class="bottom-bar">
    <!-- Left: currency + balance + audio (moved off removed top strip) -->
    <div class="bb-left">
      <div class="currency-pill">
        <span class="flag">🇺🇸</span>
        <span class="curr-text">USD</span>
        <span class="chevron">▾</span>
      </div>
      <div class="bb-balance">
        <span class="bb-curr">{game.currency === 'USD' ? '$' : game.currency}</span>
        <span>{game.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <button
        type="button"
        class="bb-audio"
        aria-label={soundOn ? 'Mute audio' : 'Unmute audio'}
        onclick={() => { soundOn = !soundOn; playBlip(soundOn ? 440 : 220, 0.05); }}
      >
        {soundOn ? '🔊' : '🔇'}
      </button>
    </div>

    <!-- Center: Stake brand -->
    <div class="bb-center">
      <span class="stake-wordmark">Stake</span>
    </div>

    <!-- Right: mode toggles -->
    <div class="bb-right">
      <button
        class="mode-pill mode-active"
        aria-label="Switch to Fun Play mode"
        onclick={() => setGameMode('OVER')}
      >
        <span class="mode-dot"></span>
        Fun Play
      </button>
      <button
        class="mode-pill mode-real"
        aria-label="Switch to Real Play mode"
        onclick={() => setGameMode('POWERPLAY')}
      >
        <span class="mode-dot real-dot"></span>
        Real Play
      </button>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    background: #02020e;
    color: #fff;
    margin: 0;
    font-family: "Trebuchet MS", Verdana, sans-serif;
  }

  .page {
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #02020e;
    --accent: #6366f1;
    --accent-rgb: 99,102,241;
  }

  .page-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  .sky-gradient { display: none; }
  .sky-glow { display: none; }
  .sky-glow-left { display: none; }
  .sky-glow-right { display: none; }
  .sky-haze { display: none; }
  .scanlines {
    position: absolute;
    inset: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    background-size: 100% 2px, 3px 100%;
    opacity: 0.025;
  }
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%);
  }

  .main-layout {
    position: absolute;
    inset: 0 0 52px;
    display: flex;
    min-height: 0;
    z-index: 10;
  }

  /* Bottom-centre bet HUD — anchored above footer, does not occlude sidewards turf */
  .bet-dock-wrap {
    position: absolute;
    left: 50%;
    bottom: 8px;
    transform: translateX(-50%);
    z-index: 35;
    width: min(600px, calc(100% - 24px));
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    filter: drop-shadow(0 16px 36px rgba(0, 0, 0, 0.5));
  }

  .bet-dock-wrap > :global(.bet-dock) {
    pointer-events: auto;
  }

  .arena-container {
    flex: 1;
    position: relative;
    width: 100%;
    min-width: 0;
    background: transparent;
    border-radius: 0;
    overflow: hidden;
    box-shadow: none;
    border: 0;
  }

  .arena-container::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 30%;
    background: linear-gradient(0deg, rgba(0,0,0,0.34), transparent);
    pointer-events: none;
    z-index: 20;
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
    to { transform: translateY(0); opacity: 1; }
  }

  /* ── Stake-style Bottom Bar ── */
  .bottom-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    background: rgba(5, 7, 13, 0.96);
    border-top: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
    z-index: 50;
  }

  .bb-left, .bb-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .bb-balance {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 800;
    font-family: 'Orbitron', monospace;
    color: rgba(255,255,255,0.92);
    letter-spacing: -0.02em;
  }
  .bb-curr {
    font-size: 0.62rem;
    font-weight: 700;
    color: rgba(255,255,255,0.45);
  }

  .bb-audio {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06);
    color: #fff;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    display: grid;
    place-items: center;
    padding: 0;
    appearance: none;
  }

  .bb-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .stake-wordmark {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: 1.15rem;
    font-weight: 700;
    color: rgba(255,255,255,0.75);
    letter-spacing: 0.01em;
    text-shadow: 0 0 20px rgba(255,255,255,0.3);
  }

  .currency-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 6px 9px;
    cursor: pointer;
    min-height: 36px;
  }

  .flag { font-size: 0.75rem; }

  .curr-text {
    font-size: 0.7rem;
    font-weight: 700;
    font-family: 'Orbitron', monospace;
    color: rgba(255,255,255,0.7);
    letter-spacing: 0.1em;
  }

  .chevron {
    font-size: 0.6rem;
    color: rgba(255,255,255,0.3);
  }

  .mode-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.4);
    font-size: 0.72rem;
    font-weight: 700;
    font-family: 'Orbitron', monospace;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-pill.mode-active {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.85);
  }

  .mode-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #00ff88;
    box-shadow: 0 0 6px rgba(0,255,136,0.8);
  }

  .real-dot {
    background: #ffd700;
    box-shadow: 0 0 6px rgba(255,215,0,0.8);
  }

  .bb-audio:focus-visible,
  .mode-pill:focus-visible,
  .currency-pill:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent, #6366f1) 70%, white);
    outline-offset: 2px;
  }

  @media (max-width: 980px) {
    .stake-wordmark {
      display: none;
    }
    .bottom-bar {
      justify-content: space-between;
    }
  }

  @media (max-width: 760px) {
    .main-layout {
      inset: 0 0 96px;
    }
    .bottom-bar {
      height: auto;
      min-height: 52px;
      padding: 6px 10px;
      display: grid;
      grid-template-columns: 1fr;
      row-gap: 6px;
    }
    .bb-left, .bb-right {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .bb-center {
      display: none;
    }
    .mode-pill {
      flex: 1 1 calc(50% - 4px);
      justify-content: center;
    }
  }
</style>
