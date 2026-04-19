<script lang="ts">
  import { game, placeBet, cashout, returnToIdle, setBetAmount, setGameMode, type VisualPhase } from '../core/gameController.svelte.js';
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

  // Animation support state
  let currentBowler = $derived(game.bowlerType);
  let currentTrajectory = $derived.by(() => {
    const outcome = game.currentDeliveries[game.currentBallIdx]?.outcome;
    if (!outcome || outcome.kind === 'wicket') return 'neutral' as 'six' | 'four' | 'neutral';
    if (outcome.runs === 6) return 'six';
    if (outcome.runs === 4) return 'four';
    return 'neutral';
  });
  const currentShotType = $derived(
    game.currentDeliveries[game.currentBallIdx]?.shotType ?? 'defend'
  );

  // Sync local → controller only; game.betAmount is never changed externally
  $effect(() => { setBetAmount(localBet); });

  let mult = $derived(game.displayMultiplier);
  let soundOn = $state(true);
  let lastCashout = $state<string | null>(null);
  let lastBallResult = $state<number | 'W' | null>(null);
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

  // ─── Commentary: phase + current delivery outcome → text ───
  const commentaryKey = $derived(game.deliveryKey * 10 + game.currentBallIdx);
  const commentaryText = $derived.by(() => {
    const phase = game.visualPhase;
    if (phase !== 'hit' && phase !== 'celebrate' && phase !== 'wicket') return '';
    const outcome = game.currentDeliveries[game.currentBallIdx]?.outcome;
    if (!outcome) return '';
    const seed = game.deliveryKey * 7 + game.currentBallIdx;
    if (outcome.kind === 'wicket') {
      return (['TIMBER! BOWLED!', 'OUT!! CLEAN BOWLED!', 'STUMPS ARE FLYING!', "THAT'S OUT!"] as const)[seed % 4]!;
    }
    if (outcome.runs === 6) return (['MAXIMUM! SIX!', 'OVER THE ROPE!', 'CROWD ERUPTS!', 'WHAT A HIT!'] as const)[seed % 4]!;
    if (outcome.runs === 4) return (['BOUNDARY! FOUR!', 'CRACKING DRIVE!', 'SMASHED TO THE FENCE!', 'MAGNIFICENT!'] as const)[seed % 4]!;
    if (outcome.runs >= 2) return (['GOOD RUNNING!', 'TWO MORE RUNS!', 'SHARP CRICKET!'] as const)[seed % 3]!;
    if (outcome.runs === 1) return (['QUICK SINGLE!', 'ONE RUN!', 'GOOD CALL!'] as const)[seed % 3]!;
    return (['DOT BALL.', 'WELL DEFENDED!', 'TIGHT BOWLING!'] as const)[seed % 3]!;
  });

  // ─── Scorecard: snapshot at broadcast phase for post-round summary ───
  const scorecardData = $derived.by(() => {
    if (game.phase !== 'broadcast') return null;
    const mult_val = game.payoutMultiplier;
    const bet = localBet;
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
    return localBet * profitMult;
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
    <div class="scanlines"></div>
    <div class="vignette"></div>
    <div class="glow-orb" style="background: radial-gradient(circle, rgba({accentRgb}, 0.15) 0%, transparent 70%)"></div>
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
    <!-- Left: Bet Sidebar -->
    <aside class="sidebar lg:block hidden">
      <BetPanel
        bind:amount={localBet}
        bind:autoCashout={autoCashoutVal}
        disabled={!canBet && !game.betActive}
        balance={game.balance}
        {actionState}
        mode={game.selectedMode}
        onModeChange={setGameMode}
        onCashout={cashout}
        payout={currentPayout}
        {accentColor}
        {accentRgb}
        onMainAction={handleMainAction}
      />
      
      {#if lastCashout}
        <div class="win-toast" style="--accent: {accentColor}">
          <div class="win-ring"></div>
          <span>WIN +${lastCashout}</span>
        </div>
      {/if}
    </aside>

    <!-- Center: Arena -->
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
        lossAmount={localBet}
        onRestart={returnToIdle}
      >
        <CricketSimulation
          phase={game.visualPhase}
          multiplier={mult}
          hitTrajectory={currentTrajectory}
          bowlerType={currentBowler}
          runs={typeof lastBallResult === 'number' ? lastBallResult : 0}
          deliveryKey={game.deliveryKey}
          phaseProgress={game.phaseProgress}
          shotType={currentShotType}
        />
      </GameArena>

      <!-- Mobile Overlay -->
      <div class="lg:hidden absolute bottom-4 left-4 right-4 z-30">
        <BetPanel
          bind:amount={localBet}
          bind:autoCashout={autoCashoutVal}
          disabled={!canBet && !game.betActive}
          balance={game.balance}
          {actionState}
          mode={game.selectedMode}
          onModeChange={setGameMode}
          onCashout={cashout}
          payout={currentPayout}
          {accentColor}
          {accentRgb}
          onMainAction={handleMainAction}
        />
      </div>
    </main>
  </div>
</div>

<style>
  :global(body) {
    background: #02020e;
    color: #fff;
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .page {
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #010108;
    --accent: #6366f1;
    --accent-rgb: 99,102,241;
  }

  .page-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  .scanlines {
    position: absolute;
    inset: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    background-size: 100% 2px, 3px 100%;
    opacity: 0.15;
  }
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, transparent 40%, #000 100%);
  }
  .glow-orb {
    position: absolute;
    width: 60%;
    height: 60%;
    top: 20%;
    left: 20%;
    filter: blur(100px);
    opacity: 0.4;
    transition: background 0.5s ease;
  }

  .topbar {
    position: relative;
    z-index: 20;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
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
  }
  .currency { color: rgba(255,255,255,0.4); font-size: 0.9rem; }

  .main-layout {
    flex: 1;
    display: flex;
    padding: 1rem;
    gap: 1rem;
    min-height: 0;
    z-index: 10;
  }

  .sidebar { width: 340px; flex-shrink: 0; }
  .arena-container {
    flex: 1;
    position: relative;
    background: #000;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,0.8);
    border: 1px solid rgba(255,255,255,0.03);
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
</style>
