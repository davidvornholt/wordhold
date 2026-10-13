import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { earliestDate } from '../src/shared/dates/learning-date';
import { isRelationDirection } from '../src/shared/directions';

type FixtureCard = VocabularyEntry['cards'][number];

const skippedAt = new Date('2026-08-29T09:00:00Z');

const changes = (card: FixtureCard, change: 'skip' | 'return'): boolean => {
  if (isRelationDirection(card.direction)) {
    return false;
  }
  return change === 'skip'
    ? card.introducedAt === null
    : card.introducedAt !== null && card.state === 'new';
};

// A word's synonym and antonym cards follow it: asked from when it was first
// met, and held back again while unanswered once it is not met any more.
const followWord = (
  cards: ReadonlyArray<FixtureCard>,
): ReadonlyArray<FixtureCard> => {
  const metAt = earliestDate(
    cards
      .filter((card) => !isRelationDirection(card.direction))
      .map((card) => card.introducedAt),
  );
  return cards.map((card) => {
    if (!isRelationDirection(card.direction)) {
      return card;
    }
    if (metAt !== null) {
      return { ...card, introducedAt: card.introducedAt ?? metAt };
    }
    return card.state === 'new' ? { ...card, introducedAt: null } : card;
  });
};

// Skips or reopens the learning pass of these cards in memory, under the
// server's rules: only a card never answered goes back to it, and synonyms
// and antonyms follow their word.
export const changeLearning = (
  entries: ReadonlyArray<VocabularyEntry>,
  cardIds: ReadonlyArray<string>,
  change: 'skip' | 'return',
) => {
  const changed: Array<string> = [];
  const next = entries.map((entry) => {
    const cards = followWord(
      entry.cards.map((card) => {
        if (!(cardIds.includes(card.cardId) && changes(card, change))) {
          return card;
        }
        changed.push(card.cardId);
        return { ...card, introducedAt: change === 'skip' ? skippedAt : null };
      }),
    );
    return {
      ...entry,
      cards,
      introduced: cards.some((card) => card.introducedAt !== null),
    };
  });
  return { entries: next, changed } as const;
};
