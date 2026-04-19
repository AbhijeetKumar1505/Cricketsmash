<script lang="ts">
  import { gsap } from 'gsap';
  import { onMount } from 'svelte';
  import type { DeliveryOutcome } from '../../core/gameController.svelte.js';

  let {
    history = [] as DeliveryOutcome[],
    multiplier = 1,
    betAmount = 0,
    profit = 0,
    wasWicket = false,
    streak = 0,
    onRestart = () => {},
  } = $props<{
    history: DeliveryOutcome[];
    multiplier: number;
    betAmount: number;
    profit: number;
    wasWicket: boolean;
    streak: number;
    onRestart: () => void;
  }>();

  let container = $state<HTMLElement | undefined>();

  onMount(() => {
    if (!container) return;
    gsap.fromTo(container,
      { scale: 0.92, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)' }
    );
  });

  function ballLabel(entry: DeliveryOutcome): string {
    if (!entry) return '';
    if (entry.kind === 'wicket') return 'W';
    if (entry.runs === 0) return '•';
    return entry.runs.toString();
  }

  function ballColor(entry: DeliveryOutcome): { color: string; rgb: string; bg: string } {
    if (!entry) return { color: 'rgba(255,255,255,0.15)', rgb: '255,255,255', bg: 'rgba(255,255,255,0.04)' };
    if (entry.kind === 'wicket') return { color: '#ff1e3c', rgb: '255,30,60', bg: 'rgba(255,30,60,0.15)' };
    if (entry.runs === 6)  return { color: '#ffc800', rgb: '255,200,0', bg: 'rgba(255,200,0,0.15)' };
    if (entry.runs === 4)  return { color: '#00ff88', rgb: '0,255,136', bg: 'rgba(0,255,136,0.12)' };
    if (entry.runs === 0)  return { color: 'rgba(255,255,255,0.35)', rgb: '255,255,255', bg: 'rgba(255,255,255,0.04)' };
    return { color: '#00d4ff', rgb: '0,212,255', bg: 'rgba(0,212,255,0.12)' };
  }

  const accentColor = $derived(wasWicket ? '#ff1e3c' : profit > 0 ? '#00ff88' : '#ffc800');
  const accentRgb   = $derived(wasWicket ? '255,30,60' : profit > 0 ? '0,255,136' : '255,200,0');

  const heading    = $derived(wasWicket ? 'WICKET!' : 'OVER COMPLETE');
  const subheading = $derived(wasWicket ? 'Better luck next time' : profit > 0 ? 'Great over!' : 'You broke even');

  const profitSign   = $derived(profit > 0 ? '+' : '');
  const profitColor  = $derived(profit > 0 ? '#00ff88' : profit < 0 ? '#ff1e3c' : '#ffc800');
</script>

<div
  bind:this={container}
  class="scorecard-root absolute inset-0 z-[90] flex items-center justify-center p-4"
  style="background: rgba(0,0,0,0.82); backdrop-filter: blur(16px);"
>
  <div
    class="scorecard-card w-full max-w-lg flex flex-col gap-6 p-6 rounded-3xl border"
    style="
      background: rgba(6,10,24,0.9);
      border-color: rgba({accentRgb}, 0.25);
      box-shadow: 0 0 80px rgba({accentRgb}, 0.15), 0 40px 80px rgba(0,0,0,0.8);
    "
  >
    <!-- Header -->
    <div class="text-center">
      <div
        class="font-headline font-black text-4xl uppercase tracking-tighter mb-1"
        style="color: {accentColor}; text-shadow: 0 0 30px rgba({accentRgb}, 0.8)"
      >
        {heading}
      </div>
      <div class="text-xs font-label font-bold text-white/40 uppercase tracking-widest">
        {subheading}
      </div>
    </div>

    <!-- Ball-by-ball scorecard -->
    <div>
      <div class="text-[9px] font-label font-bold text-white/30 uppercase tracking-widest mb-2 text-center">
        This Over
      </div>
      <div class="flex gap-2 justify-center">
        {#each Array(6) as _, i}
          {@const entry = history[i] ?? null}
          {@const bc = ballColor(entry)}
          {@const label = ballLabel(entry)}
          <div
            class="ball-cell flex items-center justify-center font-headline font-black rounded-full"
            style="
              width: 42px; height: 42px;
              font-size: {entry?.kind === 'wicket' ? '14px' : '16px'};
              color: {bc.color};
              background: {bc.bg};
              border: 1.5px solid {bc.color};
              box-shadow: {entry ? `0 0 12px rgba(${bc.rgb}, 0.3)` : 'none'};
              text-shadow: {entry ? `0 0 10px rgba(${bc.rgb}, 0.9)` : 'none'};
              opacity: {entry ? 1 : 0.2};
            "
          >
            {label}
          </div>
        {/each}
      </div>
    </div>

    <!-- Stats row -->
    <div
      class="grid grid-cols-3 gap-3 py-4 rounded-2xl border border-white/5"
      style="background: rgba(255,255,255,0.03)"
    >
      <div class="flex flex-col items-center gap-1">
        <div class="text-[10px] font-label font-bold text-white/35 uppercase tracking-widest">Multiplier</div>
        <div
          class="text-2xl font-headline font-black tabular-nums"
          style="color: {accentColor}; text-shadow: 0 0 16px rgba({accentRgb}, 0.7)"
        >
          {multiplier <= 0 ? '0.00' : multiplier.toFixed(2)}<span class="text-sm opacity-60">x</span>
        </div>
      </div>

      <div class="flex flex-col items-center gap-1 border-x border-white/5">
        <div class="text-[10px] font-label font-bold text-white/35 uppercase tracking-widest">Stake</div>
        <div class="text-2xl font-headline font-black text-white/80">
          ${betAmount.toFixed(2)}
        </div>
      </div>

      <div class="flex flex-col items-center gap-1">
        <div class="text-[10px] font-label font-bold text-white/35 uppercase tracking-widest">Profit</div>
        <div
          class="text-2xl font-headline font-black tabular-nums"
          style="color: {profitColor}; text-shadow: 0 0 12px {profitColor}55"
        >
          {profitSign}${Math.abs(profit).toFixed(2)}
        </div>
      </div>
    </div>

    <!-- Streak badge -->
    {#if streak >= 2}
      <div class="flex justify-center">
        <div
          class="px-5 py-2 rounded-full font-label font-black text-xs uppercase tracking-widest"
          style="
            background: rgba(255,200,0,0.12);
            border: 1px solid rgba(255,200,0,0.4);
            color: #ffc800;
            text-shadow: 0 0 10px rgba(255,200,0,0.7);
          "
        >
          🔥 {streak} CONSECUTIVE BOUNDARIES
        </div>
      </div>
    {/if}

    <!-- Play Again -->
    <button
      onclick={onRestart}
      class="w-full py-4 rounded-2xl font-headline font-black text-lg uppercase tracking-widest transition-all active:scale-95 hover:brightness-110"
      style="
        background: linear-gradient(135deg, rgba({accentRgb}, 0.15) 0%, rgba({accentRgb}, 0.35) 100%);
        color: {accentColor};
        border: 1.5px solid rgba({accentRgb}, 0.5);
        box-shadow: 0 0 30px rgba({accentRgb}, 0.2), 0 4px 16px rgba(0,0,0,0.4);
        cursor: pointer;
      "
    >
      ↺ PLAY AGAIN
    </button>
  </div>
</div>

<style>
  .ball-cell { transition: transform 0.2s ease; }
  .ball-cell:hover { transform: scale(1.08); }
</style>
