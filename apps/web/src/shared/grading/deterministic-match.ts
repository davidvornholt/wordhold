import type { AnswerSource } from '@wordhold/db/schema/entries';
import { isSameReading } from './formula-notation';
import { normalizeAnswerForComparison } from './normalize';
import { answerVariants } from './variants';

export type AcceptedAnswer = {
  readonly text: string;
  readonly source: AnswerSource;
};

const dictionaryGenderLabel = /\s+(?:m|f|mf)\.$/u;

const textbookReadings = (text: string): ReadonlyArray<string> => {
  // Dictionary labels describe the answer; they are not part of the phrase.
  // Only textbook answers get these omissions, never learned alternatives.
  const expansion = answerVariants(text.replace(dictionaryGenderLabel, ''));
  // The judge distinguishes optional infinitive markers from prepositions.
  return expansion._tag === 'Expanded' ? expansion.readings : [];
};

// Whether a typed answer is accepted without asking the judge. Review
// grading, the learning pass, and the retype after a mistake all use this one
// rule, so an answer that passes review also passes when the word is first
// learned. A typed answer in textbook notation ("estar ilusionado/a (con
// algo)") passes when every reading it stands for is an accepted reading.
export const isDeterministicMatch = (
  submittedAnswer: string,
  accepted: ReadonlyArray<AcceptedAnswer>,
): boolean => {
  const normalized = normalizeAnswerForComparison(submittedAnswer);
  const acceptedTexts = accepted.map((answer) =>
    normalizeAnswerForComparison(answer.text),
  );
  if (acceptedTexts.some((text) => isSameReading(text, normalized))) {
    return true;
  }

  const acceptedReadings = [
    ...acceptedTexts,
    ...accepted.flatMap((answer) =>
      answer.source === 'textbook' ? textbookReadings(answer.text) : [],
    ),
  ];
  const submitted = answerVariants(submittedAnswer);
  return (
    submitted._tag === 'Expanded' &&
    submitted.readings.length > 0 &&
    submitted.readings.every((reading) =>
      acceptedReadings.some((acceptedReading) =>
        isSameReading(acceptedReading, reading),
      ),
    )
  );
};
