<script lang="ts">
  import { type DeliveryOutcome } from '../../core/gameController.svelte.js';

  let { items = [] } = $props<{
    items: DeliveryOutcome[];
  }>();

  function getIntensityData(entry: DeliveryOutcome) {
    if (!entry) return null;
    if (entry.kind === 'wicket') return { color: '#ff1e3c', rgb: '255,30,60', label: 'W' };
    
    // For session history, we show runs (1, 2, 4, 6)
    const val = entry.runs;
    if (val >= 6) return { color: '#ff1e3c', rgb: '255,30,60', label: val.toString() };
    if (val >= 4) return { color: '#ffc800', rgb: '255,200,0', label: val.toString() };
    return             { color: '#00d4ff', rgb: '0,212,255', label: val.toString() };
  }
</script>

<div class="flex items-center gap-4 px-5 py-2.5 glass-panel rounded-2xl border border-white/5 max-w-2xl overflow-hidden">
  <div class="flex-shrink-0">
    <div class="text-[9px] font-label font-bold text-on-surface-variant/35 tracking-[0.25em] uppercase">Results</div>
  </div>

  <div class="h-3.5 w-[1px] bg-outline-variant/20 flex-shrink-0"></div>

  <div class="flex gap-1.5 overflow-x-auto scrollbar-none mask-fade-edges py-0.5">
    {#each items.filter((item: DeliveryOutcome): item is Exclude<DeliveryOutcome, null> => item !== null).slice(-15).reverse() as item}
      {@const data = getIntensityData(item)}
      {#if data}
        <div
          class="history-item flex-shrink-0 px-2.5 py-1 font-headline font-black text-[10px] tabular-nums"
          style="
            color: {data.color};
            background: rgba({data.rgb}, 0.08);
            border: 1px solid rgba({data.rgb}, 0.22);
            border-radius: 6px;
            box-shadow: 0 0 8px rgba({data.rgb}, 0.2), inset 0 0 6px rgba({data.rgb}, 0.05);
            text-shadow: 0 0 10px rgba({data.rgb}, 0.8);
          "
        >
          {data.label}
        </div>
      {/if}
    {/each}

    {#if items.every((item: DeliveryOutcome) => item === null)}
      <span class="text-[9px] font-label font-bold text-on-surface-variant/20 uppercase tracking-widest italic">Waiting for delivery...</span>
    {/if}
  </div>
</div>

<style>
  .scrollbar-none::-webkit-scrollbar { display: none; }
  .scrollbar-none { scrollbar-width: none; }
  .mask-fade-edges {
    mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
  }
  .history-item {
    animation: item-slide-in 0.3s ease-out both;
    transition: transform 0.15s ease, filter 0.15s ease;
    will-change: transform;
  }
  .history-item:hover {
    transform: scale(1.08) translateY(-1px);
    filter: brightness(1.3);
  }
</style>
