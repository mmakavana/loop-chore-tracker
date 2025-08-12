export type Kid = {
  id: string;
  name: string;
  color?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  points: number;
};

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekly'; daysOfWeek: number[] }
  | { type: 'custom'; dates: string[] };

export type Chore = {
  id: string;
  title: string;
  points: number;
  schedule: Schedule;
  assignedKidIds: string[];
  streakByKid?: Record<string, number>;
  order?: number;
};

export type Reward = { id: string; title: string; cost: number };

export type Completion = {
  id: string;
  choreId: string;
  kidId: string;
  date: string;       // 'YYYY-MM-DD'
  completed: boolean;
};

export type Payout = {
  id: string;
  kidId: string;
  period: 'weekly' | 'monthly';
  startISO: string;
  endISO: string;
  points: number;
  dollars: number;
  timestampISO: string;
  note?: string;
};

/** Manual add/deduct with a reason */
export type Adjustment = {
  id: string;
  kidId: string;
  delta: number;          // positive or negative
  reason: string;
  timestampISO: string;
};

/** Auto bonus awarded when a 10-day (or 20, 30…) streak is hit */
export type StreakBonus = {
  id: string;
  kidId: string;
  dateISO: string;        // the day the milestone was achieved
  streakLength: number;   // 10, 20, 30...
  points: number;         // typically 5
};

export type Settings = {
  dollarsPerPoint: number;
  hideCompletedOnBoard: boolean;
};

export type State = {
  kids: Kid[];
  chores: Chore[];
  rewards: Reward[];
  completions: Completion[];
  payouts: Payout[];
  /** NEW: logs */
  adjustments: Adjustment[];
  streakBonuses: StreakBonus[];
  settings: Settings;
  version: number;
};
