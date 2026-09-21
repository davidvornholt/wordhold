import { matchesAcceptedAnswer } from '../../../shared/grading/accepted';
import { type LearnItem, learnAnswer } from '../schemas/learning-models';

// The learning pass introduces one card direction without grading or scheduling
// it. The answer starts as the input placeholder and screen-reader hint, then
// disappears once the learner types so they finish from memory. The local check
// uses the graded path's normalization against that answer plus every accepted
// answer for the direction. It never calls the judge or incurs model cost.
export const matchesLearnItem = (item: LearnItem, typed: string): boolean =>
  matchesAcceptedAnswer([learnAnswer(item), ...item.textbookAnswers], typed);
