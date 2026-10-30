import { describe, expect, it } from 'bun:test';
import { formatLearningDate, formatLearningDateInline } from './learning-date';

const berlin = 'Europe/Berlin';

// 23:30 on 20 September in Berlin (UTC+2), but still 21:30 in UTC.
const lateEvening = new Date('2026-09-20T21:30:00Z');
// 01:30 on 21 September in Berlin, but still 23:30 on the 20th in UTC.
const afterMidnight = new Date('2026-09-20T23:30:00Z');

describe('formatLearningDate', () => {
  it('writes the time and counts the days in the owner time zone', () => {
    expect(
      formatLearningDate(new Date('2026-09-20T21:50:00Z'), berlin, lateEvening),
    ).toBe('Heute um 23:50');
    expect(
      formatLearningDate(new Date('2026-09-20T22:40:00Z'), berlin, lateEvening),
    ).toBe('Morgen um 00:40');
    expect(
      formatLearningDate(new Date('2026-09-21T06:40:00Z'), berlin, lateEvening),
    ).toBe('Morgen um 08:40');
    expect(
      formatLearningDate(new Date('2026-09-22T22:30:00Z'), berlin, lateEvening),
    ).toBe('23.09.2026 um 00:30');
  });

  it('counts overdue days in the owner time zone', () => {
    expect(
      formatLearningDate(
        new Date('2026-09-20T22:30:00Z'),
        berlin,
        afterMidnight,
      ),
    ).toBe('Jetzt fällig');
    expect(
      formatLearningDate(
        new Date('2026-09-20T21:00:00Z'),
        berlin,
        afterMidnight,
      ),
    ).toBe('Seit gestern fällig');
    expect(
      formatLearningDate(
        new Date('2026-09-17T21:00:00Z'),
        berlin,
        afterMidnight,
      ),
    ).toBe('Seit 4 Tagen fällig');
  });

  it('keeps a 25-hour day at the end of summer time as one day', () => {
    // 00:30 and 23:30 on 25 October 2026 in Berlin, 24 hours apart.
    expect(
      formatLearningDate(
        new Date('2026-10-25T22:30:00Z'),
        berlin,
        new Date('2026-10-24T22:30:00Z'),
      ),
    ).toBe('Heute um 23:30');
  });

  it('follows the zone it is given rather than the zone of the process', () => {
    const dueAt = new Date('2026-09-20T22:40:00Z');

    expect(formatLearningDate(dueAt, 'America/New_York', lateEvening)).toBe(
      'Heute um 18:40',
    );
    expect(formatLearningDate(dueAt, 'Asia/Tokyo', lateEvening)).toBe(
      'Heute um 07:40',
    );
  });
});

describe('formatLearningDateInline', () => {
  it('lowercases only the leading word so nouns keep their case', () => {
    expect(
      formatLearningDateInline(
        new Date('2026-09-21T10:40:00Z'),
        berlin,
        lateEvening,
      ),
    ).toBe('morgen um 12:40');
    expect(
      formatLearningDateInline(
        new Date('2026-09-17T10:40:00Z'),
        berlin,
        lateEvening,
      ),
    ).toBe('seit 3 Tagen fällig');
  });

  it('leaves the sentence-initial form untouched', () => {
    expect(
      formatLearningDate(new Date('2026-09-21T10:40:00Z'), berlin, lateEvening),
    ).toBe('Morgen um 12:40');
  });
});
