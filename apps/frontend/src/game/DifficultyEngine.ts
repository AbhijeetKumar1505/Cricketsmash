import type { PlayerId } from './CharacterManager.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard' | 'god' | 'bonus';

export interface DifficultyConfig {
  label: string;
  batsman: PlayerId;
  /** Outcome weight table: outcome key → relative weight (summed for RNG) */
  weights: Record<string, number>;
  /** Multiplier variance amplifier (1 = default, >1 = spikier) */
  variance: number;
  /** Miss probability 0–1 */
  missProbability: number;
  /** Description shown in the difficulty selector */
  description: string;
}

// ── Difficulty configs ────────────────────────────────────────────────────────

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    batsman: 'modi',
    description: 'Low volatility. Consistent returns, rare big hits.',
    variance: 0.7,
    missProbability: 0.08,
    weights: {
      '0.8':  8,
      '1.0': 20,
      '1.5': 18,
      '2.0': 16,
      '3.0': 14,
      '5.0':  8,
      '10.0': 4,
      '25.0': 2,
    },
  },

  medium: {
    label: 'Medium',
    batsman: 'putin',
    description: 'Default balance. Good mix of outcomes.',
    variance: 1.0,
    missProbability: 0.14,
    weights: {
      '0.8': 10,
      '1.0': 15,
      '1.5': 15,
      '2.0': 14,
      '3.0': 12,
      '5.0':  8,
      '10.0': 4,
      '25.0': 2,
    },
  },

  hard: {
    label: 'Hard',
    batsman: 'trump',
    description: 'Higher variance. More misses, but bigger spikes.',
    variance: 1.4,
    missProbability: 0.22,
    weights: {
      '0.8': 14,
      '1.0': 12,
      '1.5': 10,
      '2.0': 10,
      '3.0': 10,
      '5.0':  9,
      '10.0': 6,
      '25.0': 4,
      '100.0':1,
    },
  },

  god: {
    label: 'God Mode',
    batsman: 'adeft',
    description: 'Binary fate: either a massive SIX or a wicket. No in-between.',
    variance: 2.2,
    missProbability: 0.72,
    weights: {
      '0.8': 18,
      '1.0':  8,
      '1.5':  7,
      '2.0':  7,
      '3.0':  7,
      '5.0':  8,
      '10.0': 8,
      '25.0': 6,
      '100.0':4,
      '500.0':1,
    },
  },

  bonus: {
    label: 'Bonus Buy',
    batsman: 'putin',
    description: 'Premium 6-ball over with special reward table.',
    variance: 1.6,
    missProbability: 0.05,
    weights: {
      '1.0':  5,
      '1.5': 10,
      '2.0': 15,
      '3.0': 15,
      '5.0': 12,
      '10.0':10,
      '25.0': 8,
      '100.0':5,
    },
  },
};

// ── Public helpers ────────────────────────────────────────────────────────────

export function getBatsmanForDifficulty(diff: Difficulty): PlayerId {
  return DIFFICULTY_CONFIGS[diff].batsman;
}

export function getFielderForInsurance(insuranceActive: boolean): PlayerId {
  return insuranceActive ? 'kimjong' : 'ronaldo';
}

/** Weighted random sample from the difficulty's outcome table. */
export function sampleOutcome(diff: Difficulty, rng: () => number): number {
  const weights = DIFFICULTY_CONFIGS[diff].weights;
  const keys = Object.keys(weights).map(Number);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[String(keys[i])];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

export class DifficultyEngine {
  private _difficulty: Difficulty = 'medium';

  setDifficulty(d: Difficulty): void {
    this._difficulty = d;
  }

  getDifficulty(): Difficulty { return this._difficulty; }
  getConfig(): DifficultyConfig { return DIFFICULTY_CONFIGS[this._difficulty]; }
  getBatsman(): PlayerId { return getBatsmanForDifficulty(this._difficulty); }

  isMiss(rng: () => number): boolean {
    return rng() < this.getConfig().missProbability;
  }

  sampleOutcome(rng = Math.random): number {
    return sampleOutcome(this._difficulty, rng);
  }
}

export const difficultyEngine = new DifficultyEngine();
