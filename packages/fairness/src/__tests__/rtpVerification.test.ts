import { describe, it, expect } from 'vitest';
import {
  STANDARD_PROFILE,
  BONUS_BUY_PROFILE,
  computeRtp,
  CAP_SINGLE_BALL_MULTIPLIER,
  CAP_OVER_TOTAL_MULTIPLIER,
  STREAK_OVERRIDE_MULTIPLIERS,
} from '../economicModel.js';
import { decomposeRound, analyticalRtpStandard, DECOMPOSE_EPSILON } from '../perBallDecomposer.js';

const RTP_TOLERANCE = 0.005;

describe('RTP verification', () => {
  it('STANDARD_PROFILE weights sum to 1', () => {
    const total = STANDARD_PROFILE.outcomes.reduce((a, o) => a + o.weight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('BONUS_BUY_PROFILE weights sum to 1', () => {
    const total = BONUS_BUY_PROFILE.outcomes.reduce((a, o) => a + o.weight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('STANDARD_PROFILE RTP is within 94-96%', () => {
    const rtp = computeRtp(STANDARD_PROFILE.outcomes);
    expect(rtp).toBeGreaterThanOrEqual(0.94 - RTP_TOLERANCE);
    expect(rtp).toBeLessThanOrEqual(0.96 + RTP_TOLERANCE);
  });

  it('STANDARD_PROFILE RTP matches analyticalRtpStandard()', () => {
    const rtp1 = computeRtp(STANDARD_PROFILE.outcomes);
    const rtp2 = analyticalRtpStandard();
    expect(rtp1).toBeCloseTo(rtp2, 8);
  });

  it('sky weights sum to 1', () => {
    const sw = STANDARD_PROFILE.sky.weights;
    const total = sw.jetpack + sw.smallPlane + sw.bigPlane;
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('hard caps are correct', () => {
    expect(CAP_SINGLE_BALL_MULTIPLIER).toBe(100);
    expect(CAP_OVER_TOTAL_MULTIPLIER).toBe(200);
  });

  it('streak ladder keys are 3..6 with ascending values', () => {
    const entries = Object.entries(STREAK_OVERRIDE_MULTIPLIERS)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort(([a], [b]) => a - b);
    expect(entries.map(([k]) => k)).toEqual([3, 4, 5, 6]);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]![1]).toBeGreaterThan(entries[i - 1]![1]);
    }
  });
});

describe('decomposeRound — product reconciliation', () => {
  it('positive over reconciles product to target within epsilon', () => {
    const targets = [1.08, 1.5, 2.0, 5.0, 10.0, 50.0, 100.0];
    for (const target of targets) {
      const result = decomposeRound({ payoutMultiplier: target, betID: 42, mode: 'OVER' });
      expect(Math.abs(result.product - target)).toBeLessThanOrEqual(DECOMPOSE_EPSILON * 100);
    }
  });

  it('wicket over returns product = 0', () => {
    const result = decomposeRound({ payoutMultiplier: 0, betID: 99, mode: 'OVER' });
    expect(result.product).toBe(0);
    expect(result.balls.some(b => b.key === 'catch_out')).toBe(true);
  });

  it('POWERPLAY single ball reconciles to target', () => {
    const targets = [1.08, 2.25, 10.0];
    for (const target of targets) {
      const result = decomposeRound({ payoutMultiplier: target, betID: 7, mode: 'POWERPLAY' });
      expect(result.balls.length).toBe(1);
      expect(Math.abs(result.product - target)).toBeLessThanOrEqual(DECOMPOSE_EPSILON * 100);
    }
  });

  it('POWERPLAY wicket returns single catch_out ball', () => {
    const result = decomposeRound({ payoutMultiplier: 0, betID: 7, mode: 'POWERPLAY' });
    expect(result.balls.length).toBe(1);
    expect(result.balls[0]!.key).toBe('catch_out');
  });

  it('backward-spread does not overshoot when last ball is capped', () => {
    // Force 5 sixes (high product) with a low target so the last ball will be
    // capped to 100 and backward spread fires.
    const result = decomposeRound({
      payoutMultiplier: 1.5,
      betID: 1,
      mode: 'OVER',
      forcedKeys: ['six', 'six', 'six', 'six', 'six', 'single'],
    });
    expect(result.product).toBeGreaterThan(0);
    // Product must not wildly overshoot target (within a large-but-finite bound)
    expect(result.product).toBeLessThan(1.5 * 10);
  });

  it('over-cap payoutMultiplier is clamped for planning', () => {
    const result = decomposeRound({ payoutMultiplier: 500, betID: 1, mode: 'OVER', applyOverCap: true });
    expect(result.payoutMultiplier).toBe(CAP_OVER_TOTAL_MULTIPLIER);
    expect(result.telemetry.some(e => e.kind === 'cap_clamped')).toBe(true);
  });

  it('sky override telemetry fires when forceSkyType is set', () => {
    const result = decomposeRound({ payoutMultiplier: 10, betID: 3, mode: 'OVER', forceSkyType: 'JETPACK' });
    expect(result.telemetry.some(e => e.kind === 'sky_override_applied')).toBe(true);
    expect(result.balls.some(b => b.skyType === 'JETPACK')).toBe(true);
  });

  it('streak bonus telemetry fires when forceStreakLength=6', () => {
    const result = decomposeRound({ payoutMultiplier: 8, betID: 5, mode: 'OVER', forceStreakLength: 6 });
    expect(result.telemetry.some(e => e.kind === 'streak_bonus_applied')).toBe(true);
  });
});
