/**
 * devMock.ts — Mock Stake RGS for local development.
 * Activates ONLY when sessionID / rgs_url are missing from URL params.
 * Simulates auth, play, and endRound with randomized cricket outcomes.
 */
import type { StakeGameClient, AuthResult, PlayResult, GameModeName } from './stakeClient.js';
import type { Balance, AuthenticateConfig, JurisdictionFlags, Round } from 'stake-engine';

const MOCK_CURRENCY = 'USD' as const;
const MOCK_BET_LEVELS = [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000];

// Cricket crash payout distribution (weighted random)
function randomPayoutMultiplier(): number {
  const r = Math.random();
  // ~18% wicket, ~28% dot/single, ~26% scoring shot, ~18% boundary, ~10% six
  if (r < 0.18) return 0;                            // wicket — always exactly 0
  if (r < 0.46) return 1.0 + Math.random() * 0.35;  // 1.0–1.35x (dot/single)
  if (r < 0.72) return 1.35 + Math.random() * 0.9;  // 1.35–2.25x (2–3 runs)
  if (r < 0.90) return 2.25 + Math.random() * 2.75; // 2.25–5.0x (four)
  return 5.0 + Math.random() * 10.0;                 // 5.0–15.0x (six/bigshot)
}

export function createDevMockClient(): StakeGameClient {
  let balance: Balance = { amount: 100_000_000_000, currency: MOCK_CURRENCY }; // $100,000
  let roundActive = false;
  let lastPayoutMult = 0;
  let lastBetAmount = 0;

  const config: AuthenticateConfig = {
    minBet: MOCK_BET_LEVELS[0],
    maxBet: MOCK_BET_LEVELS[MOCK_BET_LEVELS.length - 1],
    stepBet: 100000,
    defaultBetLevel: 1000000,
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

    async play(amount: number, _mode?: GameModeName): Promise<PlayResult> {
      await new Promise((r) => setTimeout(r, 200));

      // Deduct bet
      balance = { ...balance, amount: balance.amount - amount };
      roundActive = true;
      lastBetAmount = amount;
      lastPayoutMult = randomPayoutMultiplier();

      const payout = Math.floor(amount * lastPayoutMult);

      const round: Round = {
        betID: Date.now(),
        amount,
        payout,
        payoutMultiplier: lastPayoutMult,
        active: true,
        mode: 'OVER',
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
