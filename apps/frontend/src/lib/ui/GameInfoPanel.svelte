<script lang="ts">
  import {
    STANDARD_PROFILE,
    computeRtp,
    CAP_OVER_TOTAL_MULTIPLIER,
    CAP_SINGLE_BALL_MULTIPLIER,
  } from '../../core/mathModel.js';

  let {
    open = false,
    onClose = () => {},
    locale = 'en',
  } = $props<{
    open?: boolean;
    onClose?: () => void;
    locale?: string;
  }>();

  const rtp = (computeRtp(STANDARD_PROFILE.outcomes) * 100).toFixed(2);
  const maxWin = `${CAP_OVER_TOTAL_MULTIPLIER}x`;
  const maxSingle = `${CAP_SINGLE_BALL_MULTIPLIER}x`;

  // Localized paytable labels
  const labels: Record<string, Record<string, string>> = {
    en: {
      title: 'Game Information',
      rules: 'How to Play',
      paytable: 'Paytable',
      stats: 'Statistics',
      legal: 'Legal',
      rtp: 'Return to Player (RTP)',
      maxWin: 'Maximum Win',
      maxSingle: 'Max Single Ball',
      close: 'Close',
      six: 'Six (6 Runs)',
      four: 'Four (4 Runs)',
      triple: 'Triple (3 Runs)',
      double: 'Double (2 Runs)',
      single: 'Single (1 Run)',
      dot: 'Dot Ball',
      good_fielding: 'Good Fielding',
      catch_out: 'Catch Out (Wicket)',
    },
    es: {
      title: 'Información del Juego',
      rules: 'Cómo Jugar',
      paytable: 'Tabla de Pagos',
      stats: 'Estadísticas',
      legal: 'Legal',
      rtp: 'Retorno al Jugador (RTP)',
      maxWin: 'Ganancia Máxima',
      maxSingle: 'Máximo por Bola',
      close: 'Cerrar',
      six: 'Seis (6 Carreras)',
      four: 'Cuatro (4 Carreras)',
      triple: 'Triple (3 Carreras)',
      double: 'Doble (2 Carreras)',
      single: 'Simple (1 Carrera)',
      dot: 'Dot Ball',
      good_fielding: 'Buena Defensa',
      catch_out: 'Atrapada (Wicket)',
    },
    pt: {
      title: 'Informações do Jogo',
      rules: 'Como Jogar',
      paytable: 'Tabela de Pagamentos',
      stats: 'Estatísticas',
      legal: 'Legal',
      rtp: 'Retorno ao Jogador (RTP)',
      maxWin: 'Ganho Máximo',
      maxSingle: 'Máximo por Bola',
      close: 'Fechar',
      six: 'Seis (6 Corridas)',
      four: 'Quatro (4 Corridas)',
      triple: 'Triplo (3 Corridas)',
      double: 'Duplo (2 Corridas)',
      single: 'Simples (1 Corrida)',
      dot: 'Dot Ball',
      good_fielding: 'Boa Defesa',
      catch_out: 'Eliminação (Wicket)',
    },
    hi: {
      title: 'खेल की जानकारी',
      rules: 'कैसे खेलें',
      paytable: 'भुगतान तालिका',
      stats: 'आँकड़े',
      legal: 'कानूनी',
      rtp: 'खिलाड़ी को रिटर्न (RTP)',
      maxWin: 'अधिकतम जीत',
      maxSingle: 'प्रति गेंद अधिकतम',
      close: 'बंद करें',
      six: 'छक्का (6 रन)',
      four: 'चौका (4 रन)',
      triple: 'तिहरा (3 रन)',
      double: 'दोहरा (2 रन)',
      single: 'एकल (1 रन)',
      dot: 'डॉट बॉल',
      good_fielding: 'अच्छी फील्डिंग',
      catch_out: 'कैच आउट (विकेट)',
    },
  };

  const t = $derived(labels[locale] ?? labels['en']!);

  // Tab state
  let activeTab = $state<'rules' | 'paytable' | 'stats' | 'legal'>('rules');

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('gi-backdrop')) {
      onClose();
    }
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
    aria-label={t.title}
    tabindex="-1"
  >
    <div class="gi-panel">
      <!-- Header -->
      <div class="gi-header">
        <h2 class="gi-title">{t.title}</h2>
        <button
          type="button"
          class="gi-close"
          aria-label={t.close}
          onclick={onClose}
        >✕</button>
      </div>

      <!-- Tabs -->
      <nav class="gi-tabs" aria-label="Info sections">
        <button
          type="button"
          class="gi-tab"
          class:gi-tab--active={activeTab === 'rules'}
          onclick={() => activeTab = 'rules'}
        >{t.rules}</button>
        <button
          type="button"
          class="gi-tab"
          class:gi-tab--active={activeTab === 'paytable'}
          onclick={() => activeTab = 'paytable'}
        >{t.paytable}</button>
        <button
          type="button"
          class="gi-tab"
          class:gi-tab--active={activeTab === 'stats'}
          onclick={() => activeTab = 'stats'}
        >{t.stats}</button>
        <button
          type="button"
          class="gi-tab"
          class:gi-tab--active={activeTab === 'legal'}
          onclick={() => activeTab = 'legal'}
        >{t.legal}</button>
      </nav>

      <!-- Content -->
      <div class="gi-body">
        {#if activeTab === 'rules'}
          <div class="gi-section">
            <h3 class="gi-sh">🏏 Cricket Crash</h3>
            <ul class="gi-list">
              <li>Place your bet and watch the bowler deliver.</li>
              <li>Each delivery results in runs (multiplier increase) or a <strong>wicket</strong> (you lose).</li>
              <li>A standard over consists of <strong>6 deliveries</strong>.</li>
              <li>Your multiplier accumulates across all deliveries in the over.</li>
              <li>You can <strong>Cash Out</strong> at any point during the over to lock in your winnings.</li>
              <li>If you're <strong>bowled out</strong> (wicket), you lose your bet.</li>
              <li><strong>Sky bonuses</strong> (Jetpack, Planes) can award <strong>10x–100x</strong> multiplier boosts.</li>
              <li><strong>Boundary streaks</strong> (consecutive 4s/6s) unlock escalating multipliers up to <strong>8x</strong>.</li>
            </ul>
          </div>

        {:else if activeTab === 'paytable'}
          <div class="gi-section">
            <table class="gi-table">
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>Multiplier</th>
                  <th>Probability</th>
                </tr>
              </thead>
              <tbody>
                {#each STANDARD_PROFILE.outcomes as o}
                  <tr class:gi-row-danger={o.key === 'catch_out'}>
                    <td class="gi-outcome-name">
                      {#if o.key === 'six'}🏏 {t.six}
                      {:else if o.key === 'four'}🏏 {t.four}
                      {:else if o.key === 'triple'}🏃 {t.triple}
                      {:else if o.key === 'double'}🏃 {t.double}
                      {:else if o.key === 'single'}🏃 {t.single}
                      {:else if o.key === 'dot'}⚫ {t.dot}
                      {:else if o.key === 'good_fielding'}🧤 {t.good_fielding}
                      {:else if o.key === 'catch_out'}❌ {t.catch_out}
                      {/if}
                    </td>
                    <td class="gi-mult"
                      class:gi-mult-high={o.multiplier >= 1.5}
                      class:gi-mult-low={o.multiplier < 1 && o.multiplier > 0}
                      class:gi-mult-zero={o.multiplier === 0}
                    >
                      {o.multiplier > 0 ? `${o.multiplier.toFixed(2)}x` : 'LOSS'}
                    </td>
                    <td class="gi-prob">{(o.weight * 100).toFixed(1)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>

            <div class="gi-sky-section">
              <h4 class="gi-sh-sm">✈️ Sky Bonuses</h4>
              <div class="gi-sky-grid">
                <div class="gi-sky-card">
                  <span class="gi-sky-icon">🚀</span>
                  <span class="gi-sky-name">Jetpack</span>
                  <span class="gi-sky-mult">10x</span>
                </div>
                <div class="gi-sky-card">
                  <span class="gi-sky-icon">✈️</span>
                  <span class="gi-sky-name">Small Plane</span>
                  <span class="gi-sky-mult">10x</span>
                </div>
                <div class="gi-sky-card gi-sky-card--rare">
                  <span class="gi-sky-icon">🛩️</span>
                  <span class="gi-sky-name">Big Plane</span>
                  <span class="gi-sky-mult">100x</span>
                </div>
              </div>
              <p class="gi-note">Sky bonus chance: {(STANDARD_PROFILE.sky.chance * 100).toFixed(0)}% per delivery</p>
            </div>
          </div>

        {:else if activeTab === 'stats'}
          <div class="gi-section">
            <div class="gi-stats-grid">
              <div class="gi-stat-card">
                <span class="gi-stat-label">{t.rtp}</span>
                <span class="gi-stat-value gi-stat-rtp">{rtp}%</span>
              </div>
              <div class="gi-stat-card">
                <span class="gi-stat-label">{t.maxWin}</span>
                <span class="gi-stat-value gi-stat-maxwin">{maxWin}</span>
              </div>
              <div class="gi-stat-card">
                <span class="gi-stat-label">{t.maxSingle}</span>
                <span class="gi-stat-value">{maxSingle}</span>
              </div>
            </div>
            <p class="gi-note">
              RTP is the theoretical statistical return calculated over a large number of rounds.
              Individual session results may vary significantly above or below the stated RTP.
            </p>
          </div>

        {:else if activeTab === 'legal'}
          <div class="gi-section gi-legal">
            <div class="gi-disclaimer">
              <h4>⚠️ Important Notices</h4>
              <ol class="gi-legal-list">
                <li><strong>Malfunctions void all pays and plays.</strong> In the event of a system malfunction, all bets and payouts from the affected round(s) are void.</li>
                <li><strong>A stable internet connection is required.</strong> The operator is not responsible for disruptions caused by connectivity issues on the player's end.</li>
                <li><strong>The RTP (Return to Player) of this game is {rtp}%.</strong> This represents the theoretical long-term expected payback percentage. Individual sessions may vary.</li>
                <li><strong>Maximum win per round is capped at {maxWin} the bet amount.</strong> Any combination of multipliers exceeding this cap will be adjusted accordingly.</li>
                <li><strong>All game outcomes are determined by the Stake RGS (Remote Gaming Server).</strong> The visual simulation is representational only and does not influence results.</li>
                <li><strong>Players must be of legal gambling age</strong> in their jurisdiction to play this game.</li>
                <li><strong>© {new Date().getFullYear()} Cricket Crash.</strong> All rights reserved. Unauthorized reproduction or distribution is prohibited.</li>
              </ol>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .gi-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: gi-fade-in 0.22s ease-out;
  }

  @keyframes gi-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .gi-panel {
    width: 92vw;
    max-width: 520px;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: rgba(8, 12, 22, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 24px 64px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    overflow: hidden;
    animation: gi-slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes gi-slide-up {
    from { transform: translateY(20px) scale(0.97); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  .gi-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .gi-title {
    font-size: 1.05rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.92);
    margin: 0;
  }

  .gi-close {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: border-color 0.15s, background 0.15s;
  }

  .gi-close:hover {
    border-color: rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.1);
  }

  .gi-tabs {
    display: flex;
    gap: 0;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .gi-tabs::-webkit-scrollbar { display: none; }

  .gi-tab {
    flex: 1;
    padding: 10px 8px;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.38);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .gi-tab:hover {
    color: rgba(255, 255, 255, 0.6);
  }

  .gi-tab--active {
    color: rgba(255, 255, 255, 0.92);
    border-bottom-color: var(--color-neon-green, #00ff88);
  }

  .gi-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 24px;
  }

  .gi-section {
    animation: gi-content-in 0.2s ease-out;
  }

  @keyframes gi-content-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .gi-sh {
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.88);
    margin: 0 0 12px;
  }

  .gi-sh-sm {
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.65);
    margin: 18px 0 10px;
  }

  .gi-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .gi-list li {
    position: relative;
    padding-left: 18px;
    font-size: 0.78rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.68);
  }

  .gi-list li::before {
    content: '▸';
    position: absolute;
    left: 0;
    color: var(--color-neon-green, #00ff88);
    font-weight: 900;
  }

  .gi-list li strong {
    color: rgba(255, 255, 255, 0.92);
  }

  /* ── Paytable ── */
  .gi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }

  .gi-table th {
    text-align: left;
    padding: 8px 6px;
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .gi-table td {
    padding: 8px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
  }

  .gi-table tr:hover td {
    background: rgba(255, 255, 255, 0.03);
  }

  .gi-outcome-name {
    font-weight: 700;
  }

  .gi-mult {
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .gi-mult-high {
    color: #00ff88;
    text-shadow: 0 0 8px rgba(0, 255, 136, 0.3);
  }

  .gi-mult-low {
    color: #fbbf24;
  }

  .gi-mult-zero {
    color: #ff3b3b;
    text-shadow: 0 0 8px rgba(255, 59, 59, 0.3);
  }

  .gi-prob {
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.45);
  }

  .gi-row-danger td {
    background: rgba(255, 30, 60, 0.06);
  }

  /* ── Sky bonuses ── */
  .gi-sky-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .gi-sky-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 6px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .gi-sky-card--rare {
    border-color: rgba(255, 43, 214, 0.25);
    background: rgba(255, 43, 214, 0.06);
  }

  .gi-sky-icon { font-size: 1.4rem; }

  .gi-sky-name {
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
  }

  .gi-sky-mult {
    font-size: 0.85rem;
    font-weight: 900;
    color: #ffc800;
    text-shadow: 0 0 8px rgba(255, 200, 0, 0.35);
  }

  .gi-sky-card--rare .gi-sky-mult {
    color: #ff2bd6;
    text-shadow: 0 0 8px rgba(255, 43, 214, 0.4);
  }

  .gi-note {
    font-size: 0.66rem;
    color: rgba(255, 255, 255, 0.35);
    margin-top: 12px;
    line-height: 1.5;
    font-style: italic;
  }

  /* ── Stats ── */
  .gi-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .gi-stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 8px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .gi-stat-label {
    font-size: 0.55rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.38);
    text-align: center;
  }

  .gi-stat-value {
    font-size: 1.3rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.92);
  }

  .gi-stat-rtp {
    color: #00ff88;
    text-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
  }

  .gi-stat-maxwin {
    color: #ffc800;
    text-shadow: 0 0 12px rgba(255, 200, 0, 0.35);
  }

  /* ── Legal ── */
  .gi-disclaimer h4 {
    font-size: 0.78rem;
    font-weight: 900;
    color: #fbbf24;
    margin: 0 0 12px;
  }

  .gi-legal-list {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: legal;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gi-legal-list li {
    counter-increment: legal;
    position: relative;
    padding-left: 28px;
    font-size: 0.72rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.58);
  }

  .gi-legal-list li::before {
    content: counter(legal);
    position: absolute;
    left: 0;
    top: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.55rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.4);
    display: grid;
    place-items: center;
  }

  .gi-legal-list li strong {
    color: rgba(255, 255, 255, 0.88);
  }

  @media (max-width: 480px) {
    .gi-panel {
      max-height: 90vh;
      border-radius: 14px 14px 0 0;
      max-width: 100vw;
      width: 100vw;
    }

    .gi-stats-grid {
      grid-template-columns: 1fr;
    }

    .gi-sky-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
