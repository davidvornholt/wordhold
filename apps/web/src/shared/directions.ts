import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { germanLabels } from './languages';

// What a course's cards ask for. A language course translates between German
// and its target language. A terms course shows a German technical term and
// asks for its definition, which is its only direction.
export type CourseSubject = {
  readonly kind: CourseKind;
  readonly targetLanguage: LanguageCode;
};

// What the course's entries are called. The dative plural follows
// prepositions such as "von".
export const courseNouns = (subject: Pick<CourseSubject, 'kind'>) =>
  subject.kind === 'terms'
    ? {
        singular: 'Begriff',
        plural: 'Begriffe',
        dativePlural: 'Begriffen',
      }
    : {
        singular: 'Vokabel',
        plural: 'Vokabeln',
        dativePlural: 'Vokabeln',
      };

export type CourseNouns = ReturnType<typeof courseNouns>;

// The session picker and the course settings both name the directions, so the
// wording lives in one place. The native side is always German.
export const directionLabel = (
  direction: AnswerDirection,
  subject: CourseSubject,
): string => {
  if (subject.kind === 'terms') {
    return 'Begriff → Definition';
  }
  const targetLabel = germanLabels[subject.targetLanguage];
  return direction === 'to_target'
    ? `Deutsch → ${targetLabel}`
    : `${targetLabel} → Deutsch`;
};

export const directionDescription = (
  direction: AnswerDirection,
  subject: CourseSubject,
): string => {
  if (subject.kind === 'terms') {
    return 'Du siehst den Begriff und schreibst seine Definition.';
  }
  return direction === 'to_target'
    ? `Du siehst die deutsche Vokabel und schreibst sie auf ${germanLabels[subject.targetLanguage]}.`
    : 'Du siehst die fremdsprachige Vokabel und schreibst sie auf Deutsch.';
};
