import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type SubmitEvent, useEffect, useId, useRef } from 'react';
import { cardClass } from '../../../shared/ui/surface-styles';
import type {
  PracticeSession,
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { FeedbackPanel } from './feedback-panel';
import { PracticeAnswerForm } from './practice-answer-form';
import { useCardSubmission } from './use-card-submission';

type SessionItem = PracticeSession['items'][number];

// "auf" takes the plain language name, so every target language declines
// correctly ("auf Französisch", "auf Latein" — never "ins Lateine").
const practiceInstruction = (
  direction: SessionItem['direction'],
  targetLabel: string,
) =>
  direction === 'to_target'
    ? `Übersetze auf ${targetLabel}`
    : 'Übersetze auf Deutsch';

type CardPracticeProps = {
  readonly item: SessionItem;
  readonly repeated: boolean;
  readonly targetLabel: string;
  readonly mode: ReviewMode;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

export const CardPractice = ({
  item,
  repeated,
  targetLabel,
  mode,
  submit,
  onNext,
}: CardPracticeProps) => {
  const answerInput = useRef<HTMLInputElement>(null);
  const promptId = useId();
  const audioUrl = item.hasAudio ? `/api/entries/${item.entryId}/audio` : null;
  const {
    answer,
    setAnswer,
    submittedAnswer,
    skipped,
    result,
    busy,
    resolution,
    error,
    submitAnswer,
    skipCard,
    resolveWrongAnswer,
  } = useCardSubmission({
    cardId: item.cardId,
    revision: item.revision,
    mode,
    audioUrl,
    submit,
    onNext,
  });

  useEffect(() => {
    if (busy || result !== null) {
      return;
    }
    const focusTask = globalThis.setTimeout(() => answerInput.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, result]);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitAnswer();
  };

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {practiceInstruction(item.direction, targetLabel)}
        {repeated ? ' · Noch einmal' : null}
      </p>
      <div className={cardClass}>
        <h2 className="font-display text-xl" id={promptId}>
          {item.prompt}
        </h2>
      </div>
      <PracticeAnswerForm
        answer={answer}
        busy={busy}
        disabled={result !== null}
        inputRef={answerInput}
        onAnswerChange={setAnswer}
        onSkip={skipCard}
        onSubmit={onSubmit}
        promptId={promptId}
        skipping={busy && skipped}
        submittedAnswer={submittedAnswer}
      />
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      {result === null ? null : (
        <FeedbackPanel
          audioUrl={audioUrl}
          onNext={() => {
            if (!result.graded || result.stored) {
              onNext(result);
            }
          }}
          onResolveWrong={resolveWrongAnswer}
          repeated={repeated}
          resolution={resolution}
          result={result}
          skipped={skipped}
          submittedAnswer={submittedAnswer ?? ''}
        />
      )}
    </>
  );
};
