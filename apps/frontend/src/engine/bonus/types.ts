import type { BonusPropVisual, BonusSkillZone } from '../worldLayout.js';

export type { BonusSkillZone };

export type BonusType = 'plus1' | 'plus2' | 'plus3' | 'multiplier';
export type BonusZone = 'ground' | 'stands' | 'boundary';
export type BonusRarityTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface BonusDefinition {
  readonly type: BonusType;
  readonly value: number;
  readonly rarityWeight: number;
  readonly rarityTier: BonusRarityTier;
  readonly baseColor: number;
  readonly emissiveColor: number;
  readonly radius: number;
  readonly hoverAmp: number;
  readonly spinSpeed: number;
}

export interface BonusSpawnPolicy {
  readonly spawnChancePerDelivery: number;
  readonly maxActive: number;
  readonly cooldownBalls: number;
}

export interface BonusRoamContext {
  readonly fielders: ReadonlyArray<{ x: number; z: number }>;
  readonly bowlerX: number;
  readonly bowlerZ: number;
  readonly batsmanX: number;
  readonly batsmanZ: number;
  /** Optional active moving bonuses (for rover/spider self-separation). */
  readonly movingBonuses?: ReadonlyArray<{ id: string; x: number; z: number; r: number }>;
}

export interface BonusSnapshot {
  readonly id: string;
  readonly type: BonusType;
  readonly rarityTier: BonusRarityTier;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Collision / UI scale hint (may exceed mesh core for sky targets). */
  readonly radius: number;
  readonly extraBalls: number;
  readonly zone: BonusZone;
  readonly visual: BonusPropVisual;
  readonly intensity: number;
  readonly vx: number;
  readonly vz: number;
}

export interface BonusHitPayload {
  readonly sourceId: string;
  readonly type: BonusType;
  readonly rarityTier: BonusRarityTier;
  readonly zone: BonusZone;
  readonly extraBalls: number;
  /** >1 multiplies session payout preview (`game.bonusProfitMultProduct`). */
  readonly profitMult: number;
  readonly worldPos: { x: number; y: number; z: number };
}
