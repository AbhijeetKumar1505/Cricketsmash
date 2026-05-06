import { payoutMultiplierToCricketOutcome } from '@cricket-crash/fairness';
import type { CricketOutcome } from '@cricket-crash/types';
import type { EngineBridge } from '../bridge/EngineBridge.js';

// Module-level bridge reference — set by CricketSimulation.svelte via bindBridge()
let _bridge: EngineBridge | null = null;
// Prevents duplicate setCallbacks() calls if both initGame and bindBridge fire
let _callbacksRegistered = false;

/**
 * Called by CricketSimulation.svelte after creating the EngineBridge.
 * Also re-registers callbacks immediately, because initGame() runs before
 * CricketSimulation mounts (game.phase starts 'initializing', so the 3D
 * canvas isn't rendered yet when initGame calls setupBridgeCallbacks).
 */
export function bindBridge(b: EngineBridge): void {
  _bridge = b;
  _callbacksRegistered = false;   // fresh bridge instance
  setupBridgeCallbacks();
}
import {
  StakeGameClient,
  JurisdictionFlags,
  GameModeName,
  PlayResult,
} from './stakeClient.js';
import type { BowlerType } from '../engine/physics/ballTrajectory.js';
import { ParseAmount, API_MULTIPLIER, GAME_MODES } from './stakeClient.js';
import { generateDeliveries, type Delivery } from './modeEngine.js';

export type HitQuality = 'perfect' | 'good' | 'edge' | 'miss' | 'none';
export type VisualPhase = 'idle' | 'bowl' | 'hit' | 'wicket' | 'celebrate';

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
  isSwinging: false,
  hitQuality: 'none' as 'perfect' | 'good' | 'edge' | 'miss' | 'none',
});

// ── Internal state ──────────────────────────────────────────────────────────
let client: StakeGameClient | null = null;
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
    setupBridgeCallbacks();
  } catch (err) {
    game.phase = 'error';
    game.errorMessage = err instanceof Error ? err.message : 'Failed to connect to game server';
    console.error('[GameController] Init failed:', err);
  }
}

export async function swing(): Promise<void> {
  // Only allow swing during bowling phase
  if (game.visualPhase !== 'bowl') return;
  if (game.isSwinging) return;
  
  game.isSwinging = true;
  
  // Trigger the 3D Engine to swing
  _bridge?.triggerSwing();
  
  console.log('[GameController] Swung!');
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
      
      // Bowl the first pre-planned delivery.
      const first = newSeq[0];
      _bridge?.triggerBowl(first ? makeEngineOutcome(first) : undefined);
    } else {
      // Joining current session
      // We overwrite the FUTURE deliveries with the new result
      const updatedDeliveries = [...game.currentDeliveries];
      for (let i = 0; i < newSeq.length && (startIdx + i) < 6; i++) {
        updatedDeliveries[startIdx + i] = newSeq[i]!;
      }
      game.currentDeliveries = updatedDeliveries;
      // bridge.updateDeliveries(game.currentDeliveries); // To be implemented if mid-session changing needed in 3D
      
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

// Convert a modeEngine Delivery to the engine's DeliveryOutcome for triggerBowl().
function makeEngineOutcome(delivery: Delivery) {
  if (!_bridge) return undefined;
  const isWicket = delivery.outcome.kind === 'wicket';
  return _bridge.makeOutcome(
    isWicket ? 'wicket' : 'hit',
    (delivery.bowlerType as string).toLowerCase() as 'fast' | 'spin' | 'swing',
    isWicket ? 0 : delivery.endMultiplier,
  );
}

// Called after each ball result to bowl the next delivery or end the over.
function advanceBall(): void {
  // Guard: session may have ended via cashout or wicket before this timer fires.
  if (!game.sessionActive) return;

  _bridge?.triggerReset();

  const nextIdx = game.currentBallIdx + 1;

  if (nextIdx >= game.currentDeliveries.length) {
    handleSessionEnd(game.displayMultiplier);
    return;
  }

  game.currentBallIdx = nextIdx;
  const nextDelivery = game.currentDeliveries[nextIdx];
  _bridge?.triggerBowl(nextDelivery ? makeEngineOutcome(nextDelivery) : undefined);
}

// Wire engine → game state callbacks. Uses module-level _bridge set by bindBridge().
function setupBridgeCallbacks() {
  // Guard: _bridge must exist, and we must not double-register on the same bridge.
  if (!_bridge || _callbacksRegistered) return;
  _callbacksRegistered = true;

  _bridge.setCallbacks({
    onBowlStart: (_bowlerType: string, hitTime: number) => {
      // New delivery started — clear prior hit state.
      game.visualPhase = 'bowl';
      game.isSwinging  = false;

      // Update the 3D scoreboard: show current ball in the session
      _bridge?.updateScoreboard(
        game.currentBallIdx,
        game.currentDeliveries.length || 6,
        game.displayMultiplier,
      );

      // Auto-swing: register the swing during the 'bowling' phase so the engine
      // resolves it the moment the ball reaches the batsman zone (~perfect timing).
      // Wicket deliveries intentionally skip auto-swing — the ball beats the bat.
      const delivery = game.currentDeliveries[game.currentBallIdx];
      if (delivery?.outcome.kind !== 'wicket') {
        const delay = Math.max(200, hitTime * 600);   // ≈60% of delivery time
        setTimeout(() => {
          if (game.sessionActive && !game.isSwinging) {
            game.isSwinging = true;
            _bridge?.triggerSwing();
          }
        }, delay);
      }
    },

    onHitResult: (quality: string) => {
      game.hitQuality = quality as typeof game.hitQuality;
      if (quality !== 'miss') {
        game.visualPhase = 'hit';
        // Show this delivery's result multiplier immediately on bat contact
        // so the player sees the number during ball flight, not 4s later.
        const delivery = game.currentDeliveries[game.currentBallIdx];
        if (delivery && delivery.outcome.kind !== 'wicket') {
          game.displayMultiplier = delivery.endMultiplier;
        }
      } else {
        // Wicket — record immediately and end session after brief display.
        const idx = game.currentBallIdx;
        const summary = [...game.overSummary];
        summary[idx] = { kind: 'wicket' };
        game.overSummary = summary;
        game.visualPhase = 'wicket';
        setTimeout(() => {
          _bridge?.triggerReset();
          handleSessionEnd(0);
        }, 2500);
      }
    },

    onMultiplier: (_mult: number) => {
      // No-op: displayMultiplier is updated in onHitResult (on contact)
      // and confirmed in onRoundEnd. The engine's raw quality-adjusted value
      // is not used directly — we rely on the pre-planned delivery.endMultiplier.
    },

    onRoundEnd: (_mult: number, _outcome: string) => {
      const idx      = game.currentBallIdx;
      const delivery = game.currentDeliveries[idx];

      if (delivery) {
        // Record the pre-planned delivery outcome in the over summary.
        const summary = [...game.overSummary];
        summary[idx]  = delivery.outcome.kind === 'wicket'
          ? { kind: 'wicket' as const }
          : { kind: 'runs'   as const, runs: delivery.outcome.runs };
        game.overSummary        = summary;
        game.displayMultiplier  = delivery.endMultiplier;
      }

      // Refresh the 3D scoreboard with the updated multiplier
      _bridge?.updateScoreboard(
        game.currentBallIdx,
        game.currentDeliveries.length || 6,
        game.displayMultiplier,
      );

      game.visualPhase = 'celebrate';

      // Show commentary (resultStage 1) for 1750 ms, then MultiplierDisplay
      // (resultStage 2) for a further 1750 ms, then bowl next ball.
      // Total inter-ball gap = 3500 ms.
      setTimeout(advanceBall, 3500);
    },
  });
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
    
    // Record history based on ACTUAL multiplier at cashout, not predicted final
    const userMult = game.displayMultiplier / Math.max(0.01, game.entryMultiplier);
    const apiAmount = Math.round(game.betAmount * API_MULTIPLIER);
    void finalizeRound(userMult, apiAmount, true);

    game.betActive = false;
    game.canCashout = false;
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

    // High-stakes safe multiplication within micro-units
    // Use BigInt if amounts exceed safe integers, but here we stay within ~9e15 
    const payout = mult > 0 ? Math.floor(Number(BigInt(betAmountApi) * BigInt(Math.round(mult * 10000))) / 10000) : 0;
    
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
  game.visualPhase = 'idle';
  game.displayMultiplier = 1;
  game.entryMultiplier = 1;
  game.sessionActive = false;
  game.betActive = false;
  game.currentDeliveries = [];
  game.overSummary = [];
  game.currentBallIdx = 0;
}

/** Dismiss the wicket overlay without resetting session — leaves broadcast phase so scorecard shows. */
export function dismissMatchOverlay(): void {
  game.visualPhase = 'idle';
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
 * Sets the playback time scale (used for juice/impact freezes).
 */
export function setPlaybackTimeScale(_scale: number): void {
  // To be re-implemented if needed, but GameLoop now uses constant dt or handles its own trauma
}

/**
 * Cleanup on unmount.
 */
export function destroyGame(): void {
  _bridge = null;
  _callbacksRegistered = false;
  client?.destroy();
  client = null;
  game.phase = 'initializing';
}

// Re-export for convenience
export { GAME_MODES } from './stakeClient.js';
export type { GameModeName } from './stakeClient.js';
