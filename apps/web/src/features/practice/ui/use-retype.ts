import type { CourseKind } from '@wordhold/db/schema/courses';
import { useState } from 'react';
import {
  copyDifference,
  copyDifferenceMessage,
} from '../../../shared/grading/copy-difference';
import { isDeterministicMatch } from '../../../shared/grading/deterministic-match';
import {
  copyMistakeMessage,
  isVerbatimCopy,
} from '../../../shared/grading/recitation';
import type { SubmitResult } from '../schemas/practice-models';
import type { RetypeState } from './practice-answer-form';

// A wrong or skipped card is not left until its answer has been written out
// once, as in the learning pass: the expected answer stands in the field as
// the template and disappears as soon as the learner types.
export const needsRetype = (result: SubmitResult | null): boolean =>
  result?.graded === true && !result.correct;

// The template is the card's textbook answer, so the copy passes whenever
// review grading would accept it. A synonym or antonym card shows its whole
// list, and any one of its words passes. A text is compared word for word,
// without the typos a recitation is forgiven.
export const matchesShownAnswer = (
  expectedAnswer: string,
  typed: string,
  kind: CourseKind,
  relatedWords: ReadonlyArray<string>,
): boolean =>
  kind === 'texts'
    ? isVerbatimCopy(expectedAnswer, typed)
    : isDeterministicMatch(
        typed,
        [expectedAnswer, ...relatedWords].map((text) => ({
          text,
          source: 'textbook',
        })),
      );

// A missed word is typed again from scratch; a missed definition or text
// keeps the copy and names the first word that differs, since most of it is
// usually right.
const missedCopy = (
  kind: CourseKind,
  template: string,
  typed: string,
  relatedWords: ReadonlyArray<string>,
) => {
  switch (kind) {
    case 'texts':
      return {
        message:
          copyMistakeMessage(template, typed) ??
          'Noch nicht ganz. Schreib den Text genau so ab.',
        keepsCopy: true,
      };
    case 'terms':
      return {
        message: copyDifferenceMessage(copyDifference(template, typed)),
        keepsCopy: true,
      };
    case 'language':
      return {
        message:
          relatedWords.length > 0
            ? 'Noch nicht ganz. Schreib eines der Wörter genau so ab.'
            : 'Noch nicht ganz. Schreib die Vokabel genau so ab.',
        keepsCopy: false,
      };
    default:
      return kind satisfies never;
  }
};

export const useRetype = (
  result: SubmitResult | null,
  templateLanguage: string,
  kind: CourseKind,
  // For a synonym or antonym card, its words, any one of which passes.
  relatedWords: ReadonlyArray<string>,
) => {
  const [typed, setTypedText] = useState('');
  const [missedMessage, setMissedMessage] = useState<string | null>(null);
  const required = needsRetype(result);
  const template = result?.expectedAnswer ?? '';

  // True when the card may move on; false after recording a miss.
  const check = (): boolean => {
    if (!required) {
      return true;
    }
    if (matchesShownAnswer(template, typed, kind, relatedWords)) {
      setMissedMessage(null);
      return true;
    }
    const missed = missedCopy(kind, template, typed, relatedWords);
    setMissedMessage(missed.message);
    if (!missed.keepsCopy) {
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
          if (kind === 'language') {
            setMissedMessage(null);
          }
        },
      }
    : null;

  return { required, field, empty: typed.trim() === '', check };
};
