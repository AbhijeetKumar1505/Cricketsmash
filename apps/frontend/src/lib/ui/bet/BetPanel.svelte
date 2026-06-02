<script lang="ts">
  import { playBlip } from '../../../lib/gameAudio';
  import {
    swing,
    game,
    nudgeBetAmount,
    setBetAmount,
    setAutoPlay,
    placeBonusBuy,
    activateInsurance,
    deactivateInsurance,
  } from '../../../core/gameController.svelte.js';
  import { navigationState } from '../../../core/navigation.svelte.js';

  let {
    disabled = false,
    onMainAction = () => {},
    actionState = 'bet' as 'bet' | 'cashout' | 'cancel' | 'waiting' | 'watching' | 'next',
    payout = 0,
    onCashout = () => {},
  } = $props<{
    disabled?: boolean;
    onMainAction?: () => void;
    onCashout?: () => void;
    onAutoplayRequest?: () => void;
    actionState?: 'bet' | 'cashout' | 'cancel' | 'waiting' | 'watching' | 'next';
    payout?: number;
  }>();

  const stakeLocked = $derived(game.sessionActive || game.betActive || disabled);

  function handleAdjust(delta: number) {
    if (stakeLocked) return;
    nudgeBetAmount(delta);
    playBlip(520, 0.05);
  }

  function handleAmountInput(e: Event) {
    if (stakeLocked) return;
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v) && v > 0) setBetAmount(v);
  }

  function handleAutoClick() {
    // Click: toggle autobet directly with current config.
    // Right-click / long-press / chevron tap: open config overlay.
    if (game.autoPlayOn) {
      setAutoPlay(false);
      playBlip(300, 0.06);
    } else {
      navigationState.activeOverlay = 'autobet';
      playBlip(560, 0.06);
    }
  }

  function openAutobetConfig(e: Event) {
    e.stopPropagation();
    navigationState.activeOverlay = 'autobet';
    playBlip(620, 0.06);
  }

  function handleMainPress() {
    if (game.visualPhase === 'bowl') {
      swing();
      playBlip(600, 0.07);
      return;
    }
    if (isLocked && actionState !== 'cashout') return;
    playBlip(actionState === 'cashout' ? 700 : 440, 0.07);
    if (actionState === 'cashout') onCashout();
    else onMainAction();
  }

  const isLocked = $derived(actionState === 'waiting' || actionState === 'watching');

  const btnState = $derived.by((): 'bet' | 'hit' | 'cashout' | 'locked' => {
    if (actionState === 'cashout') return 'cashout';
    if (game.visualPhase === 'bowl') return 'hit';
    if (isLocked) return 'locked';
    return 'bet';
  });

  const currSymbol = $derived(
    game.currency === 'USD' ? '$' :
    game.currency === 'EUR' ? '€' :
    game.currency === 'GBP' ? '£' :
    game.currency === 'INR' ? '₹' :
    game.currency
  );

  const btnDisabled = $derived(
    (isLocked || disabled) && actionState !== 'cashout' && game.visualPhase !== 'bowl'
  );

  const canBonusBuy = $derived(
    !game.betActive && !game.sessionActive && game.balance >= game.betAmount && game.betAmount > 0
  );
  const insuranceCost = $derived(game.betAmount * 10);
  const canInsurance = $derived(
    !game.betActive && !game.sessionActive && game.balance >= insuranceCost && game.betAmount > 0
  );

  function handleBonusBuy() {
    if (!canBonusBuy) return;
    void placeBonusBuy();
    playBlip(800, 0.1);
  }

  function handleInsurance() {
    if (game.insuranceActive) {
      deactivateInsurance();
      playBlip(440, 0.08);
    } else {
      if (!canInsurance) return;
      activateInsurance();
      playBlip(700, 0.1);
    }
  }
</script>

<div class="console crystal-panel">
  <div class="console-inner">

    <!-- ① Balance -->
    <div class="cell cell-balance" aria-label="Balance">
      <span class="cell-label">BALANCE</span>
      <span class="balance-val">{currSymbol}&nbsp;{game.balance.toFixed(2)}</span>
    </div>

    <!-- ② Bet Amount -->
    <div class="cell cell-bet">
      <span class="cell-label">BET AMOUNT</span>
      <div class="bet-controls">
        <button class="adj" onclick={() => handleAdjust(-1)} disabled={stakeLocked} aria-label="Decrease bet">−</button>
        <div class="bet-input-wrap">
          <span class="bet-curr">{currSymbol}</span>
          <input
            class="bet-input"
            type="number" min="0.01" step="0.01"
            value={game.betAmount.toFixed(2)}
            disabled={stakeLocked}
            oninput={handleAmountInput}
            aria-label="Bet amount"
          />
        </div>
        <button class="adj" onclick={() => handleAdjust(1)} disabled={stakeLocked} aria-label="Increase bet">+</button>
      </div>
    </div>

    <!-- ③ Auto Bet — circular crystal disc + chevron-config -->
    <div class="cell cell-auto">
      <button
        class="auto-disc"
        class:auto-on={game.autoPlayOn}
        onclick={handleAutoClick}
        aria-label={game.autoPlayOn ? 'Stop autobet' : 'Configure autobet'}
        aria-pressed={game.autoPlayOn}
      >
        {#if game.autoPlayOn}
          <svg class="auto-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
            <rect x="6" y="6" width="4" height="12" rx="1" fill="currentColor"/>
            <rect x="14" y="6" width="4" height="12" rx="1" fill="currentColor"/>
          </svg>
        {:else}
          <svg class="auto-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
            <path d="M12 4a8 8 0 11-5.66 13.66" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M4 12V6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
        <span class="auto-label">{game.autoPlayOn ? 'STOP' : 'AUTO'}</span>
      </button>
      <button
        class="auto-cfg"
        onclick={openAutobetConfig}
        aria-label="Configure autobet"
        title="Configure autobet"
      >
        <svg viewBox="0 0 12 8" width="10" height="7" fill="none" aria-hidden="true">
          <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- ④ Feature Chips — BUY + INS -->
    <div class="cell cell-chips">
      <button
        class="feat-chip"
        class:is-disabled={!canBonusBuy}
        onclick={handleBonusBuy}
        disabled={!canBonusBuy}
        aria-label="Bonus Buy"
      >
        <span class="chip-icon">★</span>
        <span class="chip-label">BUY</span>
      </button>
      <button
        class="feat-chip"
        class:is-active={game.insuranceActive}
        class:is-disabled={!canInsurance && !game.insuranceActive}
        onclick={handleInsurance}
        disabled={!canInsurance && !game.insuranceActive}
        aria-label={game.insuranceActive ? 'Deactivate insurance' : 'Activate insurance'}
      >
        <span class="chip-icon">🛡</span>
        <span class="chip-label">INS</span>
      </button>
    </div>

    <!-- ⑤ PLACE BET — large gold dome -->
    <div class="cell cell-cta">
      <button
        class="bet-btn"
        class:state-cashout={btnState === 'cashout'}
        class:state-hit={btnState === 'hit'}
        class:state-locked={btnState === 'locked'}
        onclick={handleMainPress}
        disabled={btnDisabled}
        aria-label={btnState === 'cashout' ? 'Cash out' : btnState === 'hit' ? 'Hit' : 'Place bet'}
      >
        <div class="btn-face">
          {#if btnState === 'cashout'}
            <span class="btn-word">CASH</span>
            <span class="btn-word">OUT</span>
            {#if payout > 0}
              <span class="btn-payout">{currSymbol}{payout.toFixed(2)}</span>
            {/if}
          {:else if btnState === 'hit'}
            <span class="btn-big">HIT</span>
          {:else if btnState === 'locked'}
            <span class="btn-word">WAIT</span>
          {:else}
            <span class="btn-word">PLACE</span>
            <span class="btn-word">BET</span>
          {/if}
        </div>
        <div class="btn-shine sweep-layer" aria-hidden="true"></div>
        <div class="btn-ring" aria-hidden="true"></div>
        <div class="btn-rim" aria-hidden="true"></div>
      </button>
    </div>

  </div>
</div>

<style>
  /* ── Shell ────────────────────────────────────────────────────────────────── */
  .console {
    position: relative;
    width: 100%;
    max-width: 1080px;
    border-radius: 16px 16px 12px 12px;
    overflow: visible;
  }

  /* ── Inner row ─────────────────────────────────────────────────────────────── */
  .console-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 98px;
    padding: 0 14px;
  }

  /* ── Cells ──────────────────────────────────────────────────────────────────── */
  .cell {
    display: flex;
    align-items: center;
    height: 100%;
    flex-shrink: 0;
  }

  .cell-balance { padding: 0 18px 0 8px; gap: 12px; }
  .cell-bet     { flex: 1 1 auto; padding: 0 14px; justify-content: center; max-width: 320px; }
  .cell-auto    { padding: 0 12px; gap: 4px; position: relative; }
  .cell-chips   { padding: 0 8px; flex-direction: column; gap: 5px; justify-content: center; }
  .cell-cta     { padding: 0 4px 0 12px; }

  .cell-label {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: rgba(255, 241, 163, 0.45);
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ── ① Balance ──────────────────────────────────────────────────────────── */
  .cell-balance .cell-label {
    color: rgba(255, 241, 163, 0.40);
  }

  .balance-val {
    font-family: 'Outfit', sans-serif;
    font-size: 1.1rem;
    font-weight: 900;
    color: var(--gold-bright);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    letter-spacing: -0.01em;
    text-shadow: 0 0 14px rgba(255, 184, 0, 0.38);
    transition: filter 0.2s;
  }

  /* ── ② Bet Amount ───────────────────────────────────────────────────────── */
  .cell-bet {
    flex-direction: column;
    gap: 4px;
    justify-content: center;
  }

  .bet-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 240px;
  }

  .adj {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.10),
      0 2px 6px rgba(0, 0, 0, 0.45);
    color: var(--gold-cream);
    font-size: 1.3rem;
    font-weight: 900;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    line-height: 1;
    transition: filter 0.12s, border-color 0.15s, color 0.15s;
  }

  .adj:hover:not(:disabled) {
    filter: brightness(1.3);
    border-color: var(--gold-edge);
    color: var(--gold-bright);
  }

  .adj:active:not(:disabled) { filter: brightness(0.85); transform: scale(0.96); }
  .adj:disabled { opacity: 0.3; cursor: not-allowed; }

  .bet-input-wrap {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.2));
    border: 1px solid var(--crystal-bd);
    border-radius: 10px;
    padding: 6px 12px;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.55);
    min-height: 40px;
  }

  .bet-curr {
    font-family: 'Outfit', sans-serif;
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--gold-cream);
    opacity: 0.85;
  }

  .bet-input {
    background: none;
    border: none;
    outline: none;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 1.05rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    width: 100%;
    max-width: 110px;
    text-align: center;
    padding: 0;
    appearance: textfield;
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
    letter-spacing: -0.01em;
  }
  .bet-input::-webkit-outer-spin-button,
  .bet-input::-webkit-inner-spin-button { appearance: none; -webkit-appearance: none; margin: 0; }
  .bet-input:disabled { opacity: 0.5; }

  /* ── ③ Auto Bet — circular crystal disc ─────────────────────────────────── */
  .auto-disc {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 1.5px solid var(--electric);
    background:
      conic-gradient(from 90deg,
        var(--crystal-3) 0deg,
        rgba(0, 231, 255, 0.18) 90deg,
        var(--crystal-3) 180deg,
        rgba(168, 100, 255, 0.18) 270deg,
        var(--crystal-3) 360deg),
      linear-gradient(180deg, #1c1f55, #0a0d28);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(0, 0, 0, 0.5),
      0 0 22px rgba(0, 231, 255, 0.35),
      0 3px 12px rgba(0, 0, 0, 0.6);
    color: var(--electric);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 0;
    position: relative;
    transition: filter 0.15s, border-color 0.18s, color 0.18s, box-shadow 0.18s;
  }

  .auto-disc:hover {
    filter: brightness(1.18);
    border-color: var(--gold-edge);
    color: var(--gold-bright);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(0, 0, 0, 0.5),
      0 0 22px rgba(255, 184, 0, 0.30),
      0 3px 12px rgba(0, 0, 0, 0.6);
  }

  .auto-disc.auto-on {
    color: var(--success);
    border-color: rgba(0, 255, 153, 0.45);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 0 22px rgba(0, 255, 153, 0.32),
      0 3px 12px rgba(0, 0, 0, 0.6);
    animation: auto-pulse 1.6s ease-in-out infinite;
  }

  @keyframes auto-pulse {
    0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 0 22px rgba(0,255,153,0.32), 0 3px 12px rgba(0,0,0,0.6); }
    50%       { box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 0 34px rgba(0,255,153,0.50), 0 3px 12px rgba(0,0,0,0.6); }
  }

  .auto-icon {
    display: block;
  }

  .auto-label {
    font-family: 'Outfit', sans-serif;
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.20em;
    line-height: 1;
    color: inherit;
  }

  /* Chevron under the disc → opens config overlay */
  .auto-cfg {
    width: 22px;
    height: 14px;
    margin-top: 2px;
    border-radius: 6px;
    border: 1px solid var(--crystal-bd);
    background: var(--crystal-1);
    color: rgba(255, 241, 163, 0.55);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    line-height: 1;
    transition: color 0.15s, border-color 0.15s;
  }
  .auto-cfg:hover {
    color: var(--gold-bright);
    border-color: var(--gold-edge);
  }

  /* ── ④ Feature Chips ────────────────────────────────────────────────────── */
  .feat-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    width: 52px;
    height: 38px;
    border-radius: 10px;
    border: 1.5px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.10),
      0 2px 6px rgba(0, 0, 0, 0.45);
    color: var(--gold-cream);
    cursor: pointer;
    padding: 0;
    transition: filter 0.12s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
  }

  .feat-chip:hover:not(:disabled) {
    filter: brightness(1.25);
    border-color: var(--gold-edge);
    color: var(--gold-bright);
  }

  .feat-chip:active:not(:disabled) { filter: brightness(0.85); transform: scale(0.96); }

  .feat-chip.is-active {
    border-color: rgba(0, 255, 153, 0.55);
    color: var(--success);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 0 14px rgba(0, 255, 153, 0.28),
      0 2px 6px rgba(0, 0, 0, 0.45);
  }

  .feat-chip.is-disabled,
  .feat-chip:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chip-icon {
    font-size: 0.78rem;
    line-height: 1;
  }

  .chip-label {
    font-family: 'Outfit', sans-serif;
    font-size: 0.38rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    line-height: 1;
    color: inherit;
  }

  /* ── ⑤ PLACE BET — 120px gold dome ─────────────────────────────────────── */
  .bet-btn {
    position: relative;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
    transform: translateY(-2px);
    transition: filter 0.12s;
  }

  .bet-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .bet-btn:not(:disabled):active { filter: brightness(0.88); }
  .bet-btn:not(:disabled):active .btn-face { transform: scale(0.96); }

  /* Face — 4-layer composition: metal body + crystal core + radial shine */
  .btn-face {
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 2;
    background:
      radial-gradient(circle at 50% 38%,
        rgba(255, 255, 220, 0.55) 0%,
        rgba(255, 255, 220, 0.10) 18%,
        transparent 36%),
      radial-gradient(circle at 36% 28%,
        var(--gold-cream) 0%,
        var(--gold-bright) 24%,
        var(--gold) 48%,
        #8a5800 75%,
        #2a1800 100%);
    box-shadow:
      inset 0 4px 12px rgba(255, 240, 180, 0.45),
      inset 0 -5px 12px rgba(0, 0, 0, 0.55),
      0 8px 22px rgba(0, 0, 0, 0.75);
    transition: transform 0.12s, background 0.2s;
    animation: bet-breathe 3.4s ease-in-out infinite;
  }

  @keyframes bet-breathe {
    0%, 100% { filter: brightness(1); }
    50%       { filter: brightness(1.08); }
  }

  /* Sweep — inherits .sweep-layer + circular clip */
  .btn-shine {
    border-radius: 50%;
    overflow: hidden;
    inset: 6px;
    width: auto;
    height: auto;
    z-index: 3;
  }

  .state-cashout .btn-face {
    background:
      radial-gradient(circle at 50% 38%,
        rgba(220, 255, 230, 0.55) 0%,
        rgba(180, 255, 200, 0.12) 18%,
        transparent 36%),
      radial-gradient(circle at 36% 28%,
        #d0ffd8 0%,
        #00ff99 25%,
        #00aa55 50%,
        #003a20 100%);
    box-shadow:
      inset 0 4px 12px rgba(200, 255, 220, 0.45),
      inset 0 -5px 12px rgba(0, 0, 0, 0.5),
      0 8px 26px rgba(0, 255, 153, 0.32);
    animation: none;
  }

  .state-hit .btn-face {
    background: radial-gradient(circle at 36% 28%,
      var(--gold-cream) 0%, var(--gold-bright) 30%, var(--gold) 55%, #4a2800 100%);
    animation: hit-pulse 0.55s ease-in-out infinite;
  }

  .state-locked .btn-face {
    background: radial-gradient(circle at 50% 50%, #1a1e2c, #07090f);
    box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.7);
    animation: none;
  }

  @keyframes hit-pulse {
    0%, 100% { filter: brightness(1); }
    50%       { filter: brightness(1.25); }
  }

  /* Outer ring — gold bezel with intense glow */
  .btn-ring {
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    border: 2.5px solid var(--gold);
    box-shadow:
      0 0 0 1px rgba(255, 184, 0, 0.22),
      0 0 42px rgba(255, 184, 0, 0.62),
      inset 0 0 14px rgba(255, 217, 90, 0.20);
    pointer-events: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    z-index: 1;
  }

  .state-cashout .btn-ring {
    border-color: rgba(0, 255, 153, 0.65);
    box-shadow: 0 0 30px rgba(0, 255, 153, 0.5), inset 0 0 12px rgba(0, 255, 153, 0.18);
  }

  .state-hit .btn-ring {
    border-color: var(--gold-bright);
    box-shadow: 0 0 34px rgba(255, 217, 90, 0.6), inset 0 0 14px rgba(255, 230, 100, 0.22);
  }

  .state-locked .btn-ring {
    border-color: rgba(255, 255, 255, 0.10);
    box-shadow: none;
  }

  /* Outer rim shadow — depth illusion */
  .btn-rim {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.55);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.85), inset 0 -2px 6px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    z-index: 0;
  }

  .btn-word {
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 900;
    color: rgba(0, 0, 0, 0.78);
    letter-spacing: 0.06em;
    line-height: 1.05;
    text-align: center;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.22);
  }

  .btn-big {
    font-family: 'Outfit', sans-serif;
    font-size: 1.35rem;
    font-weight: 900;
    color: rgba(0, 0, 0, 0.72);
    letter-spacing: 0.04em;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.22);
  }

  .btn-payout {
    font-size: 0.6rem;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.55);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
    letter-spacing: -0.01em;
  }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .console-inner { height: 88px; padding: 0 8px; }
    .cell-bet { max-width: 260px; }
    .bet-controls { width: 200px; gap: 6px; }
    .adj { width: 34px; height: 34px; }
    .bet-btn { width: 92px; height: 92px; }
    .auto-disc { width: 54px; height: 54px; }
    .feat-chip { width: 46px; height: 34px; }
  }

  @media (max-width: 540px) {
    .console-inner { height: auto; flex-wrap: wrap; padding: 8px 6px; justify-content: center; gap: 8px; }
    .cell { flex: 0 0 auto; height: auto; }
    .cell-bet { flex: 1 0 100%; order: 1; }
    .cell-balance { order: 0; }
    .cell-auto    { order: 2; }
    .cell-chips   { order: 3; flex-direction: row; }
    .cell-cta     { order: 4; }
  }
</style>
