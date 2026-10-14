import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { answerTally } from './vocabulary-schedule-status';

const isDue = (
  entry: VocabularyEntry,
  enabledDirections: ReadonlyArray<AnswerDirection>,
  now: Date,
) =>
  entry.cards.some(
    (card) =>
      enabledDirections.includes(card.direction) &&
      card.introducedAt !== null &&
      card.state !== 'new' &&
      card.dueAt !== null &&
      card.dueAt <= now,
  );

// Only a word asked in the course's language is spelled by the learner.
export const showsPitfalls = (
  enabledDirections: ReadonlyArray<AnswerDirection>,
): boolean => enabledDirections.includes('to_target');

// A test marks a word wrong after a single slip, so a word counts as
// difficult once it was not known or right only just.
export const matchesFilter = (
  entry: VocabularyEntry,
  enabledDirections: ReadonlyArray<AnswerDirection>,
  filter: VocabularyFilter,
  now: Date,
): boolean => {
  if (filter === 'due') {
    return isDue(entry, enabledDirections, now);
  }
  if (filter === 'first-reviews') {
    return entry.cards.some(
      (card) =>
        enabledDirections.includes(card.direction) &&
        card.introducedAt !== null &&
        card.state === 'new',
    );
  }
  if (filter === 'difficult') {
    const { failures, hardAnswers } = answerTally(entry, enabledDirections);
    return failures + hardAnswers > 0;
  }
  if (filter === 'pitfalls') {
    return (
      showsPitfalls(enabledDirections) &&
      (entry.spellingPitfalls?.length ?? 0) > 0
    );
  }
  return true;
};

// Most often not known first, then most often right only just.
export const byDifficulty =
  (enabledDirections: ReadonlyArray<AnswerDirection>) =>
  (left: VocabularyEntry, right: VocabularyEntry): number => {
    const a = answerTally(left, enabledDirections);
    const b = answerTally(right, enabledDirections);
    return b.failures - a.failures || b.hardAnswers - a.hardAnswers;
  };
