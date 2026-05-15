<script lang="ts">
  import { spring } from 'svelte/motion';

  let {
    btnState = 'bet' as 'bet' | 'hit' | 'cashout' | 'locked',
    label = 'BET',
    labelShort = 'Bet',
    payout = 0,
    disabled = false,
    onpress = () => {},
  } = $props<{
    btnState?: 'bet' | 'hit' | 'cashout' | 'locked';
    label?: string;
    labelShort?: string;
    payout?: number;
    disabled?: boolean;
    onpress?: () => void;
  }>();

  const scale = spring(1, { stiffness: 0.35, damping: 0.55 });

  function handleDown() {
    if (disabled && btnState !== 'cashout' && btnState !== 'hit') return;
    scale.set(0.92);
  }

  function handleUp() {
    scale.set(1);
  }

  function handleClick() {
    if (disabled && btnState !== 'cashout' && btnState !== 'hit') return;
    onpress();
  }

  const stateClass = $derived(`action-btn action-btn--${btnState}`);
</script>

<button
  type="button"
  class={stateClass}
  style="transform: scale({$scale})"
  aria-label={labelShort}
  onpointerdown={handleDown}
  onpointerup={handleUp}
  onpointerleave={handleUp}
  onclick={handleClick}
  {disabled}
>
  <span class="action-shimmer" aria-hidden="true"></span>
  <span class="action-label-long">{label}</span>
  <span class="action-label-short">{labelShort}</span>
  {#if btnState === 'cashout' && payout > 0}
    <span class="action-meta">+${payout.toFixed(2)}</span>
  {/if}
</button>

<style>
  .action-btn {
    position: relative;
    width: 66px;
    height: 66px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Outfit', sans-serif;
    overflow: visible;
    background: #050508;
    color: #fff;
    transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .action-btn::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: conic-gradient(from 0deg,
      transparent,
      rgba(255, 200, 0, 0.2) 20%,
      #ffc800 50%,
      rgba(255, 200, 0, 0.2) 80%,
      transparent
    );
    opacity: 0.3;
    transition: opacity 0.3s;
  }

  .action-btn:hover::before {
    opacity: 0.8;
    animation: rotate 4s linear infinite;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Labels */
  .action-label-long {
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.05em;
    z-index: 2;
  }

  .action-label-short {
    display: none;
  }

  .action-meta {
    font-size: 0.55rem;
    font-weight: 800;
    color: #ffc800;
    z-index: 2;
  }

  /* States */
  .action-btn--bet {
    background: radial-gradient(circle at 30% 30%, #1a1a1f, #050508);
    color: #ffc800;
  }

  .action-btn--hit {
    background: radial-gradient(circle at 30% 30%, #1e3a8a, #0c1533);
    color: #fff;
  }
  .action-btn--hit::before {
    background: conic-gradient(from 0deg, transparent, #3b82f6 50%, transparent);
  }

  .action-btn--cashout {
    background: #ffc800;
    color: #000;
  }
  .action-btn--cashout .action-meta {
    color: rgba(0, 0, 0, 0.7);
  }
  .action-btn--cashout::before {
    background: conic-gradient(from 0deg, transparent, #fff 50%, transparent);
    opacity: 0.5;
  }

  .action-btn--locked {
    background: #111;
    color: rgba(255, 255, 255, 0.2);
    cursor: not-allowed;
  }
  .action-btn--locked::before { display: none; }

  @media (max-width: 800px) {
    .action-btn {
      width: 54px;
      height: 54px;
    }
    .action-label-long { display: none; }
    .action-label-short { display: block; font-size: 0.65rem; font-weight: 900; }
  }
</style>
