/**
 * devMock.ts — Mock Stake RGS for local development.
 * Activates ONLY when sessionID / rgs_url are missing from URL params.
 * Simulates auth, play, and endRound with randomized cricket outcomes.
 */
import type { StakeGameClient, AuthResult, PlayResult, GameModeName } from './stakeClient.js';
import type { Balance, AuthenticateConfig, JurisdictionFlags, Round } from 'stake-engine';
import type { MathOutcomeKey, SkyObjectType } from '@cricket-crash/fairness';
import {
  STREAK_OVERRIDE_MULTIPLIERS,
  isBoundaryOutcome,
  pickWeighted,
  profileForMode,
} from './mathModel.js';

const MOCK_CURRENCY = 'USD' as const;
// Bet levels in micro-units (1_000_000 = $1.00)
const MOCK_BET_LEVELS = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 500_000_000];

// Math-first payout resolver for dev mode:
// weighted base outcome -> rare sky override -> rare streak override.
function randomPayoutMultiplier(mode: GameModeName): number {
  const profile = profileForMode(mode);
  const base = pickWeighted(profile.outcomes, (o) => o.weight, Math.random);
  let resolved = base.multiplier;

  // Sky uses override multipliers (never additive).
  if (Math.random() < profile.sky.chance) {
    const sky = pickWeighted(
      [
        { key: 'jetpack', weight: profile.sky.weights.jetpack },
        { key: 'smallPlane', weight: profile.sky.weights.smallPlane },
        { key: 'bigPlane', weight: profile.sky.weights.bigPlane },
      ] as const,
      (o) => o.weight,
      Math.random,
    );
    resolved =
      sky.key === 'bigPlane'
        ? profile.sky.multipliers.bigPlane
        : profile.sky.multipliers.jetpack;
  }

  // Streak bonuses are ultra-rare volatility injectors.
  // We approximate boundary streak rarity from p(boundary)^3 ~= 0.13%.
  if (isBoundaryOutcome(base.key)) {
    const streakRoll = Math.random();
    if (streakRoll < 0.001331) resolved = Math.max(resolved, STREAK_OVERRIDE_MULTIPLIERS[3]);
    else if (streakRoll < 0.001531) resolved = Math.max(resolved, STREAK_OVERRIDE_MULTIPLIERS[4]);
    else if (streakRoll < 0.001631) resolved = Math.max(resolved, STREAK_OVERRIDE_MULTIPLIERS[5]);
    else if (streakRoll < 0.001681) resolved = Math.max(resolved, STREAK_OVERRIDE_MULTIPLIERS[6]);
  }

  return Number(resolved.toFixed(2));
}

export function createDevMockClient(): StakeGameClient {
  let balance: Balance = { amount: 100_000_000_000, currency: MOCK_CURRENCY }; // $100,000
  let roundActive = false;
  let lastPayoutMult = 0;
  let lastBetAmount = 0;

  const config: AuthenticateConfig = {
    minBet: MOCK_BET_LEVELS[0],
    maxBet: MOCK_BET_LEVELS[MOCK_BET_LEVELS.length - 1],
    stepBet: 500_000,
    defaultBetLevel: 10_000_000,
    betLevels: MOCK_BET_LEVELS,
  };

  const jurisdiction: JurisdictionFlags = {
    socialCasino: false,
    disabledFullscreen: false,
    disabledTurbo: false,
    disabledSuperTurbo: false,
    disabledAutoplay: false,
    disabledSlamstop: false,
    disabledSpacebar: false,
    disabledBuyFeature: false,
    displayNetPosition: false,
    displayRTP: false,
    displaySessionTimer: false,
    minimumRoundDuration: 0,
  };

  return {
    async init(): Promise<AuthResult> {
      console.warn('[DevMock] Running in mock mode — no Stake RGS connection');
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 300));

      return {
        balance,
        config,
        jurisdiction,
        pendingRound: null,
      };
    },

    async play(amount: number, mode: GameModeName = 'OVER'): Promise<PlayResult> {
      await new Promise((r) => setTimeout(r, 200));

      // Deduct bet
      balance = { ...balance, amount: balance.amount - amount };
      roundActive = true;
      lastBetAmount = amount;
      lastPayoutMult = randomPayoutMultiplier(mode);

      const payout = Math.floor(amount * lastPayoutMult);

      const round: Round = {
        betID: Date.now(),
        amount,
        payout,
        payoutMultiplier: lastPayoutMult,
        active: true,
        mode,
        state: null,
      };

      return {
        balance,
        round,
        payoutMultiplier: lastPayoutMult,
      };
    },

    async endRound(): Promise<Balance> {
      await new Promise((r) => setTimeout(r, 100));

      // Credit payout — bet was already deducted in play(), add full payout back
      if (lastPayoutMult > 0) {
        balance = { ...balance, amount: balance.amount + Math.floor(lastBetAmount * lastPayoutMult) };
      }

      roundActive = false;
      return balance;
    },

    async sendEvent(_eventValue: string): Promise<void> {
      await new Promise((r) => setTimeout(r, 50));
    },

    getBalance() { return balance; },
    getConfig() { return config; },
    getJurisdiction() { return jurisdiction; },
    isRoundActive() { return roundActive; },

    destroy() {
      roundActive = false;
    },
  };
}

/** Check if we should use mock mode (no RGS params in URL) */
export function shouldUseMock(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  const hasSession = params.has('sessionID') && params.get('sessionID') !== '';
  const hasRgsUrl = params.has('rgs_url') && params.get('rgs_url') !== '';
  return !hasSession || !hasRgsUrl;
}

const VALID_KEYS: ReadonlySet<MathOutcomeKey> = new Set([
  'six',
  'four',
  'triple',
  'double',
  'single',
  'dot',
  'good_fielding',
  'catch_out',
]);

const VALID_SKY: ReadonlySet<SkyObjectType> = new Set(['JETPACK', 'SMALL_PLANE', 'BIG_PLANE']);

/**
 * Dev forcing controls from URL params:
 * - `force=six,four,dot,...`
 * - `forceSky=JETPACK|SMALL_PLANE|BIG_PLANE`
 * - `forceStreak=3|4|5|6`
 */
export function getForcedDecomposeOptions():
  | {
      forcedKeys?: MathOutcomeKey[];
      forceSkyType?: SkyObjectType;
      forceStreakLength?: 3 | 4 | 5 | 6;
    }
  | undefined {
  if (typeof window === 'undefined') return undefined;
  const p = new URLSearchParams(window.location.search);
  const force = p.get('force');
  const forceSky = p.get('forceSky');
  const forceStreak = p.get('forceStreak');

  const out: {
    forcedKeys?: MathOutcomeKey[];
    forceSkyType?: SkyObjectType;
    forceStreakLength?: 3 | 4 | 5 | 6;
  } = {};

  if (force) {
    const keys = force
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) as MathOutcomeKey[];
    const valid = keys.filter((k) => VALID_KEYS.has(k));
    if (valid.length > 0) out.forcedKeys = valid;
  }

  if (forceSky) {
    const sky = forceSky.trim().toUpperCase() as SkyObjectType;
    if (VALID_SKY.has(sky)) out.forceSkyType = sky;
  }

  if (forceStreak) {
    const n = Number(forceStreak);
    if (n === 3 || n === 4 || n === 5 || n === 6) out.forceStreakLength = n;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
