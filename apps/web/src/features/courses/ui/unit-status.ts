import { formatLearningDate } from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import type { CourseUnit } from '../schemas/course-units';

export const unitPracticeStatus = (unit: CourseUnit): string => {
  if (unit.due > 0) {
    return `${countNoun(unit.due, 'Wiederholung', 'Wiederholungen')} offen`;
  }
  if (unit.firstReviews > 0) {
    return `${countNoun(unit.firstReviews, 'erste Abfrage', 'erste Abfragen')} offen`;
  }
  if (unit.nextDueAt === null) {
    return 'Für jetzt geschafft';
  }
  return `Nächster Termin ${formatLearningDate(unit.nextDueAt).toLocaleLowerCase('de-DE')}`;
};

// One sentence describing how far a unit has come. The course list and the
// unit's own page both read this, so the two can never disagree.
export const unitProgressSummary = (unit: CourseUnit): string => {
  if (unit.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  const entryCount = countNoun(unit.entries, 'Vokabel', 'Vokabeln');
  const progress =
    unit.unintroduced === 0
      ? `${entryCount} · alle kennengelernt`
      : `${entryCount} · ${unit.unintroduced} noch kennenlernen`;
  return `${progress} · ${unitPracticeStatus(unit)}`;
};
