import { DateTime } from 'effect';
import type { PracticeDay } from '../schemas/dashboard-models';

// Calendar days are the owner's local days: the same review counts for the
// same day on the dashboard whether it happened at 00:30 or 23:30.
const ownerDay = (at: Date, timeZone: string) =>
  DateTime.startOf(DateTime.unsafeMakeZoned(at, { timeZone }), 'day');

export const ownerDayKey = (at: Date, timeZone: string): string =>
  DateTime.formatIsoDate(ownerDay(at, timeZone));

export const weekLength = 7;

// The last seven owner days ending today, oldest first.
export const ownerWeek = (
  now: Date,
  timeZone: string,
  practicedDays: ReadonlySet<string>,
): ReadonlyArray<PracticeDay> => {
  const today = ownerDay(now, timeZone);
  return Array.from({ length: weekLength }, (_, index) => {
    const day = DateTime.subtract(today, { days: weekLength - 1 - index });
    const key = DateTime.formatIsoDate(day);
    return {
      day: key,
      weekday: DateTime.toParts(day).weekDay,
      practiced: practicedDays.has(key),
    };
  });
};

// Consecutive practiced days ending today. A day without practice yet keeps
// yesterday's streak alive until midnight, so the number never drops during
// the day it is meant to motivate.
export const practiceStreak = (
  now: Date,
  timeZone: string,
  practicedDays: ReadonlySet<string>,
): number => {
  const today = ownerDay(now, timeZone);
  let offset = practicedDays.has(DateTime.formatIsoDate(today)) ? 0 : 1;
  let streak = 0;
  while (
    practicedDays.has(
      DateTime.formatIsoDate(DateTime.subtract(today, { days: offset })),
    )
  ) {
    streak += 1;
    offset += 1;
  }
  return streak;
};
