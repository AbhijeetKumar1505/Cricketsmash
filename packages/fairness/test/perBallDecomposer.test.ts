import { describe, expect, it } from 'vitest';
import {
  DECOMPOSE_EPSILON,
  GAME_MODES,
  STREAK_OVERRIDE_MULTIPLIERS,
  decomposeRound,
} from '../src/index.js';

describe('perBallDecomposer', () => {
  it('is deterministic for same input', () => {
    const input = {
      payoutMultiplier: 7.125,
      betID: 123456,
      mode: GAME_MODES.OVER,
      applyOverCap: true,
    } as const;
    const a = decomposeRound(input);
    const b = decomposeRound(input);
    expect(a).toEqual(b);
  });

  it('reconciles product within epsilon for sampled payouts', () => {
    for (let i = 1; i <= 5000; i++) {
      const payoutMultiplier = Number((0.05 + (i % 200) * 0.071).toFixed(6));
      const r = decomposeRound({
        payoutMultiplier,
        betID: i * 7919,
        mode: GAME_MODES.OVER,
        applyOverCap: true,
      });
      if (payoutMultiplier <= 0) {
        expect(r.product).toBe(0);
      } else {
        const expected = Math.min(payoutMultiplier, 200);
        expect(Math.abs(r.product - expected)).toBeLessThanOrEqual(DECOMPOSE_EPSILON * 100);
      }
    }
  });

  it('only emits valid sky override multipliers in telemetry', () => {
    let sawSky = false;
    for (let i = 0; i < 3000; i++) {
      const r = decomposeRound({
        payoutMultiplier: 2.2 + (i % 11) * 0.13,
        betID: i + 1000,
        mode: GAME_MODES.OVER,
      });
      const skyEvents = r.telemetry.filter((e) => e.kind === 'sky_override_applied');
      for (const e of skyEvents) {
        sawSky = true;
        const factor = Number((e.payload.factor ?? 0) as number);
        expect([10, 100]).toContain(factor);
      }
    }
    expect(sawSky).toBe(true);
  });

  it('uses configured streak multipliers when streak override applied in telemetry', () => {
    let checked = 0;
    for (let i = 0; i < 12000; i++) {
      const r = decomposeRound({
        payoutMultiplier: 3 + (i % 30) * 0.17,
        betID: 987000 + i,
        mode: GAME_MODES.OVER,
      });
      const streakEvents = r.telemetry.filter((e) => e.kind === 'streak_bonus_applied');
      for (const e of streakEvents) {
        const len = Math.min(Number((e.payload.streakLength ?? 0) as number), 6);
        if (len < 3) continue;
        const expected = STREAK_OVERRIDE_MULTIPLIERS[len];
        expect(expected).toBeDefined();
        expect(Number((e.payload.factor ?? 0) as number)).toBe(expected);
        checked += 1;
        if (checked >= 8) break;
      }
      if (checked >= 8) break;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

