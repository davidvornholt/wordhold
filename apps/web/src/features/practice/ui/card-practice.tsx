import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type SubmitEvent, useId, useRef } from 'react';
import type { PrepareExamples } from '../../../shared/examples/example-model';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import { WordCard } from '../../../shared/ui/word-card';
import type {
  PracticeSession,
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { FeedbackActions } from './feedback-actions';
import { FeedbackPanel } from './feedback-panel';
import { feedbackTone } from './feedback-tone';
import { PracticeAnswerForm } from './practice-answer-form';
import { useCardFlow } from './use-card-flow';
import { useCardSubmission } from './use-card-submission';
import { usePracticeAudio } from './use-practice-audio';
import { usePreparedExample } from './use-prepared-example';

type SessionItem = PracticeSession['items'][number];

// "auf" takes the plain language name, so every target language declines
// correctly ("auf Französisch", "auf Latein" — never "ins Lateine").
const practiceInstruction = (
  direction: SessionItem['direction'],
  targetLabel: string,
  repeated: boolean,
) => {
  const instruction =
    direction === 'to_target'
      ? `Übersetze auf ${targetLabel}`
      : 'Übersetze auf Deutsch';
  return repeated ? `${instruction} · Noch einmal` : instruction;
};

type CardPracticeProps = {
  readonly item: SessionItem;
  // Cards still waiting behind this one in the round.
  readonly deck: number;
  readonly repeated: boolean;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  readonly mode: ReviewMode;
  readonly prepareExamples: PrepareExamples;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  // Fires as soon as an answer is judged, before "Weiter" moves on.
  readonly onJudged: (outcome: RailOutcome) => void;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

export const CardPractice = ({
  item,
  deck,
  repeated,
  targetLabel,
  targetLanguage,
  mode,
  prepareExamples,
  submit,
  onJudged,
  onNext,
}: CardPracticeProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const promptId = useId();
  const feedbackDescriptionId = useId();
  const { example, loadExample } = usePreparedExample(
    item.entryId,
    item.example,
    prepareExamples,
  );
  const audio = usePracticeAudio({
    entryId: item.entryId,
    hasWordAudio: item.hasAudio,
    example,
    loadExample,
  });
  const submission = useCardSubmission({
    cardId: item.cardId,
    revision: item.revision,
    mode,
    playFeedbackAudio: audio.playFeedbackAudio,
    submit,
    onNext,
  });
  const { result, busy, resolution } = submission;
  useCardFlow({
    busy,
    result,
    example,
    loadExample,
    onJudged,
    inputRef,
    nextButtonRef,
  });

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submission.submitAnswer();
  };
  const tone = result === null ? 'neutral' : feedbackTone(result);
  const pendingWrong = result?.graded === true && !result.stored;

  return (
    <>
      <WordCard
        deck={deck}
        eyebrow={practiceInstruction(item.direction, targetLabel, repeated)}
        tone={tone}
        word={item.prompt}
        wordId={promptId}
        wordLang={item.direction === 'to_native' ? targetLanguage : undefined}
      >
        {result === null ? null : (
          <FeedbackPanel
            answerLanguage={
              item.direction === 'to_target' ? targetLanguage : 'de'
            }
            busy={busy || resolution !== null}
            example={example}
            id={feedbackDescriptionId}
            playSentence={audio.playSentence}
            playWord={audio.playWord}
            repeated={repeated}
            result={result}
            skipped={submission.skipped}
            submittedAnswer={submission.submittedAnswer ?? ''}
            targetLanguage={targetLanguage}
          />
        )}
      </WordCard>
      <PracticeAnswerForm
        answer={submission.answer}
        busy={busy}
        disabled={result !== null}
        inputRef={inputRef}
        onAnswerChange={submission.setAnswer}
        onSkip={submission.skipCard}
        onSubmit={onSubmit}
        promptId={promptId}
        skipping={busy && submission.skipped}
        submittedAnswer={submission.submittedAnswer}
        tone={tone}
      />
      {submission.error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {submission.error}
        </p>
      )}
      {result === null ? null : (
        <FeedbackActions
          audioPlaying={audio.playing}
          busy={busy}
          example={example}
          feedbackDescriptionId={feedbackDescriptionId}
          graded={result.graded}
          nextButton={nextButtonRef}
          onNext={() => {
            if (!result.graded || result.stored) {
              onNext(result);
            }
          }}
          onResolveWrong={submission.resolveWrongAnswer}
          pendingWrong={pendingWrong}
          playWord={audio.playWord}
          resolution={resolution}
          stopAudio={audio.stopAudio}
        />
      )}
    </>
  );
};
