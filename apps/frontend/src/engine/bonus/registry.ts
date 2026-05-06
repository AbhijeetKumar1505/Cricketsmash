import { BONUS_CONFIG } from './config.js';
import type { BonusDefinition, BonusType, BonusSkillZone } from './types.js';

export const BONUS_DEFINITIONS: Record<BonusType, BonusDefinition> = {
  plus1: {
    type: 'plus1',
    value: 1,
    rarityWeight: BONUS_CONFIG.rarityWeights.plus1,
    rarityTier: 'common',
    baseColor: 0xffd84e,
    emissiveColor: 0xfff2a0,
    radius: 0.34,
    hoverAmp: 0.16,
    spinSpeed: 0.55,
  },
  plus2: {
    type: 'plus2',
    value: 2,
    rarityWeight: BONUS_CONFIG.rarityWeights.plus2,
    rarityTier: 'rare',
    baseColor: 0x58d6ff,
    emissiveColor: 0xa6f1ff,
    radius: 0.38,
    hoverAmp: 0.2,
    spinSpeed: 0.72,
  },
  plus3: {
    type: 'plus3',
    value: 3,
    rarityWeight: BONUS_CONFIG.rarityWeights.plus3,
    rarityTier: 'epic',
    baseColor: 0xffc34d,
    emissiveColor: 0xffef9c,
    radius: 0.43,
    hoverAmp: 0.24,
    spinSpeed: 0.95,
  },
  multiplier: {
    type: 'multiplier',
    value: 2,
    rarityWeight: BONUS_CONFIG.rarityWeights.multiplier,
    rarityTier: 'legendary',
    baseColor: 0xff4f5f,
    emissiveColor: 0xff9ba3,
    radius: 0.46,
    hoverAmp: 0.26,
    spinSpeed: 1.1,
  },
};

export function pickWeightedBonusType(rng: () => number): BonusType {
  const entries = Object.values(BONUS_DEFINITIONS);
  const total = entries.reduce((acc, entry) => acc + entry.rarityWeight, 0);
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.rarityWeight;
    if (roll <= 0) return entry.type;
  }
  return entries[0]!.type;
}

export function pickWeightedZone(rng: () => number, zones: readonly BonusSkillZone[]): BonusSkillZone {
  const total = zones.reduce((acc, zone) => acc + zone.placementWeight, 0);
  let roll = rng() * total;
  for (const zone of zones) {
    roll -= zone.placementWeight;
    if (roll <= 0) return zone;
  }
  return zones[0]!;
}
