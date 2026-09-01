import { formatLearningDate } from '../../../shared/dates/learning-date';
import { directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import type { CourseUnit } from '../schemas/course-units';

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
  return `Nächster Termin ${formatLearningDate(unit.nextDueAt).toLocaleLowerCase('de-DE')}`;
};

// One sentence describing how far a unit has come. The course list and the
// unit's own page both read this, so the two can never disagree.
export const unitProgressSummary = (
  unit: CourseUnit,
  targetLabel: string,
): string => {
  if (unit.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  const entryCount = countNoun(unit.entries, 'Vokabel', 'Vokabeln');
  const directions = unit.directions
    .filter((direction) => direction.total > 0)
    .map(
      (direction) =>
        `${directionLabel(direction.direction, targetLabel)} ${direction.introduced}/${direction.total}`,
    );
  const learningStatus =
    unit.unintroduced === 0
      ? null
      : `${countNoun(unit.unintroduced, 'Vokabel', 'Vokabeln')} noch kennenlernen`;
  const practiceStatus =
    unit.unintroduced === 0 || unit.due > 0 || unit.firstReviews > 0
      ? unitPracticeStatus(unit)
      : null;
  return [entryCount, ...directions, learningStatus, practiceStatus]
    .filter((part): part is string => part !== null)
    .join(' · ');
};
