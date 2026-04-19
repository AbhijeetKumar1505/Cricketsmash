<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';

  let { 
    multiplier = 0, 
    lossAmount = 0,
    onClose = () => {} 
  } = $props<{
    multiplier: number;
    lossAmount: number;
    onClose: () => void;
  }>();

  let container = $state<HTMLElement>();

  onMount(() => {
    if (container) {
      gsap.fromTo(container, 
        { scale: 1.1, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.5, ease: 'power4.out' }
      );
    }
  });
</script>

<div 
  bind:this={container}
  class="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
>
  <!-- Background with desaturation and tinted overlay -->
  <div class="absolute inset-0 z-0 select-none">
    <div class="absolute inset-0 bg-surface/80"></div>
    <img 
      class="w-full h-full object-cover grayscale brightness-[0.2] contrast-[1.2]" 
      src="/stadium/stadium_terminated.png" 
      alt=""
    />
  </div>

  <!-- CRT & Intensity Overlays (from app.css) -->
  <div class="absolute inset-0 z-10 crt-overlay opacity-30"></div>
  <div class="absolute inset-0 z-10" style="background: linear-gradient(to top, rgba(255,30,60,0.18) 0%, transparent 60%, rgba(255,30,60,0.04) 100%)"></div>

  <!-- Content Container -->
  <div class="relative z-20 flex flex-col items-center text-center px-6 max-w-2xl">
    <div class="mb-4 tracking-[0.4em] text-ruby-premium font-label font-bold text-xs uppercase opacity-80 animate-pulse">
      SYSTEM OVERRIDE // SIGNAL LOST
    </div>
    
    <h1 class="font-headline font-black text-6xl md:text-8xl text-white ruby-glow uppercase tracking-tighter mb-4 leading-none">
      MATCH TERMINATED
    </h1>

    <div class="flex items-center gap-6 mb-12">
      <div class="h-[2px] w-12 bg-gradient-to-r from-transparent to-ruby-premium"></div>
      <span class="text-4xl md:text-6xl font-headline font-black italic text-ruby-premium ruby-glow tracking-widest">
        WICKET!
      </span>
      <div class="h-[2px] w-12 bg-gradient-to-l from-transparent to-ruby-premium"></div>
    </div>

    <!-- Glassmorphism Stats Panel -->
    <div class="w-full bg-surface-variant/40 backdrop-blur-3xl p-1 rounded-3xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
      <div class="bg-surface-container-lowest/60 rounded-2xl p-10 flex flex-col md:flex-row justify-between items-center gap-10">
        <div class="flex flex-col items-center md:items-start">
          <span class="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mb-2 opacity-60">Final Multiplier</span>
          <div class="text-6xl font-headline font-black text-ruby-premium ruby-glow tabular-nums">
            {multiplier.toFixed(2)}<span class="text-2xl ml-1">x</span>
          </div>
        </div>

        <div class="h-16 w-[1px] bg-outline-variant/20 hidden md:block"></div>

        <div class="flex flex-col items-center">
          <span class="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mb-2 opacity-60">Player Status</span>
          <div class="px-8 py-3 bg-ruby-premium text-white font-headline font-black text-2xl rounded-xl shadow-[0_0_30px_rgba(255,30,60,0.55)] transform -rotate-1">
            OUT!
          </div>
        </div>

        <div class="h-16 w-[1px] bg-outline-variant/20 hidden md:block"></div>

        <div class="flex flex-col items-center md:items-end">
          <span class="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mb-2 opacity-60">Loss Amount</span>
          <div class="text-4xl font-headline font-bold text-on-surface">
            ${lossAmount.toFixed(2)}
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="mt-12 flex flex-wrap justify-center gap-6">
      <button 
        onclick={onClose}
        class="px-12 py-5 bg-ruby-premium text-white font-headline font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,30,60,0.35)] hover:shadow-[0_25px_50px_rgba(255,30,60,0.5)]"
      >
        RETURN TO LOBBY
      </button>
      <button 
        class="px-12 py-5 bg-surface-container-highest text-primary font-headline font-black rounded-2xl border border-outline-variant/20 hover:bg-surface-bright active:scale-95 transition-all"
      >
        VIEW FULL STATS
      </button>
    </div>
  </div>

  <!-- Decorative HUD Side Elements -->
  <div class="absolute bottom-12 left-12 z-20 hidden xl:block opacity-30">
    <div class="font-label text-[10px] text-ruby-premium mb-3 uppercase tracking-widest">Wicket Log</div>
    <div class="flex flex-col gap-2">
      <div class="w-48 h-1.5 bg-ruby-premium/20 rounded-full overflow-hidden">
        <div class="w-2/3 h-full bg-ruby-premium"></div>
      </div>
      <div class="w-32 h-1.5 bg-ruby-premium/20 rounded-full overflow-hidden">
        <div class="w-1/2 h-full bg-ruby-premium"></div>
      </div>
    </div>
  </div>
</div>
