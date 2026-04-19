/** Aviator-style crash multiplier from uniform [0,1). House edge ~1%. */
export function crashMultiplierFromUnit(u: number, houseEdge = 0.01): number {
  if (u <= 0 || u >= 1) return 1;
  const capped = Math.min(u, 1 - 1e-9);
  const raw = (1 - houseEdge) / (1 - capped);
  return Math.round(Math.min(1000, Math.max(1.01, raw)) * 100) / 100;
}
