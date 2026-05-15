<script lang="ts">
  import { navigateTo } from '../core/navigation.svelte.js';
  import { fade, fly } from 'svelte/transition';

  type Level = {
    id: string;
    tier: string;
    name: string;
    description: string;
    payout: string;
    crowd: string;
    atmosphere: string;
    accent: string;
    unlocked: boolean;
    requirement?: string;
  };

  const levels: Level[] = [
    {
      id: 'local',
      tier: 'TIER 1',
      name: 'LOCAL CLUB',
      description: 'Dusty pitch, small crowd, clay outfield. Perfect for learning the crash rhythm.',
      payout: '1.0× Base',
      crowd: '~2,000',
      atmosphere: 'CASUAL',
      accent: '#ffc800',
      unlocked: true,
    },
    {
      id: 'state',
      tier: 'TIER 2',
      name: 'STATE ARENA',
      description: 'Floodlights on, professional turf, raucous home crowd. Higher stakes, bigger swings.',
      payout: '1.1× Base',
      crowd: '~25,000',
      atmosphere: 'ELECTRIC',
      accent: '#00d4ff',
      unlocked: false,
      requirement: 'Win 10 matches at Tier 1',
    },
    {
      id: 'international',
      tier: 'TIER 3',
      name: 'WORLD STADIUM',
      description: 'Global broadcast. Gold-lit coliseum. A hundred thousand voices. Maximum spectacle.',
      payout: '1.2× Base',
      crowd: '~100,000',
      atmosphere: 'LEGENDARY',
      accent: '#ffd700',
      unlocked: false,
      requirement: 'Hit 100× multiplier at Tier 2',
    },
  ];

  function selectLevel(level: Level) {
    if (!level.unlocked) return;
    navigateTo('gameplay');
  }
</script>

<div class="page" in:fade={{ duration: 600 }}>
  <!-- Header -->
  <div class="header">
    <button class="back-btn" onclick={() => navigateTo('welcome')} aria-label="Go back">← BACK</button>
    <div class="title-section">
      <h2 class="title">LEVEL <span class="gold">SELECT</span></h2>
      <p class="subtitle">TOURNAMENT PROGRESSION</p>
    </div>
    <div class="wins-stat" aria-label="Your wins">
      <span class="ws-label">YOUR WINS</span>
      <span class="ws-value">04</span>
    </div>
  </div>

  <!-- Level cards (horizontal) -->
  <div class="levels-row" role="list">
    {#each levels as level, i}
      <div
        class="lv-card"
        class:locked={!level.unlocked}
        style="--accent: {level.accent}"
        in:fly={{ x: 40, delay: i * 140, duration: 800 }}
      >
        <!-- Stadium illustration (pure CSS) -->
        <div class="stadium-art" aria-hidden="true">
          <!-- Sky gradient -->
          <div class="sa-sky"></div>

          {#if level.id === 'local'}
            <!-- Tier 1: small curved stands -->
            <div class="sa-stand sa-stand-left sa-stand-sm"></div>
            <div class="sa-stand sa-stand-right sa-stand-sm"></div>
            <div class="sa-pitch"></div>
            <div class="sa-crowd sa-crowd-sm"></div>
          {:else if level.id === 'state'}
            <!-- Tier 2: larger stands + floodlight poles -->
            <div class="sa-stand sa-stand-left sa-stand-md"></div>
            <div class="sa-stand sa-stand-right sa-stand-md"></div>
            <div class="sa-pole sa-pole-left"></div>
            <div class="sa-pole sa-pole-right"></div>
            <div class="sa-light sa-light-left"></div>
            <div class="sa-light sa-light-right"></div>
            <div class="sa-pitch"></div>
            <div class="sa-crowd sa-crowd-md"></div>
          {:else}
            <!-- Tier 3: mega stadium with golden glow -->
            <div class="sa-outer-arc"></div>
            <div class="sa-stand sa-stand-left sa-stand-lg"></div>
            <div class="sa-stand sa-stand-right sa-stand-lg"></div>
            <div class="sa-pole sa-pole-left sa-pole-tall"></div>
            <div class="sa-pole sa-pole-right sa-pole-tall"></div>
            <div class="sa-light sa-light-left sa-light-big"></div>
            <div class="sa-light sa-light-right sa-light-big"></div>
            <div class="sa-pitch sa-pitch-gold"></div>
            <div class="sa-crowd sa-crowd-lg"></div>
            <div class="sa-floodglow"></div>
          {/if}

          <!-- Lock overlay -->
          {#if !level.unlocked}
            <div class="sa-lock" aria-hidden="true">
              <span class="lock-icon">🔒</span>
            </div>
          {/if}

          <!-- Tier badge -->
          <div class="sa-tier" style="color:{level.accent}; border-color:{level.accent}55; background:{level.accent}11">
            {level.tier}
          </div>
        </div>

        <!-- Level info -->
        <div class="lv-info">
          <h3 class="lv-name">{level.name}</h3>
          <p class="lv-desc">{level.description}</p>

          <!-- Stats grid -->
          <div class="lv-stats">
            <div class="ls-item">
              <span class="ls-label">PAYOUT</span>
              <span class="ls-value" style="color:{level.accent}">{level.payout}</span>
            </div>
            <div class="ls-item">
              <span class="ls-label">CROWD</span>
              <span class="ls-value">{level.crowd}</span>
            </div>
            <div class="ls-item">
              <span class="ls-label">VIBE</span>
              <span class="ls-value">{level.atmosphere}</span>
            </div>
          </div>

          {#if level.unlocked}
            <button class="enter-btn" onclick={() => selectLevel(level)} style="--accent: {level.accent}">
              ENTER ARENA →
            </button>
          {:else}
            <div class="lock-req" aria-label="Unlock requirement">
              <span aria-hidden="true">🔒</span>
              <span>{level.requirement}</span>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    background: #020208;
    color: #fff;
    padding: 2.5rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .back-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.38);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: color 0.2s;
    padding: 0;
  }
  .back-btn:hover { color: rgba(255, 255, 255, 0.8); }

  .title-section { text-align: center; }
  .title { font-size: 2.6rem; font-weight: 900; margin: 0; letter-spacing: -0.02em; }
  .gold { color: #ffc800; }
  .subtitle {
    font-size: 0.72rem;
    letter-spacing: 0.3em;
    color: rgba(255, 255, 255, 0.28);
    margin: 0.35rem 0 0;
    font-weight: 600;
  }

  .wins-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  .ws-label { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.25); }
  .ws-value { font-size: 1.5rem; font-weight: 900; color: #00d4ff; font-variant-numeric: tabular-nums; }

  /* ── Level row ── */
  .levels-row {
    display: flex;
    gap: 2rem;
    justify-content: center;
    flex: 1;
    align-items: stretch;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Level card ── */
  .lv-card {
    flex: 1;
    max-width: 420px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 24px;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
  }
  .lv-card:not(.locked):hover {
    border-color: color-mix(in srgb, var(--accent, #ffc800) 35%, transparent);
    transform: translateY(-10px);
    box-shadow: 0 24px 48px rgba(0,0,0,0.55), 0 0 28px color-mix(in srgb, var(--accent, #ffc800) 10%, transparent);
  }
  .lv-card.locked { opacity: 0.65; filter: grayscale(0.7); }

  /* ── Stadium art (CSS) ── */
  .stadium-art {
    position: relative;
    height: 210px;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* Sky */
  .sa-sky {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #06080f 0%, #0a1022 50%, #131830 100%);
  }

  /* Stands */
  .sa-stand {
    position: absolute;
    bottom: 0;
    background: linear-gradient(180deg, #1c2035 0%, #0e1220 100%);
  }
  .sa-stand-left { left: 0; }
  .sa-stand-right { right: 0; transform: scaleX(-1); }
  .sa-stand-sm { width: 38%; height: 60%; border-radius: 0 50% 0 0; }
  .sa-stand-md { width: 44%; height: 72%; border-radius: 0 40% 0 0; }
  .sa-stand-lg { width: 48%; height: 84%; border-radius: 0 32% 0 0; }

  /* Floodlight poles */
  .sa-pole {
    position: absolute;
    bottom: 55%;
    width: 4px;
    background: linear-gradient(180deg, #444 0%, #222 100%);
    border-radius: 2px;
  }
  .sa-pole-left { left: 34%; }
  .sa-pole-right { right: 34%; }
  .sa-pole { height: 80px; }
  .sa-pole-tall { height: 100px; }

  /* Floodlight heads */
  .sa-light {
    position: absolute;
    border-radius: 4px;
  }
  .sa-light-left { left: 28%; }
  .sa-light-right { right: 28%; }
  .sa-light {
    bottom: calc(55% + 76px);
    width: 20px; height: 8px;
    background: rgba(255, 220, 100, 0.7);
    box-shadow: 0 0 12px rgba(255, 220, 100, 0.8), 0 0 30px rgba(255, 220, 100, 0.3);
  }
  .sa-light-big {
    width: 28px; height: 10px;
    bottom: calc(55% + 96px);
    background: rgba(255, 240, 160, 0.9);
    box-shadow: 0 0 20px rgba(255, 240, 160, 0.9), 0 0 50px rgba(255, 200, 0, 0.4);
  }

  /* Outer arc (tier 3 only) */
  .sa-outer-arc {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 140%;
    height: 95%;
    border: 3px solid rgba(255, 215, 0, 0.08);
    border-radius: 50%;
    bottom: -20%;
  }

  /* Pitch */
  .sa-pitch {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 30%;
    height: 55%;
    background: linear-gradient(180deg, #1a2f12 0%, #213818 100%);
    border-radius: 4px 4px 0 0;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .sa-pitch-gold {
    background: linear-gradient(180deg, #1e3015 0%, #253d18 100%);
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.06);
  }

  /* Crowd silhouettes */
  .sa-crowd {
    position: absolute;
    bottom: 55%;
    left: 0;
    right: 0;
    background: repeating-linear-gradient(
      90deg,
      rgba(255,255,255,0.03) 0px,
      rgba(255,255,255,0.03) 6px,
      rgba(255,255,255,0.01) 6px,
      rgba(255,255,255,0.01) 12px
    );
  }
  .sa-crowd-sm { height: 14px; opacity: 0.5; }
  .sa-crowd-md { height: 18px; opacity: 0.65; }
  .sa-crowd-lg { height: 22px; opacity: 0.8; }

  /* Golden flood glow (tier 3) */
  .sa-floodglow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 40% at 22% 25%, rgba(255,200,0,0.08) 0%, transparent 70%),
      radial-gradient(ellipse 60% 40% at 78% 25%, rgba(255,200,0,0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  /* Lock overlay */
  .sa-lock {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    backdrop-filter: blur(2px);
  }
  .lock-icon { font-size: 2.5rem; }

  /* Tier badge */
  .sa-tier {
    position: absolute;
    top: 12px;
    left: 12px;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    padding: 4px 10px;
    border-radius: 100px;
    border: 1px solid;
    backdrop-filter: blur(8px);
    z-index: 5;
  }

  /* ── Level info ── */
  .lv-info {
    padding: 1.8rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
  }
  .lv-name { font-size: 1.8rem; font-weight: 900; margin: 0; letter-spacing: -0.015em; }
  .lv-desc { font-size: 0.85rem; color: rgba(255,255,255,0.4); line-height: 1.5; margin: 0; flex: 1; }

  /* Stats */
  .lv-stats {
    display: flex;
    gap: 0;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
    overflow: hidden;
  }
  .ls-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 0.5rem;
    background: rgba(255,255,255,0.02);
    border-right: 1px solid rgba(255,255,255,0.04);
    gap: 3px;
  }
  .ls-item:last-child { border-right: none; }
  .ls-label { font-size: 0.48rem; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.22); }
  .ls-value { font-size: 0.78rem; font-weight: 900; color: rgba(255,255,255,0.75); }

  /* Enter button */
  .enter-btn {
    width: 100%;
    padding: 1rem;
    background: color-mix(in srgb, var(--accent, #ffc800) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent, #ffc800) 35%, transparent);
    border-radius: 12px;
    color: var(--accent, #ffc800);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: all 0.25s;
  }
  .enter-btn:hover {
    background: color-mix(in srgb, var(--accent, #ffc800) 25%, transparent);
    border-color: color-mix(in srgb, var(--accent, #ffc800) 55%, transparent);
    transform: scale(1.02);
  }

  /* Lock requirement */
  .lock-req {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.02);
    padding: 0.9rem 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.04);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .page { padding: 2rem 1.5rem; }
    .levels-row { flex-direction: column; overflow-y: auto; }
    .lv-card { max-width: none; }
    .stadium-art { height: 160px; }
  }
</style>
