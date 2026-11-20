import type { RefObject, SubmitEvent } from 'react';
import type { AnswerFieldElement } from '../../../shared/ui/answer-field';
import type { ResolvedSubmitResult } from '../schemas/practice-models';
import type { useCardSubmission } from './use-card-submission';
import type { Dictation } from './use-dictation';

type CardContinuationInput = {
  readonly submission: ReturnType<typeof useCardSubmission>;
  readonly checkRetype: () => boolean;
  readonly dictation: Dictation;
  readonly inputRef: RefObject<AnswerFieldElement | null>;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

// Moving on from a judged card: a wrong or skipped answer first has to be
// written out, a rejected answer is then stored as wrong, and a stored or
// ungraded card simply advances. The card's one form submits both before and
// after the verdict, so Enter and its one button work the same throughout.
// A recording in progress would be lost, so the answer waits for its text.
export const useCardContinuation = ({
  submission,
  checkRetype,
  dictation,
  inputRef,
  onNext,
}: CardContinuationInput) => {
  const { result, busy, resolution } = submission;
  const dictating =
    dictation.status === 'recording' || dictation.status === 'transcribing';
  const continueCard = () => {
    if (result === null || !checkRetype()) {
      inputRef.current?.focus();
      return;
    }
    if (result.graded && !result.stored) {
      submission.resolveWrongAnswer('again').catch(() => undefined);
    } else {
      onNext(result);
    }
  };
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dictating) {
      return;
    }
    dictation.abandonStart();
    if (result === null) {
      submission.submitAnswer().catch(() => undefined);
    } else if (!(busy || resolution !== null)) {
      continueCard();
    }
  };
  const skip = () => {
    dictation.abandonStart();
    submission.skipCard().catch(() => undefined);
  };
  return { dictating, onSubmit, skip };
};
