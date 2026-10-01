import { isDeterministicMatch } from '../../../shared/grading/deterministic-match';
import { type LearnItem, learnAnswer } from '../schemas/learning-models';

// The learning pass introduces one card direction without grading or scheduling
// it. The answer starts as the input placeholder and screen-reader hint, then
// disappears once the learner types so they finish from memory. The local check
// applies review grading's deterministic rule to that answer and the direction's
// textbook answers. It never calls the judge or incurs model cost.
export const matchesLearnItem = (item: LearnItem, typed: string): boolean =>
  isDeterministicMatch(
    typed,
    [learnAnswer(item), ...item.textbookAnswers].map((text) => ({
      text,
      source: 'textbook',
    })),
  );
