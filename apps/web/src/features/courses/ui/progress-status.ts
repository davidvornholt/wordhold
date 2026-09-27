import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import type {
  CourseBook,
  CourseUnit,
  WordProgress,
} from '../schemas/course-units';

// The line under a book's name: its units, if it has any, and every word in
// it, whether the word lives directly in the book or in one of its units.
export const bookSummary = (
  book: CourseBook,
  units: ReadonlyArray<CourseUnit>,
): string => {
  const places = [book, ...units];
  const entries = places.reduce((total, place) => total + place.entries, 0);
  const unintroduced = places.reduce(
    (total, place) => total + place.unintroduced,
    0,
  );
  if (units.length === 0 && entries === 0) {
    return 'Noch keine Vokabeln';
  }
  return [
    units.length === 0 ? null : countNoun(units.length, 'Einheit', 'Einheiten'),
    entries === 0
      ? 'noch keine Vokabeln'
      : countNoun(entries, 'Vokabel', 'Vokabeln'),
    unintroduced === 0 ? null : `${unintroduced} noch kennenlernen`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};

export const practiceStatus = (progress: WordProgress): string => {
  if (progress.due > 0) {
    return `${countNoun(progress.due, 'Wiederholung', 'Wiederholungen')} offen`;
  }
  if (progress.firstReviews > 0) {
    return `${countNoun(progress.firstReviews, 'Karte', 'Karten')} zum ersten Mal üben`;
  }
  if (progress.nextDueAt === null) {
    return 'Für jetzt geschafft';
  }
  return `Nächster Termin ${formatLearningDateInline(progress.nextDueAt)}`;
};

// One line describing how far a unit or a book's own words have come, in the
// same terms as the course summary. Progress per direction lives on the
// unit's or book's own page.
export const progressSummary = (progress: WordProgress): string => {
  if (progress.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  const learningStatus =
    progress.unintroduced === 0
      ? null
      : `${progress.unintroduced} noch kennenlernen`;
  const practice =
    progress.unintroduced === 0 || progress.due > 0 || progress.firstReviews > 0
      ? practiceStatus(progress)
      : null;
  return [
    countNoun(progress.entries, 'Vokabel', 'Vokabeln'),
    learningStatus,
    practice,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};
