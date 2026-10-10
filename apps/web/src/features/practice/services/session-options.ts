import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { answerDirections } from '@wordhold/db/schema/directions';
import {
  type CourseSubject,
  directionDescription,
  directionLabel,
  isRelationDirection,
} from '../../../shared/directions';
import type { SessionDirection } from '../schemas/session-request';

export type SessionOption = {
  readonly value: SessionDirection;
  readonly label: string;
  readonly description: string;
  readonly cards: number;
  readonly availability: 'available' | 'no_cards' | 'needs_two_directions';
};

type DirectionCount = {
  readonly direction: SessionDirection;
  readonly ready: number;
};

// A mix needs cards in at least two directions; with one, it would be that
// direction's sitting under another name.
const mixedAvailability = (
  singles: ReadonlyArray<SessionOption>,
  mixedCards: number,
): SessionOption['availability'] => {
  const withCards = singles.filter(
    (option) => option.availability === 'available',
  ).length;
  if (withCards === 1) {
    return 'needs_two_directions';
  }
  return withCards > 1 && mixedCards > 0 ? 'available' : 'no_cards';
};

// The directions a scheduled sitting can offer. A translation direction the
// course practises is always offered; synonyms and antonyms only where the
// counts show some word with such a list.
export const offeredDirections = (
  enabled: ReadonlyArray<AnswerDirection>,
  counts: ReadonlyArray<{ readonly direction: SessionDirection }>,
): ReadonlyArray<AnswerDirection> =>
  enabled.filter(
    (direction) =>
      !isRelationDirection(direction) ||
      counts.some((count) => count.direction === direction),
  );

export const directionsWithCards = (
  cards: ReadonlyArray<{ readonly direction: AnswerDirection }>,
): ReadonlyArray<AnswerDirection> =>
  answerDirections.filter((direction) =>
    cards.some((card) => card.direction === direction),
  );

// What the start screen offers. Only directions the course still practises
// appear, in the fixed order the settings screen uses. "Gemischt" comes last
// and only when there is more than one direction to mix.
export const directionOptions = (
  enabled: ReadonlyArray<AnswerDirection>,
  subject: CourseSubject,
  counts: ReadonlyArray<DirectionCount>,
): ReadonlyArray<SessionOption> =>
  answerDirections
    .filter((direction) => enabled.includes(direction))
    .map((direction) => {
      const cards =
        counts.find((count) => count.direction === direction)?.ready ?? 0;
      return {
        value: direction,
        label: directionLabel(direction, subject),
        description: directionDescription(direction, subject),
        cards,
        availability:
          cards > 0 ? ('available' as const) : ('no_cards' as const),
      };
    });

export const sessionOptions = (
  enabled: ReadonlyArray<AnswerDirection>,
  subject: CourseSubject,
  counts: ReadonlyArray<DirectionCount>,
): ReadonlyArray<SessionOption> => {
  const singles = directionOptions(enabled, subject, counts);
  const mixedCards =
    counts.find((count) => count.direction === 'both')?.ready ?? 0;
  return singles.length > 1
    ? [
        ...singles,
        {
          value: 'both' as const,
          label: 'Gemischt',
          description:
            singles.length === 2
              ? 'Beide Richtungen in einer Sitzung.'
              : 'Alle Richtungen in einer Sitzung.',
          cards: mixedCards,
          availability: mixedAvailability(singles, mixedCards),
        },
      ]
    : singles;
};

export const resolveAnswerDirection = (
  requested: SessionDirection | undefined,
  enabled: ReadonlyArray<AnswerDirection>,
): AnswerDirection | undefined => {
  if (requested !== undefined && requested !== 'both') {
    return enabled.includes(requested) ? requested : enabled.at(0);
  }
  return enabled.length === 1 ? enabled.at(0) : undefined;
};

// Which direction the sitting runs in, given what the URL asked for and what
// the course still practises. A direction the course has switched off is not
// honoured; it drops back to the picker. When only one direction is available,
// there is no useful choice to make, so it starts directly.
export const resolveSessionDirection = (
  requested: SessionDirection | undefined,
  enabled: ReadonlyArray<AnswerDirection>,
  ready: ReadonlyArray<AnswerDirection>,
): SessionDirection | undefined => {
  const offered =
    requested !== undefined &&
    (requested === 'both'
      ? enabled.filter((direction) => ready.includes(direction)).length > 1
      : enabled.includes(requested) && ready.includes(requested));
  if (offered) {
    return requested;
  }
  const onlyEnabled = enabled.length === 1 ? enabled.at(0) : undefined;
  return onlyEnabled !== undefined && ready.includes(onlyEnabled)
    ? onlyEnabled
    : undefined;
};
