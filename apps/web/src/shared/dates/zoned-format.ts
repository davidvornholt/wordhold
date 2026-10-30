// One formatter per zone, because building an Intl formatter costs far more
// than using one and a vocabulary list formats a date per row.
export const zonedDateFormat = (options: Intl.DateTimeFormatOptions) => {
  const formats = new Map<string, Intl.DateTimeFormat>();
  return (timeZone: string): Intl.DateTimeFormat => {
    const cached = formats.get(timeZone);
    if (cached !== undefined) {
      return cached;
    }
    const format = new Intl.DateTimeFormat('de-DE', { ...options, timeZone });
    formats.set(timeZone, format);
    return format;
  };
};

const numericDate = zonedDateFormat({
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

export const formatShortDate = (date: Date, timeZone: string): string =>
  numericDate(timeZone).format(date);

const millisecondsPerDay = 86_400_000;

// The calendar day a moment falls on in the zone, as whole days since the
// epoch, so that two of them subtract to the number of days between them.
export const calendarDay = (date: Date, timeZone: string): number => {
  const parts = numericDate(timeZone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  return (
    Date.UTC(part('year'), part('month') - 1, part('day')) / millisecondsPerDay
  );
};
