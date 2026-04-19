/** Maps crash-style multiplier to UI accent (for GSAP / CSS). No RNG. */

export type MultBand = 'safe' | 'risky' | 'danger';

export function multiplierBand(mult: number): MultBand {
  if (mult < 1.35) return 'safe';
  if (mult < 2.2) return 'risky';
  return 'danger';
}

export const BAND_COLORS: Record<MultBand, { core: string; glow: string }> = {
  safe: { core: '#4ade80', glow: 'rgba(74, 222, 128, 0.45)' },
  risky: { core: '#facc15', glow: 'rgba(250, 204, 21, 0.5)' },
  danger: { core: '#f87171', glow: 'rgba(248, 113, 113, 0.55)' },
};
