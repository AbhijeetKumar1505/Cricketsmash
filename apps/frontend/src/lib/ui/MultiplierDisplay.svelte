<script lang="ts">
  import { gsap } from 'gsap';
  import { onDestroy } from 'svelte';
  import { playTick } from '../gameAudio';

  let { value = 1, status = 'waiting' } = $props<{
    value: number;
    status: string;
  }>();

  let displayVal        = $state(1);
  let el                = $state<HTMLElement | undefined>(undefined);
  let ringEl            = $state<HTMLElement | undefined>(undefined);
  let rootEl            = $state<HTMLElement | undefined>(undefined);
  let lastTickValue     = 1;
  let lastPulseThreshold = $state(0);
  let pulseTween: gsap.core.Tween | null = null;
  let ringTween:  gsap.core.Tween | null = null;

  let milestoneRings = $state<{ id: number; color: string }[]>([]);
  let milestoneKey = 0;
  const MILESTONES = [2, 3, 5, 7, 10, 15, 20, 30, 50];
  let passedMilestones = new Set<number>();

  const proxy = { v: 1 };

  $effect(() => {
    const isLive = status === 'hitting';
    gsap.to(proxy, {
      v: value,
      duration: isLive ? 0.18 : 0.05,
      ease: 'none',
      onUpdate: () => {
        displayVal = proxy.v;
        if (isLive && displayVal >= lastTickValue + 0.10) {
          lastTickValue = Math.floor(displayVal * 10) / 10;
          playTick(displayVal);
          if (el) {
            gsap.fromTo(el,
              { scale: 1.04, filter: 'brightness(1.8)' },
              { scale: 1, filter: 'brightness(1)', duration: 0.12, ease: 'power2.out', overwrite: 'auto' }
            );
          }
          checkMilestone(displayVal);
        }
      }
    });
  });

  function checkMilestone(v: number) {
    for (const m of MILESTONES) {
      if (v >= m && !passedMilestones.has(m)) {
        passedMilestones.add(m);
        triggerMilestone(m);
        break;
      }
    }
  }

  function triggerMilestone(m: number) {
    const { color } = getMilestoneStyle(m);
    const id = ++milestoneKey;
    milestoneRings = [...milestoneRings, { id, color }];
    setTimeout(() => {
      milestoneRings = milestoneRings.filter(r => r.id !== id);
    }, 800);

    if (el) {
      gsap.fromTo(el,
        { scale: 1.5, filter: `brightness(3) drop-shadow(0 0 24px ${color})` },
        { scale: 1, filter: 'brightness(1)', duration: 0.55, ease: 'back.out(2)', overwrite: 'auto' }
      );
    }
    if (rootEl) {
      gsap.fromTo(rootEl,
        { x: -7 },
        { x: 0, duration: 0.38, ease: 'elastic.out(1.2, 0.3)', overwrite: 'auto' }
      );
    }
  }

  function getMilestoneStyle(m: number) {
    if (m >= 10) return { color: '#ff1e3c' };
    if (m >= 5)  return { color: '#ffc800' };
    if (m >= 2)  return { color: '#00d4ff' };
    return { color: '#00ff88' };
  }

  $effect(() => {
    if (status === 'wicket' || status === 'waiting') {
      if (pulseTween) pulseTween.kill();
      if (ringTween)  ringTween.kill();
      if (el)    gsap.to(el,    { scale: 1, filter: 'brightness(1)', duration: 0.3, overwrite: 'auto' });
      if (ringEl) gsap.to(ringEl, { scale: 0.95, opacity: 0, duration: 0.3, overwrite: 'auto' });
      lastPulseThreshold = 0;
      lastTickValue = 1;
      passedMilestones.clear();
      milestoneRings = [];
    }
  });

  $effect(() => {
    const isLive = status === 'hitting';
    if (!isLive || !el) return;

    const threshold = Math.floor(value * 4);
    if (threshold === lastPulseThreshold) return;
    lastPulseThreshold = threshold;

    if (pulseTween) pulseTween.kill();
    if (ringTween)  ringTween.kill();

    const speed    = Math.max(0.08, 0.75 / Math.pow(value, 0.42));
    const scaleAmt = 1.05 + Math.min(0.25, value * 0.012);

    pulseTween = gsap.to(el, {
      scale: scaleAmt,
      duration: speed,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut',
      overwrite: true,
    });

    if (ringEl && value >= 2) {
      gsap.set(ringEl, { opacity: Math.min(0.7, value * 0.055), scale: 1 });
      ringTween = gsap.to(ringEl, {
        scale: 1.15,
        opacity: 0,
        duration: speed * 1.6,
        repeat: -1,
        ease: 'power2.out',
        overwrite: true,
      });
    }
  });

  onDestroy(() => {
    gsap.killTweensOf(proxy);
    if (el)    gsap.killTweensOf(el);
    if (ringEl) gsap.killTweensOf(ringEl);
    pulseTween?.kill();
    ringTween?.kill();
  });

  const intensityData = $derived.by(() => {
    if (status === 'wicket')   return { color: '#ff0033', glowClass: 'intensity-glow-neon-red',   rgb: '255,0,51',   label: 'MATCH TERMINATED', tier: 4 };
    if (displayVal >= 10)      return { color: '#ff1e3c', glowClass: 'intensity-glow-neon-red',   rgb: '255,30,60',  label: 'DANGER ZONE',       tier: 4 };
    if (displayVal >= 5)       return { color: '#ffc800', glowClass: 'intensity-glow-neon-amber', rgb: '255,200,0',  label: 'GOLDEN RUN',        tier: 3 };
    if (displayVal >= 2)       return { color: '#00d4ff', glowClass: 'intensity-glow-neon-cyan',  rgb: '0,212,255',  label: 'RISING FAST',       tier: 2 };
    return                             { color: '#00ff88', glowClass: 'intensity-glow-neon-lime',  rgb: '0,255,136',  label: 'CRUISING',          tier: 1 };
  });

  const bgGlowSize    = $derived(`${60 + intensityData.tier * 22}%`);
  const bgGlowOpacity = $derived(0.12 + intensityData.tier * 0.08);

  const tierLabel = $derived(
    displayVal >= 20 ? 'INSANE' :
    displayVal >= 10 ? 'EXTREME' :
    displayVal >= 5  ? 'GOLDEN' :
    displayVal >= 2  ? 'GROWING' : 'CRUISING'
  );
</script>

<div class="mult-root select-none" bind:this={rootEl}>

  <!-- ─── Ambient halo ─── -->
  <div
    class="mult-halo"
    style="
      background: radial-gradient(circle, rgba({intensityData.rgb}, {bgGlowOpacity}) 0%, transparent 70%);
      width: {bgGlowSize}; height: {bgGlowSize};
      animation: glow-breathe var(--pulse-dur, 1.2s) ease-in-out infinite;
    "
  ></div>

  {#if intensityData.tier >= 3}
    <div
      class="mult-halo mult-halo-outer"
      style="
        background: radial-gradient(circle, rgba({intensityData.rgb}, {bgGlowOpacity * 0.4}) 0%, transparent 60%);
        width: calc({bgGlowSize} * 1.5); height: calc({bgGlowSize} * 1.5);
        animation: glow-breathe calc(var(--pulse-dur, 1.2s) * 1.4) 0.35s ease-in-out infinite;
      "
    ></div>
  {/if}

  <!-- ─── Expanding pulse ring ─── -->
  <div
    bind:this={ringEl}
    class="mult-ring"
    style="border-color: rgba({intensityData.rgb}, 0.55)"
  ></div>

  <!-- ─── Milestone burst rings ─── -->
  {#each milestoneRings as ring (ring.id)}
    <div
      class="milestone-ring"
      style="--accent: {ring.color}; border-color: {ring.color}"
    ></div>
  {/each}

  <!-- ─── Scoreboard frame ─── -->
  <div
    class="scoreboard-frame"
    style="--c: {intensityData.color}; --c-rgb: {intensityData.rgb}"
  >
    <!-- Corner brackets -->
    <div class="cb cb-tl"></div>
    <div class="cb cb-tr"></div>
    <div class="cb cb-bl"></div>
    <div class="cb cb-br"></div>

    <!-- Dot grid -->
    <div class="dot-grid"></div>

    <!-- Moving scanline when live -->
    {#if status === 'hitting'}
      <div class="holo-line"></div>
    {/if}

    <!-- Status pill -->
    <div class="z-20 mb-4 px-4 py-1.5 glass-panel rounded-full border border-white/10 flex items-center gap-2 relative">
      <div
        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style="background: {intensityData.color}; animation: pulse-glow var(--pulse-dur, 1.2s) ease-in-out infinite; box-shadow: 0 0 10px {intensityData.color}"
      ></div>
      <span class="text-[10px] font-label font-bold tracking-[0.22em] text-on-surface-variant uppercase">
        {tierLabel}
      </span>
    </div>

    <!-- Multiplier value -->
    <div class="relative z-10 text-center flex items-baseline gap-1" bind:this={el}>
      <h1
        class="mult-num tabular-nums font-headline font-black"
        class:intensity-glow-neon-lime={intensityData.glowClass === 'intensity-glow-neon-lime'}
        class:intensity-glow-neon-cyan={intensityData.glowClass === 'intensity-glow-neon-cyan'}
        class:intensity-glow-neon-amber={intensityData.glowClass === 'intensity-glow-neon-amber'}
        class:intensity-glow-neon-red={intensityData.glowClass === 'intensity-glow-neon-red'}
        style="color: {intensityData.color}"
      >
        {displayVal.toFixed(displayVal >= 100 ? 1 : 2)}
      </h1>
      <span
        class="mult-x font-headline font-black"
        style="color: {intensityData.color}; opacity: 0.55"
      >x</span>
    </div>

    <!-- Velocity bars -->
    <div class="mt-5 flex gap-[5px] items-end relative z-10">
      {#each Array(7) as _, i}
        <div
          class="transition-all duration-300"
          style="
            width: 3px;
            height: {8 + i * 5}px;
            border-radius: 1px;
            background: {intensityData.color};
            opacity: {displayVal > (i + 1) * 1.4 ? 0.9 : 0.10};
            box-shadow: {displayVal > (i + 1) * 1.4 ? `0 0 10px ${intensityData.color}, 0 0 20px rgba(${intensityData.rgb},0.4)` : 'none'};
            transition: opacity 0.25s, box-shadow 0.25s;
          "
        ></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .mult-root {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    transform: scale(0.75);
  }

  .mult-halo {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    will-change: opacity, transform;
    transition: background 0.6s ease, width 0.6s ease, height 0.6s ease;
  }

  .mult-halo-outer {
    z-index: 0;
    filter: blur(12px);
  }

  .mult-ring {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.95);
    width: 200px; height: 200px;
    border-radius: 50%;
    border: 2px solid;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    will-change: transform, opacity;
  }

  /* ─── Scoreboard frame ─── */
  .scoreboard-frame {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 2rem 1.2rem;
    min-width: 200px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    border-radius: 20px;
  }

  /* Corner brackets */
  .cb {
    position: absolute;
    width: 14px;
    height: 14px;
    pointer-events: none;
    z-index: 5;
    transition: border-color 0.5s ease, box-shadow 0.5s ease;
  }
  .cb-tl {
    top: 0; left: 0;
    border-top: 2px solid var(--c, #00ff88);
    border-left: 2px solid var(--c, #00ff88);
  }
  .cb-tr {
    top: 0; right: 0;
    border-top: 2px solid var(--c, #00ff88);
    border-right: 2px solid var(--c, #00ff88);
  }
  .cb-bl {
    bottom: 0; left: 0;
    border-bottom: 2px solid var(--c, #00ff88);
    border-left: 2px solid var(--c, #00ff88);
  }
  .cb-br {
    bottom: 0; right: 0;
    border-bottom: 2px solid var(--c, #00ff88);
    border-right: 2px solid var(--c, #00ff88);
  }

  /* Dot grid */
  .dot-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(var(--c-rgb, 0,255,136), 0.07) 1px, transparent 1px);
    background-size: 14px 14px;
    pointer-events: none;
    z-index: 0;
    transition: background-image 0.5s ease;
  }

  /* Holographic scanline */
  .holo-line {
    position: absolute;
    left: 0; right: 0;
    height: 1px;
    top: 0;
    background: linear-gradient(90deg, transparent, rgba(var(--c-rgb, 0,255,136), 0.6), transparent);
    animation: holo-scan 2.5s linear infinite;
    pointer-events: none;
    z-index: 3;
  }

  .mult-num {
    font-size: clamp(3rem, 8vw, 6rem);
    line-height: 0.9;
    letter-spacing: -0.02em;
    transition: color 0.4s ease;
    will-change: transform, filter;
  }

  .mult-x {
    font-size: clamp(1.2rem, 3vw, 2.5rem);
    line-height: 1;
  }
</style>
