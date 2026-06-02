<script lang="ts">
  import { navigateTo } from '../core/navigation.svelte.js';
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { WelcomeScene } from '../render/WelcomeScene.js';

  let canvas: HTMLCanvasElement;
  let scene: WelcomeScene | undefined;
  let ready = $state(false);

  onMount(() => {
    if (canvas) scene = new WelcomeScene(canvas);
    const t = setTimeout(() => (ready = true), 80);
    const onResize = () => {
      if (scene && canvas) scene.resize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  });

  onDestroy(() => scene?.dispose());

</script>

<div class="wc" in:fade={{ duration: 700 }}>
  <!-- Three.js atmosphere canvas -->
  <canvas bind:this={canvas} class="wc-canvas" aria-hidden="true"></canvas>

  <!-- Layered atmosphere -->
  <div class="atmo" aria-hidden="true">
    <div class="atmo-base"></div>
    <div class="atmo-gold-radial"></div>
    <div class="atmo-vignette"></div>
    <div class="atmo-bottom-fog"></div>
    <div class="atmo-scanlines"></div>
  </div>

  <!-- Drifting ambient orbs -->
  <div class="orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>

  <!-- Hero section -->
  <main class="hero">
    {#if ready}
      <!-- Brand title -->
      <div class="title-wrap" in:fly={{ y: 55, duration: 900, delay: 250 }}>
        <p class="eyebrow" aria-hidden="true">OFFICIAL CRICKET BETTING EXPERIENCE</p>
        <h1 class="brand-title">
          <span class="bt-cricket">CRICKET</span>
          <span class="bt-crash">CRASH</span>
        </h1>
        <p class="brand-sub" aria-hidden="true">PROVABLY FAIR · CASINO GRADE · GLOBAL</p>
      </div>

      <!-- Circular "PLAY NOW" button -->
      <div class="play-wrap" in:scale={{ start: 0.72, duration: 850, delay: 480 }}>
        <button
          class="play-btn"
          onclick={() => navigateTo('gameplay')}
          aria-label="Play now"
        >
          <div class="pb-ring pb-ring-outer" aria-hidden="true"></div>
          <div class="pb-ring pb-ring-mid" aria-hidden="true"></div>
          <div class="pb-core" aria-hidden="true">
            <span class="pb-icon">▶</span>
            <span class="pb-label">PLAY NOW</span>
          </div>
          <div class="pb-shimmer" aria-hidden="true"></div>
        </button>
      </div>

    {/if}
  </main>

  <!-- Legal footer -->
  <footer class="legal" aria-label="Legal notice">
    <span>18+ · PLAY RESPONSIBLY · CRICKET CRASH IS FOR ENTERTAINMENT PURPOSES ONLY</span>
  </footer>
</div>

<style>
  .wc {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    background: #01010a;
    font-family: 'Outfit', 'Rajdhani', sans-serif;
    color: #fff;
  }

  /* ── WebGL canvas ── */
  .wc-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  /* ── Atmosphere layers ── */
  .atmo {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .atmo-base {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.25) 0%,
      rgba(1, 1, 12, 0.55) 55%,
      rgba(1, 1, 12, 0.92) 100%
    );
  }
  .atmo-gold-radial {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 75% 45% at 50% 38%, rgba(255, 200, 0, 0.07) 0%, transparent 70%);
    animation: gold-breathe 7s ease-in-out infinite;
  }
  @keyframes gold-breathe {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  .atmo-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 8, 0.6) 100%);
  }
  .atmo-bottom-fog {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 35%;
    background: linear-gradient(to top, rgba(1, 1, 12, 0.97) 0%, transparent 100%);
  }
  .atmo-scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(0, 0, 0, 0.045) 3px, rgba(0, 0, 0, 0.045) 4px
    );
    opacity: 0.5;
  }

  /* ── Ambient orbs ── */
  .orbs {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    animation: orb-drift linear infinite;
  }
  .orb-1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255, 200, 0, 0.1), transparent 70%);
    top: -15%; left: -15%;
    animation-duration: 28s;
  }
  .orb-2 {
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(255, 100, 0, 0.08), transparent 70%);
    top: 25%; right: -8%;
    animation-duration: 20s;
    animation-delay: -9s;
  }
  .orb-3 {
    width: 280px; height: 280px;
    background: radial-gradient(circle, rgba(255, 170, 0, 0.06), transparent 70%);
    bottom: 25%; left: 28%;
    animation-duration: 24s;
    animation-delay: -14s;
  }
  @keyframes orb-drift {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(35px, -22px); }
    50% { transform: translate(-12px, 32px); }
    75% { transform: translate(22px, 12px); }
  }

  /* ── Hero ── */
  .hero {
    flex: 1;
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.2rem;
    padding: 2rem 1.5rem 0;
    text-align: center;
  }

  /* Title */
  .title-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }
  .eyebrow {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.38em;
    color: rgba(255, 255, 255, 0.3);
    text-transform: uppercase;
    margin: 0;
  }
  .brand-title {
    margin: 0;
    line-height: 0.88;
    font-weight: 900;
    font-size: clamp(3.2rem, 9vw, 6.5rem);
    letter-spacing: -0.025em;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.05em;
  }
  .bt-cricket {
    background: linear-gradient(140deg, #ffffff 0%, rgba(220, 220, 255, 0.7) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.12));
  }
  .bt-crash {
    background: linear-gradient(140deg, #ffd700 0%, #ff9500 60%, #ffc800 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 35px rgba(255, 200, 0, 0.28));
  }
  .brand-sub {
    font-size: 0.68rem;
    letter-spacing: 0.28em;
    color: rgba(255, 255, 255, 0.26);
    font-weight: 600;
    margin: 0.3rem 0 0;
  }

  /* ── Play button ── */
  .play-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .play-btn {
    position: relative;
    width: 164px;
    height: 164px;
    border: none;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.2, 1, 0.3, 1);
    padding: 0;
  }
  .play-btn:hover { transform: scale(1.07); }
  .play-btn:active { transform: scale(0.95); }

  .pb-ring {
    position: absolute;
    border-radius: 50%;
    border-style: solid;
    border-color: transparent;
  }
  .pb-ring-outer {
    inset: -10px;
    border-width: 2px;
    border-top-color: rgba(255, 200, 0, 0.65);
    border-right-color: rgba(255, 200, 0, 0.18);
    animation: pb-spin 5s linear infinite;
  }
  .pb-ring-mid {
    inset: -3px;
    border-width: 1px;
    border-top-color: rgba(255, 200, 0, 0.28);
    border-bottom-color: rgba(255, 200, 0, 0.1);
    animation: pb-spin 3.5s linear infinite reverse;
  }
  @keyframes pb-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .pb-core {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, #28200a, #18140a, #08060a);
    border: 2px solid rgba(255, 200, 0, 0.22);
    box-shadow:
      0 0 0 1px rgba(255, 200, 0, 0.06),
      0 22px 55px rgba(0, 0, 0, 0.85),
      inset 0 1px 0 rgba(255, 200, 0, 0.14),
      inset 0 -1px 0 rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .play-btn:hover .pb-core {
    border-color: rgba(255, 200, 0, 0.48);
    box-shadow:
      0 0 0 1px rgba(255, 200, 0, 0.12),
      0 26px 65px rgba(0, 0, 0, 0.85),
      0 0 45px rgba(255, 200, 0, 0.14),
      inset 0 1px 0 rgba(255, 200, 0, 0.24),
      inset 0 -1px 0 rgba(0, 0, 0, 0.55);
  }
  .pb-icon {
    font-size: 1.9rem;
    color: #ffc800;
    filter: drop-shadow(0 0 10px rgba(255, 200, 0, 0.65));
    line-height: 1;
  }
  .pb-label {
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    color: rgba(255, 200, 0, 0.8);
    text-transform: uppercase;
  }
  .pb-shimmer {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent, rgba(255, 200, 0, 0.1) 40%, transparent);
    animation: pb-spin 4.5s linear infinite;
    pointer-events: none;
  }

  /* ── Legal footer ── */
  .legal {
    position: relative;
    z-index: 10;
    padding: 0.65rem;
    color: rgba(255, 255, 255, 0.15);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-align: center;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .brand-title { font-size: clamp(2.8rem, 14vw, 4.5rem); }
    .play-btn { width: 140px; height: 140px; }
  }
</style>
