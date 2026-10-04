import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { germanLabels } from './languages';

// What a course's cards ask for. A language course translates between German
// and its target language. A terms course shows a German technical term and
// asks for its definition, a texts course shows a title and asks for the
// text word for word. Each has that one direction.
export type CourseSubject = {
  readonly kind: CourseKind;
  readonly targetLanguage: LanguageCode;
};

// A subject of terms and a collection of texts are each one list of German
// entries asked in one direction, without books, units, example sentences
// or photo import. In code both are subjects.
export const listCourseKinds = [
  'terms',
  'texts',
] as const satisfies ReadonlyArray<CourseKind>;
export type ListCourseKind = (typeof listCourseKinds)[number];

export const isListCourse = (kind: CourseKind): kind is ListCourseKind =>
  kind !== 'language';

const nounsByKind = {
  language: {
    singular: 'Vokabel',
    plural: 'Vokabeln',
    dativePlural: 'Vokabeln',
  },
  terms: {
    singular: 'Begriff',
    plural: 'Begriffe',
    dativePlural: 'Begriffen',
  },
  texts: {
    singular: 'Text',
    plural: 'Texte',
    dativePlural: 'Texten',
  },
} satisfies Record<
  CourseKind,
  {
    readonly singular: string;
    readonly plural: string;
    readonly dativePlural: string;
  }
>;

// What the course's entries are called. The dative plural follows
// prepositions such as "von".
export const courseNouns = (subject: Pick<CourseSubject, 'kind'>) =>
  nounsByKind[subject.kind];

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
  if (subject.kind === 'texts') {
    return 'Titel → Text';
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
  if (subject.kind === 'texts') {
    return 'Du siehst den Titel und schreibst den Text wortgetreu aus dem Gedächtnis.';
  }
  return direction === 'to_target'
    ? `Du siehst die deutsche Vokabel und schreibst sie auf ${germanLabels[subject.targetLanguage]}.`
    : 'Du siehst die fremdsprachige Vokabel und schreibst sie auf Deutsch.';
};
