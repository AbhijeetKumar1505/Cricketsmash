import { BALL } from '../constants.js';
import { BONUS_CONFIG } from '../bonus/config.js';
import { BonusObject } from '../bonus/BonusObject.js';
import { BONUS_DEFINITIONS, pickWeightedZone } from '../bonus/registry.js';
import type {
  BonusHitPayload,
  BonusRoamContext,
  BonusSkillZone,
  BonusSnapshot,
  BonusType,
} from '../bonus/types.js';

export interface BonusSpawnContext {
  readonly ballNumber: number;
  readonly canSpawn: boolean;
}

export class BonusSystem {
  private readonly _zones: readonly BonusSkillZone[];
  private readonly _active: BonusObject[] = [];
  private _worldElapsed = 0;
  private _idCounter = 0;

  constructor(zones: readonly BonusSkillZone[]) {
    this._zones = zones;
    this._seedPersistentBonuses();
  }

  update(dt: number, roam: BonusRoamContext, rng: () => number): void {
    this._worldElapsed += dt;
    for (const bonus of this._active) {
      const movingBonuses = this._active
        .filter((b) => b !== bonus && b.zone.role === 'movingMult')
        .map((b) => ({
          id: b.id,
          x: b.toSnapshot().x,
          z: b.toSnapshot().z,
          r: b.collisionRadius,
        }));
      bonus.update(dt, this._worldElapsed, { ...roam, movingBonuses }, rng);
    }
    this.despawnExpired(this._worldElapsed);
  }

  spawnBonus(context: BonusSpawnContext, rng: () => number): BonusObject | null {
    if (!context.canSpawn) return null;
    this._seedPersistentBonuses();
    const zone = pickWeightedZone(rng, this._zones);
    return this._active.find((b) => b.zone.id === zone.id) ?? this._active[0] ?? null;
  }

  despawnExpired(now: number): void {
    void now;
    // Intentionally no-op: bonus props are persistent stadium elements.
  }

  checkCollision(ball: { x: number; y: number; z: number }): BonusHitPayload | null {
    for (const bonus of this._active) {
      if (!bonus.isColliding(ball, BALL.RADIUS, BONUS_CONFIG.collisionPadding)) continue;
      bonus.markHit();
      const extraBalls =
        bonus.zone.role === 'ballAdder' ? (bonus.zone.ballAdderAmount ?? bonus.def.value) : 0;
      let profitMult = 1;
      if (bonus.zone.role === 'profitMult' || bonus.zone.role === 'movingMult') {
        profitMult = bonus.profitMultBoost;
      }
      return {
        sourceId: bonus.id,
        type: bonus.def.type,
        rarityTier: bonus.def.rarityTier,
        zone: bonus.zone.zone,
        extraBalls,
        profitMult,
        worldPos: { x: ball.x, y: ball.y, z: ball.z },
      };
    }
    return null;
  }

  getActive(): readonly BonusSnapshot[] {
    return this._active.map((bonus) => bonus.toSnapshot());
  }

  clear(): void {
    // Keep props permanently visible across rounds.
  }

  private _seedPersistentBonuses(): void {
    if (this._active.length > 0) return;
    for (let i = 0; i < this._zones.length; i++) {
      const zone = this._zones[i]!;
      const type = pickBonusType(zone);
      const def = BONUS_DEFINITIONS[type];
      const profitBoost =
        zone.role === 'profitMult'
          ? 10 + zoneHash(zone.id + '|profit') % 26
          : zone.role === 'movingMult'
            ? 1.12 + (zoneHash(zone.id + '|mv') % 19) / 10
            : 1;
      this._idCounter += 1;
      this._active.push(
        new BonusObject(
          `bonus_${zone.id}_${this._idCounter}`,
          def,
          zone,
          this._worldElapsed,
          i * 0.6,
          profitBoost,
        ),
      );
    }
  }
}

function zoneHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickBonusType(zone: BonusSkillZone): BonusType {
  if (zone.role === 'ballAdder') {
    const a = zone.ballAdderAmount ?? 2;
    if (a === 1) return 'plus1';
    if (a === 3) return 'plus3';
    return 'plus2';
  }
  if (zone.role === 'profitMult') return 'multiplier';
  return zone.visual === 'spider' ? 'plus2' : 'multiplier';
}
