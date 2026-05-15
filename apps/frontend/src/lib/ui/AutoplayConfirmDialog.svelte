<script lang="ts">
  let {
    open = false,
    onConfirm = () => {},
    onCancel = () => {},
  } = $props<{
    open?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>();

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('acd-backdrop')) {
      onCancel();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="acd-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Autoplay confirmation"
    tabindex="-1"
  >
    <div class="acd-card">
      <div class="acd-icon" aria-hidden="true">▶</div>
      <h3 class="acd-title">Enable Autoplay?</h3>
      <p class="acd-desc">
        Autoplay will automatically place bets after each round until you
        stop it or your balance is insufficient.
      </p>
      <div class="acd-actions">
        <button type="button" class="acd-btn acd-btn--cancel" onclick={onCancel}>
          Cancel
        </button>
        <button type="button" class="acd-btn acd-btn--confirm" onclick={onConfirm}>
          Start Autoplay
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .acd-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: acd-fade 0.18s ease-out;
  }

  @keyframes acd-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .acd-card {
    width: 88vw;
    max-width: 380px;
    padding: 28px 24px 22px;
    border-radius: 18px;
    background: rgba(10, 14, 26, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 20px 50px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    animation: acd-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes acd-pop {
    from { transform: scale(0.92) translateY(12px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
  }

  .acd-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(0, 255, 136, 0.12);
    border: 2px solid rgba(0, 255, 136, 0.3);
    display: grid;
    place-items: center;
    font-size: 1.1rem;
    color: #00ff88;
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
  }

  .acd-title {
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.92);
    margin: 0;
  }

  .acd-desc {
    font-size: 0.75rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    max-width: 300px;
  }

  .acd-actions {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-top: 4px;
  }

  .acd-btn {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .acd-btn--cancel {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
  }

  .acd-btn--cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.85);
  }

  .acd-btn--confirm {
    background: rgba(0, 255, 136, 0.15);
    border-color: rgba(0, 255, 136, 0.3);
    color: #00ff88;
    box-shadow: 0 0 16px rgba(0, 255, 136, 0.12);
  }

  .acd-btn--confirm:hover {
    background: rgba(0, 255, 136, 0.22);
    box-shadow: 0 0 24px rgba(0, 255, 136, 0.2);
  }
</style>
