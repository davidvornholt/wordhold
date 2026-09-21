import { useState } from 'react';
import { matchesAcceptedAnswer } from '../../../shared/grading/accepted';
import type { SubmitResult } from '../schemas/practice-models';
import type { RetypeState } from './practice-answer-form';

// A wrong or skipped card is not left until its answer has been written out
// once, as in the learning pass: the expected answer stands in the field as
// the template and disappears as soon as the learner types.
export const needsRetype = (result: SubmitResult | null): boolean =>
  result?.graded === true && !result.correct;

export const useRetype = (
  result: SubmitResult | null,
  templateLanguage: string,
) => {
  const [typed, setTypedText] = useState('');
  const [missed, setMissed] = useState(false);
  const required = needsRetype(result);

  // True when the card may move on; false after recording a miss, with the
  // field cleared for another attempt.
  const check = (): boolean => {
    if (!required) {
      return true;
    }
    if (matchesAcceptedAnswer(result?.expectedAnswers ?? [], typed)) {
      setMissed(false);
      return true;
    }
    setMissed(true);
    setTypedText('');
    return false;
  };

  const field: RetypeState | null = required
    ? {
        template: result?.expectedAnswers.at(0) ?? '',
        templateLanguage,
        typed,
        missed,
        onTypedChange: (value: string) => {
          setTypedText(value);
          setMissed(false);
        },
      }
    : null;

  return { required, field, empty: typed.trim() === '', check };
};
