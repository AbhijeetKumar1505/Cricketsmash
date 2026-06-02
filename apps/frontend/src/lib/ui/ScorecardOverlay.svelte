<script lang="ts">
  import { gsap } from 'gsap';
  import { onMount } from 'svelte';

  let {
    multiplier = 1,
    betAmount = 0,
    profit = 0,
    wasWicket = false,
  } = $props<{
    multiplier: number;
    betAmount: number;
    profit: number;
    wasWicket: boolean;
  }>();

  let container = $state<HTMLElement | undefined>();

  onMount(() => {
    if (!container) return;
    gsap.fromTo(container,
      { scale: 0.88, opacity: 0, y: 28 },
      { scale: 1, opacity: 1, y: 0, duration: 0.50, ease: 'back.out(1.7)' }
    );
  });

  const totalReturn = $derived(betAmount + profit);

  const accentColor = $derived(wasWicket ? '#ff1e3c' : profit > 0 ? '#00ff88' : '#ffc800');
  const accentRgb   = $derived(wasWicket ? '255,30,60' : profit > 0 ? '0,255,136' : '255,200,0');
  const profitSign  = $derived(profit > 0 ? '+' : profit < 0 ? '−' : '');
  const profitColor = $derived(profit > 0 ? '#00ff88' : profit < 0 ? '#ff3355' : '#ffc800');
  const multLabel   = $derived(multiplier <= 0 ? '0.00x' : `${multiplier.toFixed(2)}x`);
</script>

<div
  bind:this={container}
  class="sc-root"
  style="--acc:{accentColor}; --acc-rgb:{accentRgb};"
>
  <div class="sc-card">

    <!-- Glow ring -->
    <div class="sc-ring" aria-hidden="true"></div>

    <!-- Multiplier — small chip at top -->
    <div class="sc-mult-chip">
      <span class="sc-mult-val">{multLabel}</span>
    </div>

    <!-- PROFIT — hero number -->
    <div class="sc-profit-wrap">
      <span class="sc-profit-label">PROFIT</span>
      <span class="sc-profit-val" style="color:{profitColor}">
        {profitSign}{Math.abs(profit).toFixed(2)}
      </span>
    </div>

    <!-- Total return — secondary -->
    <div class="sc-return-wrap">
      <span class="sc-return-label">TOTAL RETURN</span>
      <span class="sc-return-val">{totalReturn.toFixed(2)}</span>
    </div>

  </div>
</div>

<style>
  .sc-root {
    position: absolute;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .sc-card {
    position: relative;
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 36px 28px 32px;
    border-radius: 28px;
    background: linear-gradient(180deg,
      rgba(8, 12, 28, 0.96) 0%,
      rgba(4, 6, 18, 0.98) 100%
    );
    border: 1px solid rgba(var(--acc-rgb), 0.30);
    box-shadow:
      0 0 60px rgba(var(--acc-rgb), 0.18),
      0 40px 80px rgba(0, 0, 0, 0.80),
      inset 0 1px 0 rgba(var(--acc-rgb), 0.15);
    overflow: hidden;
  }

  /* Ambient top glow ring */
  .sc-ring {
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    width: 220px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 100%,
      rgba(var(--acc-rgb), 0.40) 0%,
      rgba(var(--acc-rgb), 0.08) 50%,
      transparent 75%
    );
    pointer-events: none;
    filter: blur(4px);
  }

  /* Multiplier chip — small, at top */
  .sc-mult-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 14px;
    border-radius: 100px;
    border: 1px solid rgba(var(--acc-rgb), 0.35);
    background: rgba(var(--acc-rgb), 0.08);
    margin-bottom: 28px;
    position: relative;
    z-index: 1;
  }

  .sc-mult-val {
    font-family: 'Outfit', sans-serif;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.10em;
    color: var(--acc);
    text-shadow: 0 0 10px rgba(var(--acc-rgb), 0.60);
  }

  /* PROFIT — hero */
  .sc-profit-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 24px;
    position: relative;
    z-index: 1;
  }

  .sc-profit-label {
    font-size: 0.50rem;
    font-weight: 900;
    letter-spacing: 0.28em;
    color: rgba(255, 255, 255, 0.38);
    text-transform: uppercase;
  }

  .sc-profit-val {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(3.2rem, 11vw, 4.8rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    text-shadow:
      0 0 40px currentColor,
      0 0 80px rgba(var(--acc-rgb), 0.30),
      0 4px 0 rgba(0, 0, 0, 0.55);
  }

  /* Separator */
  .sc-return-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding-top: 20px;
    width: 100%;
  }

  .sc-return-wrap::before {
    content: '';
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(var(--acc-rgb), 0.25) 30%,
      rgba(var(--acc-rgb), 0.25) 70%,
      transparent
    );
  }

  .sc-return-label {
    font-size: 0.44rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: rgba(255, 255, 255, 0.32);
    text-transform: uppercase;
  }

  .sc-return-val {
    font-family: 'Outfit', sans-serif;
    font-size: 1.55rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.72);
    text-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
  }
</style>
