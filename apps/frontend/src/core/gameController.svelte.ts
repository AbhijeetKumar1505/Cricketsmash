import { payoutMultiplierToCricketOutcome } from '@cricket-crash/fairness';
import type { CricketOutcome } from '@cricket-crash/types';
import { createPlaybackEngine, type VisualPhase } from './playbackEngine.js';
import {
  StakeGameClient,
  JurisdictionFlags,
  GameModeName,
  PlayResult,
} from './stakeClient.js';
import type { BowlerType } from '../engine/physics/ballTrajectory.js';
import { ParseAmount, API_MULTIPLIER, GAME_MODES } from './stakeClient.js';
import type { PlaybackState } from './playbackEngine.js';
import { generateDeliveries, type Delivery } from './modeEngine.js';

export type { VisualPhase } from './playbackEngine.js';

export type DeliveryOutcome = { kind: 'runs'; runs: number } | { kind: 'wicket' } | null;

export type GamePhase =
  | 'initializing'
  | 'idle'
  | 'betting'
  | 'animating' // Session is active
  | 'broadcast' // Post-over/wicket display phase
  | 'error';

export interface RoundHistoryEntry {
  id: number;
  payoutMultiplier: number;
  outcome: CricketOutcome;
  betAmount: number;
  payout: number;
  timestamp: number;
}

interface BetConfig {
  min: number;
  max: number;
  step: number;
  levels: number[];
  default: number;
}

// ── Reactive game state (single $state object — safe to export) ─────────────
export const game = $state({
  phase: 'initializing' as GamePhase,
  balance: 0,
  currency: 'USD',
  betAmount: 0,
  payoutMultiplier: 0,
  displayMultiplier: 1, // Global Session Multiplier
  entryMultiplier: 1,   // User entry point
  elapsedMs: 0,
  outcome: null as CricketOutcome | null,
  betConfig: { min: 0, max: 0, step: 0, levels: [], default: 0 } as BetConfig,
  jurisdictionFlags: null as JurisdictionFlags | null,
  roundHistory: [] as RoundHistoryEntry[],
  errorMessage: null as string | null,
  isDevMode: false,
  deliveryKey: 0,
  visualPhase: 'idle' as VisualPhase,
  phaseProgress: 0,
  bowlerType: 'Fast' as BowlerType,
  selectedMode: GAME_MODES.OVER as GameModeName,
  currentDeliveries: [] as Delivery[],
  currentBallIdx: 0,
  canCashout: false,
  betActive: false, // Is the user currently in a bet?
  sessionActive: false, // Is the over currently playing?
  overSummary: [] as DeliveryOutcome[],
});

// ── Internal state ──────────────────────────────────────────────────────────
let client: StakeGameClient | null = null;
const playback = createPlaybackEngine();
let historyCounter = 0;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the game. Call once on mount.
 */
export async function initGame(): Promise<void> {
  game.phase = 'initializing';
  game.errorMessage = null;

  try {
    const { shouldUseMock } = await import('./devMock.js');
    const useMock = shouldUseMock();
    game.isDevMode = useMock;

    if (useMock) {
      const { createDevMockClient } = await import('./devMock.js');
      client = createDevMockClient();
    } else {
      const { createStakeClient } = await import('./stakeClient.js');
      client = createStakeClient();
    }

    const authResult = await client.init();

    game.balance = ParseAmount(authResult.balance.amount);
    game.currency = authResult.balance.currency;
    game.betConfig = {
      min: ParseAmount(authResult.config.minBet),
      max: ParseAmount(authResult.config.maxBet),
      step: ParseAmount(authResult.config.stepBet),
      levels: authResult.config.betLevels.map(ParseAmount),
      default: ParseAmount(authResult.config.defaultBetLevel),
    };
    game.betAmount = game.betConfig.default;
    game.jurisdictionFlags = authResult.jurisdiction;

    game.phase = 'idle';
  } catch (err) {
    game.phase = 'error';
    game.errorMessage = err instanceof Error ? err.message : 'Failed to connect to game server';
    console.error('[GameController] Init failed:', err);
  }
}

export async function placeBet(): Promise<void> {
  if (!client || game.betAmount <= 0) return;
  if (game.phase === 'betting' || game.betActive) return;

  const mode = game.selectedMode;
  const isMidSession = game.sessionActive;
  
  // If mid-session, we need a new Stake outcome for the REMAINING balls
  const apiAmount = Math.round(game.betAmount * API_MULTIPLIER);
  
  try {
    const result: PlayResult = await client.play(apiAmount, mode);
    game.balance = ParseAmount(result.balance.amount);
    
    // Calculate how many balls are left in the over
    const startIdx = isMidSession ? game.currentBallIdx + 1 : 0;
    
    // Generate the new sequence for these remaining balls
    const newSeq = generateDeliveries(result.payoutMultiplier, mode);
    
    if (!isMidSession) {
      // Starting a fresh session
      game.currentDeliveries = newSeq;
      game.overSummary = new Array(6).fill(null);
      game.currentBallIdx = 0;
      game.displayMultiplier = 1;
      game.entryMultiplier = 1;
      game.sessionActive = true;
      game.deliveryKey++;
      game.phase = 'animating';
      
      playback.start(
        game.currentDeliveries,
        (s: PlaybackState) => handlePlaybackTick(s),
        (finalMult: number) => handleSessionEnd(finalMult)
      );
    } else {
      // Joining current session
      // We overwrite the FUTURE deliveries with the new result
      const updatedDeliveries = [...game.currentDeliveries];
      for (let i = 0; i < newSeq.length && (startIdx + i) < 6; i++) {
        updatedDeliveries[startIdx + i] = newSeq[i]!;
      }
      game.currentDeliveries = updatedDeliveries;
      playback.updateDeliveries(game.currentDeliveries);
      
      game.entryMultiplier = game.displayMultiplier;
    }

    game.betActive = true;
    game.canCashout = result.payoutMultiplier > 0;
    game.payoutMultiplier = result.payoutMultiplier;

  } catch (err) {
    console.error('[GameController] Bet failed:', err);
    game.errorMessage = err instanceof Error ? err.message : 'Bet failed';
  }
}

function handlePlaybackTick(s: PlaybackState) {
  game.visualPhase = s.phase;
  game.displayMultiplier = s.multiplier;
  game.elapsedMs = s.elapsedMs;
  game.phaseProgress = s.phaseProgress;
  
  if (s.ballIndex !== game.currentBallIdx) {
    // A ball just completed, update the summary list
    const prevIdx = game.currentBallIdx;
    const outcome = game.currentDeliveries[prevIdx]?.outcome;
    if (outcome) {
      game.overSummary[prevIdx] = outcome as any;
    }
    game.currentBallIdx = s.ballIndex;
    game.bowlerType = game.currentDeliveries[s.ballIndex]?.bowlerType || 'Fast';
  }
}

async function handleSessionEnd(_finalMult: number) {
  // If user was still in the bet, they lose (if wicket) or auto-win (if ball 6)
  if (game.betActive) {
    game.betActive = false;
    game.canCashout = false;
    
    const apiAmount = Math.round(game.betAmount * API_MULTIPLIER);
    void finalizeRound(game.payoutMultiplier, apiAmount);
  }

  game.sessionActive = false;
  game.phase = 'broadcast';
  
  // Scorecard overlay shows during broadcast — auto-dismiss after 4s if user doesn't replay
  await new Promise(r => setTimeout(r, 4000));
  
  returnToIdle();
}

export async function cashout(): Promise<void> {
  if (!game.canCashout || !client || !game.betActive) return;

  try {
    const finalBalance = await client.endRound();
    game.balance = ParseAmount(finalBalance.amount);
    
    // Record history
    const apiAmount = Math.round(game.betAmount * API_MULTIPLIER);
    void finalizeRound(game.payoutMultiplier, apiAmount, true);

    game.betActive = false;
    game.canCashout = false;
    // DO NOT stop playback or change phase to 'result'
  } catch (err) {
    console.error('[GameController] Cashout failed:', err);
  }
}

async function finalizeRound(mult: number, betAmountApi: number, alreadyEnded = false): Promise<void> {
  if (!client) return;

  try {
    if (!alreadyEnded && client.isRoundActive()) {
      const finalBalance = await client.endRound();
      game.balance = ParseAmount(finalBalance.amount);
    }

    const payout = mult > 0 ? Math.floor(betAmountApi * mult) : 0;
    historyCounter++;
    game.roundHistory = [
      {
        id: historyCounter,
        payoutMultiplier: mult,
        outcome: payoutMultiplierToCricketOutcome(mult),
        betAmount: betAmountApi / API_MULTIPLIER,
        payout: payout / API_MULTIPLIER,
        timestamp: Date.now(),
      },
      ...game.roundHistory.slice(0, 49),
    ];
  } catch (err) {
    console.error('[GameController] EndRound failed:', err);
  }
}

export function returnToIdle(): void {
  game.phase = 'idle';
  game.displayMultiplier = 1;
  game.entryMultiplier = 1;
  game.sessionActive = false;
  game.betActive = false;
  game.currentDeliveries = [];
  game.overSummary = [];
  game.currentBallIdx = 0;
}

/**
 * Set the bet amount (in display units, not API micro-units).
 */
export function setBetAmount(amount: number): void {
  game.betAmount = Math.max(game.betConfig.min, Math.min(game.betConfig.max, amount));
}

/**
 * Select a bet level by index.
 */
export function selectBetLevel(index: number): void {
  if (index >= 0 && index < game.betConfig.levels.length) {
    game.betAmount = game.betConfig.levels[index];
  }
}

/**
 * Sets the current game mode.
 */
export function setGameMode(mode: GameModeName): void {
  if (game.phase === 'idle') {
    game.selectedMode = mode;
  }
}

/**
 * Cleanup on unmount.
 */
export function destroyGame(): void {
  playback.stop();
  client?.destroy();
  client = null;
  game.phase = 'initializing';
}

// Re-export for convenience
export { GAME_MODES } from './stakeClient.js';
export type { GameModeName } from './stakeClient.js';
