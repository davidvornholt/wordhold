import type { ReviewMode } from '@wordhold/db/schema/practice';
import { useRef } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import type { PrepareExamples } from '../../../shared/examples/example-model';
import { answerCharacters } from '../../../shared/practice/answer-characters';
import { answerLanguage } from '../../../shared/practice/card-texts';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import type { AnswerFieldElement } from '../../../shared/ui/answer-field';
import type {
  PracticeSession,
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { useCardContinuation } from './use-card-continuation';
import { useCardFlow } from './use-card-flow';
import { useCardSubmission } from './use-card-submission';
import { useDictation } from './use-dictation';
import { usePracticeAudio } from './use-practice-audio';
import { usePreparedExample } from './use-prepared-example';
import { useRetype } from './use-retype';

export type PracticeCardInput = {
  readonly item: PracticeSession['items'][number];
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

// Everything one practice card does besides drawing itself: its example and
// sounds, the answer and its verdict, the line a missed answer is written
// out on, dictation, and where focus goes as the card moves along.
export const usePracticeCard = ({
  item,
  subject,
  mode,
  prepareExamples,
  submit,
  onJudged,
  onNext,
}: PracticeCardInput) => {
  const inputRef = useRef<AnswerFieldElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
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
  const answerLang = answerLanguage(item.direction, subject.targetLanguage);
  const retype = useRetype(
    submission.result,
    answerLang,
    subject.kind,
    item.relatedWords,
  );
  useCardFlow({
    busy: submission.busy,
    result: submission.result,
    example,
    loadExample,
    onJudged,
    inputRef,
    nextButtonRef,
    retypeRequired: retype.required,
  });
  const dictation = useDictation(submission.appendDictation);
  const continuation = useCardContinuation({
    submission,
    checkRetype: retype.check,
    dictation,
    inputRef,
    onNext,
  });
  return {
    ...continuation,
    answerLang,
    audio,
    characters: answerCharacters(subject.kind, answerLang),
    dictation,
    example,
    inputRef,
    nextButtonRef,
    retype,
    skipping: submission.busy && submission.skipped,
    submission,
  };
};
