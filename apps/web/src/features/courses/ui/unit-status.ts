import { formatLearningDate } from '../../../shared/dates/learning-date';
import type { CourseUnit } from '../schemas/course-units';

export const unitPracticeStatus = (unit: CourseUnit): string => {
  if (unit.due > 0) {
    return `${unit.due} Wiederholungen offen`;
  }
  if (unit.firstReviews > 0) {
    return `${unit.firstReviews} erste Abfragen offen`;
  }
  if (unit.nextDueAt === null) {
    return 'Für jetzt geschafft';
  }
  return `Nächster Termin ${formatLearningDate(unit.nextDueAt).toLocaleLowerCase('de-DE')}`;
};
