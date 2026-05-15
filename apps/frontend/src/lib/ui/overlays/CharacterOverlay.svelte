<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { navigationState, closeOverlay } from '../../../core/navigation.svelte.js';
  import { AVATARS, type AvatarProfile } from '../../../characters/human/AvatarGallery.js';
  import FacePortrait from '../FacePortrait.svelte';

  // Only batsmen are selectable
  const batsmanIds = ['modi', 'trump', 'kim', 'putin'];
  const avatarList = batsmanIds.map(id => AVATARS[id]!).filter(Boolean) as AvatarProfile[];

  const TIER_LABELS: Record<string, string> = {
    modi: 'TIER 1', trump: 'TIER 2', kim: 'TIER 3', putin: 'TIER 4',
  };
  const STATS: Record<string, { str: number; agi: number; timing: number }> = {
    modi:  { str: 68, agi: 72, timing: 84 },
    trump: { str: 92, agi: 54, timing: 72 },
    kim:   { str: 76, agi: 86, timing: 62 },
    putin: { str: 90, agi: 92, timing: 96 },
  };
  const ACCENTS: Record<string, string> = {
    modi: '#ffc800', trump: '#ff7700', kim: '#00ffcc', putin: '#ff4444',
  };
  const DESCS: Record<string, string> = {
    modi:  'Calm & technical. Balanced timing.',
    trump: 'Aggressive power shots. Huge sixes.',
    kim:   'Unpredictable & chaotic. Wild cards.',
    putin: 'Cold precision. Ultra-fast reactions.',
  };

  function toHex(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
  }

  function selectAvatar(id: string) {
    navigationState.selectedAvatarId = id;
    closeOverlay();
  }
</script>

<div class="overlay" in:fly={{ y: 40, duration: 320 }} out:fade={{ duration: 200 }}
  role="dialog" aria-modal="true" aria-label="Select character">

  <div class="sheet">
    <div class="sheet-header">
      <h2 class="sheet-title">SELECT <span class="gold">CHARACTER</span></h2>
      <button class="close-btn" onclick={closeOverlay} aria-label="Close character selection">×</button>
    </div>

    <div class="card-grid">
      {#each avatarList as av}
        {@const acc = ACCENTS[av.id] ?? '#ffc800'}
        {@const stats = STATS[av.id] ?? { str: 70, agi: 70, timing: 70 }}
        <button
          class="av-card"
          class:active={navigationState.selectedAvatarId === av.id}
          style="--acc: {acc}; --skin: {toHex(av.skinColor)}"
          onclick={() => selectAvatar(av.id)}
          aria-label="Select {av.name}"
          aria-pressed={navigationState.selectedAvatarId === av.id}
        >
          <div class="portrait">
            <FacePortrait avatar={av} width={100} height={150} />
            <div class="tier-badge">{TIER_LABELS[av.id] ?? ''}</div>
          </div>
          <div class="card-info">
            <p class="av-name">{av.name}</p>
            <p class="av-desc">{DESCS[av.id] ?? ''}</p>
            <div class="stats">
              <div class="stat">
                <span class="slbl">STR</span>
                <div class="sbar"><div class="sfill" style="width:{stats.str}%; background:{acc}"></div></div>
              </div>
              <div class="stat">
                <span class="slbl">AGI</span>
                <div class="sbar"><div class="sfill" style="width:{stats.agi}%; background:{acc}"></div></div>
              </div>
              <div class="stat">
                <span class="slbl">TIM</span>
                <div class="sbar"><div class="sfill" style="width:{stats.timing}%; background:{acc}"></div></div>
              </div>
            </div>
          </div>
          {#if navigationState.selectedAvatarId === av.id}
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
    max-width: 680px;
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

  .card-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .av-card {
    position: relative;
    background: #0e0e12;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    color: inherit;
    padding: 0;
    transition: transform 0.25s cubic-bezier(0.2, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s;
    display: flex;
    flex-direction: column;
  }

  .av-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--acc, #ffc800) 25%, transparent);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  }

  .av-card.active {
    border-color: var(--acc, #ffc800);
    box-shadow: 0 0 24px color-mix(in srgb, var(--acc, #ffc800) 20%, transparent);
  }

  .portrait {
    position: relative;
    height: 150px;
    background: radial-gradient(circle at 50% 44%, color-mix(in srgb, var(--skin, #d4997a) 12%, #07070f), #07070f 65%);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }

  .tier-badge {
    position: absolute;
    bottom: 7px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.44rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: var(--acc, #ffc800);
    background: color-mix(in srgb, var(--acc, #ffc800) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--acc, #ffc800) 25%, transparent);
    border-radius: 100px;
    padding: 2px 7px;
    white-space: nowrap;
  }

  .card-info {
    padding: 0.8rem 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1;
  }

  .av-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.88rem;
    font-weight: 900;
    margin: 0;
    color: #fff;
    letter-spacing: -0.01em;
  }

  .av-desc {
    font-size: 0.58rem;
    color: rgba(255, 255, 255, 0.35);
    margin: 0;
    line-height: 1.4;
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  .stat {
    display: grid;
    grid-template-columns: 22px 1fr;
    align-items: center;
    gap: 5px;
  }

  .slbl {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.22);
  }

  .sbar {
    height: 2px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 100px;
    overflow: hidden;
  }

  .sfill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
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
    .card-grid { grid-template-columns: repeat(2, 1fr); }
    .portrait { height: 120px; }
  }
</style>
