<script lang="ts">
  import { gsap } from 'gsap';
  import { playBlip } from '../gameAudio';
  import { swing, game } from '../../core/gameController.svelte.js';

  let {
    amount = $bindable(10),
    autoCashout = $bindable(2.0),
    disabled = false,
    onMainAction = () => {},
    actionState = 'bet' as 'bet' | 'cashout' | 'cancel' | 'waiting' | 'betting' | 'watching' | 'next',
    payout = 0,
    onCashout = () => {},
  } = $props<{
    amount: number;
    autoCashout: number | null;
    disabled?: boolean;
    onMainAction?: () => void;
    onCashout?: () => void;
    actionState?: 'bet' | 'cashout' | 'cancel' | 'waiting' | 'betting' | 'watching' | 'next';
    payout?: number;
  }>();

  let mainBtn = $state<HTMLElement>();
  const QUICK_BETS = [10, 50, 100, 250];

  function adjust(val: number) {
    if (disabled && actionState !== 'cashout') return;
    amount = val;
    playBlip(520, 0.05);
  }

  function handleMainDown() {
    if (!mainBtn || (isLocked && game.visualPhase !== 'bowl')) return;
    gsap.to(mainBtn, { scale: 0.96, duration: 0.1, ease: 'power2.out' });
  }

  function handleMainUp() {
    if (!mainBtn) return;
    gsap.to(mainBtn, { scale: 1, duration: 0.28, ease: 'back.out(3)' });
  }

  function handleMainClick() {
    if (game.visualPhase === 'bowl') {
      swing();
      return;
    }

    if (isLocked && actionState !== 'cashout') return;
    playBlip(actionState === 'cashout' ? 700 : 400, 0.06);

    if (actionState === 'cashout' && onCashout) {
      onCashout();
    } else {
      onMainAction();
    }
  }

  const isLocked = $derived(
    actionState === 'waiting' || actionState === 'betting' || actionState === 'watching'
  );

  const mainBtnClass = $derived.by(() => {
    if (actionState === 'cashout') return 'cta-cashout';
    if (game.visualPhase === 'bowl') return 'cta-swing';
    if (isLocked) return 'cta-locked';
    return 'cta-play';
  });

  const mainBtnLabel = $derived.by(() => {
    if (actionState === 'bet') return 'PLAY BALL!';
    if (actionState === 'cashout') return 'CASH OUT';
    if (game.visualPhase === 'bowl') return 'SWING!';
    if (actionState === 'waiting') return 'WAITING…';
    if (actionState === 'betting') return 'BETTING…';
    if (actionState === 'watching') return 'IN PLAY';
    return 'PLAY BALL!';
  });
</script>

<!-- Bottom-center stadium dock — horizontal, low footprint -->
<div class="bet-dock">
  <div class="dock-rim"></div>

  <div class="dock-grid">
    <div class="dock-col dock-amount">
      <span class="dock-label">YOUR BET</span>
      <div class="dock-input-wrap">
        <span class="dock-curr" aria-hidden="true">$</span>
        <input
          class="dock-input"
          type="number"
          aria-label="Bet amount"
          bind:value={amount}
          disabled={disabled}
          oninput={() => playBlip(400, 0.02)}
        />
      </div>
    </div>

    <div class="dock-col dock-chips">
      {#each QUICK_BETS as val}
        <button
          type="button"
          class="dock-chip"
          class:dock-chip--on={amount === val}
          aria-label={`Set bet amount to ${val}`}
          onclick={() => adjust(val)}
          disabled={disabled}
        >
          ${val}
        </button>
      {/each}
    </div>

    <button
      type="button"
      bind:this={mainBtn}
      class="dock-cta {mainBtnClass}"
      aria-label={actionState === 'cashout' ? 'Cash out current round' : game.visualPhase === 'bowl' ? 'Swing now' : 'Play ball'}
      onmousedown={handleMainDown}
      onmouseup={handleMainUp}
      onclick={handleMainClick}
      disabled={isLocked && actionState !== 'cashout' && game.visualPhase !== 'bowl'}
    >
      {#if actionState === 'cashout'}
        <span class="cta-line">{mainBtnLabel}</span>
        <span class="cta-sub">+${payout.toFixed(2)}</span>
      {:else}
        <span class="cta-line">{mainBtnLabel}</span>
      {/if}
    </button>
  </div>
</div>

<style>
  .bet-dock {
    position: relative;
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
    padding: 12px 14px 13px;
    border-radius: 20px;
    background: linear-gradient(
      165deg,
      rgba(12, 18, 34, 0.92) 0%,
      rgba(8, 12, 24, 0.88) 100%
    );
    border: 1px solid color-mix(in srgb, var(--accent, #6366f1) 42%, transparent);
    box-shadow:
      0 -2px 0 rgba(255, 255, 255, 0.06) inset,
      0 12px 40px rgba(0, 0, 0, 0.45),
      0 0 0 1px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    pointer-events: auto;
  }

  .dock-rim {
    pointer-events: none;
    position: absolute;
    inset: 0;
    border-radius: 20px;
    box-shadow:
      0 0 24px color-mix(in srgb, var(--accent, #6366f1) 18%, transparent);
    opacity: 0.85;
  }

  .dock-grid {
    position: relative;
    display: grid;
    grid-template-columns: minmax(120px, 156px) 1fr auto;
    gap: 12px;
    align-items: center;
  }

  .dock-col {
    min-width: 0;
  }

  .dock-label {
    display: block;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.45);
    margin-bottom: 5px;
  }

  .dock-input-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 7px 11px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .dock-curr {
    font-family: ui-monospace, 'Orbitron', monospace;
    font-weight: 800;
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.55);
  }

  .dock-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    color: #fff;
    font-weight: 900;
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
    outline: none;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .dock-input::-webkit-outer-spin-button,
  .dock-input::-webkit-inner-spin-button {
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
  }

  .dock-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .dock-chip {
    flex: 1 1 calc(25% - 6px);
    min-width: 56px;
    min-height: 36px;
    padding: 7px 6px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.82);
    font-size: 0.72rem;
    font-weight: 800;
    font-family: ui-monospace, 'Orbitron', monospace;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }

  .dock-chip:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent, #6366f1) 55%, transparent);
  }

  .dock-chip--on {
    background: color-mix(in srgb, var(--accent, #6366f1) 22%, transparent);
    border-color: color-mix(in srgb, var(--accent, #6366f1) 70%, transparent);
    color: #fff;
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent, #6366f1) 25%, transparent);
  }

  .dock-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dock-cta {
    justify-self: end;
    min-width: 146px;
    max-width: 180px;
    min-height: 42px;
    padding: 11px 15px;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    font-weight: 950;
    font-size: 0.82rem;
    letter-spacing: 0.04em;
    line-height: 1.15;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: transform 0.18s ease, filter 0.18s ease;
    color: #06110a;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
  }

  .dock-cta:disabled {
    cursor: not-allowed;
    filter: saturate(0.35);
    opacity: 0.55;
  }

  .cta-line {
    font-size: inherit;
    font-weight: inherit;
  }

  .cta-sub {
    font-size: 0.76rem;
    font-weight: 900;
    opacity: 0.88;
    font-variant-numeric: tabular-nums;
  }

  .cta-play {
    background: linear-gradient(180deg, #6bff9a 0%, #22c55e 52%, #15803d 100%);
    box-shadow:
      0 4px 0 #052e14,
      0 0 20px rgba(34, 197, 94, 0.35);
  }

  .cta-play:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }

  .cta-play:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #052e14, 0 0 14px rgba(34, 197, 94, 0.25);
  }

  .cta-swing {
    background: linear-gradient(180deg, #93c5fd 0%, #3b82f6 50%, #1d4ed8 100%);
    color: #f8fafc;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    box-shadow:
      0 4px 0 #172554,
      0 0 22px rgba(59, 130, 246, 0.4);
  }

  .cta-swing:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }

  .cta-cashout {
    background: linear-gradient(180deg, #fdba74 0%, #fb923c 52%, #c2410c 100%);
    color: #1c0903;
    box-shadow:
      0 4px 0 #7c2d12,
      0 0 20px rgba(251, 146, 60, 0.38);
  }

  .cta-cashout:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }

  .cta-locked {
    background: linear-gradient(180deg, #4b5563 0%, #374151 100%);
    color: rgba(255, 255, 255, 0.72);
    text-shadow: none;
    box-shadow: 0 3px 0 #1f2937;
  }

  .dock-input:focus-visible,
  .dock-chip:focus-visible,
  .dock-cta:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent, #6366f1) 72%, white);
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .dock-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .dock-cta {
      width: 100%;
      max-width: none;
      min-width: 0;
      padding: 11px 16px;
      font-size: 0.85rem;
    }

    .dock-chips {
      justify-content: space-between;
    }

    .dock-chip {
      flex: 1 1 calc(25% - 4px);
    }
  }

  @media (max-width: 380px) {
    .bet-dock {
      padding-left: 8px;
      padding-right: 8px;
      border-radius: 16px;
    }
    .dock-label {
      font-size: 0.52rem;
    }
    .dock-chip {
      font-size: 0.62rem;
      min-width: 44px;
    }
  }
</style>
