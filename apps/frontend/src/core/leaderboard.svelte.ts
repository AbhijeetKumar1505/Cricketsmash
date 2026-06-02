/**
 * Cricket Crash — Leaderboard system.
 *
 * Mocked competitive standings (no backend). Generates a deterministic, plausible
 * board per-day from a name pool; user's actual win history is persisted to
 * localStorage and spliced into each tab at the correct rank.
 */

const HISTORY_KEY = 'cricketcrash.history.v1';

export interface Win {
  ts:     number;
  mult:   number;
  payout: number;
  bet:    number;
}

export interface Entry {
  rank:   number;
  name:   string;
  mult:   number;
  payout: number;
  isYou:  boolean;
}

export type LeaderTab = 'today' | 'week' | 'alltime';

const NAMES = [
  'CricKing', 'BoundaryBoss', 'SixHunter', 'StakeMaster', 'NeonBet',
  'GoldenWilly', 'CrashRoyale', 'PitchPirate', 'ApexBatsman', 'ChromeChaser',
  'VortexVanya', 'NightOwl', 'AceOfRuns', 'StumpedYou', 'WickedKnight',
  'CashCricket', 'BronzePip', 'PlatinumOver', 'Yorker99', 'SilverSlog',
  'BlitzBaron', 'EchoStriker', 'LooseCannon', 'PrimeTime', 'KineticKing',
  'SonicSlam', 'PhantomFour', 'BlackGold', 'Helix7', 'CinderSix',
  'OrbitOver', 'PulseRider', 'NovaBat', 'EmberSweep', 'QuasarPlay',
  'TurboTate', 'VividHit', 'ZenithZoe', 'RogueRoller', 'GammaGrid',
  'NebulaNick', 'AstralAce', 'CometCash', 'FrostByte', 'KryptoKai',
  'LunarLane', 'MagnetMo', 'PhoenixP', 'StellarSam', 'TitanTom',
];

/* ── Deterministic per-tab seed/PRNG ────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(suffix: string): number {
  const today = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  const s = `${today}|${suffix}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function generateBoard(tab: LeaderTab, count = 30): Entry[] {
  const rng = mulberry32(dateSeed(`${tab}-${leaderboardState.refreshKey}`));

  // Log-uniform multiplier distribution, shifted up per scope.
  const range = tab === 'today'   ? { min: 2,   max: 120 }
              : tab === 'week'    ? { min: 5,   max: 300 }
              :                     { min: 12,  max: 850 };

  const board: Entry[] = [];
  const pickedIdx = new Set<number>();
  for (let i = 0; i < count; i++) {
    // pick unique name
    let nameIdx = Math.floor(rng() * NAMES.length);
    let tries = 0;
    while (pickedIdx.has(nameIdx) && tries < 20) {
      nameIdx = (nameIdx + 1) % NAMES.length;
      tries++;
    }
    pickedIdx.add(nameIdx);

    // log-distributed multiplier
    const u = rng();
    const mult = Math.exp(Math.log(range.min) + u * (Math.log(range.max) - Math.log(range.min)));

    // payout = mult × plausible bet
    const bet = 1 + Math.floor(rng() * 999);
    const payout = Math.round(mult * bet * 100) / 100;

    board.push({ rank: 0, name: NAMES[nameIdx]!, mult: Math.round(mult * 100) / 100, payout, isYou: false });
  }

  // Sort by mult desc, assign ranks
  board.sort((a, b) => b.mult - a.mult);
  board.forEach((e, i) => (e.rank = i + 1));
  return board;
}

/* ── Persistence ────────────────────────────────────────────────────────── */

function loadHistory(): Win[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Win[];
    return Array.isArray(parsed) ? parsed.slice(-500) : [];
  } catch {
    return [];
  }
}

function persistHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    // Cap at 500 most recent
    const trimmed = leaderboardState.history.slice(-500);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — non-fatal */
  }
}

/* ── State ──────────────────────────────────────────────────────────────── */

export const leaderboardState = $state({
  history: loadHistory(),
  tab: 'today' as LeaderTab,
  refreshKey: 0,
});

/* ── Best-mult helpers ──────────────────────────────────────────────────── */

const MS_PER_DAY = 86_400_000;

function bestUserMult(tab: LeaderTab): { mult: number; payout: number; bet: number } | null {
  const now = Date.now();
  const cutoff = tab === 'today' ? now - MS_PER_DAY
              : tab === 'week'  ? now - 7 * MS_PER_DAY
              :                   0;
  let best: Win | null = null;
  for (const w of leaderboardState.history) {
    if (w.ts < cutoff) continue;
    if (!best || w.mult > best.mult) best = w;
  }
  return best ? { mult: best.mult, payout: best.payout, bet: best.bet } : null;
}

/**
 * Get a tab's board with user's "YOU" row spliced in at the right rank.
 * Called from the overlay (derived).
 */
export function boardWithYou(tab: LeaderTab): Entry[] {
  // refreshKey forces recomputation on manual refresh
  void leaderboardState.refreshKey;
  const board = generateBoard(tab);
  const you = bestUserMult(tab);
  if (!you) return board.slice(0, 10);

  const youEntry: Entry = {
    rank: 0,
    name: 'YOU',
    mult: Math.round(you.mult * 100) / 100,
    payout: Math.round(you.payout * 100) / 100,
    isYou: true,
  };

  // Insert by mult position; cap visible to 10 rows but always include YOU.
  const merged = [...board, youEntry].sort((a, b) => b.mult - a.mult);
  merged.forEach((e, i) => (e.rank = i + 1));

  const youIdx = merged.findIndex((e) => e.isYou);
  if (youIdx < 10) return merged.slice(0, 10);

  // YOU is outside top 10 — show top 9 + YOU at the bottom
  return [...merged.slice(0, 9), merged[youIdx]!];
}

/* ── Recording wins ─────────────────────────────────────────────────────── */

export function recordWin(mult: number, payout: number, bet: number): void {
  if (mult <= 0 || payout <= 0) return;
  leaderboardState.history.push({ ts: Date.now(), mult, payout, bet });
  persistHistory();
}

/** Re-roll mock board entries (user history stays). */
export function refreshLeaderboard(): void {
  leaderboardState.refreshKey++;
}
