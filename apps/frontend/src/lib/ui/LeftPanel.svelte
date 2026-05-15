<script lang="ts">
  import { navigationState } from '../../core/navigation.svelte.js';
  import { AVATARS } from '../../characters/human/AvatarGallery.js';
  import FacePortrait from './FacePortrait.svelte';

  import type { Difficulty } from '../../core/navigation.svelte.js';

  const BATSMEN: { id: string; name: string; level: number; accent: string; difficulty: Difficulty; diffLabel: string }[] = [
    { id: 'modi',  name: 'NARENDRA MODI',  level: 1, accent: '#ffc800', difficulty: 'easy',   diffLabel: 'EASY'   },
    { id: 'trump', name: 'DONALD TRUMP',   level: 2, accent: '#ff8833', difficulty: 'medium', diffLabel: 'MEDIUM' },
    { id: 'kim',   name: 'KIM JONG UN',    level: 3, accent: '#00eebb', difficulty: 'hard',   diffLabel: 'HARD'   },
    { id: 'putin', name: 'VLADIMIR PUTIN', level: 4, accent: '#ee4444', difficulty: 'insane', diffLabel: 'INSANE' },
  ];

  function selectAvatar(id: string, difficulty: Difficulty) {
    navigationState.selectedAvatarId = id;
    navigationState.selectedDifficulty = difficulty;
  }
</script>

<aside class="lp" aria-label="Batsman selection">
  <div class="lp-header">
    <span class="lp-title">SELECT BATSMAN</span>
  </div>

  <div class="batsmen-list">
    {#each BATSMEN as batter}
      {@const avatar = AVATARS[batter.id]}
      {@const isSelected = navigationState.selectedAvatarId === batter.id}
      {#if avatar}
        <button
          class="batter-row"
          class:selected={isSelected}
          style="--acc: {batter.accent}"
          onclick={() => selectAvatar(batter.id, batter.difficulty)}
          aria-label="Select {batter.name} - Level {batter.level}"
          aria-pressed={isSelected}
        >
          <!-- Portrait circle -->
          <div class="portrait-ring" class:ring-active={isSelected}>
            <div class="portrait-crop">
              <FacePortrait {avatar} width={46} height={66} />
            </div>
            {#if isSelected}
              <div class="check-badge" aria-hidden="true">
                <svg viewBox="0 0 10 10" width="10" height="10" fill="none">
                  <path d="M2 5.5l2.5 2.5 4-4.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            {/if}
          </div>

          <!-- Info -->
          <div class="batter-info">
            <span class="batter-name" class:name-active={isSelected}>{batter.name}</span>
            <div class="batter-meta">
              <span class="batter-level">LV {batter.level}</span>
              <span class="batter-diff" style="color: {batter.accent}">{batter.diffLabel}</span>
            </div>
          </div>
        </button>
      {/if}
    {/each}
  </div>

  <!-- Down indicator -->
  <div class="scroll-hint" aria-hidden="true">
    <svg viewBox="0 0 16 8" width="16" height="8" fill="none">
      <path d="M2 1.5l6 5 6-5" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
</aside>

<style>
  .lp {
    width: 200px;
    height: 100%;
    /* Brushed metal surface */
    background:
      repeating-linear-gradient(
        180deg,
        transparent 0px,
        rgba(255,255,255,0.007) 1px,
        transparent 2px,
        transparent 5px
      ),
      linear-gradient(180deg, #141420 0%, #0e0e1a 100%);
    border-right: 1px solid rgba(180, 140, 60, 0.22);
    box-shadow:
      inset -1px 0 0 rgba(255,255,255,0.025),
      4px 0 20px rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* Header */
  .lp-header {
    padding: 10px 14px 9px;
    border-bottom: 1px solid rgba(180, 140, 60, 0.15);
    background: linear-gradient(180deg, rgba(200,160,80,0.04), transparent);
    flex-shrink: 0;
  }

  .lp-title {
    font-size: 0.43rem;
    font-weight: 900;
    letter-spacing: 0.24em;
    color: rgba(200, 160, 80, 0.85);
    display: block;
    text-align: center;
    text-shadow: 0 0 12px rgba(200,160,80,0.3);
  }

  /* Batsmen list */
  .batsmen-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    padding: 6px 0;
  }

  /* Each row */
  .batter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.18s;
    position: relative;
    text-align: left;
    color: inherit;
    font-family: inherit;
    width: 100%;
    min-height: 0;
    flex: 1;
  }

  .batter-row:hover {
    background: color-mix(in srgb, var(--acc, #ffc800) 5%, transparent);
  }

  .batter-row.selected {
    background: color-mix(in srgb, var(--acc, #ffc800) 8%, #0b0b12);
  }

  /* Active left accent bar */
  .batter-row.selected::before {
    content: '';
    position: absolute;
    left: 0;
    top: 20%;
    bottom: 20%;
    width: 2px;
    background: var(--acc, #ffc800);
    border-radius: 0 2px 2px 0;
    box-shadow: 0 0 6px var(--acc, #ffc800);
  }

  /* Portrait ring */
  .portrait-ring {
    position: relative;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    flex-shrink: 0;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: #0a0a14;
  }

  .portrait-ring.ring-active {
    border-color: var(--acc, #ffc800);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--acc, #ffc800) 30%, transparent),
      0 0 12px color-mix(in srgb, var(--acc, #ffc800) 35%, transparent);
  }

  /* Crop the portrait to fill the circle */
  .portrait-crop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow: hidden;
  }

  /* Check badge on selected avatar */
  .check-badge {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--acc, #ffc800);
    display: grid;
    place-items: center;
    border: 1.5px solid #0b0b12;
    flex-shrink: 0;
  }

  /* Info block */
  .batter-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .batter-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.6rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.75);
    letter-spacing: -0.01em;
    line-height: 1.2;
    transition: color 0.2s;
    word-break: break-word;
    hyphens: auto;
  }

  .batter-name.name-active {
    color: var(--acc, #ffc800);
  }

  .batter-meta {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .batter-level {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.48);
  }

  .batter-diff {
    font-size: 0.4rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    opacity: 0.75;
    transition: opacity 0.2s;
  }

  .selected .batter-diff {
    opacity: 1;
  }

  /* Scroll hint arrow */
  .scroll-hint {
    display: flex;
    justify-content: center;
    padding: 6px 0 8px;
    flex-shrink: 0;
    border-top: 1px solid rgba(180, 140, 60, 0.08);
  }
</style>
