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
import type { DecomposeTelemetryEvent } from '@cricket-crash/fairness';
import { generateDeliveries, type Delivery } from './modeEngine.js';
import type { SkyObjectType } from '../engine/sky/types.js';
import { getForcedDecomposeOptions } from './devMock.js';

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

interface StakeTicket {
  id: number;
  source: 'main' | 'bonus';
  betAmountApi: number;y
  entryMultiplier: number;
  bonusProductAtEntry: number;
  settled: boolean;
  betId?: number;
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
  baseBallCount: 6,
  bonusBallCount: 0,
  totalBallCount: 6,
  pendingRewardToast: null as null | {
    text: string;
    color: string;
    key: number;
  },
  bonusStreak: 0,
  /** Stacking payout-preview multiplier from sky / rover / spider bonus hits (resets each new stake session). */
  bonusProfitMultProduct: 1,
  /** Incoming sky bonus type for this delivery (null if none). */
  activeSkyObject: null as SkyObjectType | null,
  /** Short-lived UI toast for sky impact (+10x / +100x). */
  skyHitToast: null as null | { type: SkyObjectType; multiplier: number; key: number },
  /** Broadcast scorecard totals for the most recently settled session. */
  lastSettledBetAmount: 0,
  lastSettledPayout: 0,
  lastSettledMultiplier: 0,
});

// ── Internal state ──────────────────────────────────────────────────────────
let client: StakeGameClient | null = null;
let historyCounter = 0;
let _bonusQueue: Promise<void> = Promise.resolve();
let _tickets: StakeTicket[] = [];
let _ticketCounter = 0;
let _activeMainTicketId: number | null = null;

function effectiveTicketMultiplier(
  displayMultiplier: number,
  entryMultiplier: number,
  bonusProfitMultProduct: number,
): number {
  const base = displayMultiplier / Math.max(0.01, entryMultiplier);
  return Math.max(0, base * bonusProfitMultProduct);
}

function effectiveMultiplierForTicket(ticket: StakeTicket): number {
  const displayLeg = game.displayMultiplier / Math.max(0.01, ticket.entryMultiplier);
  const bonusLeg = game.bonusProfitMultProduct / Math.max(0.01, ticket.bonusProductAtEntry);
  return Math.max(0, displayLeg * bonusLeg);
}

function createTicket(input: Omit<StakeTicket, 'id' | 'settled'>): StakeTicket {
  _ticketCounter += 1;
  const t: StakeTicket = { id: _ticketCounter, settled: false, ...input };
  _tickets.push(t);
  return t;
}

function findTicket(ticketId: number | null): StakeTicket | null {
  if (ticketId === null) return null;
  return _tickets.find((t) => t.id === ticketId) ?? null;
}

function betIdFromRound(round: PlayResult['round'] | undefined): number {
  const r = round as { betID?: number } | undefined;
  return typeof r?.betID === 'number' ? r.betID : Date.now();
}

function emitDecomposerTelemetry(
  c: StakeGameClient,
  events: DecomposeTelemetryEvent[],
  ctx: Record<string, string | number>,
): void {
  for (const ev of events) {
    try {
      void c.sendEvent(JSON.stringify({ v: 1, ...ctx, ...ev }));
    } catch {
      /* non-fatal */
    }
  }
}

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

    const betID = betIdFromRound(result.round);
    try {
      void client.sendEvent(
        JSON.stringify({
          v: 1,
          kind: 'bet_placed',
          betID,
          mode,
          payoutMultiplier: result.payoutMultiplier,
        }),
      );
    } catch {
      /* ignore */
    }

    // Calculate how many balls are left in the over
    const startIdx = isMidSession ? game.currentBallIdx + 1 : 0;

    const forced = game.isDevMode ? getForcedDecomposeOptions() : undefined;
    const { deliveries: newSeq, telemetry: decompTelemetry } = generateDeliveries(
      result.payoutMultiplier,
      mode,
      { betID, ...forced },
    );
    emitDecomposerTelemetry(client, decompTelemetry, { betID, mode });

    if (!isMidSession) {
      // Starting a fresh session
      game.currentDeliveries = newSeq;
      game.overSummary = new Array(newSeq.length).fill(null);
      game.currentBallIdx = 0;
      game.displayMultiplier = 1;
      game.entryMultiplier = 1;
      game.baseBallCount = 6;
      game.bonusBallCount = 0;
      game.totalBallCount = newSeq.length || 6;
      game.bonusProfitMultProduct = 1;
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
      game.totalBallCount = game.currentDeliveries.length || 6;
      game.bonusBallCount = Math.max(0, game.totalBallCount - game.baseBallCount);
    }

    const mainTicket = createTicket({
      source: 'main',
      betAmountApi: apiAmount,
      entryMultiplier: game.entryMultiplier,
      bonusProductAtEntry: game.bonusProfitMultProduct,
      betId: betID,
    });
    _activeMainTicketId = mainTicket.id;
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
  if (delivery.outcome.kind === 'wicket') {
    return _bridge.makeOutcome(
      'wicket',
      (delivery.bowlerType as string).toLowerCase() as 'fast' | 'spin' | 'swing',
      0,
      'wicket',
    );
  }

  const runs = delivery.outcome.runs;
  const bucket = runs <= 0 ? 'dot'
    : runs === 1 ? 'single'
    : runs === 2 ? 'double'
    : runs === 3 ? 'triple'
    : runs === 4 ? 'four'
    : 'six';
  return _bridge.makeOutcome(
    'hit',
    (delivery.bowlerType as string).toLowerCase() as 'fast' | 'spin' | 'swing',
    delivery.endMultiplier,
    bucket,
    delivery.skyObject ?? undefined,
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

async function requestBonusDelivery(sourceId: string): Promise<void> {
  if (!client || !game.sessionActive) return;

  const apiAmount = Math.round(game.betAmount * API_MULTIPLIER);
  const result: PlayResult = await client.play(apiAmount, GAME_MODES.POWERPLAY);
  game.balance = ParseAmount(result.balance.amount);

  const betID = betIdFromRound(result.round);
  createTicket({
    source: 'bonus',
    betAmountApi: apiAmount,
    entryMultiplier: Math.max(0.01, game.displayMultiplier),
    bonusProductAtEntry: game.bonusProfitMultProduct,
    betId: betID,
  });
  const forced = game.isDevMode ? getForcedDecomposeOptions() : undefined;
  const { deliveries: bonusSeq, telemetry: bonusTelemetry } = generateDeliveries(
    result.payoutMultiplier,
    GAME_MODES.POWERPLAY,
    { betID, ...forced },
  );
  emitDecomposerTelemetry(client, bonusTelemetry, { betID, mode: GAME_MODES.POWERPLAY });
  const bonusDelivery = bonusSeq[0];
  if (!bonusDelivery) return;

  // Keep multiplier timeline continuous across appended bonus deliveries.
  const chainedStart = Math.max(0, game.displayMultiplier);
  const chainedEnd = Math.max(0, chainedStart * bonusDelivery.endMultiplier);
  const chainedBonusDelivery: Delivery = {
    ...bonusDelivery,
    startMultiplier: chainedStart,
    endMultiplier: chainedEnd,
    outcome:
      bonusDelivery.outcome.kind === 'runs'
        ? { ...bonusDelivery.outcome, multiplier: chainedEnd }
        : bonusDelivery.outcome,
  };

  game.currentDeliveries = [...game.currentDeliveries, chainedBonusDelivery];
  game.totalBallCount = game.currentDeliveries.length || 6;
  game.bonusBallCount = Math.max(0, game.totalBallCount - game.baseBallCount);
  console.log(`[GameController] Awarded bonus ball from ${sourceId}. Total now ${game.totalBallCount}`);
}

function queueBonusBalls(extraBalls: number, sourceId: string): void {
  for (let i = 0; i < extraBalls; i++) {
    _bonusQueue = _bonusQueue.then(async () => {
      try {
        await requestBonusDelivery(sourceId);
      } catch (err) {
        game.errorMessage = err instanceof Error ? err.message : 'Bonus bet failed';
        game.phase = 'error';
        console.error('[GameController] Bonus delivery failed:', err);
      }
    });
  }
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
      game.activeSkyObject = null;

      // Update the 3D scoreboard: show current ball in the session
      _bridge?.updateScoreboard(
        game.currentBallIdx,
        game.totalBallCount || game.currentDeliveries.length || 6,
        game.displayMultiplier * game.bonusProfitMultProduct,
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

    onHitResult: (quality: string, _bucket: string) => {
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
        game.totalBallCount || game.currentDeliveries.length || 6,
        game.displayMultiplier * game.bonusProfitMultProduct,
      );

      game.visualPhase = 'celebrate';

      // Show commentary (resultStage 1) for 1750 ms, then MultiplierDisplay
      // (resultStage 2) for a further 1750 ms, then bowl next ball.
      // Total inter-ball gap = 3500 ms.
      setTimeout(advanceBall, 3500);
    },

    onSkyObjectSpawned: ({ type }) => {
      game.activeSkyObject = type;
    },

    onSkyObjectHit: ({ type, multiplier }) => {
      game.skyHitToast = { type, multiplier, key: Date.now() };
      game.activeSkyObject = null;
      setTimeout(() => {
        if (game.skyHitToast && Date.now() - game.skyHitToast.key > 900) {
          game.skyHitToast = null;
        }
      }, 950);
    },

    onBonusAwarded: ({ extraBalls, sourceId, type, profitMult }) => {
      if (!game.sessionActive) return;

      // Keep bonus value in multiplier flow (not as direct balance credit).
      if (profitMult > 1) {
        game.bonusProfitMultProduct *= profitMult;
      }

      if (extraBalls <= 0) return;
      game.bonusStreak += 1;
      game.pendingRewardToast = {
        text: `+${extraBalls} BALL${extraBalls > 1 ? 'S' : ''}`,
        color: type === 'plus3' ? '#ffc94f' : type === 'plus2' ? '#58d6ff' : type === 'multiplier' ? '#ff4f5f' : '#ffe17f',
        key: Date.now(),
      };
      queueBonusBalls(extraBalls, sourceId);
      setTimeout(() => {
        if (game.pendingRewardToast && Date.now() - game.pendingRewardToast.key > 900) {
          game.pendingRewardToast = null;
        }
      }, 950);
    },
  });
}

async function handleSessionEnd(_finalMult: number) {
  // Settle all open tickets against the final session multiplier state.
  if (_tickets.some((t) => !t.settled)) {
    game.betActive = false;
    game.canCashout = false;
    await finalizeOpenTickets();
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
    
    const mainTicket = findTicket(_activeMainTicketId);
    if (mainTicket && !mainTicket.settled) {
      const userMult = effectiveMultiplierForTicket(mainTicket);
      await finalizeTicket(mainTicket, userMult, true);
    }

    game.betActive = false;
    game.canCashout = false;
    _activeMainTicketId = null;
  } catch (err) {
    console.error('[GameController] Cashout failed:', err);
  }
}

async function finalizeOpenTickets(): Promise<void> {
  if (!client) return;
  try {
    if (client.isRoundActive()) {
      const finalBalance = await client.endRound();
      game.balance = ParseAmount(finalBalance.amount);
    }
    let totalBetApi = 0;
    let totalPayoutApi = 0;
    for (const ticket of _tickets) {
      if (ticket.settled) continue;
      const mult = effectiveMultiplierForTicket(ticket);
      const payoutApi = await finalizeTicket(ticket, mult, true);
      totalBetApi += ticket.betAmountApi;
      totalPayoutApi += payoutApi;
    }
    if (totalBetApi > 0) {
      game.lastSettledBetAmount = totalBetApi / API_MULTIPLIER;
      game.lastSettledPayout = totalPayoutApi / API_MULTIPLIER;
      game.lastSettledMultiplier = totalPayoutApi / Math.max(1, totalBetApi);
    }
    _activeMainTicketId = null;
  } catch (err) {
    console.error('[GameController] finalizeOpenTickets failed:', err);
  }
}

async function finalizeTicket(ticket: StakeTicket, mult: number, alreadyEnded = false): Promise<number> {
  if (!client) return 0;

  try {
    if (!alreadyEnded && client.isRoundActive()) {
      const finalBalance = await client.endRound();
      game.balance = ParseAmount(finalBalance.amount);
    }

    // High-stakes safe multiplication within micro-units
    // Use BigInt if amounts exceed safe integers, but here we stay within ~9e15 
    const payout = mult > 0 ? Math.floor(Number(BigInt(ticket.betAmountApi) * BigInt(Math.round(mult * 10000))) / 10000) : 0;
    
    historyCounter++;
    game.roundHistory = [
      {
        id: historyCounter,
        payoutMultiplier: mult,
        outcome: payoutMultiplierToCricketOutcome(mult),
        betAmount: ticket.betAmountApi / API_MULTIPLIER,
        payout: payout / API_MULTIPLIER,
        timestamp: Date.now(),
      },
      ...game.roundHistory.slice(0, 49),
    ];
    ticket.settled = true;
    return payout;
  } catch (err) {
    console.error('[GameController] EndRound failed:', err);
    return 0;
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
  game.baseBallCount = 6;
  game.bonusBallCount = 0;
  game.totalBallCount = 6;
  game.pendingRewardToast = null;
  game.bonusStreak = 0;
  game.bonusProfitMultProduct = 1;
  game.activeSkyObject = null;
  game.skyHitToast = null;
  game.lastSettledBetAmount = 0;
  game.lastSettledPayout = 0;
  game.lastSettledMultiplier = 0;
  _bonusQueue = Promise.resolve();
  _tickets = [];
  _activeMainTicketId = null;
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

export function getEffectiveTicketMultiplier(): number {
  const mainTicket = findTicket(_activeMainTicketId);
  if (mainTicket && !mainTicket.settled) {
    return effectiveMultiplierForTicket(mainTicket);
  }
  return effectiveTicketMultiplier(
    game.displayMultiplier,
    game.entryMultiplier,
    game.bonusProfitMultProduct,
  );
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
