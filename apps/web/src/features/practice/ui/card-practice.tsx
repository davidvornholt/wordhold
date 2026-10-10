import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type ReactNode, useId, useRef } from 'react';
import {
  type CourseSubject,
  isRelationDirection,
} from '../../../shared/directions';
import type { PrepareExamples } from '../../../shared/examples/example-model';
import { germanLabels } from '../../../shared/languages';
import {
  answerLanguage,
  foreignPromptLanguage,
} from '../../../shared/practice/card-texts';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import type { AnswerFieldElement } from '../../../shared/ui/answer-field';
import { RelationQuestion } from '../../../shared/ui/relation-question';
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
import { useCardContinuation } from './use-card-continuation';
import { useCardFlow } from './use-card-flow';
import { useCardSubmission } from './use-card-submission';
import { usePracticeAudio } from './use-practice-audio';
import { usePreparedExample } from './use-prepared-example';
import { useRetype } from './use-retype';

type SessionItem = PracticeSession['items'][number];

// "auf" takes the plain language name, so every target language declines
// correctly ("auf Französisch", "auf Latein" — never "ins Lateine"). A
// synonym or antonym is asked in the course's language, as a test does.
const practiceInstruction = (
  direction: SessionItem['direction'],
  subject: CourseSubject,
  repeated: boolean,
): ReactNode => {
  if (isRelationDirection(direction)) {
    const question = (
      <RelationQuestion
        direction={direction}
        language={subject.targetLanguage}
      />
    );
    return repeated ? <>{question} · Noch einmal</> : question;
  }
  let instruction = 'Übersetze auf Deutsch';
  if (subject.kind === 'terms') {
    instruction = 'Erkläre den Begriff';
  } else if (subject.kind === 'texts') {
    instruction = 'Schreib den Text auswendig';
  } else if (direction === 'to_target') {
    instruction = `Übersetze auf ${germanLabels[subject.targetLanguage]}`;
  }
  return repeated ? `${instruction} · Noch einmal` : instruction;
};

type CardPracticeProps = {
  readonly item: SessionItem;
  // Cards still waiting behind this one in the round.
  readonly deck: number;
  readonly repeated: boolean;
  readonly subject: CourseSubject;
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
  subject,
  mode,
  prepareExamples,
  submit,
  onJudged,
  onNext,
}: CardPracticeProps) => {
  const inputRef = useRef<AnswerFieldElement>(null);
  const { targetLanguage } = subject;
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
  const answerLang = answerLanguage(item.direction, targetLanguage);
  const retype = useRetype(result, answerLang, subject.kind, item.relatedWords);
  useCardFlow({
    busy,
    result,
    example,
    loadExample,
    onJudged,
    inputRef,
    nextButtonRef,
    retypeRequired: retype.required,
  });
  const tone = result === null ? 'neutral' : feedbackTone(result);
  const { continueCard, onSubmit } = useCardContinuation({
    submission,
    checkRetype: retype.check,
    inputRef,
    onNext,
  });

  return (
    <>
      <WordCard
        deck={deck}
        eyebrow={practiceInstruction(item.direction, subject, repeated)}
        tone={tone}
        word={item.prompt}
        wordId={promptId}
        wordLang={foreignPromptLanguage(item.direction, targetLanguage)}
      >
        {result === null ? null : (
          <FeedbackPanel
            answerLanguage={answerLang}
            busy={busy || resolution !== null}
            dictated={submission.submittedDictated}
            example={example}
            id={feedbackDescriptionId}
            kind={subject.kind}
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
        kind={subject.kind}
        onAnswerChange={submission.setAnswer}
        onDictation={submission.appendDictation}
        onSkip={submission.skipCard}
        onSubmit={onSubmit}
        promptId={promptId}
        retype={retype.field}
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
          nextDisabled={retype.required && retype.empty}
          onNext={continueCard}
          onResolveWrong={submission.resolveWrongAnswer}
          pendingWrong={result.graded && !result.stored}
          playWord={audio.playWord}
          resolution={resolution}
          stopAudio={audio.stopAudio}
        />
      )}
    </>
  );
};
