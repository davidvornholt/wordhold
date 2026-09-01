import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { answerDirections } from '@wordhold/db/schema/directions';
import {
  directionDescription,
  directionLabel,
} from '../../../shared/directions';
import type { SessionDirection } from '../schemas/session-request';

export type SessionOption = {
  readonly value: SessionDirection;
  readonly label: string;
  readonly description: string;
  readonly cards: number;
  readonly availability: 'available' | 'no_cards' | 'needs_both_directions';
};

type DirectionCount = {
  readonly direction: SessionDirection;
  readonly ready: number;
};

const mixedAvailability = (
  singles: ReadonlyArray<SessionOption>,
  mixedCards: number,
): SessionOption['availability'] => {
  if (singles.some((option) => option.availability !== 'available')) {
    return 'needs_both_directions';
  }
  return mixedCards > 0 ? 'available' : 'no_cards';
};

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
  targetLabel: string,
  counts: ReadonlyArray<DirectionCount>,
): ReadonlyArray<SessionOption> =>
  answerDirections
    .filter((direction) => enabled.includes(direction))
    .map((direction) => {
      const cards =
        counts.find((count) => count.direction === direction)?.ready ?? 0;
      return {
        value: direction,
        label: directionLabel(direction, targetLabel),
        description: directionDescription(direction, targetLabel),
        cards,
        availability:
          cards > 0 ? ('available' as const) : ('no_cards' as const),
      };
    });

export const sessionOptions = (
  enabled: ReadonlyArray<AnswerDirection>,
  targetLabel: string,
  counts: ReadonlyArray<DirectionCount>,
): ReadonlyArray<SessionOption> => {
  const singles = directionOptions(enabled, targetLabel, counts);
  const mixedCards =
    counts.find((count) => count.direction === 'both')?.ready ?? 0;
  return singles.length > 1
    ? [
        ...singles,
        {
          value: 'both' as const,
          label: 'Gemischt',
          description: 'Beide Richtungen in einer Sitzung.',
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
      ? enabled.length > 1 &&
        enabled.every((direction) => ready.includes(direction))
      : enabled.includes(requested) && ready.includes(requested));
  if (offered) {
    return requested;
  }
  const onlyEnabled = enabled.length === 1 ? enabled.at(0) : undefined;
  return onlyEnabled !== undefined && ready.includes(onlyEnabled)
    ? onlyEnabled
    : undefined;
};
