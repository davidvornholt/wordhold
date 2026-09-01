import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type SubmitEvent, useCallback, useEffect, useId, useRef } from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import type { PrepareExamples } from '../../../shared/examples/example-model';
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
import { usePreparedExample } from './use-prepared-example';

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
  readonly targetLanguage: LanguageCode;
  readonly mode: ReviewMode;
  readonly prepareExamples: PrepareExamples;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

export const CardPractice = ({
  item,
  repeated,
  targetLabel,
  targetLanguage,
  mode,
  prepareExamples,
  submit,
  onNext,
}: CardPracticeProps) => {
  const answerInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const promptId = useId();
  const { example, loadExample } = usePreparedExample(
    item.entryId,
    item.example,
    prepareExamples,
  );
  const wordAudioUrl = item.hasAudio
    ? `/api/entries/${item.entryId}/audio`
    : null;
  const sentenceAudioUrl = example?.hasAudio
    ? `/api/entries/${item.entryId}/example-audio`
    : null;
  const playAudio = useAudioPlayback();
  const playSentence = useCallback(
    () => playAudio(sentenceAudioUrl),
    [playAudio, sentenceAudioUrl],
  );
  const playWord = useCallback(
    () => playAudio(wordAudioUrl),
    [playAudio, wordAudioUrl],
  );
  const playFeedbackAudio = useCallback(async () => {
    const prepared = await loadExample();
    if (!mounted.current) {
      return;
    }
    const preparedSentenceUrl = prepared?.hasAudio
      ? `/api/entries/${item.entryId}/example-audio`
      : null;
    await playAudio(preparedSentenceUrl ?? wordAudioUrl);
  }, [item.entryId, loadExample, playAudio, wordAudioUrl]);
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
    playFeedbackAudio,
    submit,
    onNext,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (busy || result !== null) {
      return;
    }
    const focusTask = globalThis.setTimeout(() => answerInput.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, result]);

  useEffect(() => {
    if (!result?.graded || example !== null) {
      return;
    }
    loadExample().catch(() => undefined);
  }, [example, loadExample, result]);

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
          busy={busy}
          example={example}
          onNext={() => {
            if (!result.graded || result.stored) {
              onNext(result);
            }
          }}
          playSentence={sentenceAudioUrl === null ? null : playSentence}
          playWord={wordAudioUrl === null ? null : playWord}
          onResolveWrong={resolveWrongAnswer}
          repeated={repeated}
          resolution={resolution}
          result={result}
          skipped={skipped}
          submittedAnswer={submittedAnswer ?? ''}
          targetLanguage={targetLanguage}
        />
      )}
    </>
  );
};
