import { describe, expect, it } from 'bun:test';
import {
  ownerDayKey,
  ownerWeek,
  practiceStreak,
  weekLength,
} from './practice-days';

const timeZone = 'Europe/Berlin';
// 22:30 UTC is already the next calendar day in Berlin.
const lateEvening = new Date('2026-09-20T22:30:00Z');

describe('ownerDayKey', () => {
  it('buckets by the owner day, not the UTC day', () => {
    expect(ownerDayKey(lateEvening, timeZone)).toBe('2026-09-21');
    expect(ownerDayKey(lateEvening, 'UTC')).toBe('2026-09-20');
  });
});

describe('ownerWeek', () => {
  it('ends today and marks practiced days', () => {
    const week = ownerWeek(lateEvening, timeZone, new Set(['2026-09-19']));
    expect(week).toHaveLength(weekLength);
    expect(week[0]).toEqual({
      day: '2026-09-15',
      weekday: 2,
      practiced: false,
    });
    expect(week.at(-1)).toEqual({
      day: '2026-09-21',
      weekday: 1,
      practiced: false,
    });
    expect(week.filter((day) => day.practiced).map((day) => day.day)).toEqual([
      '2026-09-19',
    ]);
  });
});

describe('practiceStreak', () => {
  it('counts consecutive days ending today', () => {
    const run = ['2026-09-21', '2026-09-20', '2026-09-19'];
    expect(
      practiceStreak(lateEvening, timeZone, new Set([...run, '2026-09-17'])),
    ).toBe(run.length);
  });

  it('keeps yesterday’s streak alive before today’s practice', () => {
    const run = ['2026-09-20', '2026-09-19'];
    expect(practiceStreak(lateEvening, timeZone, new Set(run))).toBe(
      run.length,
    );
  });

  it('is zero after a missed day', () => {
    expect(practiceStreak(lateEvening, timeZone, new Set(['2026-09-19']))).toBe(
      0,
    );
    expect(practiceStreak(lateEvening, timeZone, new Set())).toBe(0);
  });
});
