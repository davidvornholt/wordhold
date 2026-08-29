const millisecondsPerDay = 86_400_000;

const startOfDay = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const time = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateTime = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatLearningDate = (dueAt: Date, now = new Date()): string => {
  const dueDay = startOfDay(dueAt);
  const today = startOfDay(now);
  const dayDifference = Math.round(
    (dueDay.getTime() - today.getTime()) / millisecondsPerDay,
  );

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
    return `Heute um ${time.format(dueAt)}`;
  }
  if (dayDifference === 1) {
    return `Morgen um ${time.format(dueAt)}`;
  }
  return dateTime.format(dueAt).replace(',', ' um');
};

export const earliestDate = (dates: ReadonlyArray<Date | null>): Date | null =>
  dates.reduce<Date | null>(
    (earliest, date) =>
      date !== null && (earliest === null || date < earliest) ? date : earliest,
    null,
  );
