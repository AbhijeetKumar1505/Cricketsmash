import type { PlayerProfile } from './PlayerProfile.js';
import { DEFAULT_PROFILE } from './PlayerProfile.js';

/**
 * One profile per character in the game.
 * Stats are derived from in-game str/agi/timing values shown in the UI.
 *
 * Batsmen   — modi, trump, putin, adeft    (selectable in RightPanel)
 * Fielders  — ronaldo (fast), kimjong (slow)  (swapped on insurance/bonus-buy)
 * Bowler    — meloni                          (fixed, always bowls)
 *
 * In live Stake mode, powerIndex scales shotPower; consistIndex scales the
 * timing window. Outcome probabilities are server-controlled, so only these
 * two stats affect visual feel in live play. Dev-mode RNG uses all stats.
 */
export const PLAYER_ROSTER: Record<string, PlayerProfile> = {

  // ── Batsmen ─────────────────────────────────────────────────────────────────

  // TIER 1 | EASY | str:68 agi:72 timing:84 | "Calm & technical. Balanced timing."
  modi: {
    id: 'modi', name: 'Norindor Muddi', role: 'batsman', style: 'balanced',
    stats: { powerIndex: 0.85, defenseIndex: 1.30, runnerIndex: 1.15, consistIndex: 1.30, aggression: 0.70 },
  },

  // TIER 2 | HARD | str:92 agi:54 timing:72 | "Aggressive power shots. Huge sixes."
  trump: {
    id: 'trump', name: 'Don Trumph', role: 'batsman', style: 'aggressive',
    stats: { powerIndex: 1.70, defenseIndex: 0.70, runnerIndex: 0.70, consistIndex: 0.80, aggression: 1.50 },
  },

  // TIER 4 | MEDIUM | str:90 agi:92 timing:96 | "Cold precision. Ultra-fast reactions."
  putin: {
    id: 'putin', name: 'Vladmir Puton', role: 'batsman', style: 'finesse',
    stats: { powerIndex: 1.40, defenseIndex: 1.40, runnerIndex: 1.40, consistIndex: 1.50, aggression: 1.20 },
  },

  // GOD MODE | Elite all-rounder — no ceiling
  adeft: {
    id: 'adeft', name: 'ADEFT', role: 'batsman', style: 'legendary',
    stats: { powerIndex: 1.80, defenseIndex: 1.60, runnerIndex: 1.50, consistIndex: 1.50, aggression: 1.40 },
  },

  // ── Fielders ────────────────────────────────────────────────────────────────

  // Default fielder — quick and fast (speedScale 1.8 in StadiumScene)
  ronaldo: {
    id: 'ronaldo', name: 'Ronaldo', role: 'fielder', style: 'aggressive',
    stats: { powerIndex: 1.10, defenseIndex: 0.90, runnerIndex: 1.50, consistIndex: 0.95, aggression: 1.30 },
  },

  // Insurance/bonus-buy fielder — lazy and slow (speedScale 0.45 in StadiumScene)
  kimjong: {
    id: 'kimjong', name: 'Kim Jong', role: 'fielder', style: 'defensive',
    stats: { powerIndex: 0.80, defenseIndex: 1.20, runnerIndex: 0.50, consistIndex: 1.00, aggression: 0.50 },
  },

  // ── Bowler ──────────────────────────────────────────────────────────────────

  // str:74 agi:94 timing:84 | "Tactical elite squad. Synchronized."
  meloni: {
    id: 'meloni', name: 'Meloni', role: 'bowler', style: 'finesse',
    stats: { powerIndex: 1.00, defenseIndex: 1.10, runnerIndex: 1.30, consistIndex: 1.10, aggression: 1.10 },
  },

  default: DEFAULT_PROFILE,
};

export function getProfile(avatarId: string): PlayerProfile {
  return PLAYER_ROSTER[avatarId.toLowerCase()] ?? DEFAULT_PROFILE;
}
