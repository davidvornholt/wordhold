import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import type { CourseBook, CourseUnit } from '../schemas/course-units';

// The line under a book's name while its units are folded away.
export const bookSummary = (units: ReadonlyArray<CourseUnit>): string =>
  [
    countNoun(units.length, 'Einheit', 'Einheiten'),
    countNoun(
      units.reduce((total, unit) => total + unit.entries, 0),
      'Vokabel',
      'Vokabeln',
    ),
  ].join(' · ');

const hasOpenWork = (units: ReadonlyArray<CourseUnit>): boolean =>
  units.some(
    (unit) => unit.due > 0 || unit.firstReviews > 0 || unit.unintroduced > 0,
  );

// Books are listed in course order. A book starts open while it has work left
// or no units yet; finished books fold away. Books are added at the end, so
// "the last book" is not necessarily the current one. When every book is
// finished, the last one stays open so the list never looks empty.
export const initiallyOpenBooks = (
  groups: ReadonlyArray<{
    readonly book: CourseBook;
    readonly units: ReadonlyArray<CourseUnit>;
  }>,
): ReadonlySet<string> => {
  const open = groups.filter(
    ({ units }) => units.length === 0 || hasOpenWork(units),
  );
  const fallback = groups.at(-1);
  return new Set(
    (open.length === 0 && fallback !== undefined ? [fallback] : open).map(
      ({ book }) => book.id,
    ),
  );
};

export const unitPracticeStatus = (unit: CourseUnit): string => {
  if (unit.due > 0) {
    return `${countNoun(unit.due, 'Wiederholung', 'Wiederholungen')} offen`;
  }
  if (unit.firstReviews > 0) {
    return `${countNoun(unit.firstReviews, 'Karte', 'Karten')} zum ersten Mal üben`;
  }
  if (unit.nextDueAt === null) {
    return 'Für jetzt geschafft';
  }
  return `Nächster Termin ${formatLearningDateInline(unit.nextDueAt)}`;
};

// One line describing how far a unit has come, in the same terms as the
// course summary. Progress per direction lives on the unit's own page.
export const unitProgressSummary = (unit: CourseUnit): string => {
  if (unit.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  const learningStatus =
    unit.unintroduced === 0 ? null : `${unit.unintroduced} noch kennenlernen`;
  const practiceStatus =
    unit.unintroduced === 0 || unit.due > 0 || unit.firstReviews > 0
      ? unitPracticeStatus(unit)
      : null;
  return [
    countNoun(unit.entries, 'Vokabel', 'Vokabeln'),
    learningStatus,
    practiceStatus,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};
