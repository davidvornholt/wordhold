import type { RefObject, SubmitEvent } from 'react';
import type { ResolvedSubmitResult } from '../schemas/practice-models';
import type { useCardSubmission } from './use-card-submission';

type CardContinuationInput = {
  readonly submission: ReturnType<typeof useCardSubmission>;
  readonly checkRetype: () => boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

// Moving on from a judged card: a wrong or skipped answer first has to be
// written out, a rejected answer is then stored as wrong, and a stored or
// ungraded card simply advances. The answer form's submit does the same, so
// Enter in the field works before and after the verdict.
export const useCardContinuation = ({
  submission,
  checkRetype,
  inputRef,
  onNext,
}: CardContinuationInput) => {
  const { result, busy, resolution } = submission;
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
  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (result === null) {
      await submission.submitAnswer();
    } else if (!(busy || resolution !== null)) {
      continueCard();
    }
  };
  return { continueCard, onSubmit };
};
