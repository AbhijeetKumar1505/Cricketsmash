<script lang="ts">
  import { playBlip } from '../../../lib/gameAudio';
  import {
    swing,
    game,
    nudgeBetAmount,
    setBetAmount,
    setAutoPlay,
  } from '../../../core/gameController.svelte.js';
  const ROUND_OPTIONS = [10, 25, 50, 100, 500];
  let autoRounds = $state(25);

  let {
    disabled = false,
    onMainAction = () => {},
    actionState = 'bet' as 'bet' | 'cashout' | 'cancel' | 'waiting' | 'watching' | 'next',
    payout = 0,
    onCashout = () => {},
    onAutoplayRequest,
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

  function handleAutoToggle() {
    const next = !game.autoPlayOn;
    if (onAutoplayRequest && !game.autoPlayOn) {
      onAutoplayRequest();
    } else {
      setAutoPlay(next);
    }
    playBlip(next ? 560 : 300, 0.06);
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
</script>

<div class="console">
  <div class="console-shine" aria-hidden="true"></div>

  <div class="console-inner">

    <!-- ① Balance — inset engraved panel -->
    <div class="cell cell-balance" aria-label="Balance">
      <span class="cell-label">BALANCE</span>
      <div class="balance-display">
        <svg viewBox="0 0 18 14" width="13" height="10" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="16" height="12" rx="2" stroke="#c8a050" stroke-width="1.1"/>
          <path d="M1 5h16" stroke="#c8a050" stroke-width="1.1"/>
          <circle cx="13" cy="9.5" r="1.5" fill="#ffc800"/>
        </svg>
        <span class="balance-val">{currSymbol}&nbsp;{game.balance.toFixed(2)}</span>
      </div>
    </div>

    <div class="vsep" aria-hidden="true"></div>

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

    <div class="vsep" aria-hidden="true"></div>

    <!-- ③ Auto Bet -->
    <div class="cell cell-auto">
      <span class="cell-label">AUTO BET</span>
      <div class="auto-controls">
        <button
          class="auto-toggle"
          class:auto-on={game.autoPlayOn}
          onclick={handleAutoToggle}
          aria-label={game.autoPlayOn ? 'Auto bet on' : 'Auto bet off'}
          aria-pressed={game.autoPlayOn}
        >
          <span class="auto-thumb" class:auto-thumb-on={game.autoPlayOn}></span>
          <span class="auto-label">{game.autoPlayOn ? 'ON' : 'OFF'}</span>
        </button>
        <div class="rounds-wrap">
          <span class="rounds-label">ROUNDS</span>
          <div class="select-wrap">
            <select class="rounds-select" bind:value={autoRounds} aria-label="Auto-play rounds">
              {#each ROUND_OPTIONS as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
            <svg viewBox="0 0 10 6" width="8" height="5" fill="none" class="sel-arrow" aria-hidden="true">
              <path d="M1 1l4 4 4-4" stroke="rgba(255,255,255,0.3)" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="vsep" aria-hidden="true"></div>

    <!-- ⑤ PLACE BET — large metallic gold button -->
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
        <!-- Outer ring -->
        <div class="btn-ring" aria-hidden="true"></div>
        <!-- Outer rim shadow -->
        <div class="btn-rim" aria-hidden="true"></div>
      </button>
    </div>

    <!-- ⑥ Auto shortcut -->
    <div class="cell cell-auto-icon">
      <button
        class="auto-icon-btn"
        class:auto-icon-on={game.autoPlayOn}
        onclick={handleAutoToggle}
        aria-label={game.autoPlayOn ? 'Stop autoplay' : 'Start autoplay'}
        title="Auto"
      >
        <svg viewBox="0 0 22 22" width="18" height="18" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="8.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 2.5" opacity="0.45"/>
          <path d="M8.5 7.5L15.5 11l-7 3.5V7.5z" fill="currentColor"/>
        </svg>
        <span class="auto-icon-label">AUTO</span>
      </button>
    </div>

  </div>
</div>

<style>
  /* ── Shell ────────────────────────────────────────────────────────────────── */
  .console {
    position: relative;
    width: 100%;
    max-width: 860px;
    margin-bottom: 6px;
    border-radius: 12px 12px 8px 8px;
    border: 1px solid rgba(180, 140, 60, 0.22);
    /* Brushed dark metal surface */
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.008) 1px,
        transparent 2px,
        transparent 5px
      ),
      linear-gradient(180deg, #16161f 0%, #0d0d16 50%, #080810 100%);
    box-shadow:
      0 -8px 32px rgba(0,0,0,0.9),
      inset 0 1px 0 rgba(255,255,255,0.05),
      inset 0 -1px 0 rgba(0,0,0,0.7),
      inset 1px 0 0 rgba(255,255,255,0.02),
      inset -1px 0 0 rgba(255,255,255,0.02);
    overflow: visible;
  }

  /* Gold sweep at top */
  .console-shine {
    position: absolute;
    top: -1px;
    left: 15%;
    right: 15%;
    height: 1.5px;
    border-radius: 2px;
    background: linear-gradient(90deg,
      transparent,
      rgba(180,140,60,0.3),
      rgba(255,210,60,0.8),
      rgba(180,140,60,0.3),
      transparent
    );
    z-index: 2;
  }

  /* ── Inner row ─────────────────────────────────────────────────────────────── */
  .console-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 74px;
    padding: 0 8px;
  }

  /* ── Cells ──────────────────────────────────────────────────────────────────── */
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 100%;
    padding: 0 10px;
    flex: 1 1 0;
    min-width: 0;
    max-width: 220px;
  }

  .cell-balance { flex: 0 0 auto; padding: 0 14px; max-width: none; }
  .cell-cta     { flex: 0 0 auto; padding: 0 8px;  max-width: none; }
  .cell-auto-icon { flex: 0 0 auto; padding: 0 8px 0 2px; max-width: none; }

  /* Engraved label */
  .cell-label {
    font-size: 0.4rem;
    font-weight: 900;
    letter-spacing: 0.2em;
    color: rgba(255,255,255,0.55);
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Vertical separator — etched line */
  .vsep {
    width: 1px;
    height: 44px;
    background: linear-gradient(180deg,
      transparent,
      rgba(255,255,255,0.06) 20%,
      rgba(255,255,255,0.06) 80%,
      transparent
    );
    flex-shrink: 0;
  }

  /* ── Balance ───────────────────────────────────────────────────────────────── */
  .balance-display {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .balance-val {
    font-family: 'Outfit', sans-serif;
    font-size: 0.92rem;
    font-weight: 900;
    color: #e0ba6a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-shadow: 0 0 14px rgba(200,160,80,0.35);
  }

  /* ── Bet Amount ─────────────────────────────────────────────────────────────── */
  .bet-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .adj {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(180,140,60,0.25);
    /* Small metallic button */
    background: linear-gradient(180deg, rgba(50,40,10,0.6), rgba(10,10,18,0.8));
    box-shadow: inset 0 1px 0 rgba(255,210,80,0.08), 0 2px 4px rgba(0,0,0,0.5);
    color: #c8a050;
    font-size: 1rem;
    font-weight: 900;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    line-height: 1;
    transition: filter 0.12s, box-shadow 0.12s;
  }

  .adj:hover:not(:disabled) {
    filter: brightness(1.25);
    border-color: rgba(200,160,80,0.45);
  }

  .adj:active:not(:disabled) {
    filter: brightness(0.85);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);
  }

  .adj:disabled { opacity: 0.3; cursor: not-allowed; }

  .bet-input-wrap {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(180,140,60,0.18);
    border-radius: 6px;
    padding: 3px 8px;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
  }

  .bet-curr {
    font-size: 0.65rem;
    font-weight: 700;
    color: rgba(200,160,80,0.8);
  }

  .bet-input {
    background: none;
    border: none;
    outline: none;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 0.88rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    width: 72px;
    text-align: center;
    padding: 0;
    appearance: textfield;
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
  }
  .bet-input::-webkit-outer-spin-button,
  .bet-input::-webkit-inner-spin-button { appearance: none; -webkit-appearance: none; margin: 0; }
  .bet-input:disabled { opacity: 0.4; }

  /* ── Auto Bet ─────────────────────────────────────────────────────────────── */
  .auto-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px 3px 4px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.35));
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .auto-toggle.auto-on {
    border-color: rgba(0,204,102,0.45);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4), 0 0 10px rgba(0,204,102,0.15);
  }

  .auto-thumb {
    width: 18px;
    height: 10px;
    border-radius: 100px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    position: relative;
    transition: background 0.2s, border-color 0.2s;
  }

  .auto-thumb::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 1px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.35);
    transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1), background 0.2s;
  }

  .auto-thumb.auto-thumb-on {
    background: rgba(0,204,102,0.25);
    border-color: rgba(0,204,102,0.5);
  }

  .auto-thumb.auto-thumb-on::after {
    transform: translateX(8px);
    background: #00cc66;
  }

  .auto-label {
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: rgba(255,255,255,0.62);
    transition: color 0.2s;
  }

  .auto-on .auto-label { color: #00cc66; }

  .rounds-wrap {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .rounds-label {
    font-size: 0.38rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: rgba(255,255,255,0.52);
    white-space: nowrap;
  }

  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .rounds-select {
    appearance: none;
    -webkit-appearance: none;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px;
    color: rgba(255,255,255,0.82);
    font-family: 'Outfit', sans-serif;
    font-size: 0.58rem;
    font-weight: 700;
    padding: 2px 18px 2px 6px;
    cursor: pointer;
    outline: none;
  }

  .rounds-select:focus { border-color: rgba(180,140,60,0.35); }
  .rounds-select option { background: #0d0d18; color: #fff; }

  .sel-arrow {
    position: absolute;
    right: 4px;
    pointer-events: none;
  }

  /* ── CTA BUTTON ────────────────────────────────────────────────────────────── */
  .bet-btn {
    position: relative;
    width: 82px;
    height: 82px;
    border-radius: 50%;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
    transform: translateY(-5px);
    transition: filter 0.12s;
  }

  .bet-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .bet-btn:not(:disabled):active { filter: brightness(0.88); }
  .bet-btn:not(:disabled):active .btn-face { transform: scale(0.95); }

  /* Face — metallic gold dome */
  .btn-face {
    position: absolute;
    inset: 5px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    /* Layered metallic gold */
    background: radial-gradient(circle at 36% 28%,
      #ffe590 0%,
      #d4930a 35%,
      #7a4800 65%,
      #3a1e00 100%
    );
    box-shadow:
      inset 0 3px 10px rgba(255,240,140,0.4),
      inset 0 -4px 10px rgba(0,0,0,0.55),
      0 6px 18px rgba(0,0,0,0.7);
    transition: transform 0.1s;
  }

  .state-cashout .btn-face {
    background: radial-gradient(circle at 36% 28%,
      #80ffb0 0%, #00b855 35%, #005528 65%, #001a0e 100%
    );
    box-shadow: inset 0 3px 10px rgba(140,255,180,0.4), inset 0 -4px 10px rgba(0,0,0,0.5), 0 6px 22px rgba(0,180,80,0.3);
  }

  .state-hit .btn-face {
    background: radial-gradient(circle at 36% 28%,
      #fff0a0 0%, #ffcc00 35%, #885500 65%, #2a1800 100%
    );
    animation: hit-pulse 0.6s ease-in-out infinite;
  }

  .state-locked .btn-face {
    background: radial-gradient(circle at 50% 50%, #2a2a38, #111120);
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.7);
  }

  @keyframes hit-pulse {
    0%, 100% { filter: brightness(1); }
    50%       { filter: brightness(1.22); }
  }

  /* Outer ring — gold bezel */
  .btn-ring {
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    border: 2px solid rgba(200,160,80,0.6);
    box-shadow:
      0 0 0 1px rgba(200,160,80,0.12),
      0 0 20px rgba(180,135,60,0.3),
      inset 0 0 8px rgba(255,210,80,0.1);
    pointer-events: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .state-cashout .btn-ring {
    border-color: rgba(0,220,100,0.65);
    box-shadow: 0 0 22px rgba(0,200,80,0.4), inset 0 0 10px rgba(0,255,110,0.1);
  }

  .state-hit .btn-ring {
    border-color: rgba(255,210,0,0.8);
    box-shadow: 0 0 26px rgba(255,190,0,0.5), inset 0 0 12px rgba(255,230,0,0.15);
  }

  /* Outer rim shadow — depth illusion */
  .btn-rim {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.5);
    box-shadow: 0 4px 12px rgba(0,0,0,0.8), inset 0 -2px 6px rgba(0,0,0,0.6);
    pointer-events: none;
  }

  .btn-word {
    font-family: 'Outfit', sans-serif;
    font-size: 0.62rem;
    font-weight: 900;
    color: rgba(0,0,0,0.7);
    letter-spacing: 0.05em;
    line-height: 1.15;
    text-align: center;
    text-shadow: 0 1px 0 rgba(255,255,255,0.2);
  }

  .btn-big {
    font-family: 'Outfit', sans-serif;
    font-size: 0.9rem;
    font-weight: 900;
    color: rgba(0,0,0,0.65);
    text-shadow: 0 1px 0 rgba(255,255,255,0.2);
  }

  .btn-payout {
    font-size: 0.46rem;
    font-weight: 700;
    color: rgba(0,0,0,0.5);
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }

  /* ── Auto icon button ────────────────────────────────────────────────────── */
  .auto-icon-btn {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid rgba(180,140,60,0.22);
    background: radial-gradient(circle at 38% 32%, rgba(60,45,12,0.5), rgba(8,8,16,0.85));
    box-shadow:
      inset 0 1px 0 rgba(255,210,80,0.07),
      inset 0 -1px 0 rgba(0,0,0,0.5),
      0 3px 10px rgba(0,0,0,0.6);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: rgba(180,140,60,0.55);
    transform: translateY(-2px);
    transition: border-color 0.18s, color 0.18s, box-shadow 0.18s, filter 0.12s;
  }

  .auto-icon-btn:hover {
    border-color: rgba(200,160,80,0.42);
    color: #c8a050;
    box-shadow: 0 0 14px rgba(180,140,60,0.2), 0 3px 10px rgba(0,0,0,0.6),
                inset 0 1px 0 rgba(255,210,80,0.1);
  }

  .auto-icon-btn:active { filter: brightness(0.85); }

  .auto-icon-btn.auto-icon-on {
    border-color: rgba(0,204,102,0.38);
    color: #00cc66;
    box-shadow: 0 0 16px rgba(0,204,102,0.22), 0 3px 10px rgba(0,0,0,0.6);
  }

  .auto-icon-label {
    font-size: 0.4rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    line-height: 1;
    color: rgba(180,140,60,0.85);
  }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .console-inner { height: auto; flex-wrap: wrap; padding: 8px 10px 6px; justify-content: flex-start; }
    .cell { flex: 1 1 auto; padding: 4px 10px; }
    .cell-balance, .cell-cta, .cell-auto-icon { flex: 0 0 auto; }
    .vsep { display: none; }
  }
</style>
