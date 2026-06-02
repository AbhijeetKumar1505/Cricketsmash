<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { navigationState, closeOverlay, type Difficulty } from '../../../core/navigation.svelte.js';
  import { setDifficulty } from '../../../core/gameController.svelte.js';
  import GlbThumbnail from '../GlbThumbnail.svelte';
  import type { PlayerId } from '../../../game/CharacterManager.js';

  const DIFFICULTIES: {
    id: Difficulty; playerId: PlayerId;
    name: string; sub: string; desc: string; mult: string; accent: string;
  }[] = [
    { id: 'easy',   playerId: 'modi',  name: 'EASY',     sub: 'Tier 1', desc: 'Slower bowler. Wider hitbox. Great for beginners.',       mult: '×1.0',  accent: '#00cc66' },
    { id: 'medium', playerId: 'putin', name: 'MEDIUM',   sub: 'Tier 2', desc: 'Balanced challenge. Standard bowler speed.',               mult: '×1.2',  accent: '#ffc800' },
    { id: 'hard',   playerId: 'trump', name: 'HARD',     sub: 'Tier 3', desc: 'Faster bowler. Tighter hitbox. Higher risk.',             mult: '×1.5',  accent: '#ff7700' },
    { id: 'god',    playerId: 'adeft', name: 'GOD MODE', sub: 'Tier 4', desc: 'Binary fate: wicket or a massive SIX. No in-between.',    mult: '×2.0+', accent: '#aa00ff' },
  ];

  function select(id: Difficulty, playerId: string) {
    navigationState.selectedDifficulty = id;
    navigationState.selectedAvatarId   = playerId;
    setDifficulty(id);
    closeOverlay();
  }
</script>

<div class="overlay" in:fly={{ y: 40, duration: 320 }} out:fade={{ duration: 200 }}
  role="dialog" aria-modal="true" aria-label="Select difficulty">

  <div class="sheet crystal-panel">
    <div class="sheet-header">
      <h2 class="sheet-title">SELECT <span class="gold">BATSMAN</span></h2>
      <button class="close-btn" onclick={closeOverlay} aria-label="Close">×</button>
    </div>

    <div class="diff-grid">
      {#each DIFFICULTIES as d}
        {@const isActive = navigationState.selectedDifficulty === d.id}
        <button
          class="diff-card"
          class:active={isActive}
          style="--acc:{d.accent}"
          onclick={() => select(d.id, d.playerId)}
          aria-pressed={isActive}
          aria-label="Select {d.name}"
        >
          <!-- 3D avatar portrait -->
          <div class="avatar-stage">
            <div class="avatar-canvas-wrap">
              <GlbThumbnail
                playerId={d.playerId}
                fullBody
                brightness={1.85}
                renderW={180}
                renderH={260}
              />
            </div>
            <!-- Gradient fade into card body -->
            <div class="avatar-fade" style="--acc:{d.accent}"></div>
            <!-- Mult badge overlaid bottom-right of portrait -->
            <span class="portrait-mult">{d.mult}</span>
          </div>

          <!-- Text info -->
          <div class="card-body">
            <div class="diff-top">
              <div class="diff-name-wrap">
                <span class="diff-name">{d.name}</span>
                <span class="diff-sub">{d.sub}</span>
              </div>
            </div>
            <p class="diff-desc">{d.desc}</p>
            <div class="diff-bar" aria-hidden="true">
              <div class="diff-bar-fill" style="width:{d.id==='easy'?25:d.id==='medium'?50:d.id==='hard'?75:100}%"></div>
            </div>
          </div>

          {#if isActive}
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
    background: rgba(4, 4, 8, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .sheet {
    width: 100%;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.4rem 1.5rem 1.5rem;
    border-radius: 22px;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sheet-title {
    font-family: 'Outfit', sans-serif;
    font-size: 1.85rem;
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.025em;
    color: #fff;
  }

  .gold {
    color: var(--gold-bright);
    text-shadow: 0 0 18px rgba(255, 184, 0, 0.5);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: 900;
    display: grid;
    place-items: center;
    padding: 0;
    transition: all 0.18s;
  }
  .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

  /* ── Grid ── */
  .diff-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.1rem;
  }

  /* ── Card ── */
  .diff-card {
    position: relative;
    background:
      linear-gradient(180deg,
        color-mix(in srgb, var(--acc, #888) 12%, #0a0a10) 0%,
        #0c0c12 50%,
        #0a0a0e 100%
      );
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition:
      transform 0.25s cubic-bezier(0.2,1,0.3,1),
      border-color 0.25s,
      box-shadow 0.25s;
  }

  .diff-card:hover {
    transform: translateY(-8px);
    border-color: color-mix(in srgb, var(--acc) 45%, transparent);
    box-shadow:
      0 20px 50px rgba(0,0,0,0.75),
      0 0 40px color-mix(in srgb, var(--acc) 22%, transparent);
  }

  .diff-card.active {
    border-color: var(--acc);
    box-shadow:
      0 0 36px color-mix(in srgb, var(--acc) 38%, transparent),
      inset 0 0 50px color-mix(in srgb, var(--acc) 12%, transparent);
  }

  /* ── Avatar stage ── */
  .avatar-stage {
    position: relative;
    height: 240px;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 0%,
      color-mix(in srgb, var(--acc) 14%, #0c0c18) 0%,
      #07070d 100%
    );
  }

  .avatar-canvas-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  /* Gradient blending portrait into card body */
  .avatar-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 40%,
      color-mix(in srgb, var(--acc) 4%, #0c0c12) 80%,
      #0c0c12 100%
    );
    pointer-events: none;
  }

  .portrait-mult {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-family: 'Outfit', monospace;
    font-size: 0.88rem;
    font-weight: 900;
    color: var(--acc);
    background: color-mix(in srgb, var(--acc) 10%, rgba(0,0,0,0.7));
    border: 1px solid color-mix(in srgb, var(--acc) 30%, transparent);
    border-radius: 7px;
    padding: 3px 9px;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  /* ── Card text body ── */
  .card-body {
    padding: 1rem 1.05rem 1.05rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
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
    font-size: 1.05rem;
    font-weight: 900;
    color: var(--acc);
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .diff-sub {
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: rgba(255,255,255,0.28);
  }

  .diff-desc {
    font-size: 0.66rem;
    color: rgba(255,255,255,0.55);
    line-height: 1.5;
    margin: 0;
  }

  .diff-bar {
    height: 3px;
    background: rgba(255,255,255,0.06);
    border-radius: 100px;
    overflow: hidden;
  }

  .diff-bar-fill {
    height: 100%;
    background: var(--acc);
    border-radius: 100px;
    box-shadow: 0 0 6px var(--acc);
  }

  /* ── Active ring ── */
  .active-ring {
    position: absolute;
    inset: -1px;
    border-radius: 16px;
    border: 2.5px solid var(--acc);
    pointer-events: none;
    animation: ring-pulse 2.5s ease-in-out infinite;
  }

  @keyframes ring-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @media (max-width: 640px) {
    .diff-grid { grid-template-columns: repeat(2, 1fr); }
    .avatar-stage { height: 200px; }
    .sheet-title { font-size: 1.5rem; }
  }
</style>
