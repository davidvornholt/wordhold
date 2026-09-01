import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { answerVariants } from '../../../shared/grading/variants';
import { type LearnItem, learnAnswer } from '../schemas/learning-models';

// The learning pass introduces one card direction without grading or scheduling
// it. The answer starts as the input placeholder and screen-reader hint, then
// disappears once the learner types so they finish from memory. The local check
// uses the graded path's normalization against that answer plus every accepted
// answer for the direction. It never calls the judge or incurs model cost.
export const matchesLearnItem = (item: LearnItem, typed: string): boolean => {
  const normalized = normalizeAnswerForComparison(typed);
  if (normalized === '') {
    return false;
  }
  const answers = [learnAnswer(item), ...item.textbookAnswers];
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
