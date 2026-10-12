import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { hasLearnedCards, hasOpenLearning } from './vocabulary-schedule-status';

export type StudyIntent = 'learn' | 'practice';

// One way to study the selected entries, as the selection bar offers it.
export type StudyAction = {
  readonly entryIds: ReadonlyArray<string>;
  readonly intent: StudyIntent;
  // The bar's leading action.
  readonly primary: boolean;
  // The list's filter and place as the selection was made, so the study
  // screen leads back to the same view.
  readonly list: {
    readonly filter: VocabularyFilter;
    readonly place: string | undefined;
  };
};

// Practice asks only what has been learned or skipped, so a selection with
// directions still open offers learning them as well. Learning leads, since
// it ends in practice anyway.
export const studyIntents = (
  entries: ReadonlyArray<VocabularyEntry>,
  enabledDirections: ReadonlyArray<AnswerDirection>,
): ReadonlyArray<StudyIntent> => [
  ...(hasOpenLearning(entries, enabledDirections) ? (['learn'] as const) : []),
  ...(hasLearnedCards(entries, enabledDirections)
    ? (['practice'] as const)
    : []),
];
