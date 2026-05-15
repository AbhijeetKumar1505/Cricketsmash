<script lang="ts">
  let {
    active = false,
    icon = '▶',
    label = '',
    showRing = false,
    ariaLabel = '',
    onclick = () => {},
  } = $props<{
    active?: boolean;
    icon?: string;
    label?: string;
    showRing?: boolean;
    ariaLabel?: string;
    onclick?: () => void;
  }>();
</script>

<button
  type="button"
  class="pill"
  class:pill-on={active}
  class:pill-ring={active && showRing}
  aria-pressed={active}
  aria-label={ariaLabel}
  {onclick}
>
  {#if active && showRing}
    <span class="pill-spinner" aria-hidden="true"></span>
  {/if}
  <span class="pill-icon" aria-hidden="true">{icon}</span>
  {#if label}
    <span class="pill-label">{label}</span>
  {/if}
</button>

<style>
  .pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 34px;
    height: 34px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid rgba(200, 160, 0, 0.15);
    background: #111;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    transition: border-color 0.18s, color 0.18s, box-shadow 0.18s, background 0.18s;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      inset 0 -2px 4px rgba(0, 0, 0, 0.25);
  }

  .pill:hover:not(.pill-on) {
    border-color: rgba(200, 160, 0, 0.3);
    color: rgba(255, 255, 255, 0.65);
    background: #161616;
  }

  .pill-on {
    border-color: rgba(200, 160, 0, 0.5);
    color: #ffd700;
    background: #1a1400;
    box-shadow:
      inset 0 1px 0 rgba(255, 215, 0, 0.06),
      0 0 16px rgba(200, 160, 0, 0.2);
    animation: pill-glow 2s ease-in-out infinite;
  }

  @keyframes pill-glow {
    0%, 100% { box-shadow: inset 0 1px 0 rgba(255,215,0,0.06), 0 0 14px rgba(200,160,0,0.18); }
    50%      { box-shadow: inset 0 1px 0 rgba(255,215,0,0.1),  0 0 22px rgba(200,160,0,0.32); }
  }

  .pill-icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  .pill-label {
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* Spinner ring for auto-play */
  .pill-spinner {
    position: absolute;
    inset: -3px;
    border-radius: 8px;
    border: 2px solid transparent;
    border-top-color: #ffd700;
    border-right-color: rgba(255, 215, 0, 0.2);
    animation: pill-spin 1.2s linear infinite;
    pointer-events: none;
  }

  @keyframes pill-spin {
    to { transform: rotate(360deg); }
  }

  .pill:focus-visible {
    outline: 2px solid rgba(200, 160, 0, 0.6);
    outline-offset: 2px;
  }
</style>
