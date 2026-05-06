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
    gsap.to(mainBtn, { scale: 0.92, duration: 0.1, ease: 'power2.out' });
  }

  function handleMainUp() {
    if (!mainBtn) return;
    gsap.to(mainBtn, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
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
    if (actionState === 'cashout') return 'btn-cashout';
    if (game.visualPhase === 'bowl') return 'btn-swing';
    if (isLocked) return 'btn-locked';
    return 'btn-bet';
  });

  const mainBtnLabel = $derived.by(() => {
    if (actionState === 'bet') return 'PLAY BALL!';
    if (actionState === 'cashout') return 'CASH OUT';
    if (game.visualPhase === 'bowl') return 'SWING!';
    if (actionState === 'waiting') return 'WAITING...';
    if (actionState === 'betting') return 'BETTING...';
    if (actionState === 'watching') return 'IN PLAY';
    return 'PLAY BALL!';
  });
</script>

<div class="doodle-pod">
  <!-- Amount Selector -->
  <div class="pod-section amount-section">
    <div class="label">YOUR BET</div>
    <div class="amount-display">
      <span class="currency">$</span>
      <input 
        type="number" 
        bind:value={amount} 
        disabled={disabled}
        oninput={() => playBlip(400, 0.02)}
      />
    </div>
    <div class="quick-bets">
      {#each QUICK_BETS as val}
        <button 
          class="quick-pill" 
          class:active={amount === val}
          onclick={() => adjust(val)}
          disabled={disabled}
        >
          ${val}
        </button>
      {/each}
    </div>
  </div>

  <!-- Main Action -->
  <button
    bind:this={mainBtn}
    class="main-action {mainBtnClass}"
    onmousedown={handleMainDown}
    onmouseup={handleMainUp}
    onclick={handleMainClick}
    disabled={isLocked && actionState !== 'cashout' && game.visualPhase !== 'bowl'}
  >
    {#if actionState === 'cashout'}
      <div class="cashout-content">
        <span class="main-txt">{mainBtnLabel}</span>
        <span class="amount-txt">+${payout.toFixed(2)}</span>
      </div>
    {:else}
      <span class="main-txt">{mainBtnLabel}</span>
    {/if}
  </button>
</div>

<style>
  .doodle-pod {
    background: #ffffff;
    border: 4px solid #000;
    border-radius: 32px;
    padding: 1.5rem;
    box-shadow: 8px 8px 0 rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 320px;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .pod-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .label {
    font-weight: 900;
    font-size: 0.75rem;
    color: #666;
    letter-spacing: 0.05em;
  }

  .amount-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #f3f4f6;
    border: 3px solid #000;
    border-radius: 16px;
    padding: 0.75rem 1rem;
  }

  .currency {
    font-weight: 900;
    font-size: 1.5rem;
    color: #000;
  }

  .amount-display input {
    background: transparent;
    border: none;
    font-weight: 900;
    font-size: 1.5rem;
    width: 100%;
    color: #000;
    outline: none;
  }

  .quick-bets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .quick-pill {
    background: #fff;
    border: 2px solid #000;
    border-radius: 99px;
    font-weight: 800;
    font-size: 0.75rem;
    padding: 0.4rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-pill:hover:not(:disabled) {
    background: #f3f4f6;
    transform: translateY(-2px);
  }

  .quick-pill.active {
    background: #000;
    color: #fff;
  }

  .main-action {
    height: 72px;
    border-radius: 24px;
    border: 4px solid #000;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    position: relative;
  }

  .btn-bet {
    background: #4ade80; /* Green */
    box-shadow: 0 6px 0 #166534;
  }
  .btn-bet:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #166534; }
  .btn-bet:active { transform: translateY(4px); box-shadow: 0 2px 0 #166534; }

  .btn-swing {
    background: #60a5fa; /* Blue */
    box-shadow: 0 6px 0 #1e40af;
  }
  .btn-swing:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #1e40af; }
  .btn-swing:active { transform: translateY(4px); box-shadow: 0 2px 0 #1e40af; }

  .btn-cashout {
    background: #fb923c; /* Orange */
    box-shadow: 0 6px 0 #9a3412;
  }
  .btn-cashout:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #9a3412; }
  .btn-cashout:active { transform: translateY(4px); box-shadow: 0 2px 0 #9a3412; }

  .btn-locked {
    background: #d1d5db;
    border-color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
  }

  .main-txt {
    font-weight: 900;
    font-size: 1.25rem;
    color: #000;
  }

  .cashout-content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .amount-txt {
    font-weight: 900;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>
