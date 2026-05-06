import { describe, expect, it } from 'vitest';
import { GAME_MODES, analyticalRtpStandard, decomposeRound } from '../src/index.js';

const RUN_SLOW = process.env.SLOW_TESTS === '1';

describe('rtp simulation @slow', () => {
  it.runIf(RUN_SLOW)('tracks analytical RTP over large sample', () => {
    const rounds = 200000;
    let sum = 0;
    for (let i = 0; i < rounds; i++) {
      const payout = 0.05 + ((i * 2654435761) % 10000) / 1000;
      const out = decomposeRound({
        payoutMultiplier: payout,
        betID: 1000000 + i,
        mode: GAME_MODES.OVER,
      });
      sum += out.product;
    }
    const realized = sum / rounds;
    const expected = analyticalRtpStandard();
    expect(Math.abs(realized - expected)).toBeLessThanOrEqual(0.005);
  });
});

