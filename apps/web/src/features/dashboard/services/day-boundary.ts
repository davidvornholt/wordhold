import { DateTime } from 'effect';

type DayBounds = {
  readonly startInclusive: Date;
  readonly endExclusive: Date;
};

export const ownerDayBounds = (now: Date, timeZone: string): DayBounds => {
  const zonedNow = DateTime.makeZonedUnsafe(now, { timeZone });
  const start = DateTime.startOf(zonedNow, 'day');
  const end = DateTime.add(start, { days: 1 });
  return {
    startInclusive: DateTime.toDateUtc(start),
    endExclusive: DateTime.toDateUtc(end),
  };
};
