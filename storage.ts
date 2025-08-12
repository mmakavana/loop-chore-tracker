import { State } from './types'

const KEY = 'skylight_kids_state_v2';

export function loadState(): State {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return {
      kids: [], chores: [], rewards: [], completions: [], payouts: [],
      settings: { dollarsPerPoint: 0.1, hideCompletedOnBoard: true },
      version: 2
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      version: 2,
      kids: [], chores: [], rewards: [], completions: [], payouts: [],
      settings: { dollarsPerPoint: 0.1, hideCompletedOnBoard: true },
      ...parsed
    };
  } catch {
    return {
      kids: [], chores: [], rewards: [], completions: [], payouts: [],
      settings: { dollarsPerPoint: 0.1, hideCompletedOnBoard: true },
      version: 2
    };
  }
}

export function saveState(s: State) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
