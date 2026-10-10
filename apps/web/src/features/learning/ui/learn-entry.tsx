import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import {
  type CourseSubject,
  directionLabel,
  isListCourse,
  isRelationDirection,
} from '../../../shared/directions';
import {
  copyDifference,
  copyDifferenceMessage,
} from '../../../shared/grading/copy-difference';
import { copyMistakeMessage } from '../../../shared/grading/recitation';
import {
  answerLanguage,
  cardAnswer,
  cardPrompt,
  foreignPromptLanguage,
} from '../../../shared/practice/card-texts';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import { KeyPointList } from '../../../shared/ui/key-point-list';
import { RelationQuestion } from '../../../shared/ui/relation-question';
import { WordCard } from '../../../shared/ui/word-card';
import type { LearnItem } from '../schemas/learning-models';
import { copiesLearnText, matchesLearnItem } from '../services/learn-check';
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
// text is shown to be copied. Both keep their own line breaks. A word has its
// example sentence and audio instead, and its synonyms and antonyms the German
// meaning they are asked in.
const LearnCardBody = ({
  item,
  subject,
  definitionId,
}: {
  readonly item: LearnItem;
  readonly subject: CourseSubject;
  readonly definitionId: string;
}) => {
  if (subject.kind === 'texts') {
    return (
      <p className="whitespace-pre-line text-lg" id={definitionId}>
        {cardAnswer(item)}
      </p>
    );
  }
  return subject.kind === 'terms' ? (
    <>
      <p className="whitespace-pre-line text-lg" id={definitionId}>
        {cardAnswer(item)}
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
    <>
      {isRelationDirection(item.direction) ? (
        <p className="text-muted-foreground">Bedeutung: {item.nativeText}</p>
      ) : null}
      <LearnExampleAudio item={item} targetLanguage={subject.targetLanguage} />
    </>
  );
};

// What the learner is asked to copy, and what is said when saving fails.
const copyLabels = {
  language: {
    field: 'Schreib die Antwort',
    // The word itself, until typing starts.
    placeholder: null,
    saveFailed: 'Die Vokabel wurde nicht gespeichert. Versuch es noch einmal.',
  },
  terms: {
    field: 'Schreib die Definition ab',
    placeholder: 'Die Definition',
    saveFailed: 'Der Begriff wurde nicht gespeichert. Versuch es noch einmal.',
  },
  texts: {
    field: 'Schreib den Text ab',
    placeholder: 'Der Text',
    saveFailed: 'Der Text wurde nicht gespeichert. Versuch es noch einmal.',
  },
} as const satisfies Record<
  CourseSubject['kind'],
  {
    readonly field: string;
    readonly placeholder: string | null;
    readonly saveFailed: string;
  }
>;

const matchesCopy = (
  subject: CourseSubject,
  item: LearnItem,
  typed: string,
): boolean =>
  subject.kind === 'texts'
    ? copiesLearnText(item, typed)
    : matchesLearnItem(item, typed);

// A missed word is typed again from scratch; a missed definition or text
// keeps the copy and names the first word that differs.
const missMessage = (
  subject: CourseSubject,
  item: LearnItem,
  typed: string,
) => {
  const answer = cardAnswer(item);
  switch (subject.kind) {
    case 'texts':
      return (
        copyMistakeMessage(answer, typed) ??
        'Noch nicht ganz. Schreib den Text genau so ab.'
      );
    case 'terms':
      return copyDifferenceMessage(copyDifference(answer, typed));
    case 'language':
      return isRelationDirection(item.direction)
        ? 'Noch nicht ganz. Schreib eines der Wörter genau so ab.'
        : 'Noch nicht ganz. Schreib die Vokabel genau so ab.';
    default:
      return subject.kind satisfies never;
  }
};

const actionLabelFor = (busy: boolean, saveFailed: boolean): string => {
  if (busy) {
    return 'Wird gespeichert …';
  }
  return saveFailed ? 'Erneut versuchen' : 'Weiter';
};

// One direction of the learning pass. A word's answer starts as the field's
// prompt, then disappears once typing begins so the learner has to hold it in
// memory. A definition or text is too long for that, so it stays on the card
// and is copied; recalling it is left to practice. Being wrong only asks
// again.
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
  // Copied from the card rather than recalled.
  const copied = isListCourse(subject.kind);
  const answer = cardAnswer(item);
  const prompt = cardPrompt(item);
  const answerLang = answerLanguage(item.direction, subject.targetLanguage);
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
    if (!matchesCopy(subject, item, typed)) {
      setSaveFailed(false);
      setMissedMessage(missMessage(subject, item, typed));
      if (!copied) {
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

  const hintVisible = copied || typed === '';
  return (
    <>
      <WordCard
        deck={deck}
        eyebrow={
          isRelationDirection(item.direction) ? (
            <RelationQuestion
              direction={item.direction}
              language={subject.targetLanguage}
            />
          ) : (
            directionLabel(item.direction, subject)
          )
        }
        tone={missedMessage === null ? 'neutral' : 'warning'}
        word={prompt}
        wordId={promptId}
        wordLang={foreignPromptLanguage(item.direction, subject.targetLanguage)}
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
          {copyLabels[subject.kind].field}
        </label>
        {!copied && typed === '' ? (
          <span className="sr-only" id={answerHintId}>
            Vorlage: <span lang={answerLang}>{answer}</span>
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
          multiline={copied}
          onChange={(value) => {
            setTyped(value);
            setSaveFailed(false);
          }}
          placeholder={copyLabels[subject.kind].placeholder ?? answer}
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
          {copyLabels[subject.kind].saveFailed}
        </p>
      ) : null}
    </>
  );
};
