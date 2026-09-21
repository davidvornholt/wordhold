import { type RefObject, useEffect } from 'react';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import type { SubmitResult } from '../schemas/practice-models';

const outcomeOf = (result: SubmitResult): RailOutcome => {
  if (!result.graded) {
    return 'ungraded';
  }
  return result.correct ? 'correct' : 'wrong';
};

type CardFlowInput = {
  readonly busy: boolean;
  readonly result: SubmitResult | null;
  readonly example: PreparedExampleSentence | null;
  readonly loadExample: () => Promise<PreparedExampleSentence | null>;
  readonly onJudged: (outcome: RailOutcome) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly nextButtonRef: RefObject<HTMLButtonElement | null>;
  // After a mistake the field asks for the answer again, so focus stays there.
  readonly retypeRequired: boolean;
};

// What happens around a card between answering and moving on: focus follows
// the loop (the field while answering, "Weiter" once judged), the rail hears
// the verdict, and a graded card fetches its example sentence if missing.
export const useCardFlow = ({
  busy,
  result,
  example,
  loadExample,
  onJudged,
  inputRef,
  nextButtonRef,
  retypeRequired,
}: CardFlowInput) => {
  useEffect(() => {
    if (busy) {
      return;
    }
    const target = result === null || retypeRequired ? inputRef : nextButtonRef;
    const focusTask = globalThis.setTimeout(() => target.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, result, retypeRequired, inputRef, nextButtonRef]);

  useEffect(() => {
    if (result !== null) {
      onJudged(outcomeOf(result));
    }
  }, [onJudged, result]);

  useEffect(() => {
    if (!result?.graded || example !== null) {
      return;
    }
    loadExample().catch(() => undefined);
  }, [example, loadExample, result]);
};
