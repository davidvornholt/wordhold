import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import { type CourseSubject, directionLabel } from '../../../shared/directions';
import {
  copyDifference,
  copyDifferenceMessage,
} from '../../../shared/grading/copy-difference';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import { KeyPointList } from '../../../shared/ui/key-point-list';
import { WordCard } from '../../../shared/ui/word-card';
import {
  type LearnItem,
  learnAnswer,
  learnPrompt,
} from '../schemas/learning-models';
import { matchesLearnItem } from '../services/learn-check';
import { LearnExampleAudio } from './learn-example-audio';

type LearnEntryProps = {
  readonly item: LearnItem;
  // Entries still waiting behind this one in the section.
  readonly deck: number;
  readonly subject: CourseSubject;
  // Records that this direction has been met. Only called once the learner has
  // written it correctly, and the next direction waits until it has been stored.
  readonly onLearned: () => Promise<void>;
};

// A definition is shown to be copied, with what it must state once known. A
// word has its example sentence and audio instead.
const LearnCardBody = ({
  item,
  subject,
  definitionId,
}: {
  readonly item: LearnItem;
  readonly subject: CourseSubject;
  readonly definitionId: string;
}) =>
  subject.kind === 'terms' ? (
    <>
      <p className="text-lg" id={definitionId}>
        {learnAnswer(item)}
      </p>
      {item.keyPoints === null ? null : (
        <KeyPointList
          items={item.keyPoints.map((text) => ({
            text,
            covered: null,
            note: null,
          }))}
        />
      )}
    </>
  ) : (
    <LearnExampleAudio item={item} targetLanguage={subject.targetLanguage} />
  );

// A missed word is typed again from scratch; a missed definition keeps the
// copy and names the first word that differs.
const missMessage = (definition: boolean, answer: string, typed: string) =>
  definition
    ? copyDifferenceMessage(copyDifference(answer, typed))
    : 'Noch nicht ganz. Schreib die Vokabel genau so ab.';

const actionLabelFor = (busy: boolean, saveFailed: boolean): string => {
  if (busy) {
    return 'Wird gespeichert …';
  }
  return saveFailed ? 'Erneut versuchen' : 'Weiter';
};

// One direction of the learning pass. A word's answer starts as the field's
// prompt, then disappears once typing begins so the learner has to hold it in
// memory. A definition is too long for that, so it stays on the card and is
// copied; recalling it is left to practice. Being wrong only asks again.
export const LearnEntry = ({
  item,
  deck,
  subject,
  onLearned,
}: LearnEntryProps) => {
  const [typed, setTyped] = useState('');
  const [missedMessage, setMissedMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const answerHintId = useId();
  const inputId = useId();
  const promptId = useId();
  const inputRef = useRef<AnswerFieldElement>(null);
  const definition = subject.kind === 'terms';
  const answer = learnAnswer(item);
  const prompt = learnPrompt(item);
  const answerLanguage =
    item.direction === 'to_target' ? subject.targetLanguage : 'de';
  useEffect(() => {
    if (busy) {
      return;
    }
    const focusTask = globalThis.setTimeout(() => inputRef.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy]);

  const actionLabel = actionLabelFor(busy, saveFailed);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!matchesLearnItem(item, typed)) {
      setSaveFailed(false);
      setMissedMessage(missMessage(definition, answer, typed));
      if (!definition) {
        setTyped('');
      }
      inputRef.current?.focus();
      return;
    }
    setMissedMessage(null);
    setBusy(true);
    setSaveFailed(false);
    try {
      await onLearned();
    } catch {
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const hintVisible = definition || typed === '';
  return (
    <>
      <WordCard
        deck={deck}
        eyebrow={directionLabel(item.direction, subject)}
        tone={missedMessage === null ? 'neutral' : 'warning'}
        word={prompt}
        wordId={promptId}
        wordLang={
          item.direction === 'to_native' ? subject.targetLanguage : undefined
        }
      >
        <LearnCardBody
          definitionId={answerHintId}
          item={item}
          subject={subject}
        />
      </WordCard>
      <form
        aria-busy={busy}
        className="flex flex-col gap-3"
        onSubmit={onSubmit}
      >
        <label className="sr-only" htmlFor={inputId}>
          {definition ? 'Schreib die Definition ab' : 'Schreib die Antwort'}
        </label>
        {!definition && typed === '' ? (
          <span className="sr-only" id={answerHintId}>
            Vorlage: <span lang={answerLanguage}>{answer}</span>
          </span>
        ) : null}
        <AnswerField
          aria-describedby={
            hintVisible ? `${promptId} ${answerHintId}` : promptId
          }
          borderClass={
            missedMessage === null
              ? 'border-input'
              : 'border-warning-foreground'
          }
          disabled={busy}
          fieldRef={inputRef}
          id={inputId}
          multiline={definition}
          onChange={(value) => {
            setTyped(value);
            setSaveFailed(false);
          }}
          placeholder={definition ? 'Die Definition' : answer}
          value={typed}
        />
        <Button disabled={busy || typed.trim() === ''} type="submit">
          {actionLabel}
        </Button>
      </form>
      <p aria-live="polite" className="text-center text-sm">
        {missedMessage}
      </p>
      {saveFailed ? (
        <p className="text-destructive text-sm" role="alert">
          {definition
            ? 'Der Begriff wurde nicht gespeichert. Versuch es noch einmal.'
            : 'Die Vokabel wurde nicht gespeichert. Versuch es noch einmal.'}
        </p>
      ) : null}
    </>
  );
};
