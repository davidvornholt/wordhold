import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { VocabularyEntry } from '../schemas/course-units';

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

export const matchesFilter = (
  entry: VocabularyEntry,
  enabledDirections: ReadonlyArray<AnswerDirection>,
  filter: 'all' | 'due' | 'first-reviews' | 'difficult',
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
    return entry.cards.some(
      (card) =>
        enabledDirections.includes(card.direction) && card.failures >= 2,
    );
  }
  return true;
};
