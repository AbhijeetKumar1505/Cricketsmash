<script lang="ts">
  import { gsap } from 'gsap';
  import { playBlip } from '../gameAudio';

  let { 
    label = 'BET', 
    subLabel = '', 
    variant = 'bet', 
    disabled = false, 
    onclick 
  } = $props<{
    label: string;
    subLabel?: string;
    variant: 'bet' | 'cashout' | 'cancel' | 'waiting';
    disabled?: boolean;
    onclick: () => void;
  }>();

  let btn = $state<HTMLElement>();

  function handleDown() {
    if (disabled || !btn) return;
    gsap.to(btn, { scale: 0.92, filter: 'brightness(1.4)', duration: 0.1, ease: 'power2.out' });
  }

  function handleUp() {
    if (disabled || !btn) return;
    gsap.to(btn, { scale: 1, filter: 'brightness(1)', duration: 0.25, ease: 'back.out(2)' });
  }

  function internalClick() {
    if (disabled) return;
    playBlip(variant === 'cashout' ? 660 : 380);
    onclick();
  }
</script>

<button
  bind:this={btn}
  class="action-btn {variant}"
  {disabled}
  onmousedown={handleDown}
  onmouseup={handleUp}
  onmouseleave={handleUp}
  onclick={internalClick}
>
  <div class="btn-shine"></div>
  <div class="content">
    <span class="label">{label}</span>
    {#if subLabel}
      <span class="sub-label">{subLabel}</span>
    {/if}
  </div>
  <div class="hover-glow"></div>
</button>

<style>
  .action-btn {
    width: 100%;
    height: 100%;
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    user-select: none;
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
  }

  .action-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    filter: grayscale(0.8);
    box-shadow: none !important;
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transform: skewX(-20deg);
    transition: left 0.6s ease;
    z-index: 2;
  }

  .action-btn:hover:not(:disabled) .btn-shine {
    left: 200%;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    position: relative;
    z-index: 5;
    line-height: 1.1;
  }

  .label {
    font-size: 1.4rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }

  .sub-label {
    font-size: 0.8rem;
    font-weight: 800;
    opacity: 0.9;
    letter-spacing: 0.02em;
  }

  /* Neon Variants */
  .bet {
    background: linear-gradient(135deg, #064e3b 0%, #10b981 100%);
    color: white;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.2), inset 0 1px rgba(255,255,255,0.2);
    border-color: rgba(16, 185, 129, 0.4);
  }

  .cashout {
    background: linear-gradient(135deg, #78350f 0%, #fbbf24 100%);
    color: #1a0f00;
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.4), inset 0 1px rgba(255,255,255,0.3);
    border-color: rgba(251, 191, 36, 0.5);
  }

  .cancel {
    background: linear-gradient(135deg, #7f1d1d 0%, #f43f5e 100%);
    color: white;
    border-color: rgba(244, 63, 94, 0.4);
  }

  .waiting {
    background: #0f172a;
    color: #475569;
    cursor: default;
    border-color: #1e293b;
  }

  .hover-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 80%);
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 1;
  }

  .action-btn:hover:not(:disabled) .hover-glow {
    opacity: 1;
  }
</style>
