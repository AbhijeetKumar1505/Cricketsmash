<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { closeOverlay } from '../../../core/navigation.svelte.js';
  import { missionsState, claimMission } from '../../../core/missions.svelte.js';
  import { game } from '../../../core/gameController.svelte.js';
  import { playBlip, playCashoutWin } from '../../../lib/gameAudio.js';

  const currSymbol = $derived(
    game.currency === 'USD' ? '$' :
    game.currency === 'EUR' ? '€' :
    game.currency === 'GBP' ? '£' :
    game.currency === 'INR' ? '₹' : game.currency
  );

  function handleClaim(id: string) {
    const amount = claimMission(id);
    if (amount <= 0) return;
    game.balance += amount;
    playCashoutWin();
    playBlip(740, 0.06);
  }

  const unclaimedCount = $derived(
    missionsState.list.filter((m) => m.current >= m.target && !m.claimed).length
  );
</script>

<div
  class="mq-overlay"
  in:fade={{ duration: 180 }}
  out:fade={{ duration: 160 }}
  role="dialog"
  aria-modal="true"
  aria-label="Daily missions"
  tabindex="-1"
  onclick={closeOverlay}
  onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') closeOverlay(); }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="mq-sheet crystal-panel"
    in:fly={{ y: 24, duration: 240 }}
    out:fly={{ y: 16, duration: 180 }}
    role="document"
    onclick={(e: MouseEvent) => e.stopPropagation()}
    onkeydown={(e: KeyboardEvent) => e.stopPropagation()}
  >
    <header class="mq-header">
      <div class="mq-titles">
        <h2 class="mq-title">DAILY <span class="gold">MISSIONS</span></h2>
        <span class="mq-sub">
          {#if unclaimedCount > 0}
            <span class="badge">{unclaimedCount}</span> ready to claim
          {:else}
            Resets daily at 00:00 UTC
          {/if}
        </span>
      </div>
      <button class="mq-close" onclick={closeOverlay} aria-label="Close">×</button>
    </header>

    <div class="mq-list">
      {#each missionsState.list as m (m.id)}
        {@const pct = Math.min(100, Math.round((m.current / m.target) * 100))}
        {@const complete = m.current >= m.target && !m.claimed}
        <article class="mq-card" class:is-complete={complete} class:is-claimed={m.claimed}>
          <div class="mq-info">
            <span class="mq-card-title">{m.title}</span>
            <span class="mq-desc">{m.description}</span>
            <div class="mq-bar-wrap">
              <div class="mq-bar"><div class="mq-bar-fill" style="width:{pct}%"></div></div>
              <span class="mq-progress">{Math.min(m.current, m.target)} / {m.target}</span>
            </div>
          </div>
          <div class="mq-right">
            <span class="mq-reward">+{currSymbol}{m.reward.amount}</span>
            {#if m.claimed}
              <span class="mq-status mq-claimed">CLAIMED</span>
            {:else if complete}
              <button class="mq-claim" onclick={() => handleClaim(m.id)}>CLAIM</button>
            {:else}
              <span class="mq-status">{pct}%</span>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  </div>
</div>

<style>
  .mq-overlay {
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

  .mq-sheet {
    width: 100%;
    max-width: 560px;
    max-height: 80vh;
    overflow: hidden;
    border-radius: 22px;
    padding: 22px 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .mq-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .mq-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mq-title {
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

  .mq-sub {
    font-size: 0.55rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: rgba(255, 241, 163, 0.50);
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .badge {
    display: inline-block;
    background: var(--gold);
    color: #1a0e00;
    padding: 1px 7px;
    border-radius: 100px;
    font-size: 0.62rem;
    font-weight: 900;
    box-shadow: 0 0 12px rgba(255, 184, 0, 0.45);
  }

  .mq-close {
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
    flex-shrink: 0;
  }
  .mq-close:hover { background: var(--crystal-2); color: var(--gold-bright); }

  .mq-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    padding-right: 4px;
    margin-right: -4px;
  }

  .mq-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    border: 1px solid var(--crystal-bd);
    border-radius: 12px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .mq-card.is-complete {
    border-color: var(--gold);
    box-shadow:
      inset 0 1px 0 rgba(255, 217, 90, 0.22),
      0 0 22px rgba(255, 184, 0, 0.22);
  }

  .mq-card.is-claimed {
    opacity: 0.55;
    border-color: rgba(0, 255, 153, 0.30);
  }

  .mq-info {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .mq-card-title {
    font-family: 'Outfit', sans-serif;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.01em;
    color: var(--gold-cream);
  }

  .mq-desc {
    font-size: 0.62rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.35;
  }

  .mq-bar-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .mq-bar {
    flex: 1 1 auto;
    height: 4px;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 100px;
    overflow: hidden;
    border: 1px solid var(--crystal-bd);
  }

  .mq-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--gold), var(--gold-bright));
    border-radius: 100px;
    box-shadow: 0 0 8px rgba(255, 184, 0, 0.55);
    transition: width 0.3s;
  }

  .mq-progress {
    font-family: 'Outfit', sans-serif;
    font-size: 0.55rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: rgba(255, 241, 163, 0.65);
    font-variant-numeric: tabular-nums;
    min-width: 42px;
    text-align: right;
  }

  .mq-right {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    min-width: 78px;
  }

  .mq-reward {
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 900;
    color: var(--success);
    text-shadow: 0 0 10px rgba(0, 255, 153, 0.42);
  }

  .mq-status {
    font-size: 0.55rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: rgba(255, 241, 163, 0.42);
  }
  .mq-status.mq-claimed { color: var(--success); }

  .mq-claim {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    background: radial-gradient(circle at 40% 30%,
      var(--gold-cream) 0%,
      var(--gold) 35%,
      #8a5800 80%);
    color: #1a0e00;
    box-shadow:
      inset 0 1px 0 rgba(255, 240, 180, 0.4),
      inset 0 -1px 0 rgba(0, 0, 0, 0.35),
      0 0 18px rgba(255, 184, 0, 0.45);
    transition: filter 0.12s, transform 0.12s;
  }
  .mq-claim:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .mq-claim:active { filter: brightness(0.9); transform: translateY(0); }
</style>
