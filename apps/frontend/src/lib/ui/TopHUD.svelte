<script lang="ts">
  import { game } from '../../core/gameController.svelte.js';
  import { openOverlay } from '../../core/navigation.svelte.js';

  let {
    soundOn = $bindable(true),
    onMuteToggle = () => {},
    onInfo = () => {},
  } = $props<{
    soundOn?: boolean;
    onMuteToggle?: () => void;
    onInfo?: () => void;
    multiplier?: number;
  }>();

  const balanceFormatted = $derived(game.balance.toFixed(2));
  const currSymbol = $derived(
    game.currency === 'USD' ? '$' :
    game.currency === 'EUR' ? '€' :
    game.currency === 'GBP' ? '£' :
    game.currency === 'INR' ? '₹' : game.currency
  );
</script>

<header class="hud">
  <!-- Brushed metal shine line -->
  <div class="hud-shine" aria-hidden="true"></div>

  <!-- Logo -->
  <div class="hud-logo">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <circle cx="12" cy="12" r="9.5" stroke="#c8a050" stroke-width="1.1" opacity="0.5"/>
        <path d="M9 12 Q12 6.5 15 12" stroke="#ffc800" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <line x1="13.5" y1="10" x2="17.5" y2="16.5" stroke="#ffc800" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="logo-text">
      <span class="logo-stake">STAKE</span>
      <span class="logo-cricket">CRICKET</span>
    </div>
  </div>

  <!-- Separator -->
  <div class="hud-sep" aria-hidden="true"></div>

  <!-- Balance -->
  <div class="hud-balance" aria-label="Balance: {currSymbol} {balanceFormatted}">
    <span class="bal-label">BALANCE</span>
    <div class="bal-row">
      <svg viewBox="0 0 20 16" width="14" height="11" fill="none" aria-hidden="true">
        <rect x="1" y="2" width="18" height="12" rx="2.5" stroke="#c8a050" stroke-width="1.2"/>
        <path d="M1 6h18" stroke="#c8a050" stroke-width="1.2"/>
        <circle cx="14.5" cy="10.5" r="1.6" fill="#ffc800"/>
      </svg>
      <span class="bal-amount">{currSymbol}&nbsp;{balanceFormatted}</span>
    </div>
  </div>

  <!-- Spacer -->
  <div class="hud-flex"></div>

  <!-- Control buttons -->
  <div class="hud-controls">
    <button class="ctrl-btn" onclick={onInfo} aria-label="Game info" title="Game Info">
      <span class="ctrl-i">i</span>
    </button>
    <button class="ctrl-btn" onclick={() => openOverlay('settings')} aria-label="Settings" title="Settings">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.8" stroke="currentColor" stroke-width="1.4"/>
        <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.04 4.04l1.06 1.06M14.9 14.9l1.06 1.06M4.04 15.96l1.06-1.06M14.9 5.1l1.06-1.06"
          stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="ctrl-btn" onclick={onMuteToggle} aria-label={soundOn ? 'Mute' : 'Unmute'} title={soundOn ? 'Mute' : 'Unmute'}>
      {#if soundOn}
        <svg viewBox="0 0 20 18" width="14" height="14" fill="none" aria-hidden="true">
          <path d="M4 6H2a1 1 0 00-1 1v4a1 1 0 001 1h2l4 3V3L4 6z" fill="currentColor"/>
          <path d="M13 5.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      {:else}
        <svg viewBox="0 0 20 18" width="14" height="14" fill="none" aria-hidden="true">
          <path d="M4 6H2a1 1 0 00-1 1v4a1 1 0 001 1h2l4 3V3L4 6z" fill="currentColor" opacity="0.4"/>
          <line x1="13" y1="6" x2="18" y2="12" stroke="#ff4466" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="18" y1="6" x2="13" y2="12" stroke="#ff4466" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      {/if}
    </button>
  </div>
</header>

<style>
  .hud {
    height: 52px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    position: relative;
    z-index: 50;
    flex-shrink: 0;
    /* Brushed metal surface */
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.012) 1px,
        transparent 2px,
        transparent 4px
      ),
      linear-gradient(180deg, #1c1c28 0%, #0f0f1a 60%, #0a0a14 100%);
    border-bottom: 1px solid rgba(180, 140, 60, 0.35);
    box-shadow:
      0 3px 20px rgba(0, 0, 0, 0.9),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6);
  }

  /* Top edge gold shine */
  .hud-shine {
    position: absolute;
    top: 0;
    left: 40px;
    right: 40px;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(200, 160, 80, 0.25),
      rgba(255, 210, 80, 0.65),
      rgba(200, 160, 80, 0.25),
      transparent
    );
  }

  /* Logo */
  .hud-logo {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-shrink: 0;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    border: 1px solid rgba(200, 160, 80, 0.28);
    background: linear-gradient(135deg, rgba(200,160,80,0.12) 0%, rgba(0,0,0,0.4) 100%);
    box-shadow: inset 0 1px 0 rgba(255,210,80,0.1), 0 2px 6px rgba(0,0,0,0.5);
    flex-shrink: 0;
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }

  .logo-stake {
    font-family: 'Outfit', sans-serif;
    font-size: 0.44rem;
    font-weight: 900;
    letter-spacing: 0.34em;
    color: rgba(200, 160, 80, 0.4);
  }

  .logo-cricket {
    font-family: 'Outfit', sans-serif;
    font-size: 0.9rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    color: #c8a050;
    text-shadow: 0 0 18px rgba(200,160,80,0.3), 0 1px 2px rgba(0,0,0,0.8);
  }

  /* Vertical separator */
  .hud-sep {
    width: 1px;
    height: 28px;
    margin: 0 16px;
    background: linear-gradient(180deg, transparent, rgba(180,140,60,0.3), transparent);
    flex-shrink: 0;
  }

  /* Balance */
  .hud-balance {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }

  .bal-label {
    font-size: 0.4rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: rgba(255,255,255,0.2);
  }

  .bal-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .bal-amount {
    font-family: 'Outfit', sans-serif;
    font-size: 0.98rem;
    font-weight: 900;
    color: #c8a050;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.015em;
    text-shadow: 0 0 18px rgba(200,160,80,0.22);
  }

  /* Spacer */
  .hud-flex { flex: 1; }

  /* Controls */
  .hud-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .ctrl-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(180, 140, 60, 0.28);
    /* Metallic radial surface */
    background: radial-gradient(circle at 38% 30%, rgba(80,60,20,0.55), rgba(10,10,18,0.9));
    box-shadow:
      0 2px 8px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,210,80,0.1),
      inset 0 -1px 0 rgba(0,0,0,0.4);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    color: #b4873c;
    transition: border-color 0.18s, box-shadow 0.18s, filter 0.15s;
    flex-shrink: 0;
  }

  .ctrl-btn:hover {
    border-color: rgba(200, 160, 80, 0.55);
    box-shadow:
      0 0 14px rgba(180,140,60,0.2),
      0 2px 8px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,210,80,0.15);
    filter: brightness(1.15);
  }

  .ctrl-btn:active {
    filter: brightness(0.9);
    box-shadow: 0 1px 4px rgba(0,0,0,0.7), inset 0 2px 4px rgba(0,0,0,0.5);
  }

  .ctrl-i {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-style: italic;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1;
    color: inherit;
  }

  @media (max-width: 540px) {
    .hud { height: 46px; padding: 0 10px; }
    .hud-sep { margin: 0 10px; }
    .logo-cricket { font-size: 0.78rem; }
    .logo-stake { display: none; }
    .bal-amount { font-size: 0.82rem; }
    .ctrl-btn { width: 28px; height: 28px; }
  }
</style>
