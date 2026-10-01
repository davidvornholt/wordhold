import type { CourseKind } from '@wordhold/db/schema/courses';
import { useState } from 'react';
import {
  copyDifference,
  copyDifferenceMessage,
} from '../../../shared/grading/copy-difference';
import { isDeterministicMatch } from '../../../shared/grading/deterministic-match';
import type { SubmitResult } from '../schemas/practice-models';
import type { RetypeState } from './practice-answer-form';

// A wrong or skipped card is not left until its answer has been written out
// once, as in the learning pass: the expected answer stands in the field as
// the template and disappears as soon as the learner types.
export const needsRetype = (result: SubmitResult | null): boolean =>
  result?.graded === true && !result.correct;

// The template is the card's textbook answer, so the copy passes whenever
// review grading would accept it.
export const matchesShownAnswer = (
  expectedAnswer: string,
  typed: string,
): boolean =>
  isDeterministicMatch(typed, [{ text: expectedAnswer, source: 'textbook' }]);

export const useRetype = (
  result: SubmitResult | null,
  templateLanguage: string,
  kind: CourseKind,
) => {
  const [typed, setTypedText] = useState('');
  const [missedMessage, setMissedMessage] = useState<string | null>(null);
  const required = needsRetype(result);
  const template = result?.expectedAnswer ?? '';

  // True when the card may move on; false after recording a miss. A missed
  // word is typed again from scratch; a missed definition keeps the copy and
  // names the first word that differs, since most of it is usually right.
  const check = (): boolean => {
    if (!required) {
      return true;
    }
    if (matchesShownAnswer(template, typed)) {
      setMissedMessage(null);
      return true;
    }
    if (kind === 'terms') {
      setMissedMessage(copyDifferenceMessage(copyDifference(template, typed)));
    } else {
      setMissedMessage('Noch nicht ganz. Schreib die Vokabel genau so ab.');
      setTypedText('');
    }
    return false;
  };

  const field: RetypeState | null = required
    ? {
        template,
        templateLanguage,
        typed,
        missedMessage,
        onTypedChange: (value: string) => {
          setTypedText(value);
          // The pointer to the differing word stays while it is fixed.
          if (kind !== 'terms') {
            setMissedMessage(null);
          }
        },
      }
    : null;

  return { required, field, empty: typed.trim() === '', check };
};
