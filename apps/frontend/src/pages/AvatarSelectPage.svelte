<script lang="ts">
  import { navigationState, navigateTo } from '../core/navigation.svelte.js';
  import { AVATARS, type AvatarProfile } from '../characters/human/AvatarGallery.js';
  import { fade, scale } from 'svelte/transition';
  import FacePortrait from '../lib/ui/FacePortrait.svelte';

  const avatarList = Object.values(AVATARS);

  function toHex(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
  }

  type RoleInfo = { role: string; tier?: string; accent: string; stats: { str: number; agi: number; timing: number }; desc: string };

  const ROLE_MAP: Record<string, RoleInfo> = {
    modi:  { role: 'BATSMAN', tier: 'TIER 1', accent: '#ffc800', stats: { str: 68, agi: 72, timing: 84 }, desc: 'Calm & technical. Balanced timing.' },
    trump: { role: 'BATSMAN', tier: 'TIER 2', accent: '#ff7700', stats: { str: 92, agi: 54, timing: 72 }, desc: 'Aggressive power shots. Huge sixes.' },
    kim:   { role: 'BATSMAN', tier: 'TIER 3', accent: '#00ffcc', stats: { str: 76, agi: 86, timing: 62 }, desc: 'Unpredictable & chaotic. Wild cards.' },
    putin: { role: 'BATSMAN', tier: 'TIER 4', accent: '#ff4444', stats: { str: 90, agi: 92, timing: 96 }, desc: 'Cold precision. Ultra-fast reactions.' },
    meloni:{ role: 'FIELDER SQUAD', accent: '#888aff', stats: { str: 74, agi: 94, timing: 84 }, desc: 'Tactical elite squad. Synchronized.' },
    munir: { role: 'BOWLER', accent: '#ff2200', stats: { str: 96, agi: 88, timing: 90 }, desc: 'Aggressive fast bowler. Fire trail.' },
  };

  function selectAvatar(id: string) {
    navigationState.selectedAvatarId = id;
    navigateTo('gameplay');
  }

  function roleAccent(avatar: AvatarProfile): string {
    return ROLE_MAP[avatar.id]?.accent ?? '#ffc800';
  }
</script>

<div class="page" in:fade={{ duration: 600 }}>
  <!-- Header -->
  <div class="header">
    <button class="back-btn" onclick={() => navigateTo('welcome')} aria-label="Go back">← BACK</button>
    <div class="title-section">
      <h2 class="title">SELECT <span class="gold">AVATAR</span></h2>
      <p class="subtitle">CHOOSE YOUR CHAMPION</p>
    </div>
    <div class="hint">UNIQUE ABILITIES ACTIVE</div>
  </div>

  <!-- Avatar grid -->
  <div class="avatar-grid">
    {#each avatarList as avatar, i}
      {@const role = ROLE_MAP[avatar.id]}
      <button
        class="av-card"
        class:selected={navigationState.selectedAvatarId === avatar.id}
        onclick={() => selectAvatar(avatar.id)}
        in:scale={{ delay: i * 80, duration: 500, start: 0.85 }}
        aria-label="Select {avatar.name} as your avatar"
        style="--accent: {roleAccent(avatar)}"
      >
        <!-- Portrait — SVG face portrait (same FaceProfile data as 3D character) -->
        <div class="portrait" style="--skin: {toHex(avatar.skinColor)}">
          <FacePortrait {avatar} width={120} height={180} />
          <!-- Role badge overlaid on top of SVG -->
          <div class="p-badge" style="background: {roleAccent(avatar)}22; color: {roleAccent(avatar)}; border-color: {roleAccent(avatar)}44">
            {role?.role ?? 'PLAYER'}
            {#if role?.tier}<span class="p-tier"> · {role.tier}</span>{/if}
          </div>
        </div>

        <!-- Info -->
        <div class="av-info">
          <h3 class="av-name">{avatar.name}</h3>
          {#if role?.desc}
            <p class="av-desc">{role.desc}</p>
          {/if}

          <!-- Stats -->
          <div class="av-stats" aria-label="Character stats">
            <div class="stat-row">
              <span class="stat-lbl">STRENGTH</span>
              <div class="stat-bar"><div class="stat-fill" style="width:{role?.stats.str ?? 70}%; background:{roleAccent(avatar)}"></div></div>
              <span class="stat-num">{role?.stats.str ?? 70}</span>
            </div>
            <div class="stat-row">
              <span class="stat-lbl">AGILITY</span>
              <div class="stat-bar"><div class="stat-fill" style="width:{role?.stats.agi ?? 70}%; background:{roleAccent(avatar)}"></div></div>
              <span class="stat-num">{role?.stats.agi ?? 70}</span>
            </div>
            <div class="stat-row">
              <span class="stat-lbl">TIMING</span>
              <div class="stat-bar"><div class="stat-fill" style="width:{role?.stats.timing ?? 70}%; background:{roleAccent(avatar)}"></div></div>
              <span class="stat-num">{role?.stats.timing ?? 70}</span>
            </div>
          </div>
        </div>

        <!-- Selection indicator -->
        {#if navigationState.selectedAvatarId === avatar.id}
          <div class="selected-ring" aria-hidden="true"></div>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    background: #020208;
    color: #fff;
    padding: 2rem 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    font-family: 'Outfit', sans-serif;
    overflow-y: auto;
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
  .title {
    font-size: 2.4rem;
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .gold { color: #ffc800; }
  .subtitle {
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    color: rgba(255, 255, 255, 0.3);
    margin: 0.35rem 0 0;
    font-weight: 600;
  }

  .hint {
    font-size: 0.62rem;
    font-weight: 800;
    color: #00d4ff;
    letter-spacing: 0.1em;
    text-shadow: 0 0 10px rgba(0, 212, 255, 0.4);
  }

  /* ── Avatar grid ── */
  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.4rem;
    max-width: 1500px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Avatar card ── */
  .av-card {
    position: relative;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    color: inherit;
    padding: 0;
    transition: transform 0.3s cubic-bezier(0.2, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s;
    display: flex;
    flex-direction: column;
  }
  .av-card:hover {
    transform: translateY(-6px);
    border-color: rgba(var(--accent, 255, 200, 0), 0.3);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 20px color-mix(in srgb, var(--accent, #ffc800) 15%, transparent);
  }
  .av-card.selected {
    border-color: var(--accent, #ffc800);
    box-shadow: 0 0 30px color-mix(in srgb, var(--accent, #ffc800) 22%, transparent);
  }

  /* ── Portrait area ── */
  .portrait {
    position: relative;
    height: 180px;
    background: radial-gradient(circle at 50% 44%, color-mix(in srgb, var(--skin, #d4997a) 10%, #070710), #070710 60%);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow: hidden;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .p-badge {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 0.52rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    padding: 3px 10px;
    border-radius: 100px;
    border: 1px solid;
    z-index: 6;
    backdrop-filter: blur(6px);
  }
  .p-tier {
    font-weight: 600;
    opacity: 0.7;
  }

  /* ── Info section ── */
  .av-info {
    padding: 1.2rem 1.4rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    flex: 1;
  }
  .av-name {
    font-size: 1.35rem;
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .av-desc {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.4;
    margin: 0;
  }

  /* Stats */
  .av-stats {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-top: 0.2rem;
  }
  .stat-row {
    display: grid;
    grid-template-columns: 60px 1fr 28px;
    align-items: center;
    gap: 6px;
  }
  .stat-lbl {
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.25);
  }
  .stat-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 100px;
    overflow: hidden;
  }
  .stat-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 0 6px currentColor;
  }
  .stat-num {
    font-size: 0.6rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.28);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* Selected ring */
  .selected-ring {
    position: absolute;
    inset: -1px;
    border-radius: 18px;
    border: 2px solid var(--accent, #ffc800);
    pointer-events: none;
    box-shadow: inset 0 0 20px color-mix(in srgb, var(--accent, #ffc800) 12%, transparent);
    animation: ring-pulse 2.5s ease-in-out infinite;
  }
  @keyframes ring-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* ── Responsive ── */
  @media (max-width: 700px) {
    .page { padding: 1.5rem; }
    .title { font-size: 1.8rem; }
    .hint { display: none; }
    .avatar-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .portrait { height: 140px; }
  }
</style>
