<script lang="ts">
  import { type DeliveryOutcome } from '../../core/gameController.svelte.js';

  let { currentBall = 0, history = [] } = $props<{
    currentBall: number;
    history: DeliveryOutcome[];
  }>();

  function getBallData(entry: DeliveryOutcome, isCurrent: boolean) {
    if (!entry) {
      return {
        label: isCurrent ? '▸' : '·',
        color: isCurrent ? '#ffffff' : 'rgba(255,255,255,0.2)',
        rgb: '255,255,255',
        bg: isCurrent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: isCurrent ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)',
      };
    }
    if (entry.kind === 'wicket') return {
      label: 'W',
      color: '#ff1e3c',
      rgb: '255,30,60',
      bg: 'rgba(255,30,60,0.18)',
      border: 'rgba(255,30,60,0.5)',
    };
    if (entry.runs === 6) return {
      label: '6',
      color: '#ff9900',
      rgb: '255,153,0',
      bg: 'rgba(255,153,0,0.18)',
      border: 'rgba(255,153,0,0.5)',
    };
    if (entry.runs === 4) return {
      label: '4',
      color: '#00ff88',
      rgb: '0,255,136',
      bg: 'rgba(0,255,136,0.15)',
      border: 'rgba(0,255,136,0.45)',
    };
    if (entry.runs === 0) return {
      label: '•',
      color: 'rgba(255,255,255,0.45)',
      rgb: '255,255,255',
      bg: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.15)',
    };
    return {
      label: entry.runs.toString(),
      color: '#00d4ff',
      rgb: '0,212,255',
      bg: 'rgba(0,212,255,0.12)',
      border: 'rgba(0,212,255,0.35)',
    };
  }
</script>

<div class="flex items-center gap-2 px-4 py-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
  <div class="text-[9px] font-label font-black tracking-widest text-on-surface-variant/40 uppercase mr-1">Over</div>

  <div class="flex gap-1.5">
    {#each Array(6) as _, i}
      {@const outcome = history[i] ?? null}
      {@const isCurrent = i === currentBall && !outcome}
      {@const d = getBallData(outcome, isCurrent)}
      <div
        class="ball-slot relative flex items-center justify-center rounded-full font-headline font-black transition-all duration-300"
        class:current={isCurrent}
        style="
          width: 28px; height: 28px;
          font-size: 11px;
          color: {d.color};
          background: {d.bg};
          border: 1px solid {d.border};
          box-shadow: {outcome || isCurrent ? `0 0 10px rgba(${d.rgb}, 0.35)` : 'none'};
          text-shadow: {outcome ? `0 0 8px rgba(${d.rgb}, 0.8)` : 'none'};
        "
      >
        {d.label}
        {#if isCurrent}
          <div class="ping-ring absolute inset-0 rounded-full" style="border: 1px solid {d.color}"></div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .ping-ring {
    animation: ring-ping 1.2s ease-out infinite;
  }
  @keyframes ring-ping {
    0%   { transform: scale(1);   opacity: 0.7; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  .ball-slot.current {
    animation: slot-pulse 1.4s ease-in-out infinite;
  }
  @keyframes slot-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.65; }
  }
</style>
