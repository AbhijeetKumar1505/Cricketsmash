<script lang="ts">
  import { game } from '../../core/gameController.svelte.js';
  import { navigationState } from '../../core/navigation.svelte.js';
  import { AVATARS } from '../../characters/human/AvatarGallery.js';
  import FacePortrait from './FacePortrait.svelte';

  let { multiplier = 1 } = $props<{ multiplier?: number }>();

  const bowlerAvatar = AVATARS['munir']!;

  // Multiplier color
  const multColor = $derived(
    multiplier >= 10 ? '#ff00ff' :
    multiplier >= 5  ? '#00ffff' :
    multiplier >= 2  ? '#00ff88' :
    multiplier > 1   ? '#ffc800' :
    'rgba(255,255,255,0.5)'
  );

  // Win probability
  const winPct = $derived(
    game.sessionActive
      ? Math.max(5, Math.min(95, Math.round(100 / Math.max(1.05, multiplier))))
      : 50
  );

  // Over display: "1.X / 5"
  const overDisplay = $derived(`1.${game.currentBallIdx} / 5`);

  // Runs scored so far
  const runsSoFar = $derived(
    game.overSummary.reduce((sum, b) => sum + (b?.kind === 'runs' ? b.runs : 0), 0)
  );

  // Runs needed (target 50)
  const runsNeeded = $derived(Math.max(0, 50 - runsSoFar));

  // Difficulty → pace label
  const paceLabel = $derived(
    navigationState.selectedDifficulty === 'easy'   ? 'MEDIUM PACE' :
    navigationState.selectedDifficulty === 'medium' ? 'FAST'        :
    navigationState.selectedDifficulty === 'hard'   ? 'EXTRA FAST'  :
    'DEADLY FAST'
  );
</script>

<aside class="rp" aria-label="Game information">

  <!-- Header -->
  <div class="rp-header">
    <span class="rp-title">GAME INFO</span>
  </div>

  <!-- Current Bowler -->
  <div class="section bowler-section">
    <span class="section-label">CURRENT BOWLER</span>
    <div class="bowler-row">
      <div class="bowler-portrait">
        <FacePortrait avatar={bowlerAvatar} width={40} height={58} />
      </div>
      <div class="bowler-info">
        <span class="bowler-name">ASIM MUNIR</span>
        <span class="bowler-role">{paceLabel}</span>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Over -->
  <div class="section">
    <span class="section-label">OVER</span>
    <span class="stat-large" aria-live="polite">{overDisplay}</span>
  </div>

  <div class="divider"></div>

  <!-- Runs needed -->
  <div class="section">
    <span class="section-label">RUNS NEEDED</span>
    <span class="stat-large runs-val" aria-live="polite">{runsNeeded}</span>
  </div>

  <div class="divider"></div>

  <!-- Multiplier -->
  <div class="section">
    <span class="section-label">MULTIPLIER</span>
    <span
      class="mult-val"
      style="color: {multColor}; {game.sessionActive ? 'text-shadow: 0 0 18px ' + multColor + '55' : ''}"
      aria-live="polite"
      aria-atomic="true"
    >
      {multiplier.toFixed(2)}x
    </span>
  </div>

  <div class="divider"></div>

  <!-- Win chance -->
  <div class="section">
    <span class="section-label">WIN CHANCE</span>
    <div class="chance-wrap" aria-label="Win chance {winPct}%">
      <span class="chance-pct" style="color: {winPct > 60 ? '#ffc800' : winPct > 35 ? '#ff8833' : '#ff4444'}">
        {winPct}%
      </span>
      <div class="chance-track">
        <div
          class="chance-fill"
          style="width: {winPct}%; background: {winPct > 60 ? 'linear-gradient(90deg, #a07000, #ffc800)' : winPct > 35 ? 'linear-gradient(90deg, #aa4400, #ff8833)' : 'linear-gradient(90deg, #880022, #ff4444)'}"
        ></div>
      </div>
    </div>
  </div>

</aside>

<style>
  .rp {
    width: 170px;
    height: 100%;
    min-height: 0;
    /* Brushed metal — horizontal grain for right panel */
    background:
      repeating-linear-gradient(
        180deg,
        transparent 0px,
        rgba(255,255,255,0.007) 1px,
        transparent 2px,
        transparent 5px
      ),
      linear-gradient(180deg, #141420 0%, #0e0e1a 100%);
    border-left: 1px solid rgba(180, 140, 60, 0.22);
    box-shadow:
      inset 1px 0 0 rgba(255,255,255,0.025),
      -4px 0 20px rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* Header */
  .rp-header {
    padding: 10px 14px 9px;
    border-bottom: 1px solid rgba(180, 140, 60, 0.15);
    background: linear-gradient(180deg, rgba(200,160,80,0.04), transparent);
    flex-shrink: 0;
  }

  .rp-title {
    font-size: 0.43rem;
    font-weight: 900;
    letter-spacing: 0.24em;
    color: rgba(200, 160, 80, 0.85);
    display: block;
    text-align: center;
    text-shadow: 0 0 12px rgba(200,160,80,0.3);
  }

  /* Sections */
  .section {
    padding: 8px 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex: 1 1 0;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }

  .section-label {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    display: block;
    white-space: nowrap;
  }

  .divider {
    height: 1px;
    background: rgba(180, 140, 60, 0.12);
    margin: 0 14px;
    flex-shrink: 0;
  }

  /* Bowler section */
  .bowler-section {
    align-items: flex-start;
    gap: 6px;
    flex: 1.5 1 0;
  }

  .bowler-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .bowler-portrait {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid rgba(180, 140, 60, 0.28);
    overflow: hidden;
    background: #090914;
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    box-shadow: 0 0 8px rgba(180, 140, 60, 0.12);
  }

  .bowler-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .bowler-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.62rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: -0.01em;
    line-height: 1;
    white-space: nowrap;
  }

  .bowler-role {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: #ff7700;
    white-space: nowrap;
  }

  /* Large stat values */
  .stat-large {
    font-family: 'Outfit', sans-serif;
    font-size: 1.1rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.92);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .runs-val {
    color: #ffc800;
  }

  /* Multiplier */
  .mult-val {
    font-family: 'Outfit', sans-serif;
    font-size: 1.4rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1;
    transition: color 0.3s, text-shadow 0.3s;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* Win chance */
  .chance-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    width: 100%;
  }

  .chance-pct {
    font-family: 'Outfit', sans-serif;
    font-size: 1.0rem;
    font-weight: 900;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    transition: color 0.4s;
    filter: brightness(1.2);
  }

  .chance-track {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 100px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .chance-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.5s ease-out, background 0.5s;
    box-shadow: 0 0 6px rgba(200, 160, 80, 0.3);
  }
</style>
