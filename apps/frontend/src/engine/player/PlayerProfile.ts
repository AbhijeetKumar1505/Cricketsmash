export interface PlayerStats {
  /** 0.5–1.8: scales six/four probability in dev mode; scales shotPower in all modes. */
  powerIndex:   number;
  /** 0.5–1.8: wicket resistance — higher = fewer wickets in dev mode RNG. */
  defenseIndex: number;
  /** 0.5–1.5: scales 1/2/3 run probability in dev mode; also reflects field speed for fielders. */
  runnerIndex:  number;
  /** 0.7–1.5: timing window multiplier — affects perfect/good window width. */
  consistIndex: number;
  /** 0.5–1.5: biases shot-type toward pull/cut/loft vs defend in deriveShotType. */
  aggression:   number;
}

export interface PlayerProfile {
  id:    string;
  name:  string;
  role:  'batsman' | 'fielder' | 'bowler';
  style: 'aggressive' | 'balanced' | 'defensive' | 'finesse' | 'legendary';
  stats: PlayerStats;
}

export const DEFAULT_PROFILE: PlayerProfile = {
  id:    'default',
  name:  'Default',
  role:  'batsman',
  style: 'balanced',
  stats: { powerIndex: 1.0, defenseIndex: 1.0, runnerIndex: 1.0, consistIndex: 1.0, aggression: 1.0 },
};
