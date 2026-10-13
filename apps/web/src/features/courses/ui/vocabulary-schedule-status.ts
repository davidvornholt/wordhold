import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  earliestDate,
  formatLearningDate,
  formatLearningDateInline,
} from '../../../shared/dates/learning-date';
import { isRelationDirection } from '../../../shared/directions';
import type { VocabularyEntry } from '../schemas/course-units';

export type VocabularyCard = VocabularyEntry['cards'][number];

const isPracticed = (card: VocabularyCard): boolean =>
  card.introducedAt !== null && card.state !== 'new';

const dueSummary = (due: number, active: number): string => {
  if (due < active) {
    return `${due} von ${active} Richtungen fällig`;
  }
  return active === 2 ? 'Beide Richtungen fällig' : 'Alle Richtungen fällig';
};

// One line for an entry's row: whether it is still to be learned, and when
// its enabled directions come up next.
export const scheduleSummary = (
  entry: VocabularyEntry,
  enabledDirections: ReadonlyArray<AnswerDirection>,
  now: Date,
): string => {
  const activeCards = entry.cards.filter((card) =>
    enabledDirections.includes(card.direction),
  );
  const introduced = activeCards.filter((card) => card.introducedAt !== null);
  const practiced = activeCards.filter(isPracticed);
  if (introduced.length === 0) {
    return 'Noch nicht kennengelernt';
  }
  if (practiced.length < activeCards.length) {
    if (activeCards.length === 1) {
      return 'Bereit für die erste Übung';
    }
    return practiced.length === 0
      ? `${introduced.length} von ${activeCards.length} Richtungen bereit`
      : `${practiced.length} von ${activeCards.length} Richtungen geübt`;
  }
  const due = practiced.filter(
    (card) => card.dueAt !== null && card.dueAt <= now,
  );
  const nextDueAt = earliestDate(practiced.map((card) => card.dueAt));
  if (due.length > 0) {
    if (activeCards.length === 1 && nextDueAt !== null) {
      return formatLearningDate(nextDueAt, now);
    }
    return dueSummary(due.length, activeCards.length);
  }
  return nextDueAt === null
    ? 'Noch kein weiterer Termin'
    : `Nächste Wiederholung ${formatLearningDateInline(nextDueAt, now)}`;
};

// One direction's schedule: when it comes up next, or why it does not.
export const cardStatus = (card: VocabularyCard, now: Date): string => {
  if (card.introducedAt === null) {
    return isRelationDirection(card.direction)
      ? 'Wird abgefragt, sobald die Vokabel kennengelernt ist'
      : 'Noch nicht kennengelernt';
  }
  if (card.state === 'new') {
    return 'Bereit für die erste Übung';
  }
  if (card.dueAt === null) {
    return 'Noch kein weiterer Termin';
  }
  return card.dueAt <= now
    ? formatLearningDate(card.dueAt, now)
    : `Nächste Wiederholung ${formatLearningDateInline(card.dueAt, now)}`;
};

// What can change about a direction's learning pass: a direction still to be
// learned can skip it, and one not yet practised can go back to it. Once a
// direction has been answered, its schedule decides when it comes back.
// Synonyms and antonyms have no learning pass; they follow their word.
export const learningChangeFor = (
  card: VocabularyCard,
): 'skip' | 'return' | null => {
  if (isRelationDirection(card.direction)) {
    return null;
  }
  if (card.introducedAt === null) {
    return 'skip';
  }
  return card.state === 'new' ? 'return' : null;
};

// The directions with a learning pass: each one the course practises except
// synonyms and antonyms, which are asked once their word is learned.
export const learningDirections = (
  enabledDirections: ReadonlyArray<AnswerDirection>,
): ReadonlyArray<AnswerDirection> =>
  enabledDirections.filter((direction) => !isRelationDirection(direction));

// The cards of these entries that still have this direction to learn.
export const openLearningCardIds = (
  entries: ReadonlyArray<VocabularyEntry>,
  direction: AnswerDirection,
): ReadonlyArray<string> =>
  entries.flatMap((entry) =>
    entry.cards
      .filter(
        (card) => card.direction === direction && card.introducedAt === null,
      )
      .map((card) => card.cardId),
  );

// Whether any of these entries has a direction the course practises left to
// learn.
export const hasOpenLearning = (
  entries: ReadonlyArray<VocabularyEntry>,
  enabledDirections: ReadonlyArray<AnswerDirection>,
): boolean =>
  learningDirections(enabledDirections).some(
    (direction) => openLearningCardIds(entries, direction).length > 0,
  );

// Whether any of these entries has a direction the course practises that
// has been learned or skipped, and so can be practised.
export const hasLearnedCards = (
  entries: ReadonlyArray<VocabularyEntry>,
  enabledDirections: ReadonlyArray<AnswerDirection>,
): boolean =>
  entries.some((entry) =>
    entry.cards.some(
      (card) =>
        enabledDirections.includes(card.direction) &&
        card.introducedAt !== null,
    ),
  );
