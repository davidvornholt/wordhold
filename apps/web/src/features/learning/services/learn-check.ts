import { normalizeAnswer } from '../../../shared/grading/normalize';
import { answerVariants } from '../../../shared/grading/variants';
import type { LearnItem } from '../schemas/learning-models';

// The learning pass introduces an entry without grading or scheduling it. The
// target starts as the input placeholder and screen-reader hint, then disappears
// once the learner types so they finish from memory. The local check uses the
// graded path's normalization against that target plus every accepted answer for
// the direction. It never calls the judge or incurs model cost.
export const matchesLearnItem = (item: LearnItem, typed: string): boolean => {
  const normalized = normalizeAnswer(typed);
  if (normalized === '') {
    return false;
  }
  const answers = [item.targetText, ...item.textbookAnswers];
  if (answers.some((answer) => normalizeAnswer(answer) === normalized)) {
    return true;
  }
  return answers.some((answer) => {
    const expansion = answerVariants(answer);
    return (
      expansion._tag === 'Expanded' && expansion.readings.includes(normalized)
    );
  });
};
