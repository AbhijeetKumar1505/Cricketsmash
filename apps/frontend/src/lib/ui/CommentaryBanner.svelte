<script lang="ts">
  import { gsap } from 'gsap';

  let { text = '', commentaryKey = 0, streak = 0 } = $props<{
    text: string;
    commentaryKey: number;
    streak: number;
  }>();

  let el = $state<HTMLElement | undefined>();

  $effect(() => {
    void commentaryKey; // reactive dep — triggers re-animation on each delivery
    if (!el || !text) return;

    gsap.killTweensOf(el);
    gsap.fromTo(el,
      { y: 28, opacity: 0, scale: 0.92 },
      { y: 0, opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(2)' }
    );

    const timer = gsap.delayedCall(2.4, () => {
      if (el) gsap.to(el, { y: -16, opacity: 0, duration: 0.5, ease: 'power3.in' });
    });
    return () => { timer.kill(); };
  });

  const streakLabel = $derived(
    streak >= 4 ? `🔥 ${streak} IN A ROW!` :
    streak === 3 ? '🔥🔥 THREE BOUNDARIES!' :
    streak === 2 ? '🔥 BACK-TO-BACK!' : ''
  );

  const isWicket   = $derived(text.includes('BOWLED') || text.includes('OUT') || text.includes('TIMBER') || text.includes('STUMPS'));
  const isBoundary = $derived(text.includes('SIX') || text.includes('MAXIMUM') || text.includes('ROPE'));
  const isFour     = $derived(text.includes('FOUR') || text.includes('BOUNDARY') || text.includes('FENCE') || text.includes('DRIVE'));

  const textColor = $derived(
    isWicket   ? '#ff1e3c' :
    isBoundary ? '#ffc800' :
    isFour     ? '#00ff88' : 'rgba(255,255,255,0.9)'
  );
  const textRgb = $derived(
    isWicket   ? '255,30,60' :
    isBoundary ? '255,200,0' :
    isFour     ? '0,255,136' : '255,255,255'
  );
</script>

<div
  bind:this={el}
  class="commentary-root pointer-events-none flex flex-col items-center gap-3 opacity-0"
>
  <!-- Main commentary text -->
  <div
    class="px-8 py-3 glass-panel rounded-2xl border font-headline font-black text-2xl md:text-3xl tracking-widest uppercase text-center"
    style="
      color: {textColor};
      border-color: rgba({textRgb}, 0.35);
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(12px);
      text-shadow: 0 0 30px rgba({textRgb}, 0.9), 0 0 60px rgba({textRgb}, 0.4);
      box-shadow: 0 0 40px rgba({textRgb}, 0.2), inset 0 0 20px rgba({textRgb}, 0.06);
    "
  >
    {text}
  </div>

  <!-- Streak badge -->
  {#if streakLabel}
    <div
      class="px-5 py-1.5 rounded-full font-label font-black text-xs uppercase tracking-widest animate-bounce"
      style="
        background: rgba(255,200,0,0.18);
        border: 1px solid rgba(255,200,0,0.45);
        color: #ffc800;
        text-shadow: 0 0 12px rgba(255,200,0,0.8);
      "
    >
      {streakLabel}
    </div>
  {/if}
</div>
