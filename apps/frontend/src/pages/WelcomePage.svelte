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

  // Flags representing cricket-playing nations worldwide
  const flags = ['🇮🇳','🇵🇰','🇦🇺','🇬🇧','🇿🇦','🇳🇿','🇧🇩','🇳🇬','🇦🇫','🇵🇬',
                  '🇺🇸','🇨🇦','🇯🇵','🇨🇳','🇷🇺','🇰🇪','🇮🇹','🇧🇷','🇦🇪','🇸🇱'];
  const loopFlags = [...flags, ...flags, ...flags];
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

  <!-- Top stats bar -->
  {#if ready}
    <header class="top-bar" in:fly={{ y: -28, duration: 700, delay: 150 }}>
      <div class="live-badge" aria-label="Live players">
        <span class="live-dot" aria-hidden="true"></span>
        <span class="live-text">LIVE</span>
      </div>

      <div class="top-stats" role="status" aria-label="Server statistics">
        <div class="ts-item">
          <span class="ts-label">PLAYERS</span>
          <span class="ts-val">12,847</span>
        </div>
        <div class="ts-div" aria-hidden="true"></div>
        <div class="ts-item">
          <span class="ts-label">JACKPOT</span>
          <span class="ts-val ts-gold">$2.4M</span>
        </div>
        <div class="ts-div" aria-hidden="true"></div>
        <div class="ts-item">
          <span class="ts-label">MAX WIN</span>
          <span class="ts-val">1000×</span>
        </div>
      </div>

      <div class="top-end">
        <button class="top-icon-btn" title="Settings" aria-label="Settings" onclick={() => {}}>⚙</button>
        <button class="top-icon-btn" title="Leaderboard" aria-label="Leaderboard" onclick={() => {}}>🏆</button>
      </div>
    </header>
  {/if}

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

      <!-- Secondary action buttons -->
      <nav class="sec-nav" aria-label="Main menu" in:fly={{ y: 28, duration: 700, delay: 750 }}>
        <button class="sn-btn" onclick={() => navigateTo('gameplay')} aria-label="Quick bet">
          <span class="sn-icon" aria-hidden="true">⚡</span>
          <span class="sn-label">QUICK BET</span>
        </button>
        <button class="sn-btn sn-highlight" onclick={() => navigateTo('gameplay')} aria-label="Tournament mode">
          <span class="sn-icon" aria-hidden="true">🏆</span>
          <span class="sn-label">TOURNAMENT</span>
        </button>
        <button class="sn-btn" onclick={() => navigateTo('gameplay')} aria-label="Choose avatar">
          <span class="sn-icon" aria-hidden="true">👤</span>
          <span class="sn-label">AVATAR</span>
        </button>
        <button class="sn-btn" onclick={() => navigateTo('gameplay')} aria-label="Skins and inventory">
          <span class="sn-icon" aria-hidden="true">🎖</span>
          <span class="sn-label">SKINS</span>
        </button>
      </nav>
    {/if}
  </main>

  <!-- Scrolling country flags strip -->
  {#if ready}
    <div
      class="flags-strip"
      in:fade={{ delay: 1100, duration: 700 }}
      aria-hidden="true"
    >
      <div class="flags-track">
        {#each loopFlags as flag}
          <span class="flag-item">{flag}</span>
        {/each}
      </div>
    </div>
  {/if}

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

  /* ── Top bar ── */
  .top-bar {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 1100px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.4rem 2rem 0;
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 28, 48, 0.1);
    border: 1px solid rgba(255, 28, 48, 0.22);
    border-radius: 100px;
    padding: 4px 10px;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    background: #ff3344;
    border-radius: 50%;
    animation: live-blink 1.5s ease-in-out infinite;
    box-shadow: 0 0 6px #ff3344;
  }
  @keyframes live-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
  .live-text {
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.2em;
    color: #ff4455;
  }

  .top-stats {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 100px;
    padding: 6px 18px;
    backdrop-filter: blur(12px);
  }
  .ts-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .ts-label {
    font-size: 0.45rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: rgba(255, 255, 255, 0.28);
  }
  .ts-val {
    font-size: 0.72rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.82);
    font-variant-numeric: tabular-nums;
  }
  .ts-gold {
    color: #ffc800;
    text-shadow: 0 0 10px rgba(255, 200, 0, 0.45);
  }
  .ts-div {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.07);
  }

  .top-end {
    display: flex;
    gap: 8px;
  }
  .top-icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    display: grid;
    place-items: center;
    padding: 0;
  }
  .top-icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.12);
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

  /* ── Secondary nav ── */
  .sec-nav {
    display: flex;
    gap: 0.9rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .sn-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 88px;
    padding: 1rem 0.4rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: all 0.25s;
    backdrop-filter: blur(8px);
  }
  .sn-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 200, 0, 0.22);
    color: #fff;
    transform: translateY(-5px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  }
  .sn-highlight {
    background: rgba(255, 200, 0, 0.05);
    border-color: rgba(255, 200, 0, 0.14);
    color: #ffd700;
  }
  .sn-highlight:hover {
    background: rgba(255, 200, 0, 0.1);
    border-color: rgba(255, 200, 0, 0.32);
    color: #ffd700;
  }
  .sn-icon {
    font-size: 1.35rem;
    line-height: 1;
  }
  .sn-label {
    font-size: 0.52rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ── Flags strip ── */
  .flags-strip {
    position: relative;
    z-index: 10;
    width: 100%;
    overflow: hidden;
    padding: 0.7rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  }
  .flags-track {
    display: flex;
    gap: 1.4rem;
    width: max-content;
    animation: flags-scroll 38s linear infinite;
  }
  @keyframes flags-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-33.333%); }
  }
  .flag-item {
    font-size: 1.45rem;
    opacity: 0.65;
    filter: grayscale(0.25);
    flex-shrink: 0;
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
    .top-bar { padding: 1rem 1rem 0; }
    .top-stats { gap: 0.8rem; padding: 5px 12px; }
    .brand-title { font-size: clamp(2.8rem, 14vw, 4.5rem); }
    .play-btn { width: 140px; height: 140px; }
    .sec-nav { gap: 0.6rem; }
    .sn-btn { width: 76px; padding: 0.8rem 0.3rem; }
  }

  @media (max-width: 400px) {
    .top-stats { display: none; }
  }
</style>
