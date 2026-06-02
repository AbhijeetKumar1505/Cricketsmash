/**
 * Camera-relative sky placement uses the fixed broadcast camera world position
 * (matches `render/Camera.ts` PRESETS.broadcast).
 */
import type { SkyObjectType } from './types.js';
import { GAME_MODES, type GameModeName } from '../../core/stakeClient.js';
import {
  multiplierForSkyType,
  profileForMode,
  weightedPickSkyType,
} from '@cricket-crash/fairness';

/** Matches `Camera.ts` broadcast preset (camera world position). */
export const SKY_CAMERA_WORLD = { x: 0, y: 4.72, z: 13 } as const;

export const SKY_OBJECT_CHANCE_BONUS_BUY = profileForMode(GAME_MODES.POWERPLAY).sky.chance;

/**
 * Visual sky objects should be seen regularly in normal gameplay.
 * These are display/cinematic frequencies and can be higher than payout-impact rates.
 */
export const SKY_OBJECT_VISUAL_CHANCE_STANDARD = 0.18;
export const SKY_OBJECT_VISUAL_CHANCE_BONUS_BUY = 0.24;

export function skyObjectChanceForMode(mode: GameModeName): number {
  return profileForMode(mode).sky.chance;
}

export function skyObjectVisualChanceForMode(mode: GameModeName): number {
  return mode === GAME_MODES.POWERPLAY
    ? SKY_OBJECT_VISUAL_CHANCE_BONUS_BUY
    : SKY_OBJECT_VISUAL_CHANCE_STANDARD;
}

/** Ballistic time-of-flight for redirect impulse (seconds). */
export const SKY_FLIGHT_TIME = 1.4;

export { multiplierForSkyType, weightedPickSkyType };

export function spawnWorldPosition(type: SkyObjectType, rng: () => number): { x: number; y: number; z: number } {
  const base = SKY_CAMERA_WORLD;
  switch (type) {
    case 'JETPACK':
      return {
        x: base.x + (rng() * 6 - 3),
        y: base.y + 6,
        z: base.z - 18,
      };
    case 'SMALL_PLANE':
      return {
        x: base.x + (rng() < 0.5 ? -8 : 8) + (rng() * 2 - 1),
        y: base.y + 9,
        z: base.z - 28,
      };
    case 'BIG_PLANE':
      return {
        x: base.x + (rng() * 2 - 1),
        y: base.y + 13,
        z: base.z - 38,
      };
    default:
      return { x: base.x, y: base.y + 6, z: base.z - 18 };
  }
}

export function velocityForSkyType(type: SkyObjectType): { x: number; y: number; z: number } {
  switch (type) {
    case 'JETPACK':
      return { x: 0, y: 0.2, z: 0 };
    case 'SMALL_PLANE':
      return { x: -3.5, y: 0, z: 0 };
    case 'BIG_PLANE':
      return { x: -1.6, y: 0, z: 0 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

export const SKY_HIT_RADIUS = 3.2;
