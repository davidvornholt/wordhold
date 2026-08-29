import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import type {
  PracticeSession,
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type {
  SubmitPayloadData,
  WrongAnswerResolution,
} from '../schemas/submission-schema';
import { FeedbackPanel } from './feedback-panel';
import { PracticeAnswerForm } from './practice-answer-form';

type SessionItem = PracticeSession['items'][number];

const practiceInstruction = (
  direction: SessionItem['direction'],
  targetLabel: string,
) =>
  direction === 'to_target'
    ? `Übersetze ins ${targetLabel}e`
    : 'Übersetze ins Deutsche';

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
  const [answer, setAnswer] = useState('');
  const [submittedData, setSubmittedData] = useState<SubmitPayloadData | null>(
    null,
  );
  const [startedAt] = useState(() => performance.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<Exclude<
    WrongAnswerResolution,
    'defer'
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioUrl = item.hasAudio ? `/api/entries/${item.entryId}/audio` : null;

  useEffect(() => {
    if (busy || result !== null) {
      return;
    }
    const focusTask = globalThis.setTimeout(() => answerInput.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, result]);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || result !== null) {
      return;
    }
    const data: SubmitPayloadData = {
      cardId: item.cardId,
      revision: item.revision,
      answer,
      elapsedMs: Math.floor(performance.now() - startedAt),
      wrongAnswerResolution: 'defer',
      mode,
    };
    setSubmittedData(data);
    setBusy(true);
    setError(null);
    try {
      const submitted = await submit({ data });
      setResult(submitted);
      if (audioUrl !== null) {
        await new Audio(audioUrl).play().catch(() => undefined);
      }
    } catch (cause) {
      setSubmittedData(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const resolveWrongAnswer = async (
    wrongAnswerResolution: Exclude<WrongAnswerResolution, 'defer'>,
  ) => {
    if (
      busy ||
      submittedData === null ||
      result === null ||
      !result.graded ||
      result.stored
    ) {
      return;
    }
    setBusy(true);
    setResolution(wrongAnswerResolution);
    setError(null);
    try {
      const submitted = await submit({
        data: {
          ...submittedData,
          wrongAnswerResolution,
          assessmentId: result.assessmentId,
        },
      });
      if (submitted.graded && !submitted.stored) {
        throw new Error('Die Antwort wurde noch nicht gespeichert.');
      }
      setResult(submitted);
      onNext(submitted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      setResolution(null);
    }
  };

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {practiceInstruction(item.direction, targetLabel)}
        {repeated ? ' · Noch einmal' : null}
      </p>
      <div className="border border-border bg-card p-6">
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
        onSubmit={onSubmit}
        promptId={promptId}
        submittedAnswer={submittedData?.answer ?? null}
      />
      {error === null ? null : (
        <p className="text-destructive text-sm">{error}</p>
      )}
      {result === null || submittedData === null ? null : (
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
          submittedAnswer={submittedData.answer}
        />
      )}
    </>
  );
};
