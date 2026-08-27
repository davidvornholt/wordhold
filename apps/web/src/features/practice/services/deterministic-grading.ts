import type { AnswerSource } from '@wordhold/db/schema/entries';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import { answerVariants } from '../../../shared/grading/variants';

export type AcceptedAnswer = {
  readonly text: string;
  readonly normalized: string;
  readonly source: AnswerSource;
};

export const isDeterministicMatch = (
  submittedAnswer: string,
  accepted: ReadonlyArray<AcceptedAnswer>,
): boolean => {
  const normalized = normalizeAnswer(submittedAnswer);
  if (accepted.some((answer) => answer.normalized === normalized)) {
    return true;
  }

  const acceptedReadings = new Set(accepted.map((answer) => answer.normalized));
  for (const answer of accepted) {
    if (answer.source === 'textbook') {
      const expansion = answerVariants(answer.text);
      if (expansion._tag === 'Expanded') {
        for (const reading of expansion.readings) {
          acceptedReadings.add(reading);
        }
      }
    }
  }

  const submitted = answerVariants(submittedAnswer);
  return (
    submitted._tag === 'Expanded' &&
    submitted.readings.length > 0 &&
    submitted.readings.every((reading) => acceptedReadings.has(reading))
  );
};
