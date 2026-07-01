import { payoutMultiplierToCricketOutcome } from '@cricket-crash/fairness';
import type { CricketOutcome } from '@cricket-crash/types';
import type { EngineBridge } from '../bridge/EngineBridge.js';
import type { Difficulty } from '../game/DifficultyEngine.js';
import { difficultyEngine, getBatsmanForDifficulty, getFielderForInsurance } from '../game/DifficultyEngine.js';
import { insuranceManager } from '../game/InsuranceManager.js';
import { gameBus } from '../game/GameEventBus.js';
import { recordMissionEvent } from './missions.svelte.js';
import { recordWin as recordLeaderboardWin } from './leaderboard.svelte.js';

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
  syncAutobetFraming();
}
import {
  StakeGameClient,
  JurisdictionFlags,
  PlayResult,
} from './stakeClient.js';
import type { BowlerType } from '../engine/physics/ballTrajectory.js';
import { ParseAmount, API_MULTIPLIER, GAME_MODES } from './stakeClient.js';
import type { DecomposeTelemetryEvent } from '@cricket-crash/fairness';
import { generateDeliveries, applyGodModeOverrides, type Delivery } from './modeEngine.js';
import type { SkyObjectType } from '../engine/sky/types.js';
import { getForcedDecomposeOptions } from './devMock.js';

export type HitQuality = 'perfect' | 'good' | 'edge' | 'miss' | 'none';
export type VisualPhase = 'idle' | 'bowl' | 'hit' | 'wicket' | 'celebrate';

export type DeliveryOutcome = { kind: 'runs'; runs: number } | { kind: 'wicket' } | null;

export type GamePhase =
  | 'initializing'
  | 'idle'
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
  betAmountApi: number;
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
  /** Arcade: repeat next POWERPLAY bet after each result until toggled off. */
  autoPlayOn: false,
  /** Autobet config (set via setAutoPlayConfig). Each null = no limit. */
  autobetRoundsTotal: null as number | null,
  autobetRoundsPlayed: 0,
  autobetMaxLossAmount: null as number | null,
  autobetMaxWinAmount: null as number | null,
  autobetStopAtMult: null as number | null,
  /** Balance captured at autobet start — used for cumulative loss/win comparison. */
  autobetStartBalance: 0,
  /** Shorter gaps between result → next bowl when on. Kept in sync with autobetSpeed. */
  turboPlay: false,
  /** 0=Slow  1=Normal  2=Fast  3=Turbo — controls inter-round timing in autobet. */
  autobetSpeed: 1 as 0 | 1 | 2 | 3,
  currentDeliveries: [] as Delivery[],
  canCashout: false,
  betActive: false,
  sessionActive: false,
  overSummary: [] as DeliveryOutcome[],
  recentResults: [] as Array<{ kind: 'runs'; runs: number } | { kind: 'wicket' }>,
  isSwinging: false,
  hitQuality: 'none' as 'perfect' | 'good' | 'edge' | 'miss' | 'none',
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
  /** Whether to show the result card during broadcast phase. */
  showResultCard: true,

  // ── Difficulty & character selection ──────────────────────────────────────
  difficulty: 'medium' as Difficulty,
  /** Active batsman character id */
  activeBatsman: 'modi' as string,
  /** Active fielder character id */
  activeFielder: 'ronaldo' as string,

  // ── Insurance ─────────────────────────────────────────────────────────────
  insuranceActive: false,
  insuranceCost: 0,
  insuranceTriggered: false,

  // ── Bonus Buy ─────────────────────────────────────────────────────────────
  bonusBuyAvailable: true,
  /** 30% surcharge deducted locally when bonus buy is initiated */
  bonusBuyCost: 0,
  /** Error message shown when bonus buy button is clicked but blocked */
  bonusBuyAlert: null as string | null,
  /** Per-round win toast shown above the bet panel after a scoring delivery */
  winToast: null as null | { amount: number; multiplier: number; key: number },
});

// ── Internal state ──────────────────────────────────────────────────────────
let client: StakeGameClient | null = null;
let historyCounter = 0;
let _tickets: StakeTicket[] = [];
let _ticketCounter = 0;
let _activeMainTicketId: number | null = null;
let _skyHitThisDelivery = false;
// Snapshot of the delivery the engine is currently animating — captured at
// triggerBowl and cleared after onRoundEnd so callbacks always read the
// right delivery even if game.currentDeliveries is overwritten by a concurrent bet.
let _activeBowlDelivery: Delivery | null = null;

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

function syncAutobetFraming(): void {
  _bridge?.setAutobetFraming(game.autoPlayOn);
}

function isNotableResult(): boolean {
  const outcome = game.overSummary[0];
  if (!outcome) return false;
  if (outcome.kind === 'wicket') return true;
  if (outcome.kind === 'runs' && outcome.runs >= 4) return true;
  if (_skyHitThisDelivery) return true;
  return false;
}

function interBallResultDelayMs(): number {
  const notable = isNotableResult();
  switch (game.autobetSpeed) {
    case 0: return notable ? 4500 : 2000;   // slow — appreciate the result
    case 1: return notable ? 3500 : 1200;   // normal (previous default)
    case 2: return notable ? 1200 :  500;   // fast
    case 3: return 300;                     // turbo
    default: return notable ? 3500 : 1200;
  }
}

function broadcastWaitMs(): number {
  const notable = isNotableResult();
  switch (game.autobetSpeed) {
    case 0: return notable ? 3600 : 1600;
    case 1: return notable ? 3200 :  800;
    case 2: return notable ? 1200 :  500;
    case 3: return 350;
    default: return notable ? 3200 : 800;
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
  if (game.betActive) return;
  game.betActive = true;  // lock before any await — prevents concurrent placeBet() calls

  recordMissionEvent({ kind: 'bet' });

  const apiAmount = Math.round(game.betAmount * API_MULTIPLIER);

  try {
    const result: PlayResult = await client.play(apiAmount, GAME_MODES.POWERPLAY);
    game.balance = ParseAmount(result.balance.amount);

    const betID = betIdFromRound(result.round);
    try {
      void client.sendEvent(
        JSON.stringify({
          v: 1,
          kind: 'bet_placed',
          betID,
          autoPlayOn: game.autoPlayOn,
          turboPlay: game.turboPlay,
          payoutMultiplier: result.payoutMultiplier,
        }),
      );
    } catch {
      /* ignore */
    }

    const forced = game.isDevMode ? getForcedDecomposeOptions() : undefined;
    let { deliveries: newSeq, telemetry: decompTelemetry } = generateDeliveries(
      result.payoutMultiplier,
      { betID, ...forced },
    );
    emitDecomposerTelemetry(client, decompTelemetry, { betID, mode: GAME_MODES.POWERPLAY });

    if (game.isDevMode) {
      const d = newSeq[0];
      console.log(
        `%c[CRICKET] Round ${betID} | server=${result.payoutMultiplier}× | ${d?.outcome.kind}${d?.outcome.kind === 'runs' ? ` ${d.outcome.runs}r end=${d.endMultiplier.toFixed(3)}×` : ''}`,
        'color:#0af;font-weight:bold',
      );
    }

    if (game.difficulty === 'god') {
      newSeq = applyGodModeOverrides(newSeq);
    }

    game.currentDeliveries = newSeq;
    game.overSummary = [null];
    game.displayMultiplier = 1;
    game.entryMultiplier = 1;
    game.bonusProfitMultProduct = 1;
    game.sessionActive = true;
    _skyHitThisDelivery = false;
    game.deliveryKey++;
    game.phase = 'animating';

    const delivery = newSeq[0];
    _activeBowlDelivery = delivery ?? null;  // snapshot before triggerBowl; cleared in onRoundEnd
    _bridge?.triggerBowl(
      delivery ? makeEngineOutcome(delivery) : undefined,
      delivery ? { shotType: delivery.shotType } : undefined,
    );

    const mainTicket = createTicket({
      source: 'main',
      betAmountApi: apiAmount,
      entryMultiplier: game.entryMultiplier,
      bonusProductAtEntry: game.bonusProfitMultProduct,
      betId: betID,
    });
    _activeMainTicketId = mainTicket.id;
    game.canCashout = false;  // enabled in onBowlStart — avoids leaking wicket outcome at bet time
    game.payoutMultiplier = result.payoutMultiplier;

  } catch (err) {
    console.error('[GameController] Bet failed:', err);
    game.errorMessage = err instanceof Error ? err.message : 'Bet failed';
    game.autoPlayOn = false;
    game.betActive = false;  // release lock so user can retry after API failure
    _activeBowlDelivery = null;
    syncAutobetFraming();
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

// Single-ball game: after each ball result, session is always complete.
function advanceBall(): void {
  if (!game.sessionActive) return;
  _bridge?.triggerReset();
  handleSessionEnd(game.displayMultiplier);
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

      _bridge?.updateScoreboard(0, 1, game.displayMultiplier * game.bonusProfitMultProduct);

      const delivery = _activeBowlDelivery;
      if (delivery?.outcome.kind !== 'wicket') {
        // Ball is released after 0.55s run-up, then travels for hitTime seconds.
      // CONTACT fires SWING_DUR (0.22s) after triggerSwing, so we schedule
      // triggerSwing at: 0.55 + hitTime - 0.22 = hitTime + 0.33.
      // V5: +20ms offset so contact aligns with ball arrival instead of slightly early.
      const delay = Math.max(200, (hitTime + 0.35) * 1000);
        setTimeout(() => {
          if (game.sessionActive && !game.isSwinging) {
            game.isSwinging = true;
            _bridge?.triggerSwing();
          }
        }, delay);
      }
      // Cashout enabled here — animation has started, outcome not yet revealed.
      game.canCashout = true;
    },

    onHitResult: (quality: string, _bucket: string) => {
      if (!game.sessionActive) return;
      game.hitQuality = quality as typeof game.hitQuality;

      const delivery = _activeBowlDelivery;

      if (quality !== 'miss') {
        game.visualPhase = 'hit';
        if (delivery && delivery.outcome.kind !== 'wicket') {
          game.displayMultiplier = delivery.endMultiplier;
        }

        if (game.isDevMode) {
          console.log(
            `%c[BALL] quality=${quality} bucket=${_bucket}`,
            `color:#4af`,
            '| planned', delivery?.outcome.kind,
            delivery?.outcome.kind === 'runs' ? `${delivery.outcome.runs}r ${delivery.endMultiplier.toFixed(3)}×` : '',
          );
        }
      } else {
        if (game.isDevMode) {
          console.log(`%c[BALL] quality=MISS → WICKET`, 'color:#f44;font-weight:bold');
        }
        game.overSummary = [{ kind: 'wicket' }];
        game.visualPhase = 'wicket';
        setTimeout(() => {
          if (!game.sessionActive) return;  // guard: session may have ended (e.g. cashout)
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
      const delivery = _activeBowlDelivery;
      _activeBowlDelivery = null;  // clear snapshot — this delivery is now settled

      if (delivery) {
        game.overSummary = [delivery.outcome.kind === 'wicket'
          ? { kind: 'wicket' as const }
          : { kind: 'runs'   as const, runs: delivery.outcome.runs }];
        game.displayMultiplier = delivery.endMultiplier;

        if (delivery.outcome.kind === 'wicket') {
          recordMissionEvent({ kind: 'wicket' });
        } else {
          recordMissionEvent({
            kind: 'hit',
            runs: delivery.outcome.runs,
            multiplier: delivery.endMultiplier,
          });
        }
      } else {
        // Fallback: delivery snapshot was lost — infer outcome from engine params.
        // This path should never occur after the modeEngine fallback fix, but guards
        // against any future regression where _activeBowlDelivery could be null.
        if (_outcome === 'wicket' || _mult === 0) {
          game.overSummary = [{ kind: 'wicket' as const }];
          game.displayMultiplier = 0;
          recordMissionEvent({ kind: 'wicket' });
        } else {
          game.overSummary = [{ kind: 'runs' as const, runs: 0 }];
          game.displayMultiplier = Math.max(1, _mult);
          recordMissionEvent({ kind: 'hit', runs: 0, multiplier: game.displayMultiplier });
        }
      }

      _bridge?.updateScoreboard(0, 1, game.displayMultiplier * game.bonusProfitMultProduct);

      const isWicket = delivery ? delivery.outcome.kind === 'wicket'
        : (_outcome === 'wicket' || _mult === 0);
      if (!isWicket) {
        game.visualPhase = 'celebrate';
        // Show win amount toast above bet panel
        if (delivery && delivery.outcome.kind === 'runs' && delivery.outcome.runs > 0) {
          const winAmount = game.betAmount * delivery.endMultiplier;
          const toastKey = Date.now();
          game.winToast = { amount: winAmount, multiplier: delivery.endMultiplier, key: toastKey };
          setTimeout(() => {
            if (game.winToast?.key === toastKey) game.winToast = null;
          }, 2800);
        }
        setTimeout(advanceBall, interBallResultDelayMs());
      }
    },

    onSkyObjectSpawned: ({ type }) => {
      game.activeSkyObject = type;
    },

    onSkyObjectHit: ({ type, multiplier }) => {
      _skyHitThisDelivery = true;
      game.skyHitToast = { type, multiplier, key: Date.now() };
      game.activeSkyObject = null;
      setTimeout(() => {
        if (game.skyHitToast && Date.now() - game.skyHitToast.key > 900) {
          game.skyHitToast = null;
        }
      }, 950);
    },

  });
}

async function handleSessionEnd(_finalMult: number) {
  // Mission tracking — peak multiplier vs wicket-free session
  const wasWicket = game.overSummary.some((s) => s?.kind === 'wicket');
  recordMissionEvent({
    kind: 'session_end',
    peakMultiplier: Math.max(_finalMult, game.displayMultiplier),
    wasWicket,
  });

  // Settle all open tickets against the final session multiplier state.
  if (_tickets.some((t) => !t.settled)) {
    game.betActive = false;
    game.canCashout = false;
    await finalizeOpenTickets();
  }

  game.sessionActive = false;
  game.showResultCard = isNotableResult();
  game.phase = 'broadcast';

  await new Promise((r) => setTimeout(r, broadcastWaitMs()));

  // Record this round's outcome in rolling history before overSummary is cleared
  const roundOutcome = game.overSummary[0] ?? null;
  if (roundOutcome !== null) {
    game.recentResults = [roundOutcome, ...game.recentResults].slice(0, 6);
  }

  returnToIdle();
  syncAutobetFraming();

  if (!game.autoPlayOn) return;

  // ── Autobet limit checks ─────────────────────────────────────────────
  game.autobetRoundsPlayed += 1;
  const stopReason = checkAutobetLimits(_finalMult);
  if (stopReason) {
    game.autoPlayOn = false;
    syncAutobetFraming();
    return;
  }

  const gapMs = [900, 780, 400, 220][game.autobetSpeed] ?? 780;
  await new Promise((r) => setTimeout(r, gapMs));
  if (!game.autoPlayOn) return;
  if (game.betActive || game.sessionActive) return;
  if (game.betAmount > game.balance) {
    game.autoPlayOn = false;
    syncAutobetFraming();
    return;
  }
  await placeBet();
}

/**
 * Returns a stop-reason string if any autobet limit has been hit, else null.
 */
function checkAutobetLimits(finalMult: number): string | null {
  if (game.autobetRoundsTotal !== null && game.autobetRoundsPlayed >= game.autobetRoundsTotal) {
    return 'rounds';
  }
  const delta = game.balance - game.autobetStartBalance;
  if (game.autobetMaxLossAmount !== null && delta <= -game.autobetMaxLossAmount) {
    return 'loss';
  }
  if (game.autobetMaxWinAmount !== null && delta >= game.autobetMaxWinAmount) {
    return 'win';
  }
  if (game.autobetStopAtMult !== null && finalMult >= game.autobetStopAtMult) {
    return 'mult';
  }
  return null;
}

export async function cashout(): Promise<void> {
  if (!game.canCashout || !client || !game.betActive) return;

  try {
    const finalBalance = await client.endRound();
    game.balance = ParseAmount(finalBalance.amount);
    
    const mainTicket = findTicket(_activeMainTicketId);
    let cashoutMult = 1;
    if (mainTicket && !mainTicket.settled) {
      cashoutMult = effectiveMultiplierForTicket(mainTicket);
      await finalizeTicket(mainTicket, cashoutMult, true);
    }

    recordMissionEvent({ kind: 'cashout', multiplier: cashoutMult });

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
    const balanceBefore = game.balance;

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

    // ── Settlement integrity audit ─────────────────────────────────────────
    if (game.isDevMode) {
      const stake        = totalBetApi / API_MULTIPLIER;
      const serverPayout = game.balance - (balanceBefore - stake); // endRound delta + stake
      const displayMult  = game.lastSettledMultiplier;
      const isWicket     = game.overSummary.some((s) => s?.kind === 'wicket');
      console.log(
        `%c[SETTLE] stake=${stake} | serverPayout≈${serverPayout.toFixed(2)} | displayMult=${displayMult.toFixed(3)}× | wicket=${isWicket} | Δbal=${(game.balance - balanceBefore).toFixed(2)}`,
        isWicket ? 'color:#f44' : displayMult > 1 ? 'color:#4f4' : 'color:#fa0',
      );
      // Only flag a genuine anomaly: wicket that paid MORE than the original stake.
      // A wicket paying back exactly the stake (1× return) is normal behaviour in
      // both mock mode and Stake RGS — it means no profit loss, not a split.
      if (isWicket && serverPayout > stake) {
        console.warn(
          '[INTEGRITY] SPLIT: server paid', serverPayout.toFixed(2),
          'on WICKET (stake was', stake.toFixed(2), ') — display and economy mismatch!',
        );
      }
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
    const betAmount = ticket.betAmountApi / API_MULTIPLIER;
    const payoutAmount = payout / API_MULTIPLIER;
    game.roundHistory = [
      {
        id: historyCounter,
        payoutMultiplier: mult,
        outcome: payoutMultiplierToCricketOutcome(mult),
        betAmount,
        payout: payoutAmount,
        timestamp: Date.now(),
      },
      ...game.roundHistory.slice(0, 49),
    ];
    ticket.settled = true;

    // Leaderboard — record any settled winning ticket (cashout or end-of-over)
    if (mult > 1 && payoutAmount > 0) {
      recordLeaderboardWin(mult, payoutAmount, betAmount);
    }

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
  game.pendingRewardToast = null;
  game.bonusStreak = 0;
  game.bonusProfitMultProduct = 1;
  game.bonusBuyCost = 0;
  game.bonusBuyAlert = null;
  game.winToast = null;
  game.activeSkyObject = null;
  game.skyHitToast = null;
  _skyHitThisDelivery = false;
  game.lastSettledBetAmount = 0;
  game.lastSettledPayout = 0;
  game.lastSettledMultiplier = 0;
  game.showResultCard = true;
  _tickets = [];
  _activeMainTicketId = null;

  // Restore default Ronaldo fielder after bonus buy session (skip if insurance is holding kimjong)
  if (game.activeFielder === 'kimjong' && !game.insuranceActive) {
    game.activeFielder = 'ronaldo';
    gameBus.emit('FIELDER_SWAP', { from: 'kimjong', to: 'ronaldo', explosion: false });
  }
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

export function nudgeBetAmount(deltaSteps: number): void {
  const step = game.betConfig.step > 0 ? game.betConfig.step : 0.5;
  setBetAmount(game.betAmount + deltaSteps * step);
}

/**
 * Autoplay: after each settled ball, automatically place the next bet until toggled off.
 */
export function setAutoPlay(on: boolean): void {
  const was = game.autoPlayOn;
  game.autoPlayOn = on;
  if (on && !was) {
    // Fresh start — snapshot balance + reset rounds counter.
    game.autobetStartBalance = game.balance;
    game.autobetRoundsPlayed = 0;
  }
  syncAutobetFraming();
  if (on && !was && !game.sessionActive && !game.betActive && game.phase === 'idle' && client) {
    if (game.betAmount > 0 && game.betAmount <= game.balance) {
      void placeBet();
    }
  }
}

export function toggleAutoPlay(): void {
  setAutoPlay(!game.autoPlayOn);
}

/** Configure autobet limits before starting. Pass nulls for no-limit. */
export function setAutoPlayConfig(cfg: {
  rounds?: number | null;
  maxLossAmount?: number | null;
  maxWinAmount?: number | null;
  stopAtMult?: number | null;
}): void {
  if (cfg.rounds !== undefined)        game.autobetRoundsTotal   = cfg.rounds;
  if (cfg.maxLossAmount !== undefined) game.autobetMaxLossAmount = cfg.maxLossAmount;
  if (cfg.maxWinAmount !== undefined)  game.autobetMaxWinAmount  = cfg.maxWinAmount;
  if (cfg.stopAtMult !== undefined)    game.autobetStopAtMult    = cfg.stopAtMult;
}

export function setTurboPlay(on: boolean): void {
  game.turboPlay = on;
}

export function setAutobetSpeed(level: 0 | 1 | 2 | 3): void {
  game.autobetSpeed = level;
  game.turboPlay = level === 3;
}

export function toggleTurboPlay(): void {
  game.turboPlay = !game.turboPlay;
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
  _bridge?.setAutobetFraming(false);
  _bridge = null;
  _callbacksRegistered = false;
  client?.destroy();
  client = null;
  game.phase = 'initializing';
}

// ── Difficulty & character API ───────────────────────────────────────────────

export function setDifficulty(d: Difficulty): void {
  difficultyEngine.setDifficulty(d);
  game.difficulty = d;
  const batsman = getBatsmanForDifficulty(d);
  game.activeBatsman = batsman;
  gameBus.emit('DIFFICULTY_CHANGED', { difficulty: d, batsman });
}

export function getDifficultyConfig() {
  return difficultyEngine.getConfig();
}

// ── Insurance API ────────────────────────────────────────────────────────────

/** Wire insurance manager to game bus on first use. */
function _ensureInsuranceInit(): void {
  insuranceManager.init(gameBus);
}

export function activateInsurance(): boolean {
  _ensureInsuranceInit();
  insuranceManager.setBetAmount(game.betAmount);
  const ok = insuranceManager.activate(game.balance);
  if (ok) {
    const state = insuranceManager.getState();
    game.insuranceActive = true;
    game.insuranceCost   = state.cost;
    game.balance        -= state.cost;
    game.activeFielder   = getFielderForInsurance(true);
    gameBus.emit('FIELDER_SWAP', { from: 'ronaldo', to: 'kimjong', explosion: true });
  }
  return ok;
}

export function deactivateInsurance(): void {
  insuranceManager.deactivate();
  game.insuranceActive = false;
  game.activeFielder   = 'ronaldo';
  gameBus.emit('FIELDER_SWAP', { from: 'kimjong', to: 'ronaldo', explosion: false });
}

// ── Bonus Buy API ────────────────────────────────────────────────────────────

export async function placeBonusBuy(): Promise<void> {
  if (!client) return;
  if (game.betActive || game.sessionActive) return;

  const surcharge = game.betAmount * 0.30;
  if (game.balance < game.betAmount + surcharge) return;

  game.bonusBuyCost = surcharge;
  game.balance = Math.max(0, game.balance - surcharge);

  // Swap fielder to Kim Jong (lazy) — keep current batsman unchanged
  game.activeFielder = 'kimjong';
  gameBus.emit('FIELDER_SWAP', { from: 'ronaldo', to: 'kimjong', explosion: false });
  gameBus.emit('BONUS_BUY_REQUESTED', { betAmount: game.betAmount });
  await placeBet();
  gameBus.emit('BONUS_BUY_STARTED', { betAmount: game.betAmount });
}

// Re-export for convenience
export { GAME_MODES } from './stakeClient.js';
export type { GameModeName } from './stakeClient.js';
