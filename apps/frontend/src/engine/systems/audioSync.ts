/**
 * Derives Web Audio intensity multipliers from simulation state — no RNG.
 * Wire into `gameAudio` callers from the Svelte layer if desired.
 */
export function crowdIntensity(multiplier: number, phase: string): number {
  const m = Math.max(1, multiplier);
  const base = Math.min(1.2, 0.35 + Math.log1p(m - 1) * 0.15);
  if (phase === 'hit' || phase === 'bowl') return base * 1.15;
  return base;
}

export function tensionIntensity(isWicketPhase: boolean, multiplier: number): number {
  if (isWicketPhase) return 1.25;
  return Math.min(1, 0.4 + multiplier * 0.04);
}
