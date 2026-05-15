<script lang="ts">
  let {
    value = 10,
    disabled = false,
    currSymbol = '$',
    onAdjust = (_delta: number) => {},
    onChange = (_v: number) => {},
  } = $props<{
    value?: number;
    disabled?: boolean;
    currSymbol?: string;
    onAdjust?: (delta: number) => void;
    onChange?: (v: number) => void;
  }>();

  function handleInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(v)) onChange(v);
  }
</script>

<div class="amt-wrap" aria-label="Bet amount">
  <button
    type="button"
    class="amt-btn"
    aria-label="Decrease bet"
    disabled={disabled}
    onclick={() => onAdjust(-1)}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>

  <label class="amt-field" for="bet-amt-input">
    <span class="amt-curr" aria-hidden="true">{currSymbol}</span>
    <input
      id="bet-amt-input"
      class="amt-input"
      type="number"
      {value}
      {disabled}
      onchange={handleInput}
    />
  </label>

  <button
    type="button"
    class="amt-btn"
    aria-label="Increase bet"
    disabled={disabled}
    onclick={() => onAdjust(1)}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="7" y1="3" x2="7" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>
</div>

<style>
  .amt-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
  }

  .amt-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #15151a;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #ffc800;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .amt-btn:hover:not(:disabled) {
    background: #202028;
    border-color: rgba(255, 200, 0, 0.3);
    transform: translateY(-2px);
  }

  .amt-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .amt-field {
    flex: 1;
    display: flex;
    align-items: center;
    background: #050508;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 0 16px;
    height: 100%;
    transition: border-color 0.3s;
  }

  .amt-field:focus-within {
    border-color: rgba(255, 200, 0, 0.4);
  }

  .amt-curr {
    font-size: 0.9rem;
    font-weight: 900;
    color: #ffc800;
    margin-right: 8px;
  }

  .amt-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #fff;
    font-family: 'Orbitron', monospace;
    font-size: 1.2rem;
    font-weight: 700;
    outline: none;
    width: 100%;
  }

  @media (max-width: 800px) {
    .amt-wrap {
      height: 40px;
    }
    .amt-btn {
      width: 32px;
      height: 32px;
    }
  }
</style>
