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

// ── Skill-based branching outcome sampler (mock/local only) ─────────────────────
//
// Two-level joint-probability model that replaces the flat economic-profile RNG:
//   Level 1 — score gate:  P(score) = SCORE_RATE, else no-score.
//   Level 2a — no-score:   dot (DOT_SHARE) vs wicket. God mode has no dots
//              (6-or-wicket), so its no-score is always a wicket.
//   Level 2b — score:      per-skill run distribution → the run's payout multiplier.
//
// The returned value is the round `payoutMultiplier`. It decomposes back to the
// matching runs via `runsFromMultiplier`, so payout (money) and the visual runs
// stay consistent. All constants below are the tuning knobs.

/** P(score) on any ball. Remaining probability is a no-score. */
export const SCORE_RATE = 0.20;
/** Enhanced score rate for a bonus-buy round. */
export const BONUS_SCORE_RATE = 0.35;
/** Within a no-score: P(dot) vs P(wicket) = 1 - DOT_SHARE. */
export const DOT_SHARE = 0.60;
/** Dot payout — near-push; decomposes to a defended 0-run ball (returns ~90%). */
export const DOT_MULT = 0.9;

/** Run → payout multiplier (decodes back to the same run via runsFromMultiplier). */
const RUN_MULT: Record<number, number> = { 1: 1.1, 2: 1.5, 3: 1.8, 4: 3.0, 6: 4.5 };

/**
 * Per-skill run distribution WITHIN the score branch (weights, not normalised).
 * modi low → putin mid → trump high → adeft six-only. `bonus` is a richer table
 * used on bonus-buy rounds regardless of batsman.
 */
const SKILL_SCORE_WEIGHTS: Record<Difficulty, Record<number, number>> = {
  easy:   { 1: 0.45, 2: 0.30, 3: 0.15, 4: 0.08, 6: 0.02 }, // E≈1.55 → RTP≈0.74
  medium: { 1: 0.20, 2: 0.30, 3: 0.25, 4: 0.18, 6: 0.07 }, // E≈2.13 → RTP≈0.86
  hard:   { 2: 0.20, 3: 0.30, 4: 0.35, 6: 0.15 },          // E≈2.57 → RTP≈0.95
  god:    { 6: 1.0 },                                       // six only → RTP≈0.90
  bonus:  { 2: 0.18, 3: 0.24, 4: 0.34, 6: 0.24 },          // richer bonus table
};

function pickRunFromWeights(weights: Record<number, number>, rng: () => number): number {
  const entries = Object.entries(weights).map(([k, w]) => [Number(k), w] as const);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [run, w] of entries) {
    r -= w;
    if (r <= 0) return run;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Sample a round `payoutMultiplier` from the skill-based branching model.
 * `bonus` raises the score rate and uses the richer bonus table.
 */
export function samplePayoutMultiplier(diff: Difficulty, rng: () => number, bonus = false): number {
  const scoreRate = bonus ? BONUS_SCORE_RATE : SCORE_RATE;

  // Level 1 — score gate.
  if (rng() >= scoreRate) {
    // No-score branch.
    if (diff === 'god') return 0;                 // 6-or-wicket: no dots
    return rng() < DOT_SHARE ? DOT_MULT : 0;      // dot (0.9×) or wicket (0)
  }

  // Score branch — skill-shaped run → its multiplier.
  const weights = bonus ? SKILL_SCORE_WEIGHTS.bonus : (SKILL_SCORE_WEIGHTS[diff] ?? SKILL_SCORE_WEIGHTS.medium);
  const run = pickRunFromWeights(weights, rng);
  return RUN_MULT[run] ?? 1.1;
}

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
  /** One-shot flag: the next sampled ball is a bonus-buy round. */
  private _bonusRound = false;

  setDifficulty(d: Difficulty): void {
    this._difficulty = d;
  }

  getDifficulty(): Difficulty { return this._difficulty; }
  getConfig(): DifficultyConfig { return DIFFICULTY_CONFIGS[this._difficulty]; }
  getBatsman(): PlayerId { return getBatsmanForDifficulty(this._difficulty); }

  /** Arm the next `samplePayoutMultiplier()` to use the enhanced bonus branch. */
  armBonusRound(): void { this._bonusRound = true; }

  isMiss(rng: () => number): boolean {
    return rng() < this.getConfig().missProbability;
  }

  sampleOutcome(rng = Math.random): number {
    return sampleOutcome(this._difficulty, rng);
  }

  /** Sample a round payoutMultiplier for the current difficulty (consumes bonus flag). */
  samplePayoutMultiplier(rng: () => number = Math.random): number {
    const bonus = this._bonusRound;
    this._bonusRound = false;
    return samplePayoutMultiplier(this._difficulty, rng, bonus);
  }
}

export const difficultyEngine = new DifficultyEngine();
