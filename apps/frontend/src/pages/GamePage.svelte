<script lang="ts">
  import { game, placeBet, cashout, returnToIdle, dismissMatchOverlay, setBetAmount, setGameMode, type VisualPhase } from '../core/gameController.svelte.js';
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

  let mult = $derived(game.displayMultiplier);
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
    const mult_val = game.payoutMultiplier;
    const bet = game.betAmount;
    const wasWicket = game.overSummary.some(s => s?.kind === 'wicket');
    return {
      history:   game.overSummary,
      multiplier: mult_val,
      betAmount:  bet,
      profit:     mult_val > 0 ? bet * mult_val - bet : -bet,
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
    const profitMult = game.displayMultiplier / Math.max(0.01, game.entryMultiplier);
    return game.betAmount * profitMult;
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

  <!-- ─── Top Bar ─── -->
  <header class="topbar">
    <div class="brand">
      <div class="live-badge"><span>LIVE</span></div>
      <img class="brand-logo" src="/logo.jpeg" alt="Cricket Crash" />
    </div>
    
    <div class="topbar-end">
      <div class="bal-pill">
        <span class="currency">{game.currency === 'USD' ? '$' : game.currency}</span>
        {game.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <button
        class="audio-btn"
        onclick={() => { soundOn = !soundOn; playBlip(soundOn ? 440 : 220, 0.05); }}
      >
        {soundOn ? '🔊' : '🔇'}
      </button>
    </div>
  </header>

  <!-- ─── Main Layout ─── -->
  <div class="main-layout">
    <!-- Left: Floating bet controls -->
    <aside class="bet-overlay lg:block hidden">
      <BetPanel
        bind:amount={localBet}
        bind:autoCashout={autoCashoutVal}
        disabled={!canBet && !game.betActive}
        {actionState}
        onCashout={cashout}
        payout={currentPayout}
        onMainAction={handleMainAction}
      />
      
      {#if lastCashout}
        <div class="win-toast" style="--accent: {accentColor}">
          <div class="win-ring"></div>
          <span>WIN +${lastCashout}</span>
        </div>
      {/if}
    </aside>

    <main class="arena-container">
      <GameArena
        arenaStatus={isBroadcast ? 'over_ended' : (game.visualPhase === 'celebrate' ? 'result' : game.visualPhase === 'bowl' ? 'bowling' : game.visualPhase === 'hit' ? 'hitting' : game.visualPhase === 'wicket' ? 'wicket' : 'waiting')}
        overHistory={game.overSummary}
        currentBallIdx={game.currentBallIdx}
        accumulatedMult={game.displayMultiplier}
        {commentaryText}
        {commentaryKey}
        {streak}
        {scorecardData}
        lossAmount={game.betAmount}
        onRestart={returnToIdle}
        onViewStats={dismissMatchOverlay}
      >
        <CricketSimulation />
      </GameArena>

      <!-- Mobile Overlay -->
      <div class="lg:hidden mobile-bet-overlay">
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
    <!-- Left: currency selector -->
    <div class="bb-left">
      <div class="currency-pill">
        <span class="flag">🇺🇸</span>
        <span class="curr-text">USD</span>
        <span class="chevron">▾</span>
      </div>
    </div>

    <!-- Center: Stake brand -->
    <div class="bb-center">
      <span class="stake-wordmark">Stake</span>
    </div>

    <!-- Right: mode toggles -->
    <div class="bb-right">
      <button
        class="mode-pill mode-active"
        onclick={() => setGameMode('OVER')}
      >
        <span class="mode-dot"></span>
        Fun Play
      </button>
      <button
        class="mode-pill mode-real"
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

  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 72px;
    padding: 0 34px;
    background: linear-gradient(180deg, rgba(0,0,0,0.36), transparent);
    backdrop-filter: none;
    border-bottom: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .live-badge {
    background: #ff1e3c;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 900;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.1em;
    box-shadow: 0 0 10px rgba(255,30,60,0.4);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
  .brand-logo { height: 1.6rem; }
  .audio-btn {
    width: 34px;
    height: 34px;
    border: 0;
    background: rgba(0,0,0,0.12);
    color: white;
    border-radius: 50%;
    cursor: pointer;
  }

  .topbar-end {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  .bal-pill {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #eef3ff;
    text-shadow: 0 2px 12px rgba(0,0,0,0.75);
  }
  .currency { color: rgba(255,255,255,0.4); font-size: 0.9rem; }

  .main-layout {
    position: absolute;
    inset: 72px 0 44px;
    display: flex;
    min-height: 0;
    z-index: 10;
  }

  .bet-overlay {
    position: absolute;
    left: 18px;
    bottom: 18px;
    z-index: 35;
    width: 360px;
    pointer-events: auto;
    filter: drop-shadow(0 18px 40px rgba(0,0,0,0.38));
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

  .mobile-bet-overlay {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 35;
  }

  .win-toast {
    margin-top: 1rem;
    background: rgba(var(--accent-rgb), 0.1);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 1rem;
    border-radius: 12px;
    text-align: center;
    font-weight: 900;
    font-size: 1.1rem;
    animation: slide-up 0.4s ease-out;
  }
  @keyframes slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* ── Stake-style Bottom Bar ── */
  .bottom-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    background: rgba(5, 7, 13, 0.96);
    border-top: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
    z-index: 50;
  }

  .bb-left, .bb-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bb-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
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
    padding: 4px 8px;
    cursor: pointer;
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
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.4);
    font-size: 0.7rem;
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
</style>
