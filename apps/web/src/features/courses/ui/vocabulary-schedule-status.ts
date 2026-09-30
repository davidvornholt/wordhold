import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  earliestDate,
  formatLearningDate,
  formatLearningDateInline,
} from '../../../shared/dates/learning-date';
import type { VocabularyEntry } from '../schemas/course-units';

export type VocabularyCard = VocabularyEntry['cards'][number];

const isPracticed = (card: VocabularyCard): boolean =>
  card.introducedAt !== null && card.state !== 'new';

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
    if (due.length === activeCards.length) {
      return 'Beide Richtungen fällig';
    }
    return `${due.length} von ${activeCards.length} Richtungen fällig`;
  }
  return nextDueAt === null
    ? 'Noch kein weiterer Termin'
    : `Nächste Wiederholung ${formatLearningDateInline(nextDueAt, now)}`;
};

// One direction's schedule: when it comes up next, or why it does not.
export const cardStatus = (card: VocabularyCard, now: Date): string => {
  if (card.introducedAt === null) {
    return 'Noch nicht kennengelernt';
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
