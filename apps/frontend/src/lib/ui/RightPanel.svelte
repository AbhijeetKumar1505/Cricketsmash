<script lang="ts">
  import { game } from '../../core/gameController.svelte.js';
  import { navigationState } from '../../core/navigation.svelte.js';
  import GlbThumbnail from './GlbThumbnail.svelte';
  import type { PlayerId } from '../../game/CharacterManager.js';

  let { multiplier = 1 } = $props<{ multiplier?: number }>();

  const multColor = $derived(
    multiplier <= 0  ? '#ff3355' :
    multiplier >= 20 ? '#ff44ff' :
    multiplier >= 10 ? '#cc44ff' :
    multiplier >= 5  ? '#ffd95a' :
    multiplier >= 2  ? '#00e7ff' :
    multiplier > 1   ? '#ffc800' :
    'rgba(255, 241, 163, 0.70)'
  );

  const multRgb = $derived(
    multiplier <= 0  ? '255,51,85' :
    multiplier >= 20 ? '255,68,255' :
    multiplier >= 10 ? '204,68,255' :
    multiplier >= 5  ? '255,217,90' :
    multiplier >= 2  ? '0,231,255' :
    '255,200,0'
  );

  const isCrashed = $derived(multiplier <= 0 && game.sessionActive);

  $effect(() => {
    const intensity = Math.min(1, Math.max(0.18, 0.18 + (multiplier - 1) * 0.08));
    document.documentElement.style.setProperty('--ui-intensity', intensity.toFixed(3));
  });

  const potentialPayout = $derived(
    game.betActive && game.betAmount > 0
      ? (game.betAmount * multiplier).toFixed(2)
      : null
  );

  const currSymbol = $derived(
    game.currency === 'USD' ? '$' :
    game.currency === 'EUR' ? '€' :
    game.currency === 'GBP' ? '£' :
    game.currency === 'INR' ? '₹' :
    game.currency
  );

  const paceLabel = $derived(
    navigationState.selectedDifficulty === 'easy'   ? 'MEDIUM PACE' :
    navigationState.selectedDifficulty === 'medium' ? 'FAST'        :
    navigationState.selectedDifficulty === 'hard'   ? 'EXTRA FAST'  :
    'DEADLY FAST'
  );

  const riskLevel = $derived(
    navigationState.selectedDifficulty === 'easy'   ? 1 :
    navigationState.selectedDifficulty === 'medium' ? 2 :
    navigationState.selectedDifficulty === 'hard'   ? 3 : 4
  );

  const riskLabel = $derived(['', 'LOW', 'MEDIUM', 'HIGH', 'EXTREME'][riskLevel]!);

  const riskColor = $derived(
    riskLevel === 1 ? '#00cc66' :
    riskLevel === 2 ? '#ffc800' :
    riskLevel === 3 ? '#ff7700' :
    '#cc00ff'
  );

  const riskPct = $derived((riskLevel / 4) * 100);

  const RP_BATSMEN = [
    { id: 'modi',  name: 'NORINDOR MUDDI', accent: '#ffc800', diffLabel: 'EASY'     },
    { id: 'putin', name: 'VLADMIR PUTON',  accent: '#22ccff', diffLabel: 'MEDIUM'   },
    { id: 'trump', name: 'DON TRUMPH',     accent: '#ff8833', diffLabel: 'HARD'     },
    { id: 'adeft', name: 'ADEFT',          accent: '#aa00ff', diffLabel: 'GOD MODE' },
  ] as const;

  const currentBatsman = $derived(
    RP_BATSMEN.find(b => b.id === navigationState.selectedAvatarId) ?? RP_BATSMEN[0]!
  );
  const batsmanAvatarId  = $derived(currentBatsman.id as PlayerId);
  const batsmanName      = $derived(currentBatsman.name);
  const batsmanAccent    = $derived(currentBatsman.accent);
  const batsmanDiffLabel = $derived(currentBatsman.diffLabel);
</script>

<aside class="rp crystal-panel" aria-label="Game information">

  <!-- ── ZONE 1: Live stats card ── -->
  <div class="stats-zone">

    <!-- Bowler strip -->
    <div class="bowler-strip">
      <div class="bowler-avatar">
        <GlbThumbnail playerId="meloni" />
      </div>
      <div class="bowler-text">
        <span class="bowler-name">MELODY</span>
        <span class="bowler-pace">{paceLabel}</span>
      </div>
      <span class="zone-tag">BOWLER</span>
    </div>

    <!-- Multiplier orb -->
    <div class="mult-orb" class:is-crashed={isCrashed} style="--mc:{multColor}; --mr:{multRgb}">
      <div class="mult-glow" aria-hidden="true"></div>
      <span class="mult-label">MULTIPLIER</span>
      <span class="mult-val" aria-live="polite">
        {multiplier.toFixed(2)}<span class="mult-x">x</span>
      </span>
      {#if isCrashed}
        <div class="mult-burst" aria-hidden="true"></div>
      {/if}
    </div>

    <!-- Payout row -->
    <div class="payout-row">
      <span class="payout-key">POTENTIAL WIN</span>
      {#if potentialPayout}
        <span class="payout-val" aria-live="polite">{currSymbol}{potentialPayout}</span>
      {:else}
        <span class="payout-empty">PLACE A BET</span>
      {/if}
    </div>

    <!-- Risk bar -->
    <div class="risk-row">
      <span class="risk-key">RISK</span>
      <div class="risk-bar-track">
        <div
          class="risk-bar-fill"
          style="width:{riskPct}%; background:{riskColor}; box-shadow: 0 0 8px {riskColor}88"
        ></div>
      </div>
      <span class="risk-val" style="color:{riskColor}">{riskLabel}</span>
    </div>

  </div>

  <!-- ── ZONE 2: Divider ── -->
  <div class="zone-divider"></div>

  <!-- ── ZONE 3: Batsman showcase ── -->
  <div class="showcase-zone" style="--acc:{batsmanAccent}">
    <div class="showcase-header">
      <span class="showcase-tag">SELECT BATSMAN</span>
      <div class="showcase-accent-line"></div>
    </div>

    <button
      class="showcase-stage"
      onclick={() => (navigationState.activeOverlay = 'difficulty')}
      aria-label="Change batsman — currently {batsmanName}"
    >
      <!-- Floor glow -->
      <div class="stage-floor" aria-hidden="true"></div>
      <!-- Outer halo ring -->
      <div class="stage-halo" aria-hidden="true"></div>
      <!-- Character -->
      <div class="stage-char">
        <GlbThumbnail
          playerId={batsmanAvatarId}
          fullBody
          brightness={2.2}
          renderW={270}
          renderH={430}
        />
      </div>
      <!-- Hover hint -->
      <div class="stage-hint" aria-hidden="true">CHANGE</div>
    </button>

    <!-- Name badge -->
    <div class="showcase-badge" style="--acc:{batsmanAccent}">
      <span class="badge-name">{batsmanName}</span>
      <span class="badge-diff" style="color:{batsmanAccent}">{batsmanDiffLabel}</span>
    </div>
  </div>

</aside>

<style>
  /* ── Root ──────────────────────────────────────────────────────────────────── */
  .rp {
    width: 100%;
    height: 100%;
    min-height: 0;
    border-left: 1px solid var(--crystal-bd);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
    background: linear-gradient(180deg,
      rgba(6, 9, 24, 0.95) 0%,
      rgba(4, 6, 18, 0.98) 100%
    );
  }

  /* ── ZONE 1: stats ─────────────────────────────────────────────────────────── */
  .stats-zone {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 10px 0 8px;
  }

  /* Bowler strip */
  .bowler-strip {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 12px 8px;
    background: linear-gradient(90deg,
      rgba(255, 184, 0, 0.07) 0%,
      transparent 100%
    );
    border-bottom: 1px solid rgba(255, 184, 0, 0.10);
    position: relative;
  }

  .bowler-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1.5px solid var(--gold);
    overflow: hidden;
    background: #0a0d28;
    flex-shrink: 0;
    box-shadow: 0 0 12px rgba(255, 184, 0, 0.35);
  }

  .bowler-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 0;
    min-width: 0;
  }

  .bowler-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.62rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: 0.01em;
    line-height: 1;
  }

  .bowler-pace {
    font-size: 0.40rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: var(--electric);
    text-shadow: 0 0 8px rgba(0, 231, 255, 0.60);
  }

  .zone-tag {
    font-size: 0.36rem;
    font-weight: 900;
    letter-spacing: 0.20em;
    color: rgba(255, 241, 163, 0.35);
    align-self: flex-start;
    padding-top: 1px;
  }

  /* Multiplier orb */
  .mult-orb {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 14px 12px 12px;
    overflow: hidden;
  }

  .mult-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 60%,
      rgba(var(--mr, 255,200,0), 0.12) 0%,
      rgba(var(--mr, 255,200,0), 0.04) 50%,
      transparent 75%
    );
    pointer-events: none;
    transition: background 0.4s ease-out;
  }

  .mult-label {
    font-size: 0.40rem;
    font-weight: 900;
    letter-spacing: 0.26em;
    color: rgba(255, 241, 163, 0.45);
    position: relative;
    z-index: 1;
  }

  .mult-val {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(2.4rem, 5.2vw, 3.2rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--mc, #ffc800);
    text-shadow:
      0 0 calc(28px * var(--ui-intensity, 0.2) + 8px) currentColor,
      0 0 60px rgba(var(--mr, 255,200,0), calc(0.15 + 0.20 * var(--ui-intensity, 0.2))),
      0 2px 0 rgba(0, 0, 0, 0.60);
    transition: color 0.25s ease-out, text-shadow 0.25s ease-out;
    display: inline-flex;
    align-items: baseline;
    position: relative;
    z-index: 1;
  }

  .mult-x {
    font-size: 0.48em;
    opacity: 0.55;
    font-weight: 900;
    margin-left: 3px;
  }

  .mult-orb.is-crashed .mult-val {
    animation: crash-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  @keyframes crash-shake {
    0%, 100% { transform: translate(0, 0); }
    10%, 30%, 50%, 70%, 90% { transform: translate(-3px, 1px); }
    20%, 40%, 60%, 80%      { transform: translate(3px, -1px); }
  }

  .mult-burst {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at 50% 50%,
      rgba(255, 51, 85, 0.50) 0%,
      rgba(255, 51, 85, 0.10) 40%,
      transparent 70%
    );
    animation: burst 0.6s ease-out forwards;
  }
  @keyframes burst {
    0%   { transform: scale(0.4); opacity: 1; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  /* Payout row */
  .payout-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: rgba(0, 0, 0, 0.22);
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    gap: 6px;
  }

  .payout-key {
    font-size: 0.40rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(255, 241, 163, 0.40);
    white-space: nowrap;
  }

  .payout-val {
    font-family: 'Outfit', sans-serif;
    font-size: 0.88rem;
    font-weight: 900;
    color: var(--success);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    text-shadow: 0 0 14px rgba(0, 255, 153, 0.50);
    transition: text-shadow 0.3s;
  }

  .payout-empty {
    font-size: 0.40rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: rgba(255, 241, 163, 0.20);
  }

  /* Risk bar */
  .risk-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
  }

  .risk-key {
    font-size: 0.38rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(255, 241, 163, 0.38);
    flex-shrink: 0;
    width: 22px;
  }

  .risk-bar-track {
    flex: 1 1 0;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 100px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .risk-bar-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.4s ease, background 0.4s ease, box-shadow 0.4s ease;
  }

  .risk-val {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    flex-shrink: 0;
    width: 42px;
    text-align: right;
    transition: color 0.4s;
  }

  /* ── Zone divider ──────────────────────────────────────────────────────────── */
  .zone-divider {
    height: 1px;
    flex-shrink: 0;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 184, 0, 0.20) 20%,
      rgba(255, 217, 90, 0.50) 50%,
      rgba(255, 184, 0, 0.20) 80%,
      transparent 100%
    );
    box-shadow: 0 0 10px rgba(255, 184, 0, 0.20);
    margin: 0 10px;
  }

  /* ── ZONE 3: Batsman showcase ──────────────────────────────────────────────── */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }

  .showcase-zone {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background:
      radial-gradient(ellipse at 50% 70%,
        color-mix(in srgb, var(--acc) 10%, transparent) 0%,
        transparent 68%
      );
  }

  .showcase-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 6px;
  }

  .showcase-tag {
    font-size: 0.38rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: rgba(255, 255, 255, 0.35);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .showcase-accent-line {
    flex: 1 1 0;
    height: 1px;
    background: linear-gradient(90deg,
      rgba(255, 184, 0, 0.25) 0%,
      transparent 100%
    );
  }

  .showcase-stage {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: hidden;
  }

  /* Floor spotlight */
  .stage-floor {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 55%;
    background: radial-gradient(ellipse at 50% 100%,
      color-mix(in srgb, var(--acc) 28%, transparent) 0%,
      color-mix(in srgb, var(--acc) 08%, transparent) 40%,
      transparent 72%
    );
    pointer-events: none;
    z-index: 0;
    transition: background 0.35s;
  }

  /* Halo ring behind character */
  .stage-halo {
    position: absolute;
    bottom: 12%;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 14px;
    background: radial-gradient(ellipse at 50% 50%,
      color-mix(in srgb, var(--acc) 50%, transparent) 0%,
      transparent 70%
    );
    filter: blur(6px);
    pointer-events: none;
    z-index: 0;
    border-radius: 50%;
    transition: background 0.35s;
  }

  .stage-char {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 1;
    animation: float 3.4s ease-in-out infinite;
    filter: drop-shadow(0 10px 18px color-mix(in srgb, var(--acc) 45%, transparent));
  }

  /* CHANGE hint — shown on hover */
  .stage-hint {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 9px;
    border-radius: 100px;
    font-size: 0.38rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: rgba(255, 255, 255, 0.50);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.10);
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 2;
    pointer-events: none;
  }

  .showcase-stage:hover .stage-floor {
    background: radial-gradient(ellipse at 50% 100%,
      color-mix(in srgb, var(--acc) 45%, transparent) 0%,
      color-mix(in srgb, var(--acc) 14%, transparent) 45%,
      transparent 75%
    );
  }

  .showcase-stage:hover .stage-hint { opacity: 1; }

  /* Name badge */
  .showcase-badge {
    flex-shrink: 0;
    margin: 0 10px 10px;
    padding: 7px 12px 8px;
    border-radius: 12px;
    background: linear-gradient(180deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(0, 0, 0, 0.40) 100%
    );
    border: 1px solid rgba(255, 184, 0, 0.18);
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow:
      inset 0 1px 0 rgba(255, 217, 90, 0.12),
      0 0 16px rgba(255, 184, 0, 0.08);
    position: relative;
    overflow: hidden;
  }

  .showcase-badge::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 5%,
      color-mix(in srgb, var(--acc) 70%, transparent) 50%,
      transparent 95%
    );
    pointer-events: none;
  }

  .badge-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.90);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-diff {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
