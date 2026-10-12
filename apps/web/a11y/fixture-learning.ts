import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';

const skippedAt = new Date('2026-08-29T09:00:00Z');

const changes = (
  card: VocabularyEntry['cards'][number],
  change: 'skip' | 'return',
): boolean =>
  change === 'skip'
    ? card.introducedAt === null
    : card.introducedAt !== null && card.state === 'new';

// Skips or reopens the learning pass of these cards in memory, under the
// server's rule that only a card never answered goes back to it.
export const changeLearning = (
  entries: ReadonlyArray<VocabularyEntry>,
  cardIds: ReadonlyArray<string>,
  change: 'skip' | 'return',
) => {
  const changed: Array<string> = [];
  const next = entries.map((entry) => {
    const cards = entry.cards.map((card) => {
      if (!(cardIds.includes(card.cardId) && changes(card, change))) {
        return card;
      }
      changed.push(card.cardId);
      return { ...card, introducedAt: change === 'skip' ? skippedAt : null };
    });
    return {
      ...entry,
      cards,
      introduced: cards.some((card) => card.introducedAt !== null),
    };
  });
  return { entries: next, changed } as const;
};
