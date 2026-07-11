<script lang="ts">
  import { playBlip, playWinTrin } from '../../../lib/gameAudio';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
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

  // Quick-stake chips — setBetAmount clamps to the table min/max.
  function setStake(mode: 'half' | 'double' | 'max') {
    if (stakeLocked) return;
    const v = mode === 'half' ? game.betAmount / 2
            : mode === 'double' ? game.betAmount * 2
            : game.balance;
    setBetAmount(v);
    playBlip(mode === 'max' ? 640 : 520, 0.05);
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
    if (isLocked && actionState !== 'cashout') return;
    playBlip(actionState === 'cashout' ? 700 : 440, 0.07);
    if (actionState === 'cashout') onCashout();
    else onMainAction();
  }

  const isLocked = $derived(actionState === 'waiting' || actionState === 'watching');

  // Swing is autonomous (driven by the probability-chosen delivery in the
  // controller), so the button only ever surfaces bet / cashout / locked.
  const btnState = $derived.by((): 'bet' | 'cashout' | 'locked' => {
    if (actionState === 'cashout') return 'cashout';
    if (isLocked) return 'locked';
    return 'bet';
  });

  const CURRENCY_SYMBOLS: Record<string, string> = {
    // Fiat
    USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$',
    JPY: '¥', CNY: '¥', KRW: '₩', HKD: 'HK$', SGD: 'S$',
    INR: '₹', BRL: 'R$', MXN: '$', ARS: '$', CLP: '$', PEN: 'S/',
    COP: '$', NOK: 'kr', SEK: 'kr', DKK: 'kr', CHF: 'Fr', PLN: 'zł',
    CZK: 'Kč', HUF: 'Ft', RON: 'lei', TRY: '₺', AED: 'د.إ',
    RUB: '₽', IDR: 'Rp', VND: '₫', NGN: '₦', ZAR: 'R',
    PHP: '₱', THB: '฿', MYR: 'RM',
    // Crypto
    BTC: '₿', ETH: 'Ξ', LTC: 'Ł', DOGE: 'Ð', ADA: '₳',
    XRP: 'XRP', BNB: 'BNB', SOL: 'SOL', TRX: 'TRX', USDT: '$',
    USDC: '$', AVAX: 'AVAX', MATIC: 'MATIC', LINK: 'LINK', DOT: 'DOT',
    UNI: 'UNI', APE: 'APE', SHIB: 'SHIB',
    // Stake social currencies
    XGC: 'GC', XSC: 'SC',
  };
  const CURRENCY_DECIMALS: Record<string, number> = {
    JPY: 0, KRW: 0, IDR: 0, VND: 0, CLP: 0, HUF: 0,
    BTC: 8, ETH: 6, LTC: 6, DOGE: 4, ADA: 4,
    XRP: 4, BNB: 4, SOL: 4, TRX: 4, AVAX: 4, MATIC: 4,
  };

  const currSymbol   = $derived(CURRENCY_SYMBOLS[game.currency] ?? game.currency);
  const currDecimals = $derived(CURRENCY_DECIMALS[game.currency] ?? 2);

  const btnDisabled = $derived(
    (isLocked || disabled) && actionState !== 'cashout'
  );

  const bonusBuySurcharge = $derived(game.betAmount * 0.30);
  const canBonusBuy = $derived(
    game.bonusBuyAvailable &&
    !game.betActive && !game.sessionActive &&
    game.balance >= game.betAmount + bonusBuySurcharge
  );
  const insuranceCost = $derived(game.betAmount * 0.10);
  const canInsurance = $derived(
    !game.betActive && !game.sessionActive &&
    game.balance >= insuranceCost
  );

  let insAlert = $state<string | null>(null);
  let insAlertTimer = 0;

  // Bonus / insurance popover (opens just above the BONUS button)
  let showBonusMenu = $state(false);
  function toggleBonusMenu(e: Event) {
    e.stopPropagation();
    if (game.betActive || game.sessionActive) return;
    showBonusMenu = !showBonusMenu;
    playBlip(showBonusMenu ? 600 : 380, 0.05);
  }

  function scheduleBonusAlertClear() {
    setTimeout(() => { game.bonusBuyAlert = null; }, 2200);
  }

  function scheduleInsAlertClear() {
    clearTimeout(insAlertTimer);
    insAlertTimer = window.setTimeout(() => { insAlert = null; }, 2200);
  }

  function handleBonusBuy() {
    if (game.betActive || game.sessionActive) return;
    // Already armed → clicking disarms (no balance checks needed).
    if (game.bonusBuyArmed) {
      placeBonusBuy();
      playBlip(360, 0.08);
      showBonusMenu = false;
      return;
    }
    if (!game.bonusBuyAvailable) {
      game.bonusBuyAlert = 'Bonus Buy unavailable';
      scheduleBonusAlertClear();
      return;
    }
    if (game.balance < game.betAmount + bonusBuySurcharge) {
      game.bonusBuyAlert = 'Insufficient balance';
      scheduleBonusAlertClear();
      return;
    }
    placeBonusBuy();
    playBlip(800, 0.1);
    showBonusMenu = false;
  }

  function handleInsurance() {
    if (game.insuranceActive) {
      deactivateInsurance();
      playBlip(440, 0.08);
      showBonusMenu = false;
      return;
    }
    if (game.betActive || game.sessionActive) return;
    if (game.balance < insuranceCost) {
      insAlert = 'Insufficient balance';
      scheduleInsAlertClear();
      return;
    }
    activateInsurance();
    playBlip(700, 0.1);
    showBonusMenu = false;
  }
</script>

<svelte:window onclick={() => { if (showBonusMenu) showBonusMenu = false; }} />

{#if game.winToast}
  <div class="win-toast"
       class:win-toast--mega={game.winToast.multiplier > 3}
       class:win-toast--flat={game.winToast.multiplier <= 1}
       transition:fly={{ y: -20, duration: 350, easing: cubicOut }}
       onintroend={() => { if ((game.winToast?.multiplier ?? 0) > 1) playWinTrin(game.winToast?.multiplier ?? 1); }}>
    {#if game.winToast.multiplier > 3}
      <span class="win-mega">MEGA WIN</span>
    {/if}
    <span class="win-amt">{game.winToast.multiplier > 1 ? '+' : ''}{currSymbol}{game.winToast.amount.toFixed(currDecimals)}</span>
  </div>
{/if}

<div class="console crystal-panel">
  <div class="console-inner">

    <!-- ① Balance -->
    <div class="cell cell-balance" aria-label="Balance">
      <span class="cell-label">BALANCE</span>
      <span class="balance-val">{currSymbol}&nbsp;{game.balance.toFixed(currDecimals)}</span>
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
      <div class="stake-chips">
        <button class="stake-chip" onclick={() => setStake('half')} disabled={stakeLocked} aria-label="Halve bet">½</button>
        <button class="stake-chip" onclick={() => setStake('double')} disabled={stakeLocked} aria-label="Double bet">2×</button>
        <button class="stake-chip" onclick={() => setStake('max')} disabled={stakeLocked} aria-label="Max bet">MAX</button>
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

    <!-- ④ Bonus — big button with Bonus Buy + Insurance popover -->
    <div class="cell cell-chips" style="position:relative;">
      {#if game.bonusBuyAlert}
        <div class="bb-alert bb-alert-buy" transition:fly={{ y: -8, duration: 200 }}>
          {game.bonusBuyAlert}
        </div>
      {:else if insAlert}
        <div class="bb-alert bb-alert-ins" transition:fly={{ y: -8, duration: 200 }}>
          {insAlert}
        </div>
      {/if}

      {#if showBonusMenu}
        <div
          class="bonus-menu"
          role="menu"
          transition:fly={{ y: 8, duration: 160, easing: cubicOut }}
        >
          <button
            class="bonus-opt"
            class:is-active={game.bonusBuyArmed}
            class:is-disabled={!canBonusBuy && !game.bonusBuyArmed}
            onclick={handleBonusBuy}
            aria-label={game.bonusBuyArmed ? 'Disarm bonus buy' : 'Bonus Buy'}
          >
            <span class="opt-icon">★</span>
            <span class="opt-text">
              <span class="opt-title">Bonus Buy{game.bonusBuyArmed ? ' · ARMED' : ''}</span>
              <span class="opt-sub">Powerplay over · +{currSymbol}{bonusBuySurcharge.toFixed(currDecimals)}</span>
            </span>
          </button>
          <button
            class="bonus-opt"
            class:is-active={game.insuranceActive}
            class:is-disabled={!canInsurance && !game.insuranceActive}
            onclick={handleInsurance}
            aria-label={game.insuranceActive ? 'Deactivate feature spin' : 'Feature Spin'}
          >
            <span class="opt-icon">🛡</span>
            <span class="opt-text">
              <span class="opt-title">Feature Spin{game.insuranceActive ? ' · ON' : ''}</span>
              <span class="opt-sub">Refund on wicket · {currSymbol}{insuranceCost.toFixed(currDecimals)}</span>
            </span>
          </button>
        </div>
      {/if}

      <button
        class="bonus-main"
        class:menu-open={showBonusMenu}
        class:has-active={game.insuranceActive || game.bonusBuyArmed}
        onclick={toggleBonusMenu}
        aria-haspopup="menu"
        aria-expanded={showBonusMenu}
        aria-label="Bonus and feature options"
      >
        <span class="bonus-main-icon">★</span>
        <span class="bonus-main-label">BONUS</span>
        {#if game.insuranceActive || game.bonusBuyArmed}<span class="bonus-main-dot" aria-hidden="true"></span>{/if}
      </button>
    </div>

    <!-- ⑤ PLACE BET — large gold dome -->
    <div class="cell cell-cta">
      <button
        class="bet-btn"
        class:state-cashout={btnState === 'cashout'}
        class:state-locked={btnState === 'locked'}
        onclick={handleMainPress}
        disabled={btnDisabled}
        aria-label={btnState === 'cashout' ? 'Cash out' : 'Place bet'}
      >
        <div class="btn-face">
          {#if btnState === 'cashout'}
            <span class="btn-word">CASH</span>
            <span class="btn-word">OUT</span>
            {#if payout > 0}
              <span class="btn-payout">{currSymbol}{payout.toFixed(currDecimals)}</span>
            {/if}
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

  /* Quick-stake chips */
  .stake-chips {
    display: flex;
    gap: 6px;
    margin-top: 5px;
    justify-content: center;
  }
  .stake-chip {
    flex: 1 1 auto;
    max-width: 74px;
    height: 22px;
    border-radius: 7px;
    border: 1px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    color: var(--gold-cream);
    font-family: 'Outfit', sans-serif;
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    cursor: pointer;
    padding: 0;
    transition: filter 0.12s, border-color 0.15s, color 0.15s;
  }
  .stake-chip:hover:not(:disabled) {
    filter: brightness(1.25);
    border-color: var(--gold-edge);
    color: var(--gold-bright);
  }
  .stake-chip:active:not(:disabled) { filter: brightness(0.85); transform: scale(0.96); }
  .stake-chip:disabled { opacity: 0.3; cursor: not-allowed; }

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

  /* ── ④ Bonus button — big, opens popover ─────────────────────────────────── */
  .bonus-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 78px;
    height: 78px;
    border-radius: 16px;
    border: 1.5px solid var(--gold-edge);
    background:
      radial-gradient(circle at 50% 30%, rgba(255, 210, 90, 0.14), transparent 65%),
      linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 0 16px rgba(255, 184, 0, 0.20),
      0 3px 10px rgba(0, 0, 0, 0.5);
    color: var(--gold-bright);
    cursor: pointer;
    padding: 0;
    position: relative;
    transition: filter 0.12s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.12s;
  }

  .bonus-main:hover:not(:disabled) {
    filter: brightness(1.2);
    border-color: var(--gold-bright);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      0 0 24px rgba(255, 184, 0, 0.36),
      0 3px 12px rgba(0, 0, 0, 0.5);
  }

  .bonus-main:active:not(:disabled) { filter: brightness(0.9); transform: scale(0.97); }

  .bonus-main.menu-open {
    border-color: var(--gold-bright);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      0 0 26px rgba(255, 184, 0, 0.42),
      0 3px 12px rgba(0, 0, 0, 0.5);
  }

  .bonus-main.has-active {
    border-color: rgba(0, 255, 153, 0.6);
  }

  .bonus-main-icon { font-size: 1.5rem; line-height: 1; }

  .bonus-main-label {
    font-family: 'Outfit', sans-serif;
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    line-height: 1;
    color: inherit;
  }

  .bonus-main-dot {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 8px rgba(0, 255, 153, 0.8);
  }

  /* Popover just above the BONUS button */
  .bonus-menu {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    width: 232px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 14px;
    border: 1px solid var(--gold-edge);
    background: linear-gradient(180deg, rgba(14, 18, 40, 0.98), rgba(6, 9, 24, 0.98));
    box-shadow:
      0 12px 34px rgba(0, 0, 0, 0.7),
      0 0 22px rgba(255, 184, 0, 0.14);
    z-index: 40;
  }

  .bonus-menu::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 7px solid transparent;
    border-top-color: rgba(8, 11, 28, 0.98);
  }

  .bonus-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 11px;
    border-radius: 10px;
    border: 1px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    color: var(--gold-cream);
    cursor: pointer;
    text-align: left;
    transition: filter 0.12s, border-color 0.15s, box-shadow 0.15s;
  }

  .bonus-opt:hover:not(.is-disabled) {
    filter: brightness(1.2);
    border-color: var(--gold-edge);
  }

  .bonus-opt:active:not(.is-disabled) { filter: brightness(0.88); }

  .bonus-opt.is-active {
    border-color: rgba(0, 255, 153, 0.55);
    box-shadow: inset 0 0 12px rgba(0, 255, 153, 0.18);
  }

  .bonus-opt.is-disabled { opacity: 0.35; cursor: not-allowed; }

  .opt-icon { font-size: 1.1rem; line-height: 1; flex-shrink: 0; }

  .opt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

  .opt-title {
    font-family: 'Outfit', sans-serif;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1;
    color: var(--gold-bright);
  }

  .bonus-opt.is-active .opt-title { color: var(--success); }

  .opt-sub {
    font-size: 0.56rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.1;
    color: rgba(255, 241, 163, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Win toast ─────────────────────────────────────────────────────────── */
  .win-toast {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.82);
    border: 1px solid #ffd700;
    border-radius: 24px;
    padding: 6px 22px;
    display: flex;
    gap: 10px;
    align-items: baseline;
    pointer-events: none;
    z-index: 30;
    white-space: nowrap;
    margin-bottom: 8px;
  }

  .win-amt  { color: #00ff88; font-size: 1.35rem; font-weight: 700; letter-spacing: 0.04em; }
  .win-mega {
    color: #ffe27a;
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 0.28em;
    text-shadow: 0 0 12px rgba(255, 210, 90, 0.9);
  }
  .win-toast--mega {
    border-color: #ffe27a;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }
  .win-toast--mega .win-amt { color: #ffe27a; }

  /* Dot / wicket — neutral return, no green/red, no glow */
  .win-toast--flat { border-color: rgba(255, 241, 163, 0.30); }
  .win-toast--flat .win-amt {
    color: rgba(255, 241, 205, 0.88);
    font-weight: 800;
  }

  /* ── Bonus buy alert pill ──────────────────────────────────────────────── */
  .bb-alert {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(200, 40, 40, 0.90);
    border: 1px solid rgba(255, 80, 80, 0.6);
    border-radius: 12px;
    padding: 4px 12px;
    font-size: 0.55rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    pointer-events: none;
    z-index: 20;
    margin-bottom: 4px;
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

  .state-locked .btn-face {
    background: radial-gradient(circle at 50% 50%, #1a1e2c, #07090f);
    box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.7);
    animation: none;
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
    .bonus-main { width: 66px; height: 66px; }
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
