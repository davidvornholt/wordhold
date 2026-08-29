import type { AnswerDirection } from '@wordhold/db/schema/directions';

// The session picker and the course settings both name the directions, so the
// wording lives in one place. The native side is always German.
export const directionLabel = (
  direction: AnswerDirection,
  targetLabel: string,
): string =>
  direction === 'to_target'
    ? `Deutsch → ${targetLabel}`
    : `${targetLabel} → Deutsch`;

export const directionDescription = (
  direction: AnswerDirection,
  targetLabel: string,
): string =>
  direction === 'to_target'
    ? `Du siehst die deutsche Vokabel und schreibst sie auf ${targetLabel}.`
    : 'Du siehst die fremdsprachige Vokabel und schreibst sie auf Deutsch.';
