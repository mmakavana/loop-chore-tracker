import {
  eachDayOfInterval, endOfMonth, format, isWithinInterval,
  startOfMonth, startOfWeek, endOfWeek
} from 'date-fns'
import { Chore, Schedule, Completion } from './types'

export const toISO = (d: Date) => format(d, 'yyyy-MM-dd');

export function isChoreDueOn(chore: Chore, dateISO: string) {
  const d = new Date(dateISO);
  const dow = d.getDay();
  const s: Schedule = chore.schedule;
  if (s.type === 'daily') return true;
  if (s.type === 'weekly') return s.daysOfWeek.includes(dow);
  if (s.type === 'custom') return s.dates.includes(dateISO);
  return false;
}

export function monthDays(year: number, monthIndex0: number) {
  const start = startOfMonth(new Date(year, monthIndex0, 1));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end });
}

export function prevMonth(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1);
  d.setMonth(d.getMonth() - 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

export function nextMonth(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1);
  d.setMonth(d.getMonth() + 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

export function weekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return { startISO: toISO(start), endISO: toISO(end) };
}

export function monthRange(date: Date) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { startISO: toISO(start), endISO: toISO(end) };
}

export function sumPoints(
  completions: Completion[], kidId: string,
  startISO: string, endISO: string, allChores: Chore[]
) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const set = completions.filter(c => c.kidId === kidId && c.completed);
  let sum = 0;
  for (const c of set) {
    const d = new Date(c.date);
    if (isWithinInterval(d, { start, end })) {
      const ch = allChores.find(x => x.id === c.choreId);
      if (ch) sum += ch.points;
    }
  }
  return sum;
}
