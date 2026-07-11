<script lang="ts">
  import {
    STANDARD_PROFILE,
    BONUS_BUY_PROFILE,
    STREAK_OVERRIDE_MULTIPLIERS,
    computeRtp,
    CAP_OVER_TOTAL_MULTIPLIER,
    CAP_SINGLE_BALL_MULTIPLIER,
  } from '../../core/mathModel.js';
  import { game, setBetAmount, nudgeBetAmount } from '../../core/gameController.svelte.js';

  let {
    open = false,
    onClose = () => {},
    locale: _locale = 'en',
  } = $props<{
    open?: boolean;
    onClose?: () => void;
    locale?: string;
  }>();

  const rtpStd  = (computeRtp(STANDARD_PROFILE.outcomes) * 100).toFixed(2);
  const rtpBonus = (computeRtp(BONUS_BUY_PROFILE.outcomes) * 100).toFixed(2);

  let activeTab   = $state<'rules' | 'paytable' | 'features' | 'legal'>('rules');
  let paytableMode = $state<'standard' | 'bonus'>('standard');

  const profile = $derived(paytableMode === 'bonus' ? BONUS_BUY_PROFILE : STANDARD_PROFILE);

  // ── Bet amount (synced with the shared game store via setBetAmount) ──
  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'CA$', AUD: 'A$',
    JPY: '¥', BRL: 'R$', BTC: '₿', ETH: 'Ξ',
  };
  const currSym = $derived(CURRENCY_SYMBOLS[game.currency] ?? game.currency);
  /** Money return for a payout multiplier, based on the current bet. */
  function money(mult: number): string {
    return `${currSym}${(game.betAmount * Math.max(0, mult)).toFixed(2)}`;
  }
  function handleBetInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v) && v > 0) setBetAmount(v);
  }

  const OUTCOME_META: Record<string, { label: string; color: string }> = {
    six:          { label: 'SIX',      color: '#00ff88' },
    four:         { label: 'FOUR',     color: '#4ade80' },
    triple:       { label: '3 RUNS',   color: '#fbbf24' },
    double:       { label: '2 RUNS',   color: '#f59e0b' },
    single:       { label: '1 RUN',    color: '#d97706' },
    dot:          { label: 'DOT BALL', color: 'rgba(255,255,255,0.4)' },
    good_fielding:{ label: 'FIELDED',  color: 'rgba(255,255,255,0.3)' },
    catch_out:    { label: 'WICKET',   color: '#ff4455' },
  };

  const streakEntries = Object.entries(STREAK_OVERRIDE_MULTIPLIERS)
    .map(([k, v]) => ({ streak: Number(k), mult: v }));

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('gi-backdrop')) onClose();
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="gi-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Game Information"
    tabindex="-1"
  >
    <div class="gi-panel">

      <!-- ── Header ── -->
      <div class="gi-header">
        <div class="gi-header-left">
          <div>
            <div class="gi-title">Cricket Crash</div>
            <div class="gi-subtitle">Game Information</div>
          </div>
        </div>
        <button type="button" class="gi-close" aria-label="Close" onclick={onClose}>✕</button>
      </div>

      <!-- ── Tabs ── -->
      <nav class="gi-tabs" aria-label="Sections">
        {#each (['rules', 'paytable', 'features', 'legal'] as const) as tab}
          <button
            type="button"
            class="gi-tab"
            class:active={activeTab === tab}
            onclick={() => activeTab = tab}
          >
            {#if tab === 'rules'}HOW TO PLAY
            {:else if tab === 'paytable'}PAYTABLE
            {:else if tab === 'features'}FEATURES
            {:else}LEGAL{/if}
          </button>
        {/each}
      </nav>

      <!-- ── Body ── -->
      <div class="gi-body">

        <!-- ── HOW TO PLAY ── -->
        {#if activeTab === 'rules'}
          <div class="gi-content" aria-live="polite">

            <div class="gi-intro-card">
              <p>A 6-delivery cricket crash game. Build your multiplier ball by ball — but get bowled out and you lose everything. Cash out before the wicket falls.</p>
            </div>

            <div class="step-label">THE OVER</div>
            <div class="steps">
              <div class="step">
                <div class="step-num">1</div>
                <div class="step-body">
                  <div class="step-title">Place Your Bet</div>
                  <div class="step-desc">Set your stake amount. Optionally activate <strong>Feature Spin</strong> or arm a <strong>Bonus Buy</strong> before the over begins.</div>
                </div>
              </div>
              <div class="step">
                <div class="step-num">2</div>
                <div class="step-body">
                  <div class="step-title">Watch Each Delivery</div>
                  <div class="step-desc">The bowler delivers. Each ball can score runs (multiplying your bet) or result in a <span class="danger-text">wicket</span> (you lose).</div>
                </div>
              </div>
              <div class="step">
                <div class="step-num">3</div>
                <div class="step-body">
                  <div class="step-title">Cash Out Anytime</div>
                  <div class="step-desc">You can <strong>Cash Out</strong> after any ball to lock in your winnings. The over runs up to 6 deliveries.</div>
                </div>
              </div>
              <div class="step">
                <div class="step-num">4</div>
                <div class="step-body">
                  <div class="step-title">Collect Winnings</div>
                  <div class="step-desc">Your payout = <strong>Bet × Final Multiplier</strong>. A perfect over (6 deliveries, no wicket) unlocks massive compounded returns.</div>
                </div>
              </div>
            </div>

            <div class="step-label" style="margin-top:18px;">SKY BONUSES</div>
            <div class="rules-note-card">
              <div class="rn-row">
                <div><strong>Jetpack / Small Plane</strong> — rare mid-delivery bonus that returns <strong>{money(10)}</strong> on your current stake</div>
              </div>
              <div class="rn-row">
                <div><strong>Big Plane</strong> — extremely rare. Returns <strong>{money(100)}</strong> on your current stake</div>
              </div>
              <div class="rn-row">
                <div><strong>Bonus Buy mode</strong> increases sky contact chance to <strong>{(BONUS_BUY_PROFILE.sky.chance * 100).toFixed(0)}%</strong> per delivery (vs {(STANDARD_PROFILE.sky.chance * 100).toFixed(0)}% standard)</div>
              </div>
            </div>

            <div class="step-label" style="margin-top:18px;">BOUNDARY STREAKS</div>
            <div class="rules-note-card">
              <div class="rn-row">
                <div>Hit <strong>3 or more consecutive 4s or 6s</strong> to trigger the hat-trick streak bonus. The return escalates with each consecutive boundary up to <strong>{money(STREAK_OVERRIDE_MULTIPLIERS[6])}</strong>.</div>
              </div>
            </div>

          </div>

        <!-- ── PAYTABLE ── -->
        {:else if activeTab === 'paytable'}
          <div class="gi-content" aria-live="polite">

            <div class="pt-mode-toggle">
              <button
                class="pt-mode-btn"
                class:active={paytableMode === 'standard'}
                onclick={() => paytableMode = 'standard'}
              >STANDARD</button>
              <button
                class="pt-mode-btn pt-mode-btn--bonus"
                class:active={paytableMode === 'bonus'}
                onclick={() => paytableMode = 'bonus'}
              >BONUS BUY</button>
            </div>

            {#if paytableMode === 'bonus'}
              <div class="bonus-badge">Powerplay mode — enhanced multipliers &amp; lower wicket rate</div>
            {/if}

            <!-- Bet amount — synced with the bet panel (returns update live) -->
            <div class="pt-bet-setter">
              <span class="pt-bet-label">YOUR BET</span>
              <button class="pt-bet-adj" onclick={() => nudgeBetAmount(-1)} aria-label="Decrease bet">−</button>
              <div class="pt-bet-input-wrap">
                <span class="pt-bet-curr">{currSym}</span>
                <input
                  class="pt-bet-input"
                  type="number" min="0.01" step="0.01"
                  value={game.betAmount.toFixed(2)}
                  oninput={handleBetInput}
                  aria-label="Bet amount"
                />
              </div>
              <button class="pt-bet-adj" onclick={() => nudgeBetAmount(1)} aria-label="Increase bet">+</button>
            </div>

            <!-- Outcome rows — return based on your bet -->
            <div class="pt-table">
              <div class="pt-header">
                <span>OUTCOME</span>
                <span>RETURN</span>
              </div>
              {#each profile.outcomes as o}
                {@const meta = OUTCOME_META[o.key]}
                <div
                  class="pt-row"
                  class:pt-row--wicket={o.key === 'catch_out'}
                  class:pt-row--dim={o.multiplier < 1}
                >
                  <span class="pt-name">
                    <span style="color:{meta?.color}">{meta?.label}</span>
                  </span>
                  <span class="pt-mult" style="color:{meta?.color}">{money(o.multiplier)}</span>
                </div>
              {/each}
            </div>

            <!-- Sky bonuses -->
            <div class="step-label" style="margin-top:18px;">SKY BONUSES</div>
            <div class="sky-grid">
              <div class="sky-card">
                <div class="sky-name">JETPACK</div>
                <div class="sky-mult">{money(10)}</div>
              </div>
              <div class="sky-card">
                <div class="sky-name">SMALL PLANE</div>
                <div class="sky-mult">{money(10)}</div>
              </div>
              <div class="sky-card sky-card--rare">
                <div class="sky-name">BIG PLANE</div>
                <div class="sky-mult rare-mult">{money(100)}</div>
              </div>
            </div>

            <!-- Streak ladder -->
            <div class="step-label" style="margin-top:18px;">BOUNDARY STREAK BONUS</div>
            <div class="streak-row">
              {#each streakEntries as s}
                <div class="streak-card">
                  <div class="streak-num">{s.streak}+</div>
                  <div class="streak-label">in a row</div>
                  <div class="streak-mult">{money(s.mult)}</div>
                </div>
              {/each}
            </div>
            <p class="gi-note">Consecutive 4s or 6s — streak resets on any other outcome.</p>

            <!-- Caps -->
            <div class="caps-row">
              <div class="cap-card">
                <div class="cap-label">MAX PER BALL</div>
                <div class="cap-val">{money(CAP_SINGLE_BALL_MULTIPLIER)}</div>
              </div>
              <div class="cap-card">
                <div class="cap-label">MAX WIN CAP</div>
                <div class="cap-val gold">{money(CAP_OVER_TOTAL_MULTIPLIER)}</div>
              </div>
            </div>

          </div>

        <!-- ── FEATURES ── -->
        {:else if activeTab === 'features'}
          <div class="gi-content" aria-live="polite">

            <div class="feat-card feat-card--bonus">
              <div class="feat-header">
                <div>
                  <div class="feat-name">BONUS BUY</div>
                  <div class="feat-tag">POWERPLAY MODE</div>
                </div>
                <div class="feat-cost">+30% surcharge</div>
              </div>
              <div class="feat-body">
                <p>Pays a 30% premium on your bet to enter Powerplay mode for the next over. Significantly improves multipliers, reduces wicket probability, and boosts sky bonus contact rate.</p>
              </div>
              <div class="feat-stats">
                <div class="feat-stat">
                  <span class="fs-label">MIN BET</span>
                  <span class="fs-val">15</span>
                </div>
                <div class="feat-stat">
                  <span class="fs-label">SKY CHANCE</span>
                  <span class="fs-val green">{(BONUS_BUY_PROFILE.sky.chance * 100).toFixed(0)}%</span>
                </div>
                <div class="feat-stat">
                  <span class="fs-label">WICKET RATE</span>
                  <span class="fs-val green">{(BONUS_BUY_PROFILE.outcomes.find(o => o.key === 'catch_out')!.weight * 100).toFixed(0)}%</span>
                </div>
                <div class="feat-stat">
                  <span class="fs-label">SIX MULT</span>
                  <span class="fs-val gold">{BONUS_BUY_PROFILE.outcomes.find(o => o.key === 'six')!.multiplier}×</span>
                </div>
              </div>
              <div class="feat-compare">
                <div class="compare-col">
                  <div class="cmp-label">Standard</div>
                  <div class="cmp-val dim">Sky: {(STANDARD_PROFILE.sky.chance * 100).toFixed(0)}%</div>
                  <div class="cmp-val dim">Wicket: {(STANDARD_PROFILE.outcomes.find(o => o.key === 'catch_out')!.weight * 100).toFixed(0)}%</div>
                  <div class="cmp-val dim">Six: {STANDARD_PROFILE.outcomes.find(o => o.key === 'six')!.multiplier}×</div>
                </div>
                <div class="cmp-arrow">→</div>
                <div class="compare-col">
                  <div class="cmp-label green">Bonus Buy</div>
                  <div class="cmp-val green">Sky: {(BONUS_BUY_PROFILE.sky.chance * 100).toFixed(0)}%</div>
                  <div class="cmp-val green">Wicket: {(BONUS_BUY_PROFILE.outcomes.find(o => o.key === 'catch_out')!.weight * 100).toFixed(0)}%</div>
                  <div class="cmp-val green">Six: {BONUS_BUY_PROFILE.outcomes.find(o => o.key === 'six')!.multiplier}×</div>
                </div>
              </div>
            </div>

            <div class="feat-card feat-card--ins">
              <div class="feat-header">
                <div>
                  <div class="feat-name">FEATURE SPIN</div>
                  <div class="feat-tag">WICKET PROTECTION</div>
                </div>
                <div class="feat-cost">10% of bet (min 20)</div>
              </div>
              <div class="feat-body">
                <p>Pay a small premium before the over. If a wicket falls at any point during that over, your original bet is refunded in full — you keep your accumulated winnings too.</p>
              </div>
              <div class="feat-stats">
                <div class="feat-stat">
                  <span class="fs-label">MIN BET</span>
                  <span class="fs-val">20</span>
                </div>
                <div class="feat-stat">
                  <span class="fs-label">COST</span>
                  <span class="fs-val">10% of bet</span>
                </div>
                <div class="feat-stat">
                  <span class="fs-label">COVERS</span>
                  <span class="fs-val green">1 WICKET</span>
                </div>
                <div class="feat-stat">
                  <span class="fs-label">REFUND</span>
                  <span class="fs-val gold">FULL BET</span>
                </div>
              </div>
            </div>

            <div class="feat-card feat-card--autobet">
              <div class="feat-header">
                <div>
                  <div class="feat-name">AUTOBET</div>
                  <div class="feat-tag">AUTOMATED PLAY</div>
                </div>
              </div>
              <div class="feat-body">
                <p>Automate consecutive rounds. Set a round count, stop-on-loss threshold, stop-on-win target, or exit target. Use the speed selector to control pace from Slow to Turbo.</p>
              </div>
              <div class="feat-stats">
                <div class="feat-stat"><span class="fs-label">SLOW</span><span class="fs-val">4.5s</span></div>
                <div class="feat-stat"><span class="fs-label">NORMAL</span><span class="fs-val">1.2s</span></div>
                <div class="feat-stat"><span class="fs-label">FAST</span><span class="fs-val">0.5s</span></div>
                <div class="feat-stat"><span class="fs-label">TURBO</span><span class="fs-val gold">0.3s</span></div>
              </div>
            </div>

          </div>

        <!-- ── LEGAL ── -->
        {:else if activeTab === 'legal'}
          <div class="gi-content" aria-live="polite">

            <div class="legal-rtp-banner">
              <div class="lrb-col">
                <div class="lrb-label">STANDARD RTP</div>
                <div class="lrb-val green">{rtpStd}%</div>
              </div>
              <div class="lrb-divider"></div>
              <div class="lrb-col">
                <div class="lrb-label">BONUS BUY RTP</div>
                <div class="lrb-val gold">{rtpBonus}%</div>
              </div>
              <div class="lrb-divider"></div>
              <div class="lrb-col">
                <div class="lrb-label">MAX WIN CAP</div>
                <div class="lrb-val">{CAP_OVER_TOTAL_MULTIPLIER}×</div>
              </div>
            </div>

            <div class="legal-list">
              <div class="legal-item">
                <div class="legal-num">01</div>
                <div class="legal-text">
                  <strong>Malfunctions void all pays and plays.</strong> In the event of a system or network malfunction, all bets and payouts from the affected round are void and stakes will be returned.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">02</div>
                <div class="legal-text">
                  <strong>A stable internet connection is required.</strong> The operator assumes no responsibility for service interruptions caused by connectivity issues on the player's end.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">03</div>
                <div class="legal-text">
                  <strong>All game outcomes are determined by the Stake RGS (Remote Gaming Server).</strong> The 3D cricket simulation shown on-screen is representational only and does not influence game results in any way.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">04</div>
                <div class="legal-text">
                  <strong>RTP represents the theoretical long-term payback percentage.</strong> Standard mode is {rtpStd}%; Bonus Buy (Powerplay) mode is {rtpBonus}%. Individual sessions may vary significantly above or below these figures.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">05</div>
                <div class="legal-text">
                  <strong>Maximum win per round is capped at {CAP_OVER_TOTAL_MULTIPLIER}× the bet amount.</strong> Any combination of delivery multipliers and bonus events that would exceed this cap will be adjusted accordingly at settlement.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">06</div>
                <div class="legal-text">
                  <strong>Provably fair outcomes.</strong> Results are generated via HMAC-SHA256 using a server seed (hash published pre-round) combined with a client seed and nonce. The full server seed is revealed after each session, allowing independent verification.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">07</div>
                <div class="legal-text">
                  <strong>Players must be of legal gambling age</strong> in their jurisdiction to participate. Gambling can be addictive — please play responsibly.
                </div>
              </div>
              <div class="legal-item">
                <div class="legal-num">08</div>
                <div class="legal-text">
                  <strong>© {new Date().getFullYear()} Cricket Crash.</strong> All rights reserved. Game design, mechanics, and visual content are proprietary. Unauthorized reproduction or distribution is prohibited.
                </div>
              </div>
            </div>

          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ─────────────────────────────────────────────────────────────── */
  .gi-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: gi-fade 0.2s ease-out;
    padding: 16px;
  }

  @keyframes gi-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Panel ───────────────────────────────────────────────────────────────── */
  .gi-panel {
    width: 100%;
    max-width: 500px;
    max-height: min(88vh, 680px);
    display: flex;
    flex-direction: column;
    border-radius: 20px;
    background: linear-gradient(160deg, rgba(14, 20, 38, 0.98) 0%, rgba(8, 12, 24, 0.99) 100%);
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow:
      0 32px 80px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(255, 255, 255, 0.03) inset,
      0 1px 0 rgba(255, 255, 255, 0.08) inset;
    overflow: hidden;
    animation: gi-up 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes gi-up {
    from { transform: translateY(24px) scale(0.96); opacity: 0; }
    to   { transform: translateY(0) scale(1); opacity: 1; }
  }

  /* ── Header ──────────────────────────────────────────────────────────────── */
  .gi-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 14px;
    background: linear-gradient(135deg, rgba(255,184,0,0.06) 0%, rgba(0,255,136,0.04) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .gi-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .gi-title {
    font-family: 'Outfit', sans-serif;
    font-size: 1.05rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    color: #fff;
    line-height: 1.1;
  }

  .gi-subtitle {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.38);
    text-transform: uppercase;
    margin-top: 2px;
  }

  .gi-close {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .gi-close:hover { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.09); color: #fff; }

  /* ── Tabs ────────────────────────────────────────────────────────────────── */
  .gi-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .gi-tabs::-webkit-scrollbar { display: none; }

  .gi-tab {
    flex: 1;
    min-width: max-content;
    padding: 11px 10px;
    font-family: 'Outfit', sans-serif;
    font-size: 0.55rem;
    font-weight: 900;
    letter-spacing: 0.10em;
    color: rgba(255, 255, 255, 0.32);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .gi-tab:hover { color: rgba(255,255,255,0.6); }
  .gi-tab.active {
    color: rgba(255, 255, 255, 0.95);
    border-bottom-color: #00ff88;
  }

  /* ── Body ────────────────────────────────────────────────────────────────── */
  .gi-body {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .gi-body::-webkit-scrollbar { width: 4px; }
  .gi-body::-webkit-scrollbar-track { background: transparent; }
  .gi-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

  .gi-content {
    padding: 18px 18px 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: gi-content-in 0.18s ease-out;
  }

  @keyframes gi-content-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Shared helpers ──────────────────────────────────────────────────────── */
  .step-label {
    font-size: 0.48rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28);
  }

  .gi-note {
    font-size: 0.64rem;
    color: rgba(255,255,255,0.32);
    font-style: italic;
    line-height: 1.5;
    margin: 0;
  }

  .green { color: #00ff88; }
  .gold  { color: #ffc800; }
  .dim   { color: rgba(255,255,255,0.35); }
  .danger-text { color: #ff4455; font-weight: 700; }

  /* ── Rules ───────────────────────────────────────────────────────────────── */
  .gi-intro-card {
    background: rgba(0, 255, 136, 0.05);
    border: 1px solid rgba(0, 255, 136, 0.12);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 0.76rem;
    line-height: 1.55;
    color: rgba(255,255,255,0.72);
  }
  .gi-intro-card p { margin: 0; }

  .steps { display: flex; flex-direction: column; gap: 8px; }

  .step {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 12px 14px;
  }

  .step-num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00ff88 0%, #00cc6e 100%);
    color: #002211;
    font-size: 0.72rem;
    font-weight: 900;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow: 0 0 10px rgba(0,255,136,0.25);
  }

  .step-body { flex: 1; }

  .step-title {
    font-size: 0.78rem;
    font-weight: 900;
    color: rgba(255,255,255,0.92);
    margin-bottom: 3px;
    letter-spacing: 0.02em;
  }

  .step-desc {
    font-size: 0.70rem;
    line-height: 1.5;
    color: rgba(255,255,255,0.58);
  }
  .step-desc strong { color: rgba(255,255,255,0.88); }

  .rules-note-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rn-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 0.71rem;
    line-height: 1.5;
    color: rgba(255,255,255,0.6);
  }
  .rn-row strong { color: rgba(255,255,255,0.9); }

  /* ── Paytable ────────────────────────────────────────────────────────────── */
  .pt-mode-toggle {
    display: flex;
    gap: 6px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    padding: 4px;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .pt-mode-btn {
    flex: 1;
    padding: 8px 10px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    font-family: 'Outfit', sans-serif;
    font-size: 0.60rem;
    font-weight: 900;
    letter-spacing: 0.10em;
    color: rgba(255,255,255,0.38);
    cursor: pointer;
    transition: all 0.15s;
  }
  .pt-mode-btn.active {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.92);
  }
  .pt-mode-btn--bonus.active {
    background: rgba(255,200,0,0.1);
    border-color: rgba(255,200,0,0.25);
    color: #ffc800;
  }

  .bonus-badge {
    font-size: 0.62rem;
    color: #ffc800;
    background: rgba(255,200,0,0.08);
    border: 1px solid rgba(255,200,0,0.18);
    border-radius: 8px;
    padding: 6px 12px;
    text-align: center;
    font-weight: 700;
  }

  .pt-table {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .pt-header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.04);
    font-size: 0.48rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(255,255,255,0.28);
    text-transform: uppercase;
  }

  .pt-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 9px 12px;
    border-top: 1px solid rgba(255,255,255,0.04);
    transition: background 0.1s;
  }
  .pt-row:hover { background: rgba(255,255,255,0.025); }
  .pt-row--wicket { background: rgba(255,30,60,0.06); }
  .pt-row--dim { opacity: 0.7; }

  .pt-name {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.73rem;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .pt-mult {
    font-size: 0.80rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    min-width: 64px;
    text-align: right;
  }

  /* Bet-amount setter (synced with the bet panel) */
  .pt-bet-setter {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(255, 200, 0, 0.06);
    border: 1px solid rgba(255, 200, 0, 0.18);
  }
  .pt-bet-label {
    font-size: 0.48rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(255, 241, 163, 0.6);
    text-transform: uppercase;
    margin-right: auto;
  }
  .pt-bet-adj {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: #ffc800;
    font-size: 1.1rem;
    font-weight: 900;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    transition: filter 0.12s, border-color 0.15s;
  }
  .pt-bet-adj:hover { filter: brightness(1.3); border-color: rgba(255,200,0,0.4); }
  .pt-bet-adj:active { filter: brightness(0.85); }

  .pt-bet-input-wrap {
    display: flex;
    align-items: center;
    gap: 3px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 5px 10px;
    min-width: 96px;
  }
  .pt-bet-curr { font-size: 0.7rem; font-weight: 800; color: rgba(255,241,163,0.8); }
  .pt-bet-input {
    background: none;
    border: none;
    outline: none;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    width: 100%;
    text-align: right;
    padding: 0;
    appearance: textfield;
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
  }
  .pt-bet-input::-webkit-outer-spin-button,
  .pt-bet-input::-webkit-inner-spin-button { appearance: none; -webkit-appearance: none; margin: 0; }

  /* Sky grid */
  .sky-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .sky-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    text-align: center;
  }
  .sky-card--rare {
    border-color: rgba(200,100,255,0.22);
    background: rgba(200,100,255,0.05);
  }

  .sky-name   { font-size: 0.48rem; font-weight: 900; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); text-transform: uppercase; }
  .sky-mult   { font-size: 0.95rem; font-weight: 900; color: #ffc800; text-shadow: 0 0 8px rgba(255,200,0,0.35); font-variant-numeric: tabular-nums; }
  .rare-mult  { color: #cc66ff; text-shadow: 0 0 8px rgba(180,80,255,0.4); }

  /* Streak */
  .streak-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .streak-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 12px 6px;
    border-radius: 12px;
    background: rgba(255,184,0,0.06);
    border: 1px solid rgba(255,184,0,0.15);
    text-align: center;
  }

  .streak-num   { font-size: 1.1rem; font-weight: 900; color: #ffc800; line-height: 1; }
  .streak-label { font-size: 0.44rem; font-weight: 700; letter-spacing: 0.10em; color: rgba(255,255,255,0.3); text-transform: uppercase; }
  .streak-mult  { font-size: 0.85rem; font-weight: 900; color: #fff; }

  /* Caps */
  .caps-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .cap-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 14px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
  }

  .cap-label { font-size: 0.48rem; font-weight: 900; letter-spacing: 0.16em; color: rgba(255,255,255,0.3); text-transform: uppercase; }
  .cap-val   { font-size: 1.1rem; font-weight: 900; color: rgba(255,255,255,0.85); font-variant-numeric: tabular-nums; }
  .cap-val.gold { color: #ffc800; text-shadow: 0 0 12px rgba(255,200,0,0.3); }

  /* ── Features ────────────────────────────────────────────────────────────── */
  .feat-card {
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    overflow: hidden;
  }
  .feat-card--bonus { border-color: rgba(255,200,0,0.18); }
  .feat-card--ins   { border-color: rgba(0,200,255,0.15); }
  .feat-card--autobet { border-color: rgba(120,80,255,0.18); }

  .feat-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.03);
  }

  .feat-name {
    font-family: 'Outfit', sans-serif;
    font-size: 0.82rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.92);
  }
  .feat-tag {
    font-size: 0.46rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    color: rgba(255,255,255,0.32);
    text-transform: uppercase;
    margin-top: 2px;
  }
  .feat-cost {
    margin-left: auto;
    font-size: 0.60rem;
    font-weight: 800;
    color: #ffc800;
    background: rgba(255,200,0,0.1);
    border: 1px solid rgba(255,200,0,0.2);
    border-radius: 8px;
    padding: 4px 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .feat-body {
    padding: 12px 14px 6px;
    font-size: 0.71rem;
    line-height: 1.55;
    color: rgba(255,255,255,0.58);
  }
  .feat-body p { margin: 0; }

  .feat-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .feat-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 10px 6px;
    border-right: 1px solid rgba(255,255,255,0.05);
    text-align: center;
  }
  .feat-stat:last-child { border-right: none; }

  .fs-label { font-size: 0.42rem; font-weight: 900; letter-spacing: 0.14em; color: rgba(255,255,255,0.25); text-transform: uppercase; }
  .fs-val   { font-size: 0.68rem; font-weight: 900; color: rgba(255,255,255,0.82); white-space: nowrap; }
  .fs-val.green { color: #00ff88; }
  .fs-val.gold  { color: #ffc800; }

  .feat-compare {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px 12px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .compare-col { display: flex; flex-direction: column; gap: 2px; }
  .cmp-label   { font-size: 0.52rem; font-weight: 900; letter-spacing: 0.10em; color: rgba(255,255,255,0.38); text-transform: uppercase; margin-bottom: 2px; }
  .cmp-val     { font-size: 0.62rem; font-weight: 700; }
  .cmp-arrow   { font-size: 1rem; color: rgba(255,255,255,0.2); flex-shrink: 0; margin: 0 4px; }

  /* ── Legal ───────────────────────────────────────────────────────────────── */
  .legal-rtp-banner {
    display: flex;
    align-items: center;
    justify-content: space-around;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 14px 10px;
  }

  .lrb-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .lrb-label { font-size: 0.46rem; font-weight: 900; letter-spacing: 0.16em; color: rgba(255,255,255,0.3); text-transform: uppercase; }
  .lrb-val { font-size: 1.15rem; font-weight: 900; color: rgba(255,255,255,0.85); }
  .lrb-val.green { color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.3); }
  .lrb-val.gold  { color: #ffc800; text-shadow: 0 0 10px rgba(255,200,0,0.3); }
  .lrb-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.07); }

  .legal-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .legal-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .legal-item:last-child { border-bottom: none; }

  .legal-num {
    font-size: 0.58rem;
    font-weight: 900;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.05em;
    padding-top: 1px;
    flex-shrink: 0;
    width: 22px;
  }

  .legal-text {
    font-size: 0.70rem;
    line-height: 1.6;
    color: rgba(255,255,255,0.52);
  }
  .legal-text strong { color: rgba(255,255,255,0.82); }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .gi-panel {
      max-height: 92dvh;
      border-radius: 16px 16px 0 0;
      max-width: 100%;
    }

    .feat-stats { grid-template-columns: repeat(2, 1fr); }
    .streak-row { grid-template-columns: repeat(4, 1fr); }
    .sky-grid   { grid-template-columns: repeat(3, 1fr); }
    .caps-row   { grid-template-columns: 1fr 1fr; }
  }
</style>
