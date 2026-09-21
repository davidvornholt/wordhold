import { normalizeAnswerForComparison } from './normalize';
import { answerVariants } from './variants';

// Whether typed text reproduces one of the accepted answers: the graded
// path's normalization, plus every reading the textbook notation stands for
// ("el/la tenista" accepts "la tenista"). Never calls the judge.
export const matchesAcceptedAnswer = (
  answers: ReadonlyArray<string>,
  typed: string,
): boolean => {
  const normalized = normalizeAnswerForComparison(typed);
  if (normalized === '') {
    return false;
  }
  if (
    answers.some(
      (answer) => normalizeAnswerForComparison(answer) === normalized,
    )
  ) {
    return true;
  }
  return answers.some((answer) => {
    const expansion = answerVariants(answer);
    return (
      expansion._tag === 'Expanded' && expansion.readings.includes(normalized)
    );
  });
};
