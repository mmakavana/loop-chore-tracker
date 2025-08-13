export type ID = string;

export type ScheduleType = 'daily' | 'weekly' | 'custom';

export interface ChoreSchedule {
  type: ScheduleType;
  daysOfWeek?: number[];   // 0..6 for Sun..Sat
  dates?: string[];        // ISO dates for custom
}

export interface Chore {
  id: ID;
  title: string;
  points: number;
  schedule: ChoreSchedule;
  kidIds: ID[];
  order?: number;
}

export interface Kid {
  id: ID;
  name: string;
  emoji?: string;
  points?: number;
}

export interface Completion {
  id: ID;
  kidId: ID;
  choreId: ID;
  dateISO: string;         // yyyy-mm-dd
  completed: boolean;
}

export interface AdjustmentLog {
  id: ID;
  kidId: ID;
  delta: number;
  reason?: string;
  timestampISO: string;    // Date.toISOString()
}

export interface BonusLog {
  id: ID;
  kidId: ID;
  dateISO: string;
  streakLength: number;
  points: number;
}

export interface Settings {
  hideCompletedOnBoard: boolean;
}

export interface State {
  kids: Kid[];
  chores: Chore[];
  completions: Completion[];
  adjustments: AdjustmentLog[];
  bonuses: BonusLog[];
  settings: Settings;
}


