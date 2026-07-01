<script lang="ts">
  import { navigationState } from '../../core/navigation.svelte.js';
  import {
    game,
    placeBonusBuy,
    activateInsurance,
    deactivateInsurance,
  } from '../../core/gameController.svelte.js';
  import { missionsState } from '../../core/missions.svelte.js';
  import { leaderboardState } from '../../core/leaderboard.svelte.js';
  import { playBlip } from '../../lib/gameAudio.js';

  const BATSMEN_ACCENT: Record<string, string> = {
    modi:  '#FFB800',
    putin: '#22CCFF',
    trump: '#FF8833',
    adeft: '#AA00FF',
  };

  const currentAccent = $derived(
    BATSMEN_ACCENT[navigationState.selectedAvatarId ?? 'modi'] ?? '#FFB800'
  );

  // ── Bonus Buy ────────────────────────────────────────────────────────────
  const canBonusBuy = $derived(
    !game.betActive &&
    !game.sessionActive &&
    game.balance >= game.betAmount &&
    game.betAmount > 0
  );

  function handleBonusBuy() {
    if (!canBonusBuy) return;
    void placeBonusBuy();
    playBlip(800, 0.1);
  }

  // ── Insurance ────────────────────────────────────────────────────────────
  const insuranceCost = $derived(game.betAmount * 10);
  const canInsurance = $derived(
    !game.betActive &&
    !game.sessionActive &&
    game.balance >= insuranceCost &&
    game.betAmount > 0
  );

  function handleInsurance() {
    if (game.insuranceActive) {
      deactivateInsurance();
      playBlip(440, 0.08);
      return;
    }
    if (!canInsurance) return;
    activateInsurance();
    playBlip(700, 0.1);
  }

  function openOverlay(name: 'difficulty' | 'missions' | 'leaderboard') {
    navigationState.activeOverlay = name;
    playBlip(620, 0.06);
  }

  const missionsClaimReady = $derived(
    missionsState.list.filter((m) => m.current >= m.target && !m.claimed).length
  );

  /** User's all-time best multiplier (shown on RANK chip). */
  const personalBestMult = $derived.by(() => {
    let best = 0;
    for (const w of leaderboardState.history) if (w.mult > best) best = w.mult;
    return best;
  });
</script>

<aside class="lp" aria-label="Utility actions">
  <div class="chips">
    <!-- Difficulty / Batsman -->
    <button
      class="crystal-chip"
      style="--chip-acc:{currentAccent}"
      onclick={() => openOverlay('difficulty')}
      aria-label="Select batsman / difficulty"
      title="Batsman"
    >
      <span class="chip-icon" aria-hidden="true">
        <svg viewBox="0 0 22 22" width="18" height="18" fill="none">
          <circle cx="11" cy="7.5" r="3.2" stroke="currentColor" stroke-width="1.4"/>
          <path d="M4 19c1.5-3.5 4.4-5 7-5s5.5 1.5 7 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="chip-label">DIFF</span>
      <span class="chip-dot" aria-hidden="true"></span>
    </button>

    <!-- Bonus Buy -->
    <button
      class="crystal-chip"
      class:is-disabled={!canBonusBuy}
      disabled={!canBonusBuy}
      onclick={handleBonusBuy}
      aria-label="Bonus buy"
      title="Bonus Buy"
    >
      <span class="chip-icon" aria-hidden="true">
        <svg viewBox="0 0 22 22" width="18" height="18" fill="none">
          <circle cx="11" cy="11" r="8.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M7 11h8M11 7v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="chip-label">BUY</span>
    </button>

    <!-- Insurance -->
    <button
      class="crystal-chip"
      class:is-active={game.insuranceActive}
      class:is-disabled={!canInsurance && !game.insuranceActive}
      disabled={!canInsurance && !game.insuranceActive}
      onclick={handleInsurance}
      aria-label={game.insuranceActive ? 'Deactivate insurance' : 'Activate insurance'}
      title={game.insuranceActive ? 'Insurance ON' : `Insurance — ${insuranceCost.toFixed(2)}`}
    >
      <span class="chip-icon" aria-hidden="true">
        {#if game.insuranceActive}
          <svg viewBox="0 0 22 24" width="16" height="18" fill="none">
            <path d="M11 1.5L2.5 4.8v7.2c0 5.7 3.7 10.5 8.5 11.5 4.8-1 8.5-5.8 8.5-11.5V4.8L11 1.5z"
              fill="rgba(0,255,153,0.18)" stroke="#00FF99" stroke-width="1.4"/>
            <path d="M7.5 12l2.5 2.5 5-5" stroke="#00FF99" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 22 24" width="16" height="18" fill="none">
            <path d="M11 1.5L2.5 4.8v7.2c0 5.7 3.7 10.5 8.5 11.5 4.8-1 8.5-5.8 8.5-11.5V4.8L11 1.5z"
              stroke="currentColor" stroke-width="1.4"/>
          </svg>
        {/if}
      </span>
      <span class="chip-label">{game.insuranceActive ? 'ON' : 'INS'}</span>
    </button>

    <!-- Missions -->
    <button
      class="crystal-chip"
      onclick={() => openOverlay('missions')}
      aria-label="Missions"
      title="Daily missions"
    >
      <span class="chip-icon" aria-hidden="true">
        <svg viewBox="0 0 22 22" width="17" height="17" fill="none">
          <path d="M5 4h12v15l-6-3-6 3V4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M9 10l1.6 1.6L14 8.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="chip-label">QUEST</span>
      {#if missionsClaimReady > 0}
        <span class="chip-badge" aria-hidden="true">{missionsClaimReady}</span>
      {/if}
    </button>

    <!-- Leaderboard -->
    <button
      class="crystal-chip"
      onclick={() => openOverlay('leaderboard')}
      aria-label="Leaderboard{personalBestMult > 0 ? ` — your best ${personalBestMult.toFixed(2)}×` : ''}"
      title={personalBestMult > 0
        ? `Your best: ${personalBestMult.toFixed(2)}×`
        : 'Leaderboard'}
    >
      <span class="chip-icon" aria-hidden="true">
        <svg viewBox="0 0 22 22" width="17" height="17" fill="none">
          <path d="M7 9V5h8v4M11 9v9M6 18h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 8h3v2a3 3 0 01-3 3M7 8H4v2a3 3 0 003 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </span>
      {#if personalBestMult > 0}
        <span class="chip-stat">{personalBestMult.toFixed(personalBestMult >= 10 ? 1 : 2)}×</span>
      {:else}
        <span class="chip-label">RANK</span>
      {/if}
    </button>
  </div>
</aside>

<style>
  .lp {
    width: 70px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 12px 0;
    background:
      linear-gradient(180deg,
        rgba(255, 184, 0, 0.025) 0%,
        rgba(0, 0, 0, 0.2) 50%,
        rgba(255, 184, 0, 0.02) 100%);
    border-right: 1px solid var(--crystal-bd);
    box-shadow:
      inset -1px 0 0 rgba(255, 255, 255, 0.025),
      4px 0 20px rgba(0, 0, 0, 0.6);
  }

  .chips {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  /* Active-difficulty dot under the DIFF chip — colored by current batsman */
  .chip-dot {
    position: absolute;
    bottom: -2px;
    left: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--chip-acc, var(--gold));
    box-shadow: 0 0 8px var(--chip-acc, var(--gold));
    transform: translateX(-50%);
    pointer-events: none;
  }

  /* Personal-best multiplier on the RANK chip (replaces label when > 0) */
  .chip-stat {
    font-family: 'Outfit', sans-serif;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: -0.01em;
    line-height: 1;
    color: var(--gold-bright);
    text-shadow: 0 0 8px rgba(255, 184, 0, 0.55);
    font-variant-numeric: tabular-nums;
  }

  /* Unclaimed-complete badge — gold pill, top-right of chip */
  .chip-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 14px;
    height: 14px;
    padding: 0 4px;
    border-radius: 100px;
    background: var(--gold);
    color: #1a0e00;
    font-family: 'Outfit', sans-serif;
    font-size: 0.55rem;
    font-weight: 900;
    line-height: 14px;
    text-align: center;
    box-shadow: 0 0 10px rgba(255, 184, 0, 0.55);
    pointer-events: none;
    z-index: 1;
  }
</style>
