import { normalizeAnswer } from '../../../shared/grading/normalize';
import { answerVariants } from '../../../shared/grading/variants';
import type { LearnItem } from '../schemas/learning-models';

// The learning pass is copying practice, not recall practice: the entry is on
// screen while it is typed. So the check is deterministic and local — the same
// normalization the graded path uses, against the spelling shown plus every
// accepted answer of that direction, and never the judge. Nothing is billed
// and nothing is scheduled by getting this right or wrong.
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
