<script lang="ts">
  import { gsap } from 'gsap';
  import { onDestroy } from 'svelte';

  let { multiplier = 1, status = 'waiting' } = $props<{
    multiplier: number;
    status: string;
  }>();

  let el = $state<HTMLElement>();

  let lastThreshold = $state(0);
  let flickerTween: gsap.core.Tween | null = null;

  // 1. Base Density Sync
  $effect(() => {
    const isLive = status === 'hitting';
    if (!isLive || !el) {
      if (el) {
        gsap.killTweensOf(el);
        if (flickerTween) flickerTween.kill();
        gsap.set(el, { opacity: 0 });
      }
      return;
    }

    const intensity = Math.min(1, Math.max(0, (multiplier - 2) / 10));
    gsap.to(el, {
      opacity: intensity * 0.8,
      duration: 1,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  });

  // 2. Flicker Logic (Threshold-based)
  $effect(() => {
    const isLive = status === 'hitting';
    if (!isLive || !el || multiplier < 5) {
      if (flickerTween) flickerTween.kill();
      lastThreshold = 0;
      return;
    }

    const currentThreshold = Math.floor(multiplier * 2);
    if (currentThreshold !== lastThreshold) {
      lastThreshold = currentThreshold;
      
      if (flickerTween) flickerTween.kill();
      
      const intensity = Math.min(1, Math.max(0, (multiplier - 2) / 10));
      const flickerRate = Math.max(0.06, 0.5 / (multiplier * 0.5));
      
      flickerTween = gsap.to(el, {
        opacity: intensity * 0.4,
        duration: flickerRate,
        repeat: -1,
        yoyo: true,
        ease: 'steps(2)',
        overwrite: false
      });
    }
  });

  onDestroy(() => {
    if (el) gsap.killTweensOf(el);
  });
</script>

<div 
  bind:this={el} 
  class="risk-overlay" 
  style="--risk-color: {multiplier >= 10 ? '#ef4444' : '#f59e0b'}"
></div>

<style>
  .risk-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    opacity: 0;
    background: radial-gradient(
      circle at center,
      transparent 40%,
      var(--risk-color) 120%
    );
    mix-blend-mode: screen;
  }
</style>
