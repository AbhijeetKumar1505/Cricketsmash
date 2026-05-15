<script lang="ts">
  import { navigateTo } from '../core/navigation.svelte.js';
  import { fade, fly } from 'svelte/transition';

  type Mode = {
    id: string;
    title: string;
    description: string;
    accent: string;
    tag: string;
    stats: { label: string; value: string }[];
    available: boolean;
  };

  const modes: Mode[] = [
    {
      id: 'classic',
      title: 'CLASSIC CRASH',
      description: 'The original high-stakes multiplier experience. Simple rules, fast results, massive potential.',
      accent: '#ffc800',
      tag: 'MOST POPULAR',
      stats: [
        { label: 'MAX WIN', value: '1000×' },
        { label: 'SPEED', value: 'FAST' },
        { label: 'MIN BET', value: '$0.10' },
      ],
      available: true,
    },
    {
      id: 'tournament',
      title: 'TOURNAMENT',
      description: 'Progressive stadium levels. Win trophies. Unlock elite avatars and exclusive rewards.',
      accent: '#00d4ff',
      tag: 'RANKED',
      stats: [
        { label: 'TIERS', value: '3 LEVELS' },
        { label: 'BONUS', value: '+20%' },
        { label: 'TROPHIES', value: '12 TYPES' },
      ],
      available: true,
    },
    {
      id: 'social',
      title: 'SOCIAL LOBBY',
      description: 'Watch live games. Compete in community challenges. Spectate the biggest wins.',
      accent: '#ff4b2b',
      tag: 'COMING SOON',
      stats: [
        { label: 'PLAYERS', value: '12,847' },
        { label: 'LIVE', value: '24/7' },
        { label: 'CHAT', value: 'GLOBAL' },
      ],
      available: false,
    },
  ];

  function handleSelect(mode: Mode) {
    if (!mode.available) return;
    navigateTo('gameplay');
  }
</script>

<div class="page" in:fade={{ duration: 600 }}>
  <!-- Header -->
  <div class="header">
    <button class="back-btn" onclick={() => navigateTo('welcome')} aria-label="Go back">← BACK</button>
    <div class="title-section">
      <h2 class="title">SELECT <span class="gold">MODE</span></h2>
      <p class="subtitle">CHOOSE YOUR ARENA</p>
    </div>
    <div class="balance" aria-label="Your balance">
      <span class="bal-label">CREDITS</span>
      <span class="bal-value">10,000.00</span>
    </div>
  </div>

  <!-- Mode cards -->
  <div class="modes-grid">
    {#each modes as mode, i}
      <button
        class="mode-card"
        class:locked={!mode.available}
        onclick={() => handleSelect(mode)}
        in:fly={{ y: 35, delay: 100 * i, duration: 750 }}
        aria-label="{mode.title} — {mode.available ? 'available' : 'coming soon'}"
        style="--accent: {mode.accent}"
        disabled={!mode.available}
      >
        <!-- Background glow layer -->
        <div class="card-glow" aria-hidden="true"></div>
        <!-- Top accent bar -->
        <div class="card-accent-bar" aria-hidden="true"></div>

        <div class="card-body">
          <!-- Tag pill -->
          <div class="mode-tag" style="color:{mode.accent}; border-color:{mode.accent}44; background:{mode.accent}11">
            {mode.tag}
          </div>

          <!-- Icon -->
          <div class="mode-icon" aria-hidden="true">
            {#if mode.id === 'classic'}
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.3"/>
                <path d="M24 8 L24 40" stroke="currentColor" stroke-width="2" stroke-dasharray="3 4"/>
                <path d="M8 24 L40 24" stroke="currentColor" stroke-width="2" stroke-dasharray="3 4"/>
                <circle cx="24" cy="24" r="5" fill="currentColor"/>
                <path d="M16 14 L32 34" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            {:else if mode.id === 'tournament'}
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M16 8 H32 V26 C32 33.7 28.4 38 24 38 C19.6 38 16 33.7 16 26 Z" stroke="currentColor" stroke-width="2.5" fill="none"/>
                <path d="M16 12 H10 C10 12 10 24 16 26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M32 12 H38 C38 12 38 24 32 26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="24" y1="38" x2="24" y2="44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="16" y1="44" x2="32" y2="44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            {:else}
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="18" cy="20" r="7" stroke="currentColor" stroke-width="2.5" fill="none"/>
                <circle cx="32" cy="16" r="6" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6"/>
                <path d="M6 38 C6 30 12 26 18 26 C24 26 30 30 30 38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                <path d="M28 28 C31 27 38 29 38 36" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6" fill="none"/>
              </svg>
            {/if}
          </div>

          <h3 class="mode-title">{mode.title}</h3>
          <p class="mode-desc">{mode.description}</p>

          <!-- Stats row -->
          <div class="mode-stats" aria-label="Mode statistics">
            {#each mode.stats as stat}
              <div class="ms-item">
                <span class="ms-label">{stat.label}</span>
                <span class="ms-value">{stat.value}</span>
              </div>
            {/each}
          </div>

          <!-- CTA -->
          {#if mode.available}
            <div class="mode-cta">ENTER ARENA →</div>
          {:else}
            <div class="mode-cta locked-cta">COMING SOON</div>
          {/if}
        </div>

        <!-- Hover border -->
        <div class="hover-border" aria-hidden="true"></div>
      </button>
    {/each}
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at 50% 20%, #0e0e1c 0%, #020208 100%);
    color: #fff;
    padding: 2.5rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 3rem;
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
  }

  /* ── Header ── */
  .header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    flex-shrink: 0;
  }
  .back-btn {
    justify-self: start;
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

  .balance {
    justify-self: end;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.65rem 1.2rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .bal-label { font-size: 0.55rem; letter-spacing: 0.12em; color: rgba(255, 255, 255, 0.25); font-weight: 700; }
  .bal-value { font-size: 1.1rem; font-weight: 900; color: #ffc800; font-variant-numeric: tabular-nums; }

  /* ── Modes grid ── */
  .modes-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.8rem;
    max-width: 1300px;
    margin: 0 auto;
    width: 100%;
    flex: 1;
    align-items: stretch;
  }

  /* ── Mode card ── */
  .mode-card {
    position: relative;
    background: #0c0c18;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 22px;
    padding: 0;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1), box-shadow 0.4s, border-color 0.3s;
    display: flex;
    flex-direction: column;
    color: inherit;
    min-height: 420px;
  }
  .mode-card:not(.locked):hover {
    transform: translateY(-12px) scale(1.015);
    box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 30px color-mix(in srgb, var(--accent, #ffc800) 10%, transparent);
    border-color: color-mix(in srgb, var(--accent, #ffc800) 25%, transparent);
  }
  .mode-card.locked {
    opacity: 0.55;
    cursor: not-allowed;
    filter: grayscale(0.8);
  }
  .mode-card:disabled { pointer-events: none; }

  /* Glow */
  .card-glow {
    position: absolute;
    bottom: -60px; left: 50%;
    transform: translateX(-50%);
    width: 200px; height: 200px;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent, #ffc800) 20%, transparent), transparent 70%);
    transition: opacity 0.4s;
    opacity: 0;
    pointer-events: none;
    border-radius: 50%;
  }
  .mode-card:hover .card-glow { opacity: 1; }

  /* Top accent bar */
  .card-accent-bar {
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--accent, #ffc800), transparent);
    opacity: 0.4;
    transition: opacity 0.3s;
  }
  .mode-card:hover .card-accent-bar { opacity: 1; }

  /* Body */
  .card-body {
    padding: 2rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    position: relative;
    z-index: 2;
  }

  /* Tag */
  .mode-tag {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    padding: 4px 10px;
    border-radius: 100px;
    border: 1px solid;
    width: fit-content;
  }

  /* SVG Icon */
  .mode-icon {
    width: 52px;
    height: 52px;
    color: var(--accent, #ffc800);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent, #ffc800) 8%, transparent);
    border-radius: 14px;
    padding: 10px;
    transition: background 0.3s;
  }
  .mode-icon svg { width: 100%; height: 100%; }
  .mode-card:hover .mode-icon { background: color-mix(in srgb, var(--accent, #ffc800) 15%, transparent); }

  .mode-title { font-size: 1.6rem; font-weight: 900; margin: 0; letter-spacing: -0.01em; }
  .mode-desc { font-size: 0.85rem; line-height: 1.55; color: rgba(255,255,255,0.42); margin: 0; flex: 1; }

  /* Stats */
  .mode-stats {
    display: flex;
    gap: 0;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
    overflow: hidden;
    margin-top: 0.25rem;
  }
  .ms-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.8rem 0.5rem;
    background: rgba(255,255,255,0.02);
    border-right: 1px solid rgba(255,255,255,0.04);
    gap: 3px;
  }
  .ms-item:last-child { border-right: none; }
  .ms-label { font-size: 0.48rem; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.22); }
  .ms-value { font-size: 0.78rem; font-weight: 900; color: rgba(255,255,255,0.75); }

  /* CTA */
  .mode-cta {
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: var(--accent, #ffc800);
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255,255,255,0.04);
    transition: letter-spacing 0.25s;
  }
  .mode-card:hover .mode-cta { letter-spacing: 0.18em; }
  .locked-cta { color: rgba(255,255,255,0.22); }

  /* Hover border */
  .hover-border {
    position: absolute;
    inset: 0;
    border: 2px solid transparent;
    border-radius: 22px;
    transition: border-color 0.4s;
    pointer-events: none;
  }
  .mode-card:hover .hover-border {
    border-color: color-mix(in srgb, var(--accent, #ffc800) 15%, transparent);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .page { padding: 2rem 1.5rem; }
    .modes-grid { grid-template-columns: 1fr; max-height: calc(100vh - 140px); overflow-y: auto; }
    .mode-card { min-height: auto; }
  }
</style>
