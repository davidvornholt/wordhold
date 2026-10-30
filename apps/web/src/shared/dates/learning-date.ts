import { calendarDay, zonedDateFormat } from './zoned-format';

const time = zonedDateFormat({
  hour: '2-digit',
  minute: '2-digit',
});

const dateTime = zonedDateFormat({
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// "Heute" and "morgen" are the owner's calendar days, the same ones the
// dashboard counts today's answers and the streak in.
export const formatLearningDate = (
  dueAt: Date,
  timeZone: string,
  now = new Date(),
): string => {
  const dayDifference =
    calendarDay(dueAt, timeZone) - calendarDay(now, timeZone);

  if (dueAt.getTime() <= now.getTime()) {
    if (dayDifference === 0) {
      return 'Jetzt fällig';
    }
    if (dayDifference === -1) {
      return 'Seit gestern fällig';
    }
    return `Seit ${Math.abs(dayDifference)} Tagen fällig`;
  }
  if (dayDifference === 0) {
    return `Heute um ${time(timeZone).format(dueAt)}`;
  }
  if (dayDifference === 1) {
    return `Morgen um ${time(timeZone).format(dueAt)}`;
  }
  return dateTime(timeZone).format(dueAt).replace(',', ' um');
};

// The same phrase mid-sentence: "Nächster Termin morgen um 12:40".
export const formatLearningDateInline = (
  dueAt: Date,
  timeZone: string,
  now = new Date(),
): string => {
  const phrase = formatLearningDate(dueAt, timeZone, now);
  return `${phrase.charAt(0).toLocaleLowerCase('de-DE')}${phrase.slice(1)}`;
};

export const earliestDate = (dates: ReadonlyArray<Date | null>): Date | null =>
  dates.reduce<Date | null>(
    (earliest, date) =>
      date !== null && (earliest === null || date < earliest) ? date : earliest,
    null,
  );
