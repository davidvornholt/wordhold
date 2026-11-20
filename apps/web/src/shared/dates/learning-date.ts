import { calendarDay, zonedDateFormat } from './zoned-format';

const time = zonedDateFormat({
  hour: '2-digit',
  minute: '2-digit',
});

const calendarDate = zonedDateFormat({
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

type LearningDay =
  | { readonly kind: 'phrase'; readonly phrase: string }
  | { readonly kind: 'date'; readonly date: string };

const phrase = (text: string): LearningDay => ({
  kind: 'phrase',
  phrase: text,
});

// "Heute" and "morgen" are the owner's calendar days, the same ones the
// dashboard counts today's answers and the streak in. A card due on a later
// day is due from the start of that day, so only a step later today has a
// time worth showing.
const learningDay = (dueAt: Date, timeZone: string, now: Date): LearningDay => {
  const dayDifference =
    calendarDay(dueAt, timeZone) - calendarDay(now, timeZone);

  if (dueAt.getTime() <= now.getTime()) {
    if (dayDifference === 0) {
      return phrase('Jetzt fällig');
    }
    if (dayDifference === -1) {
      return phrase('Seit gestern fällig');
    }
    return phrase(`Seit ${Math.abs(dayDifference)} Tagen fällig`);
  }
  if (dayDifference === 0) {
    return phrase(`Heute um ${time(timeZone).format(dueAt)}`);
  }
  if (dayDifference === 1) {
    return phrase('Morgen');
  }
  return { kind: 'date', date: calendarDate(timeZone).format(dueAt) };
};

// On its own, such as under "Nächster Lerntermin": "Morgen" or "22.11.2026".
export const formatLearningDate = (
  dueAt: Date,
  timeZone: string,
  now = new Date(),
): string => {
  const day = learningDay(dueAt, timeZone, now);
  return day.kind === 'date' ? day.date : day.phrase;
};

// Mid-sentence: "Nächster Termin morgen" or "Nächster Termin am 22.11.2026".
export const formatLearningDateInline = (
  dueAt: Date,
  timeZone: string,
  now = new Date(),
): string => {
  const day = learningDay(dueAt, timeZone, now);
  return day.kind === 'date'
    ? `am ${day.date}`
    : `${day.phrase.charAt(0).toLocaleLowerCase('de-DE')}${day.phrase.slice(1)}`;
};

export const earliestDate = (dates: ReadonlyArray<Date | null>): Date | null =>
  dates.reduce<Date | null>(
    (earliest, date) =>
      date !== null && (earliest === null || date < earliest) ? date : earliest,
    null,
  );
