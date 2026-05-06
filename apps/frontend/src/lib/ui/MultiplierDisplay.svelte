<script lang="ts">
  /**
   * MultiplierDisplay.svelte
   * Premium, high-impact broadcast-style multiplier display.
   * Part of the Doodle Cricket / Cricket Crash stadium HUD.
   */
  let { value = 1, status = "waiting" } = $props<{
    value: number;
    status: "waiting" | "bowling" | "hitting" | "result" | "wicket";
  }>();

  // Reactive color spectrum based on multiplier magnitude
  const multiplierColor = $derived(
    status === "wicket"
      ? "var(--color-ruby-premium)"
      : value >= 10
        ? "var(--color-neon-pink)"
        : value >= 5
          ? "var(--color-gold)"
          : value >= 2
            ? "var(--color-neon-green)"
            : "var(--color-electric-blue)"
  );

  const multiplierRgb = $derived(
    status === "wicket"
      ? "255, 30, 60"
      : value >= 10
        ? "255, 43, 214"
        : value >= 5
          ? "245, 197, 66"
          : value >= 2
            ? "0, 255, 136"
            : "0, 212, 255"
  );

  const glowClass = $derived(
    status === "wicket"
      ? "intensity-glow-neon-red"
      : value >= 10
        ? "intensity-glow-neon-magenta" // Custom one we'll add
        : value >= 5
          ? "intensity-glow-neon-amber"
          : value >= 2
            ? "intensity-glow-neon-lime"
            : "intensity-glow-neon-cyan"
  );

  // Formatting for the display
  const formattedValue = $derived(value.toFixed(2));
</script>

<div 
  class="multiplier-container"
  class:crashed={status === "wicket"}
>
  <div class="multiplier-shell">
    <div 
      class="multiplier-text {glowClass} font-headline tabular-nums"
      style="color: {multiplierColor}; --accent-rgb: {multiplierRgb};"
    >
      {formattedValue}<span class="multiplier-x">x</span>
    </div>
  </div>
  
  <div class="multiplier-label font-label">
    CURRENT PAYOUT
  </div>
</div>

<style>
  .multiplier-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    user-select: none;
  }

  .multiplier-shell {
    position: relative;
    padding: 0 1rem;
    transform: perspective(1000px) rotateX(10deg);
  }

  .multiplier-text {
    font-size: 5.5rem;
    line-height: 1;
    letter-spacing: -0.04em;
    filter: drop-shadow(0 0 20px rgba(var(--accent-rgb), 0.3));
    animation: num-bounce-subtle 2s ease-in-out infinite;
  }

  .multiplier-x {
    font-size: 2.5rem;
    opacity: 0.6;
    margin-left: 2px;
    letter-spacing: normal;
  }

  .multiplier-label {
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.4em;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    margin-top: -0.5rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  /* Custom intensity glow for Magenta/High mult */
  :global(.intensity-glow-neon-magenta) {
    text-shadow:
      0 0 18px rgba(255, 43, 214, 0.98),
      0 0 50px rgba(255, 43, 214, 0.65),
      0 0 100px rgba(255, 43, 214, 0.28);
  }

  @keyframes num-bounce-subtle {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-4px) scale(1.02); }
  }

  .crashed .multiplier-text {
    animation: electric-surge 0.4s ease-in-out infinite;
  }

  @media (max-width: 768px) {
    .multiplier-text {
      font-size: 4rem;
    }
    .multiplier-x {
      font-size: 1.8rem;
    }
  }
</style>
