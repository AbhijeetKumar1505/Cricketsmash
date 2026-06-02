<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { closeOverlay } from '../../../core/navigation.svelte.js';
  import {
    leaderboardState,
    boardWithYou,
    refreshLeaderboard,
    type LeaderTab,
  } from '../../../core/leaderboard.svelte.js';
  import { game } from '../../../core/gameController.svelte.js';
  import { playBlip } from '../../../lib/gameAudio.js';

  const currSymbol = $derived(
    game.currency === 'USD' ? '$' :
    game.currency === 'EUR' ? '€' :
    game.currency === 'GBP' ? '£' :
    game.currency === 'INR' ? '₹' : game.currency
  );

  const TABS: { id: LeaderTab; label: string }[] = [
    { id: 'today',   label: 'TODAY' },
    { id: 'week',    label: 'WEEK' },
    { id: 'alltime', label: 'ALL TIME' },
  ];

  const visible = $derived(boardWithYou(leaderboardState.tab));

  function setTab(t: LeaderTab) {
    leaderboardState.tab = t;
    playBlip(520, 0.04);
  }
  function refresh() {
    refreshLeaderboard();
    playBlip(640, 0.06);
  }

  function rankBadge(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }
</script>

<div
  class="lb-overlay"
  in:fade={{ duration: 180 }}
  out:fade={{ duration: 160 }}
  role="dialog"
  aria-modal="true"
  aria-label="Leaderboard"
  tabindex="-1"
  onclick={closeOverlay}
  onkeydown={(e) => { if (e.key === 'Escape') closeOverlay(); }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="lb-sheet crystal-panel"
    in:fly={{ y: 24, duration: 240 }}
    out:fly={{ y: 16, duration: 180 }}
    role="document"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <header class="lb-header">
      <h2 class="lb-title">LEADER<span class="gold">BOARD</span></h2>
      <button class="lb-close" onclick={closeOverlay} aria-label="Close">×</button>
    </header>

    <!-- Tab bar -->
    <div class="lb-tabs" role="tablist">
      {#each TABS as t}
        <button
          class="lb-tab"
          class:is-active={leaderboardState.tab === t.id}
          onclick={() => setTab(t.id)}
          role="tab"
          aria-selected={leaderboardState.tab === t.id}
        >
          {t.label}
        </button>
      {/each}
    </div>

    <!-- Table -->
    <div class="lb-table" role="table" aria-label="Top players">
      <div class="lb-row lb-row-head" role="row">
        <span class="col-rank">RANK</span>
        <span class="col-name">PLAYER</span>
        <span class="col-mult">MULT</span>
        <span class="col-pay">PAYOUT</span>
      </div>

      {#each visible as e (e.rank + e.name)}
        <div
          class="lb-row"
          class:is-you={e.isYou}
          class:is-top1={e.rank === 1}
          class:is-top2={e.rank === 2}
          class:is-top3={e.rank === 3}
          role="row"
        >
          <span class="col-rank">{rankBadge(e.rank)}</span>
          <span class="col-name">{e.name}</span>
          <span class="col-mult">{e.mult.toFixed(2)}×</span>
          <span class="col-pay">{currSymbol}{e.payout.toFixed(2)}</span>
        </div>
      {/each}
    </div>

    <footer class="lb-footer">
      <span class="lb-foot-note">
        {#if visible.some(e => e.isYou)}
          Your best in this window appears as <span class="you-pill">YOU</span>.
        {:else}
          Place a winning bet to enter the board.
        {/if}
      </span>
      <button class="lb-refresh" onclick={refresh} aria-label="Refresh leaderboard">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
          <path d="M2 8a6 6 0 1110 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M11.5 12.5L11 9l3.4-.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        REFRESH
      </button>
    </footer>
  </div>
</div>

<style>
  .lb-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(4, 7, 18, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .lb-sheet {
    width: 100%;
    max-width: 580px;
    max-height: 84vh;
    overflow: hidden;
    border-radius: 22px;
    padding: 20px 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .lb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .lb-title {
    font-family: 'Outfit', sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    margin: 0;
    color: #fff;
  }
  .gold {
    color: var(--gold-bright);
    text-shadow: 0 0 18px rgba(255, 184, 0, 0.5);
  }

  .lb-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--crystal-bd);
    background: var(--crystal-1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.2rem;
    font-weight: 900;
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
    padding: 0;
  }
  .lb-close:hover { background: var(--crystal-2); color: var(--gold-bright); }

  /* Tabs */
  .lb-tabs {
    display: flex;
    gap: 6px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 12px;
    border: 1px solid var(--crystal-bd);
  }

  .lb-tab {
    flex: 1 1 0;
    padding: 8px 0;
    border-radius: 9px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.20em;
    color: rgba(255, 241, 163, 0.50);
    transition: background 0.18s, color 0.18s;
  }

  .lb-tab:hover { color: var(--gold-bright); }

  .lb-tab.is-active {
    background: linear-gradient(180deg,
      rgba(255, 184, 0, 0.18),
      rgba(255, 184, 0, 0.04));
    color: var(--gold-bright);
    box-shadow:
      inset 0 1px 0 rgba(255, 217, 90, 0.20),
      0 0 14px rgba(255, 184, 0, 0.15);
  }

  /* Table */
  .lb-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    padding-right: 4px;
    margin-right: -4px;
  }

  .lb-row {
    display: grid;
    grid-template-columns: 56px 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-1), rgba(0,0,0,0.25));
    font-family: 'Outfit', sans-serif;
    font-size: 0.78rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.78);
  }

  .lb-row-head {
    background: none;
    border: none;
    padding: 4px 12px 2px;
    font-size: 0.46rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: rgba(255, 241, 163, 0.42);
  }

  .col-rank {
    font-variant-numeric: tabular-nums;
  }
  .col-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .col-mult, .col-pay {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .col-mult { color: var(--gold-cream); }
  .col-pay  { color: var(--success); min-width: 84px; }

  /* Top 3 highlights */
  .lb-row.is-top1 {
    border-color: var(--gold);
    background: linear-gradient(180deg,
      rgba(255, 217, 90, 0.16),
      rgba(255, 184, 0, 0.04));
    box-shadow: 0 0 20px rgba(255, 184, 0, 0.18);
  }
  .lb-row.is-top2 {
    border-color: rgba(220, 220, 220, 0.30);
    background: linear-gradient(180deg, rgba(220,220,220,0.06), rgba(0,0,0,0.25));
  }
  .lb-row.is-top3 {
    border-color: rgba(196, 132, 60, 0.40);
    background: linear-gradient(180deg, rgba(196,132,60,0.10), rgba(0,0,0,0.25));
  }

  .lb-row.is-you {
    border-color: var(--gold);
    background: linear-gradient(180deg,
      rgba(255, 184, 0, 0.22),
      rgba(255, 184, 0, 0.06));
    color: var(--gold-bright);
    box-shadow:
      inset 0 1px 0 rgba(255, 217, 90, 0.28),
      0 0 24px rgba(255, 184, 0, 0.30);
  }
  .lb-row.is-you .col-mult,
  .lb-row.is-you .col-pay {
    color: var(--gold-cream);
  }

  /* Footer */
  .lb-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
  }

  .lb-foot-note {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: rgba(255, 241, 163, 0.50);
  }

  .you-pill {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 100px;
    background: var(--gold);
    color: #1a0e00;
    font-weight: 900;
    font-size: 0.55rem;
    margin: 0 2px;
  }

  .lb-refresh {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 9px;
    border: 1px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    color: rgba(255, 241, 163, 0.78);
    font-family: 'Outfit', sans-serif;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, filter 0.12s;
  }
  .lb-refresh:hover {
    color: var(--gold-bright);
    border-color: var(--gold-edge);
    filter: brightness(1.15);
  }
</style>
