import type { AnswerSource } from '@wordhold/db/schema/entries';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { answerVariants } from '../../../shared/grading/variants';

export type AcceptedAnswer = {
  readonly text: string;
  readonly source: AnswerSource;
};

const dictionaryGenderLabel = /\s+(?:m|f|mf)\.$/u;

const textbookReadings = (text: string): ReadonlyArray<string> => {
  // Dictionary labels describe the answer; they are not part of the phrase.
  // Only textbook answers get these omissions, never learned alternatives.
  const expansion = answerVariants(text.replace(dictionaryGenderLabel, ''));
  return expansion._tag === 'Expanded'
    ? expansion.readings.flatMap((reading) =>
        reading.startsWith('to ')
          ? [reading, reading.slice('to '.length)]
          : [reading],
      )
    : [];
};

export const isDeterministicMatch = (
  submittedAnswer: string,
  accepted: ReadonlyArray<AcceptedAnswer>,
): boolean => {
  const normalized = normalizeAnswerForComparison(submittedAnswer);
  if (
    accepted.some(
      (answer) => normalizeAnswerForComparison(answer.text) === normalized,
    )
  ) {
    return true;
  }

  const acceptedReadings = new Set(
    accepted.map((answer) => normalizeAnswerForComparison(answer.text)),
  );
  for (const answer of accepted) {
    if (answer.source === 'textbook') {
      for (const reading of textbookReadings(answer.text)) {
        acceptedReadings.add(reading);
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
