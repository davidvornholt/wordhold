import type { CourseKind } from '@wordhold/db/schema/courses';
import type { RefObject, SubmitEvent, SubmitEventHandler } from 'react';
import { isListCourse } from '../../../shared/directions';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import { CharacterPalette } from '../../../shared/ui/character-palette';
import type { CardTone } from '../../../shared/ui/word-card';
import { DictationButton } from './dictation-button';
import { toneField } from './feedback-tone';
import { type Dictation, useDictation } from './use-dictation';

// After a wrong or skipped answer the field asks for the answer to be written
// out; the expected answer is its template until the learner types.
export type RetypeState = {
  readonly template: string;
  readonly templateLanguage: string;
  readonly typed: string;
  // What went wrong in the last attempt, or null before one was checked.
  readonly missedMessage: string | null;
  readonly onTypedChange: (typed: string) => void;
};

type PracticeAnswerFormProps = {
  readonly answer: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly inputRef: RefObject<AnswerFieldElement | null>;
  readonly kind: CourseKind;
  readonly onAnswerChange: (answer: string) => void;
  readonly onDictation: (transcript: string) => void;
  readonly onSkip: () => void;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly promptId: string;
  readonly retype: RetypeState | null;
  readonly skipping: boolean;
  readonly submittedAnswer: string | null;
  // Once judged, the field keeps the answer and takes the verdict's tone.
  readonly tone: CardTone;
};

const answerPlaceholders = {
  language: 'Deine Antwort',
  terms: 'Deine Definition',
  texts: 'Dein Text',
} as const satisfies Record<CourseKind, string>;

const RetypeField = ({
  busy,
  hintId,
  inputRef,
  multiline,
  promptId,
  retype,
}: Pick<PracticeAnswerFormProps, 'busy' | 'inputRef' | 'promptId'> & {
  // Definitions and texts are answered in a field that wraps.
  readonly multiline: boolean;
  readonly hintId: string;
  readonly retype: RetypeState;
}) => (
  <>
    {retype.typed === '' ? (
      <span className="sr-only" id={hintId}>
        Vorlage: <span lang={retype.templateLanguage}>{retype.template}</span>
      </span>
    ) : null}
    <AnswerField
      aria-describedby={
        retype.typed === '' ? `${promptId} ${hintId}` : promptId
      }
      aria-label="Schreib die Antwort ab"
      borderClass={
        retype.missedMessage === null ? toneField.neutral : toneField.warning
      }
      disabled={busy}
      fieldRef={inputRef}
      multiline={multiline}
      onChange={retype.onTypedChange}
      placeholder={retype.template}
      value={retype.typed}
    />
    {retype.missedMessage === null ? null : (
      <p className="text-center text-sm" role="status">
        {retype.missedMessage}
      </p>
    )}
  </>
);

// Help with writing the answer: a subject's formulas need characters the
// keyboard lacks, and a text can be recited aloud.
const AnswerAids = ({
  busy,
  dictation,
  inputRef,
  kind,
}: Pick<PracticeAnswerFormProps, 'busy' | 'inputRef' | 'kind'> & {
  readonly dictation: Dictation;
}) => {
  if (kind === 'terms') {
    return <CharacterPalette disabled={busy} fieldRef={inputRef} />;
  }
  return kind === 'texts' && dictation.supported ? (
    <DictationButton dictation={dictation} disabled={busy} />
  ) : null;
};

export const PracticeAnswerForm = ({
  answer,
  busy,
  disabled,
  inputRef,
  kind,
  onAnswerChange,
  onDictation,
  onSkip,
  onSubmit,
  promptId,
  retype,
  skipping,
  submittedAnswer,
  tone,
}: PracticeAnswerFormProps) => {
  const multiline = isListCourse(kind);
  const dictation = useDictation(onDictation);
  // A recording in progress would be lost, so the answer waits for its text.
  const dictating =
    dictation.status === 'recording' || dictation.status === 'transcribing';
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    if (dictating) {
      event.preventDefault();
      return;
    }
    dictation.abandonStart();
    onSubmit(event);
  };
  const skip = () => {
    dictation.abandonStart();
    onSkip();
  };
  return (
    <form aria-busy={busy} className="flex flex-col gap-3" onSubmit={submit}>
      {retype === null ? (
        <AnswerField
          aria-describedby={promptId}
          aria-label="Deine Antwort"
          borderClass={toneField[tone]}
          disabled={busy || disabled}
          fieldRef={inputRef}
          multiline={multiline}
          onChange={onAnswerChange}
          placeholder={answerPlaceholders[kind]}
          value={submittedAnswer ?? answer}
        />
      ) : (
        <RetypeField
          busy={busy}
          hintId={`${promptId}-retype-hint`}
          inputRef={inputRef}
          multiline={multiline}
          promptId={promptId}
          retype={retype}
        />
      )}
      {disabled ? null : (
        <>
          <AnswerAids
            busy={busy}
            dictation={dictation}
            inputRef={inputRef}
            kind={kind}
          />
          <Button
            disabled={busy || dictating || answer.trim() === ''}
            type="submit"
          >
            {busy && !skipping ? 'Wird geprüft …' : 'Prüfen'}
          </Button>
          <Button
            className="w-fit self-center px-3 py-2"
            disabled={busy || dictating}
            onClick={skip}
            variant="quiet-muted"
          >
            {skipping ? 'Wird gespeichert …' : 'Weiß ich nicht'}
          </Button>
        </>
      )}
    </form>
  );
};
