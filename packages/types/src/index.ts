/** Cricket Crash — shared domain types (Stake RGS mode only) */

export type GameMode = 'stake';

export type CricketPhase =
  | 'waiting'
  | 'locked'
  | 'bowling'
  | 'hitting'
  | 'result'
  | 'wicket'
  | 'end';

export type CricketRuns = 0 | 1 | 2 | 3 | 4 | 6;

export type CricketOutcome =
  | { kind: 'runs'; runs: CricketRuns; multiplier: number }
  | { kind: 'wicket'; multiplier: 0 };

export interface FairnessVerifyPayload {
  server_seed: string;
  client_seed: string;
  nonce: number;
  server_seed_hash: string;
  /** Required for outcome re-derivation in full verification */
  spin_modifier?: boolean;
}

/** Leaderboard entry (local history only in Stake mode) */
export interface LeaderEntry {
  rank: number;
  userId: string;
  username: string;
  profit: number;
  totalBets: number;
}

/** Recent round record (local history) */
export interface RoundRecord {
  roundId: string;
  outcomeKind: 'wicket' | 'runs';
  crashMultiplier: number;
  playerCount: number;
  endedAt: string;
  bowlerType: string;
}
