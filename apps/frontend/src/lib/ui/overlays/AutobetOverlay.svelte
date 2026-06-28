<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { closeOverlay } from '../../../core/navigation.svelte.js';
  import {
    game,
    setAutoPlay,
    setAutoPlayConfig,
    setAutobetSpeed,
  } from '../../../core/gameController.svelte.js';
  import { playBlip } from '../../../lib/gameAudio.js';

  const SPEEDS = [
    { level: 0 as const, label: 'SLOW',   icon: '🐢' },
    { level: 1 as const, label: 'NORMAL', icon: '▶' },
    { level: 2 as const, label: 'FAST',   icon: '▶▶' },
    { level: 3 as const, label: 'TURBO',  icon: '⚡' },
  ];

  const ROUNDS = [10, 25, 50, 100, 500, null] as const;             // null = ∞
  const LOSS_MULTS = [5, 10, 20, null] as const;                     // null = no limit
  const WIN_MULTS  = [10, 20, 50, null] as const;
  const MULT_STOPS = [2, 5, 10, null] as const;

  let rounds = $state<number | null>(25);
  let lossMult = $state<number | null>(null);
  let winMult = $state<number | null>(null);
  let multStop = $state<number | null>(null);

  const currSymbol = $derived(
    game.currency === 'USD' ? '$' :
    game.currency === 'EUR' ? '€' :
    game.currency === 'GBP' ? '£' :
    game.currency === 'INR' ? '₹' : game.currency
  );

  function fmtRounds(r: number | null): string { return r === null ? '∞' : String(r); }
  function fmtAmount(m: number | null): string {
    if (m === null) return 'NONE';
    return `${currSymbol}${(game.betAmount * m).toFixed(0)}`;
  }
  function fmtMult(m: number | null): string {
    return m === null ? 'OFF' : `${m}×`;
  }

  function start() {
    setAutoPlayConfig({
      rounds,
      maxLossAmount: lossMult === null ? null : game.betAmount * lossMult,
      maxWinAmount:  winMult  === null ? null : game.betAmount * winMult,
      stopAtMult:    multStop,
    });
    setAutoPlay(true);
    playBlip(640, 0.1);
    closeOverlay();
  }

  function stop() {
    setAutoPlay(false);
    playBlip(280, 0.08);
    closeOverlay();
  }
</script>

<div
  class="ab-overlay"
  in:fade={{ duration: 180 }}
  out:fade={{ duration: 160 }}
  role="dialog"
  aria-modal="true"
  aria-label="Autobet configuration"
  tabindex="-1"
  onclick={closeOverlay}
  onkeydown={(e) => { if (e.key === 'Escape') closeOverlay(); }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="ab-sheet crystal-panel"
    in:fly={{ y: 24, duration: 240 }}
    out:fly={{ y: 16, duration: 180 }}
    role="document"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="ab-header">
      <h2 class="ab-title">AUTOBET</h2>
      <button class="ab-close" onclick={closeOverlay} aria-label="Close">×</button>
    </div>

    <!-- Rounds -->
    <section class="ab-section">
      <span class="ab-label">ROUNDS</span>
      <div class="chip-row">
        {#each ROUNDS as r}
          <button
            class="ab-chip"
            class:is-on={rounds === r}
            onclick={() => { rounds = r; playBlip(540, 0.04); }}
          >{fmtRounds(r)}</button>
        {/each}
      </div>
    </section>

    <!-- Stop on Loss -->
    <section class="ab-section">
      <span class="ab-label">STOP ON LOSS <em>(×bet)</em></span>
      <div class="chip-row">
        {#each LOSS_MULTS as m}
          <button
            class="ab-chip"
            class:is-on={lossMult === m}
            onclick={() => { lossMult = m; playBlip(540, 0.04); }}
          >
            <span class="chip-main">{fmtMult(m)}</span>
            {#if m !== null}<span class="chip-sub">{fmtAmount(m)}</span>{/if}
          </button>
        {/each}
      </div>
    </section>

    <!-- Stop on Win -->
    <section class="ab-section">
      <span class="ab-label">STOP ON WIN <em>(×bet)</em></span>
      <div class="chip-row">
        {#each WIN_MULTS as m}
          <button
            class="ab-chip"
            class:is-on={winMult === m}
            onclick={() => { winMult = m; playBlip(540, 0.04); }}
          >
            <span class="chip-main">{fmtMult(m)}</span>
            {#if m !== null}<span class="chip-sub">{fmtAmount(m)}</span>{/if}
          </button>
        {/each}
      </div>
    </section>

    <!-- Stop on Multiplier -->
    <section class="ab-section">
      <span class="ab-label">STOP AT MULTIPLIER</span>
      <div class="chip-row">
        {#each MULT_STOPS as m}
          <button
            class="ab-chip"
            class:is-on={multStop === m}
            onclick={() => { multStop = m; playBlip(540, 0.04); }}
          >{m === null ? 'OFF' : `${m}×`}</button>
        {/each}
      </div>
    </section>

    <!-- Speed -->
    <section class="ab-section">
      <span class="ab-label">SPEED</span>
      <div class="chip-row speed-row">
        {#each SPEEDS as s}
          <button
            class="ab-chip speed-chip"
            class:is-on={game.autobetSpeed === s.level}
            onclick={() => { setAutobetSpeed(s.level); playBlip(540, 0.04); }}
          >
            <span class="speed-icon">{s.icon}</span>
            <span class="speed-label">{s.label}</span>
          </button>
        {/each}
      </div>
    </section>

    <!-- Actions -->
    <div class="ab-actions">
      {#if game.autoPlayOn}
        <button class="ab-cta ab-cta-stop" onclick={stop}>STOP AUTOBET</button>
      {:else}
        <button class="ab-cta ab-cta-start" onclick={start}>START AUTOBET</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .ab-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(4, 7, 18, 0.78);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 1rem 130px;
  }

  .ab-sheet {
    width: 100%;
    max-width: 460px;
    max-height: calc(100dvh - 150px);
    overflow-y: auto;
    border-radius: 18px;
    padding: 18px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ab-title {
    font-family: 'Outfit', sans-serif;
    font-size: 1.15rem;
    font-weight: 900;
    margin: 0;
    letter-spacing: 0.16em;
    color: var(--gold-bright);
    text-shadow: 0 0 12px rgba(255, 184, 0, 0.4);
  }

  .ab-close {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid var(--crystal-bd);
    background: var(--crystal-1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.15rem;
    font-weight: 900;
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
    padding: 0;
  }
  .ab-close:hover { background: var(--crystal-2); color: var(--gold-bright); }

  .ab-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ab-label {
    font-size: 0.50rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: rgba(255, 241, 163, 0.55);
  }
  .ab-label em {
    font-style: normal;
    color: rgba(255, 255, 255, 0.30);
    margin-left: 4px;
    letter-spacing: 0.10em;
  }

  .chip-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .ab-chip {
    padding: 7px 4px;
    border-radius: 10px;
    border: 1px solid var(--crystal-bd);
    background: linear-gradient(180deg, var(--crystal-2), var(--crystal-1));
    color: rgba(255, 255, 255, 0.78);
    font-family: 'Outfit', sans-serif;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: filter 0.12s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-height: 38px;
  }
  .ab-chip:hover {
    border-color: var(--gold-edge);
    color: var(--gold-bright);
  }
  .ab-chip.is-on {
    border-color: var(--gold);
    color: var(--gold-bright);
    background: linear-gradient(180deg,
      rgba(255, 184, 0, 0.18) 0%,
      rgba(255, 184, 0, 0.05) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 217, 90, 0.25),
      0 0 14px rgba(255, 184, 0, 0.22);
  }

  .speed-row { grid-template-columns: repeat(4, 1fr); }
  .speed-chip { min-height: 52px; gap: 4px; padding: 10px 6px; }
  .speed-icon { font-size: 1.25rem; line-height: 1; }
  .speed-label {
    font-family: 'Outfit', sans-serif;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    color: inherit;
    line-height: 1;
  }

  .ab-chip.is-on.speed-chip {
    border-color: #00d4ff;
    color: #00d4ff;
    background: linear-gradient(180deg,
      rgba(0, 212, 255, 0.18) 0%,
      rgba(0, 212, 255, 0.05) 100%);
    box-shadow:
      inset 0 1px 0 rgba(0, 212, 255, 0.25),
      0 0 14px rgba(0, 212, 255, 0.28);
  }

  .chip-main { line-height: 1; }
  .chip-sub {
    font-size: 0.50rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.38);
  }
  .ab-chip.is-on .chip-sub { color: var(--gold-cream); }

  .ab-actions {
    margin-top: 4px;
  }

  .ab-cta {
    width: 100%;
    height: 46px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    transition: filter 0.12s, box-shadow 0.15s;
  }

  .ab-cta-start {
    background: radial-gradient(circle at 40% 30%,
      var(--gold-cream) 0%,
      var(--gold) 35%,
      #8a5800 80%,
      #3a2400 100%);
    color: #1a0e00;
    box-shadow:
      inset 0 2px 4px rgba(255, 240, 180, 0.5),
      inset 0 -2px 6px rgba(0, 0, 0, 0.4),
      var(--glow-gold-strong);
  }
  .ab-cta-start:hover { filter: brightness(1.1); }

  .ab-cta-stop {
    background: radial-gradient(circle at 40% 30%,
      #ff8899 0%,
      var(--danger) 35%,
      #6e0d1a 80%,
      #200005 100%);
    color: #fff;
    box-shadow:
      inset 0 2px 4px rgba(255, 200, 210, 0.4),
      inset 0 -2px 6px rgba(0, 0, 0, 0.45),
      0 0 28px rgba(255, 51, 85, 0.45);
  }
  .ab-cta-stop:hover { filter: brightness(1.08); }
</style>
