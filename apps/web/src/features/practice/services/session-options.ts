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
};

type DirectionCount = {
  readonly direction: SessionDirection;
  readonly ready: number;
};

// What the start screen offers. Only directions the course still practises
// appear, in the fixed order the settings screen uses. "Gemischt" comes last
// and only when there is more than one direction to mix.
export const sessionOptions = (
  enabled: ReadonlyArray<AnswerDirection>,
  targetLabel: string,
  counts: ReadonlyArray<DirectionCount>,
): ReadonlyArray<SessionOption> => {
  const singles = answerDirections
    .filter((direction) => enabled.includes(direction))
    .map((direction) => ({
      value: direction,
      label: directionLabel(direction, targetLabel),
      description: directionDescription(direction, targetLabel),
      cards: counts.find((count) => count.direction === direction)?.ready ?? 0,
    }));
  return singles.length > 1
    ? [
        ...singles,
        {
          value: 'both' as const,
          label: 'Gemischt',
          description: 'Beide Richtungen in einer Sitzung.',
          cards: counts.find((count) => count.direction === 'both')?.ready ?? 0,
        },
      ]
    : singles;
};

// Which direction the sitting runs in, given what the URL asked for and what
// the course still practises. A direction the course has switched off is not
// honoured; it drops back to the picker. A course down to a single direction
// has nothing to pick, so it starts straight away.
export const resolveSessionDirection = (
  requested: SessionDirection | undefined,
  enabled: ReadonlyArray<AnswerDirection>,
): SessionDirection | undefined => {
  const offered =
    requested !== undefined &&
    (requested === 'both' ? enabled.length > 1 : enabled.includes(requested));
  if (offered) {
    return requested;
  }
  return enabled.length === 1 ? enabled.at(0) : undefined;
};
