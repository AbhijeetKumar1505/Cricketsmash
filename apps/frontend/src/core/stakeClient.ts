/**
 * stakeClient.ts — Thin wrapper around the `stake-engine` RGSClient.
 * This is the ONLY module that communicates with the Stake RGS API.
 * All game logic flows through here.
 */
import { RGSClient, DisplayAmount, ParseAmount } from 'stake-engine';
import type {
  AuthenticateConfig,
  AuthenticateResponse,
  Balance,
  Currency,
  JurisdictionFlags,
  PlayResponse,
  Round,
} from 'stake-engine';

/** All RGS amounts are in micro-units (1 USD = 1_000_000) */
export const API_MULTIPLIER = 1_000_000;

export { DisplayAmount, ParseAmount };
export type { Balance, Currency, AuthenticateConfig, JurisdictionFlags, Round };

// ── Cricket Crash bet mode names ────────────────────────────────────────────
export const GAME_MODES = {
  /** Standard 6-delivery over */
  OVER: 'OVER',
  /** Single-delivery high-risk round */
  POWERPLAY: 'POWERPLAY',
} as const;
export type GameModeName = (typeof GAME_MODES)[keyof typeof GAME_MODES];

// ── Auth result ─────────────────────────────────────────────────────────────
export interface AuthResult {
  balance: Balance;
  config: AuthenticateConfig;
  jurisdiction: JurisdictionFlags;
  /** Non-null if there's an unfinished round to resume */
  pendingRound: Round | null;
}

// ── Play result ─────────────────────────────────────────────────────────────
export interface PlayResult {
  balance: Balance;
  round: Round;
  payoutMultiplier: number;
}

// ── Client type ─────────────────────────────────────────────────────────────
type RGSClientInstance = ReturnType<typeof RGSClient>;

export interface StakeGameClient {
  init(): Promise<AuthResult>;
  play(amount: number, mode?: GameModeName): Promise<PlayResult>;
  endRound(): Promise<Balance>;
  sendEvent(eventValue: string): Promise<void>;
  getBalance(): Balance | null;
  getConfig(): AuthenticateConfig | null;
  getJurisdiction(): JurisdictionFlags | null;
  isRoundActive(): boolean;
  destroy(): void;
}

// ── Factory ─────────────────────────────────────────────────────────────────
export function createStakeClient(): StakeGameClient {
  let client: RGSClientInstance | null = null;
  let _balance: Balance | null = null;
  let _config: AuthenticateConfig | null = null;
  let _jurisdiction: JurisdictionFlags | null = null;
  let _roundActive = false;

  // Listen for SDK balance events
  const handleBalanceUpdate = (e: Event) => {
    const custom = e as CustomEvent<Balance>;
    _balance = custom.detail;
  };
  const handleRoundActive = (e: Event) => {
    const custom = e as CustomEvent<{ active: boolean }>;
    _roundActive = custom.detail.active;
  };

  return {
    async init(): Promise<AuthResult> {
      // RGSClient reads sessionID + rgs_url from window.location.href
      client = RGSClient({ url: window.location.href, enforceBetLevels: true });

      // Subscribe to SDK events
      window.addEventListener('balanceUpdate', handleBalanceUpdate);
      window.addEventListener('roundActive', handleRoundActive);

      const authResponse: AuthenticateResponse = await client.Authenticate();

      _balance = authResponse.balance;
      _config = authResponse.config;
      _jurisdiction = authResponse.jurisdictionFlags;

      let pendingRound: Round | null = null;
      if (authResponse.round?.active) {
        pendingRound = authResponse.round;
        _roundActive = true;
      }

      return {
        balance: _balance,
        config: _config,
        jurisdiction: _jurisdiction,
        pendingRound,
      };
    },

    async play(amount: number, mode: GameModeName = GAME_MODES.OVER): Promise<PlayResult> {
      if (!client) throw new Error('StakeClient not initialized. Call init() first.');

      const response: PlayResponse = await client.Play({ amount, mode });

      _balance = response.balance;
      _roundActive = response.round?.active ?? false;

      const payoutMultiplier = response.round?.payoutMultiplier ?? 0;

      return {
        balance: response.balance,
        round: response.round,
        payoutMultiplier,
      };
    },

    async endRound(): Promise<Balance> {
      if (!client) throw new Error('StakeClient not initialized. Call init() first.');

      const response = await client.EndRound();
      _balance = response.balance;
      _roundActive = false;
      return response.balance;
    },

    async sendEvent(eventValue: string): Promise<void> {
      if (!client) throw new Error('StakeClient not initialized. Call init() first.');
      await client.Event(eventValue);
    },

    getBalance() { return _balance; },
    getConfig() { return _config; },
    getJurisdiction() { return _jurisdiction; },
    isRoundActive() { return _roundActive; },

    destroy() {
      window.removeEventListener('balanceUpdate', handleBalanceUpdate);
      window.removeEventListener('roundActive', handleRoundActive);
      client = null;
      _balance = null;
      _config = null;
      _jurisdiction = null;
      _roundActive = false;
    },
  };
}
