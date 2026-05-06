import { describe, expect, it } from 'vitest';
import {
  BONUS_BUY_PROFILE,
  GAME_MODES,
  STANDARD_PROFILE,
  computeRtp,
  profileForMode,
  skyObjectChanceForMode,
} from '../src/index.js';

function sumWeights(profile: { outcomes: Array<{ weight: number }> }): number {
  return profile.outcomes.reduce((a, o) => a + o.weight, 0);
}

describe('economic invariants', () => {
  it('standard RTP is within target band', () => {
    const rtp = computeRtp(STANDARD_PROFILE.outcomes);
    expect(rtp).toBeGreaterThanOrEqual(0.94);
    expect(rtp).toBeLessThanOrEqual(0.96);
  });

  it('probability weights sum to 1.0 for each profile', () => {
    expect(sumWeights(STANDARD_PROFILE)).toBeCloseTo(1, 10);
    expect(sumWeights(BONUS_BUY_PROFILE)).toBeCloseTo(1, 10);
  });

  it('sky chance aligns with profile values by mode', () => {
    const overChance = skyObjectChanceForMode(GAME_MODES.OVER);
    const ppChance = skyObjectChanceForMode(GAME_MODES.POWERPLAY);
    expect(overChance).toBe(profileForMode(GAME_MODES.OVER).sky.chance);
    expect(ppChance).toBe(profileForMode(GAME_MODES.POWERPLAY).sky.chance);
    expect(overChance).toBe(0.02);
    expect(ppChance).toBe(0.12);
  });
});

