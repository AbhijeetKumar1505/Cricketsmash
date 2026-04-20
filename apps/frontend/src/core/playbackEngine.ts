import { phaseLength } from '../engine/physics/ballTrajectory.js';
import type { Delivery } from './modeEngine.js';

export type VisualPhase = 'idle' | 'bowl' | 'hit' | 'wicket' | 'celebrate';

const GROWTH_RATE = 0.08; // slightly faster for multi-ball tension

export interface PlaybackState {
  phase: VisualPhase;
  multiplier: number;
  elapsedMs: number;
  phaseProgress: number;
  ballIndex: number;
}

export type PlaybackTickCallback = (state: PlaybackState) => void;
export type PlaybackCompleteCallback = (finalMultiplier: number) => void;

export interface PlaybackEngine {
  start(
    deliveries: Delivery[],
    onTick: PlaybackTickCallback,
    onComplete: PlaybackCompleteCallback,
  ): void;
  updateDeliveries(newDeliveries: Delivery[]): void;
  stop(): void;
  isRunning(): boolean;
}

export function createPlaybackEngine(): PlaybackEngine {
  let rafId: number | null = null;
  let running = false;
  let startTime = 0;
  let activeDeliveries: Delivery[] = [];
  
  // Internal timeline state
  let currentPhase: VisualPhase = 'idle';

  function getTimeForMultiplier(multiplier: number): number {
    if (multiplier <= 1) return 0;
    return Math.log(multiplier) / GROWTH_RATE;
  }

  return {
    start(deliveries, onTick, onComplete) {
      this.stop();
      if (deliveries.length === 0) return;

      activeDeliveries = [...deliveries];
      running = true;
      startTime = performance.now();
      
      let currentBallIdx = 0;
      let ballStartTime = startTime;

      const tick = (now: number) => {
        if (!running) return;

        const currentDelivery = activeDeliveries[currentBallIdx]!;
        const bowlDur = phaseLength('bowl', currentDelivery.bowlerType) * 1000;
        const revealDur = 1800;
        const celebrateDur = 2400;
        const wicketDur = 1800;

        const growth = currentDelivery.endMultiplier - currentDelivery.startMultiplier;
        const hitDur = growth > 0 ? Math.max(1200, getTimeForMultiplier(1 + growth) * 1000) : 600;

        const ballElapsed = now - ballStartTime;
        let progress = 0;
        let multiplier = currentDelivery.startMultiplier;

        if (ballElapsed < bowlDur) {
          currentPhase = 'bowl';
          progress = ballElapsed / bowlDur;
          multiplier = currentDelivery.startMultiplier;
        } 
        else if (ballElapsed < bowlDur + hitDur) {
          currentPhase = 'hit';
          const hitElapsed = ballElapsed - bowlDur;
          progress = hitElapsed / hitDur;
          const mDelta = Math.exp(GROWTH_RATE * (hitElapsed / 1000)) - 1;
          multiplier = Math.min(currentDelivery.endMultiplier, currentDelivery.startMultiplier + mDelta);
        }
        else {
          const outcome = currentDelivery.outcome;
          const resultElapsed = ballElapsed - (bowlDur + hitDur);

          if (outcome.kind === 'wicket') {
            if (resultElapsed < wicketDur) {
              currentPhase = 'wicket';
              progress = resultElapsed / wicketDur;
              multiplier = 0;
            } else {
              running = false;
              onTick({ phase: 'wicket', multiplier: 0, elapsedMs: now - startTime, phaseProgress: 1, ballIndex: currentBallIdx });
              onComplete(0);
              return;
            }
          } else {
            if (resultElapsed < revealDur + celebrateDur) {
              currentPhase = 'celebrate';
              progress = resultElapsed / (revealDur + celebrateDur);
              multiplier = currentDelivery.endMultiplier;
            } else {
              if (currentBallIdx < activeDeliveries.length - 1) {
                currentBallIdx++;
                ballStartTime = now;
              } else {
                running = false;
                onTick({ phase: 'celebrate', multiplier: currentDelivery.endMultiplier, elapsedMs: now - startTime, phaseProgress: 1, ballIndex: currentBallIdx });
                onComplete(currentDelivery.endMultiplier);
                return;
              }
            }
          }
        }

        onTick({
          phase: currentPhase,
          multiplier: Math.floor(multiplier * 100) / 100,
          elapsedMs: now - startTime,
          phaseProgress: progress,
          ballIndex: currentBallIdx
        });

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    },

    updateDeliveries(newDeliveries: Delivery[]) {
      // Hot-swapping future balls
      activeDeliveries = [...newDeliveries];
    },

    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      running = false;
    },

    isRunning() {
      return running;
    }
  };
}
