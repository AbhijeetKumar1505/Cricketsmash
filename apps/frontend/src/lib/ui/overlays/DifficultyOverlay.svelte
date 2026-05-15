<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { navigationState, closeOverlay, type Difficulty } from '../../../core/navigation.svelte.js';

  const DIFFICULTIES: { id: Difficulty; name: string; sub: string; desc: string; mult: string; accent: string }[] = [
    { id: 'easy',   name: 'EASY',   sub: 'Tier 1', desc: 'Slower bowler. Wider hitbox. Great for beginners.',         mult: '×1.0',   accent: '#00cc66' },
    { id: 'medium', name: 'MEDIUM', sub: 'Tier 2', desc: 'Balanced challenge. Standard bowler speed.',                 mult: '×1.2',   accent: '#ffc800' },
    { id: 'hard',   name: 'HARD',   sub: 'Tier 3', desc: 'Faster bowler. Tighter hitbox. Higher risk.',               mult: '×1.5',   accent: '#ff7700' },
    { id: 'insane', name: 'INSANE', sub: 'Tier 4', desc: 'Maximum speed. Laser hitbox. Field aggression maxed.',      mult: '×2.0',   accent: '#ff2244' },
  ];

  function select(id: Difficulty) {
    navigationState.selectedDifficulty = id;
    closeOverlay();
  }
</script>

<div class="overlay" in:fly={{ y: 40, duration: 320 }} out:fade={{ duration: 200 }}
  role="dialog" aria-modal="true" aria-label="Select difficulty">

  <div class="sheet">
    <div class="sheet-header">
      <h2 class="sheet-title">SELECT <span class="gold">DIFFICULTY</span></h2>
      <button class="close-btn" onclick={closeOverlay} aria-label="Close difficulty selection">×</button>
    </div>

    <div class="diff-grid">
      {#each DIFFICULTIES as d}
        <button
          class="diff-card"
          class:active={navigationState.selectedDifficulty === d.id}
          style="--acc: {d.accent}"
          onclick={() => select(d.id)}
          aria-pressed={navigationState.selectedDifficulty === d.id}
          aria-label="Select {d.name} difficulty"
        >
          <div class="diff-top">
            <div class="diff-name-wrap">
              <span class="diff-name">{d.name}</span>
              <span class="diff-sub">{d.sub}</span>
            </div>
            <span class="diff-mult">{d.mult}</span>
          </div>
          <p class="diff-desc">{d.desc}</p>
          <div class="diff-bar" aria-hidden="true">
            <div class="diff-bar-fill" style="width: {d.id === 'easy' ? 25 : d.id === 'medium' ? 50 : d.id === 'hard' ? 75 : 100}%"></div>
          </div>
          {#if navigationState.selectedDifficulty === d.id}
            <div class="active-ring" aria-hidden="true"></div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(4, 4, 8, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .sheet {
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sheet-title {
    font-family: 'Outfit', sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.02em;
    color: #fff;
  }

  .gold { color: #b4873c; }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: 900;
    display: grid;
    place-items: center;
    padding: 0;
    transition: all 0.18s;
    line-height: 1;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .diff-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .diff-card {
    position: relative;
    background: #0e0e12;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 1.1rem 1rem;
    cursor: pointer;
    text-align: left;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    transition: transform 0.25s cubic-bezier(0.2, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s;
  }

  .diff-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--acc, #ffc800) 25%, transparent);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  }

  .diff-card.active {
    border-color: var(--acc, #ffc800);
    box-shadow: 0 0 24px color-mix(in srgb, var(--acc, #ffc800) 18%, transparent);
  }

  .diff-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .diff-name-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .diff-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.95rem;
    font-weight: 900;
    color: var(--acc, #ffc800);
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .diff-sub {
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: rgba(255, 255, 255, 0.28);
  }

  .diff-mult {
    font-family: 'Outfit', monospace;
    font-size: 0.75rem;
    font-weight: 900;
    color: color-mix(in srgb, var(--acc, #ffc800) 80%, #fff);
    background: color-mix(in srgb, var(--acc, #ffc800) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--acc, #ffc800) 20%, transparent);
    border-radius: 6px;
    padding: 2px 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .diff-desc {
    font-size: 0.62rem;
    color: rgba(255, 255, 255, 0.38);
    line-height: 1.5;
    margin: 0;
  }

  .diff-bar {
    height: 2px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 100px;
    overflow: hidden;
  }

  .diff-bar-fill {
    height: 100%;
    background: var(--acc, #ffc800);
    border-radius: 100px;
    box-shadow: 0 0 6px var(--acc, #ffc800);
  }

  .active-ring {
    position: absolute;
    inset: -1px;
    border-radius: 14px;
    border: 2px solid var(--acc, #ffc800);
    pointer-events: none;
    animation: ring-pulse 2.5s ease-in-out infinite;
  }

  @keyframes ring-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
  }

  @media (max-width: 600px) {
    .diff-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
