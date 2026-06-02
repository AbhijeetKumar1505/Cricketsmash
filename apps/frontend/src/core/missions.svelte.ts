/**
 * Cricket Crash — Daily Missions system.
 *
 * State + event hooks + persistence. Wired from `gameController.svelte.ts` via
 * `recordMissionEvent()` at the relevant lifecycle points (placeBet, cashout,
 * hit result, wicket). Persists to localStorage and resets daily at UTC midnight.
 */

const STORAGE_KEY = 'cricketcrash.missions.v1';

export interface MissionReward {
  type: 'credit';
  amount: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  reward: MissionReward;
  claimed: boolean;
  daily: boolean;
}

interface PersistedState {
  list: Mission[];
  lastResetDay: string;
}

/** Mission templates — fixed catalogue, daily reset (UTC). */
const MISSION_TEMPLATES: Mission[] = [
  {
    id: 'boundary_hunter',
    title: 'Boundary Hunter',
    description: 'Hit 5 fours this session.',
    target: 5,
    current: 0,
    reward: { type: 'credit', amount: 50 },
    claimed: false,
    daily: true,
  },
  {
    id: 'six_machine',
    title: 'Six Machine',
    description: 'Hit 3 sixes this session.',
    target: 3,
    current: 0,
    reward: { type: 'credit', amount: 75 },
    claimed: false,
    daily: true,
  },
  {
    id: 'crash_survivor',
    title: 'Crash Survivor',
    description: 'Reach a 10× multiplier without losing the wicket.',
    target: 3,
    current: 0,
    reward: { type: 'credit', amount: 100 },
    claimed: false,
    daily: true,
  },
  {
    id: 'cashout_king',
    title: 'Cashout King',
    description: 'Cash out above 3× five times.',
    target: 5,
    current: 0,
    reward: { type: 'credit', amount: 60 },
    claimed: false,
    daily: true,
  },
  {
    id: 'big_spender',
    title: 'Big Spender',
    description: 'Place 10 bets.',
    target: 10,
    current: 0,
    reward: { type: 'credit', amount: 40 },
    claimed: false,
    daily: true,
  },
];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function freshList(): Mission[] {
  return MISSION_TEMPLATES.map((m) => ({ ...m, current: 0, claimed: false }));
}

function load(): PersistedState {
  if (typeof localStorage === 'undefined') {
    return { list: freshList(), lastResetDay: todayUtc() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { list: freshList(), lastResetDay: todayUtc() };
    const parsed = JSON.parse(raw) as PersistedState;
    // Daily reset
    if (parsed.lastResetDay !== todayUtc()) {
      return { list: freshList(), lastResetDay: todayUtc() };
    }
    // Migrate: keep counters from persisted matching templates, drop unknown ids,
    // add new templates that weren't there before.
    const list = MISSION_TEMPLATES.map((tmpl) => {
      const prev = parsed.list.find((m) => m.id === tmpl.id);
      return prev
        ? { ...tmpl, current: prev.current, claimed: prev.claimed }
        : { ...tmpl };
    });
    return { list, lastResetDay: parsed.lastResetDay };
  } catch {
    return { list: freshList(), lastResetDay: todayUtc() };
  }
}

const initial = load();

export const missionsState = $state<PersistedState>({
  list: initial.list,
  lastResetDay: initial.lastResetDay,
});

/** Persist on any mutation. */
function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ list: missionsState.list, lastResetDay: missionsState.lastResetDay }),
    );
  } catch {
    /* quota — non-fatal */
  }
}

function increment(id: string, by = 1): void {
  const m = missionsState.list.find((x) => x.id === id);
  if (!m || m.claimed) return;
  m.current = Math.min(m.target, m.current + by);
  persist();
}

/**
 * Recorded by gameController at lifecycle points.
 */
export type MissionEvent =
  | { kind: 'bet' }
  | { kind: 'cashout';  multiplier: number }
  | { kind: 'hit';      runs: number; multiplier: number }
  | { kind: 'wicket' }
  | { kind: 'session_end'; peakMultiplier: number; wasWicket: boolean };

export function recordMissionEvent(event: MissionEvent): void {
  switch (event.kind) {
    case 'bet':
      increment('big_spender', 1);
      break;
    case 'hit':
      if (event.runs === 4) increment('boundary_hunter', 1);
      if (event.runs === 6) increment('six_machine', 1);
      break;
    case 'cashout':
      if (event.multiplier >= 3) increment('cashout_king', 1);
      break;
    case 'session_end':
      if (event.peakMultiplier >= 10 && !event.wasWicket) {
        increment('crash_survivor', 1);
      }
      break;
    case 'wicket':
      // No-op for now — crash_survivor uses session_end with wasWicket guard.
      break;
  }
}

/** Claim a completed mission's reward. Returns the credit amount granted (0 if not claimable). */
export function claimMission(id: string): number {
  const m = missionsState.list.find((x) => x.id === id);
  if (!m) return 0;
  if (m.claimed) return 0;
  if (m.current < m.target) return 0;
  m.claimed = true;
  persist();
  return m.reward.amount;
}

/** Count missions complete but not yet claimed — used by LeftPanel badge. */
export function unclaimedCompleteCount(): number {
  return missionsState.list.filter((m) => m.current >= m.target && !m.claimed).length;
}
