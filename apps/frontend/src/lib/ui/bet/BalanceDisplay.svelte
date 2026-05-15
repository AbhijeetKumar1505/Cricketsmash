<script lang="ts">
  import { spring } from 'svelte/motion';

  let {
    balance = 0,
    currPrefix = '$',
  } = $props<{
    balance?: number;
    currPrefix?: string;
  }>();

  const displayed = spring(0, { stiffness: 0.08, damping: 0.65 });
  let prevBalance = 0;
  let flash = $state(false);

  $effect(() => {
    displayed.set(balance);
    if (balance > prevBalance) {
      flash = true;
      setTimeout(() => flash = false, 600);
    }
    prevBalance = balance;
  });

  const formatted = $derived(
    $displayed.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
</script>

<div class="bal" aria-label="Wallet balance">
  <span class="bal-label">BAL</span>
  <span class="bal-value" class:bal-flash={flash}>
    {currPrefix}{formatted}
  </span>
</div>

<style>
  .bal {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 8px;
    min-width: 0;
  }

  .bal-label {
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(200, 160, 0, 0.45);
  }

  .bal-value {
    font-family: ui-monospace, 'Orbitron', monospace;
    font-size: 0.82rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
    transition: text-shadow 0.3s ease;
  }

  .bal-flash {
    text-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
    color: #ffd700;
  }
</style>
