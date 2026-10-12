import { parseVocabularySearch } from '../../../features/courses/schemas/vocabulary-search';
import type { StudyIntent } from '../../../features/courses/ui/study-action';
import {
  parseStudySearch,
  type SessionDirection,
} from '../../../features/practice/schemas/session-request';

// What a study screen covers, and where it was opened from, so its way back
// leads there. A book's or unit's page names its place; a list hands over
// its filter and the place it showed. Hand-picked entries narrow either.
export const parseStudyRouteSearch = (input: unknown) => ({
  ...parseVocabularySearch(input),
  ...parseStudySearch(input),
});

export type StudyRouteSearch = ReturnType<typeof parseStudyRouteSearch>;

// Switches between learning and practice, or to another direction, on the
// same selection and keeps where it came from.
export const studySearch =
  (mode: StudyIntent, direction?: SessionDirection) =>
  (search: StudyRouteSearch): StudyRouteSearch => ({
    ...search,
    direction,
    mode,
  });
