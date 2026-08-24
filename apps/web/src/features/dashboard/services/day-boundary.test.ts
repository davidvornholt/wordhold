import { describe, expect, it } from 'bun:test';
import { ownerDayBounds } from './day-boundary';

const millisecondsPerHour = 3_600_000;
const springDayHours = 23;
const autumnDayHours = 25;

describe('ownerDayBounds', () => {
  it('converts a Europe/Berlin winter day to UTC bounds', () => {
    const bounds = ownerDayBounds(
      new Date('2026-01-15T12:00:00.000Z'),
      'Europe/Berlin',
    );

    expect(bounds.startInclusive.toISOString()).toBe(
      '2026-01-14T23:00:00.000Z',
    );
    expect(bounds.endExclusive.toISOString()).toBe('2026-01-15T23:00:00.000Z');
  });

  it('converts a Europe/Berlin summer day to UTC bounds', () => {
    const bounds = ownerDayBounds(
      new Date('2026-07-15T12:00:00.000Z'),
      'Europe/Berlin',
    );

    expect(bounds.startInclusive.toISOString()).toBe(
      '2026-07-14T22:00:00.000Z',
    );
    expect(bounds.endExclusive.toISOString()).toBe('2026-07-15T22:00:00.000Z');
  });

  it('uses calendar days across daylight-saving transitions', () => {
    const spring = ownerDayBounds(
      new Date('2026-03-29T12:00:00.000Z'),
      'Europe/Berlin',
    );
    const autumn = ownerDayBounds(
      new Date('2026-10-25T12:00:00.000Z'),
      'Europe/Berlin',
    );

    expect(
      spring.endExclusive.getTime() - spring.startInclusive.getTime(),
    ).toBe(springDayHours * millisecondsPerHour);
    expect(
      autumn.endExclusive.getTime() - autumn.startInclusive.getTime(),
    ).toBe(autumnDayHours * millisecondsPerHour);
  });
});
