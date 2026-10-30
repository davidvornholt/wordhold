import { describe, expect, it } from 'bun:test';
import { calendarDay, formatShortDate } from './zoned-format';

// 00:30 on 25 August in Berlin (UTC+2), but still 22:30 on the 24th in UTC.
const justAfterMidnight = new Date('2026-08-24T22:30:00Z');

describe('formatShortDate', () => {
  it('writes the calendar day of the given zone', () => {
    expect(formatShortDate(justAfterMidnight, 'Europe/Berlin')).toBe(
      '25.8.2026',
    );
    expect(formatShortDate(justAfterMidnight, 'America/New_York')).toBe(
      '24.8.2026',
    );
  });
});

describe('calendarDay', () => {
  it('tells days apart at the zone’s midnight, not at UTC’s', () => {
    const lateEvening = new Date('2026-08-24T21:30:00Z');

    expect(
      calendarDay(justAfterMidnight, 'Europe/Berlin') -
        calendarDay(lateEvening, 'Europe/Berlin'),
    ).toBe(1);
    expect(
      calendarDay(justAfterMidnight, 'UTC') - calendarDay(lateEvening, 'UTC'),
    ).toBe(0);
  });
});
