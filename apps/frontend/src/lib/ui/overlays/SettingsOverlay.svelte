<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { closeOverlay } from '../../../core/navigation.svelte.js';

  let {
    soundOn = $bindable(true),
    onSoundToggle = () => {},
  } = $props<{
    soundOn?: boolean;
    onSoundToggle?: () => void;
  }>();
</script>

<div class="overlay" in:fly={{ y: 40, duration: 320 }} out:fade={{ duration: 200 }}
  role="dialog" aria-modal="true" aria-label="Settings">

  <div class="sheet">
    <div class="sheet-header">
      <h2 class="sheet-title">SETTINGS</h2>
      <button class="close-btn" onclick={closeOverlay} aria-label="Close settings">×</button>
    </div>

    <div class="settings-grid">
      <!-- Audio -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">AUDIO</span>
          <span class="setting-desc">Game sounds and effects</span>
        </div>
        <button
          class="toggle-btn"
          class:on={soundOn}
          onclick={onSoundToggle}
          aria-label={soundOn ? 'Mute audio' : 'Unmute audio'}
          aria-pressed={soundOn}
        >
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="divider" aria-hidden="true"></div>

      <!-- Provably Fair -->
      <div class="setting-row setting-info-row">
        <div class="setting-info">
          <span class="setting-name">PROVABLY FAIR</span>
          <span class="setting-desc">HMAC-SHA256 · Seed verified each round</span>
        </div>
        <span class="fair-badge">✓ FAIR</span>
      </div>

      <div class="divider" aria-hidden="true"></div>

      <!-- Version -->
      <div class="setting-row setting-info-row">
        <div class="setting-info">
          <span class="setting-name">VERSION</span>
          <span class="setting-desc">Cricket Crash v1.0</span>
        </div>
        <span class="version-tag">v1.0</span>
      </div>
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
    max-width: 420px;
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

  .settings-grid {
    background: #0e0e12;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.2rem;
    gap: 1rem;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .setting-name {
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.8);
  }

  .setting-desc {
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.32);
    letter-spacing: 0.04em;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
  }

  /* Toggle */
  .toggle-btn {
    position: relative;
    width: 42px;
    height: 24px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    cursor: pointer;
    padding: 0;
    transition: background 0.22s, border-color 0.22s;
    flex-shrink: 0;
  }

  .toggle-btn.on {
    background: #b4873c;
    border-color: #b4873c;
  }

  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    transition: transform 0.22s cubic-bezier(0.2, 1, 0.3, 1), background 0.22s;
  }

  .toggle-btn.on .toggle-knob {
    transform: translateX(18px);
    background: #fff;
  }

  /* Info badges */
  .fair-badge {
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: #00cc66;
    background: rgba(0, 204, 102, 0.08);
    border: 1px solid rgba(0, 204, 102, 0.22);
    border-radius: 6px;
    padding: 3px 8px;
    flex-shrink: 0;
  }

  .version-tag {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
</style>
