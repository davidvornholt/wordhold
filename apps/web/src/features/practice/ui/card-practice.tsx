import { type ReactNode, useId } from 'react';
import {
  type CourseSubject,
  isRelationDirection,
} from '../../../shared/directions';
import { germanLabels } from '../../../shared/languages';
import { shownPitfalls } from '../../../shared/pitfalls/pitfall-model';
import { foreignPromptLanguage } from '../../../shared/practice/card-texts';
import { RelationQuestion } from '../../../shared/ui/relation-question';
import { WordCard } from '../../../shared/ui/word-card';
import { AnswerEntry, RetypeLine } from './answer-entry';
import { CheckActions, ContinueActions } from './card-actions';
import { FeedbackPanel } from './feedback-panel';
import { SubmissionNotice } from './submission-notice';
import { type PracticeCardInput, usePracticeCard } from './use-practice-card';

type SessionItem = PracticeCardInput['item'];

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

type CardPracticeProps = PracticeCardInput & {
  // Cards still waiting behind this one in the round.
  readonly deck: number;
  readonly repeated: boolean;
};

// One card, answered and continued in one form: Enter checks the answer,
// and once judged, writes the missed one out or moves on. The one button at
// the right does both, so the hand stays in place.
export const CardPractice = ({
  deck,
  repeated,
  ...input
}: CardPracticeProps) => {
  const { item, subject } = input;
  const { targetLanguage } = subject;
  const promptId = useId();
  const feedbackDescriptionId = useId();
  const {
    answerLang,
    audio,
    characters,
    dictating,
    dictation,
    example,
    inputRef,
    nextButtonRef,
    onSubmit,
    retype,
    skip,
    skipping,
    submission,
  } = usePracticeCard(input);
  const { result, busy, resolution, error, reconnecting } = submission;

  return (
    <form aria-busy={busy} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <WordCard
        deck={deck}
        instruction={practiceInstruction(item.direction, subject, repeated)}
        word={item.prompt}
        wordId={promptId}
        wordLang={foreignPromptLanguage(item.direction, targetLanguage)}
      >
        {result === null ? (
          <AnswerEntry
            answerLanguage={answerLang}
            busy={busy}
            characters={characters}
            checking={busy && !skipping}
            dictation={dictation}
            inputRef={inputRef}
            kind={subject.kind}
            onAnswerChange={submission.setAnswer}
            otherWording={submission.otherWording}
            promptId={promptId}
            value={submission.submittedAnswer ?? submission.answer}
          />
        ) : (
          <FeedbackPanel
            answerLanguage={answerLang}
            busy={busy || resolution !== null}
            dictated={submission.submittedDictated}
            example={example}
            id={feedbackDescriptionId}
            kind={subject.kind}
            repeated={repeated}
            result={result}
            retype={
              retype.field === null ? null : (
                <RetypeLine
                  busy={busy}
                  characters={characters}
                  hintId={`${promptId}-retype-hint`}
                  inputRef={inputRef}
                  kind={subject.kind}
                  promptId={promptId}
                  retype={retype.field}
                />
              )
            }
            sentence={audio.sentence}
            skipped={submission.skipped}
            spellingPitfalls={shownPitfalls(item)}
            submittedAnswer={submission.submittedAnswer ?? ''}
            targetLanguage={targetLanguage}
            word={audio.word}
          />
        )}
      </WordCard>
      <SubmissionNotice error={error} reconnecting={reconnecting} />
      {result === null ? (
        <CheckActions
          blocked={busy || dictating}
          checking={busy && !skipping}
          empty={submission.answer.trim() === ''}
          nextButtonRef={nextButtonRef}
          onSkip={skip}
          skipping={skipping}
        />
      ) : (
        <ContinueActions
          busy={busy}
          feedbackId={feedbackDescriptionId}
          kind={subject.kind}
          nextButtonRef={nextButtonRef}
          onOverrule={() => {
            submission.resolveWrongAnswer('hard').catch(() => undefined);
          }}
          overrulable={result.graded && !result.stored}
          resolution={resolution}
          retypeMissing={retype.required && retype.empty}
        />
      )}
    </form>
  );
};
