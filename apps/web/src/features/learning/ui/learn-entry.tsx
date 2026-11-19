import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import {
  type CourseSubject,
  directionLabel,
  isListCourse,
} from '../../../shared/directions';
import {
  copyDifference,
  copyDifferenceMessage,
} from '../../../shared/grading/copy-difference';
import { copyMistakeMessage } from '../../../shared/grading/recitation';
import { shownPitfalls } from '../../../shared/pitfalls/pitfall-model';
import { answerCharacters } from '../../../shared/practice/answer-characters';
import {
  answerLanguage,
  cardAnswer,
  cardPrompt,
  foreignPromptLanguage,
} from '../../../shared/practice/card-texts';
import { ActionBar } from '../../../shared/ui/action-bar';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import { KeyPointList } from '../../../shared/ui/key-point-list';
import { SoundButton } from '../../../shared/ui/sound-button';
import { SpellingPitfallNote } from '../../../shared/ui/spelling-pitfall-note';
import { WordCard } from '../../../shared/ui/word-card';
import type { LearnItem } from '../schemas/learning-models';
import {
  copiesLearnDefinition,
  copiesLearnText,
  matchesLearnItem,
} from '../services/learn-check';
import { LearnExample } from './learn-example';
import { useLearnAudio } from './use-learn-audio';

type LearnEntryProps = {
  readonly item: LearnItem;
  // Entries still waiting behind this one in the section.
  readonly deck: number;
  // Whether the word's example sentence is still being prepared.
  readonly examplePending: boolean;
  readonly subject: CourseSubject;
  // Records that this direction has been met. Only called once the learner has
  // written it correctly, and the next direction waits until it has been stored.
  readonly onLearned: () => Promise<void>;
};

// A definition is shown to be copied, with what it must state once known. A
// text is shown to be copied. Both keep their own line breaks and stand
// above the page they are copied onto.
const CopySource = ({
  item,
  kind,
  definitionId,
}: {
  readonly item: LearnItem;
  readonly kind: 'terms' | 'texts';
  readonly definitionId: string;
}) => (
  <>
    <p className="whitespace-pre-line text-lg" id={definitionId}>
      {cardAnswer(item)}
    </p>
    {kind === 'terms' && item.keyPoints !== null ? (
      <KeyPointList
        items={item.keyPoints.map((text) => ({
          text,
          covered: null,
          note: null,
        }))}
      />
    ) : null}
  </>
);

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
): boolean => {
  switch (subject.kind) {
    case 'texts':
      return copiesLearnText(item, typed);
    case 'terms':
      return copiesLearnDefinition(item, typed);
    case 'language':
      return matchesLearnItem(item, typed);
    default:
      return subject.kind satisfies never;
  }
};

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
      return 'Noch nicht ganz. Schreib die Vokabel genau so ab.';
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

// One direction of the learning pass. A word's answer starts as the line's
// template, then disappears once typing begins so the learner has to hold it in
// memory. A definition or text is too long for that, so it stays on the card
// and is copied; recalling it is left to practice. Being wrong only asks
// again.
export const LearnEntry = ({
  item,
  deck,
  examplePending,
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
  const audio = useLearnAudio({ item, pending: examplePending });
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
    <form aria-busy={busy} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <WordCard
        deck={deck}
        instruction={directionLabel(item.direction, subject)}
        word={prompt}
        wordId={promptId}
        wordLang={foreignPromptLanguage(item.direction, subject.targetLanguage)}
      >
        {subject.kind === 'language' ? null : (
          <CopySource
            definitionId={answerHintId}
            item={item}
            kind={subject.kind}
          />
        )}
        <div>
          <label className="sr-only" htmlFor={inputId}>
            {copyLabels[subject.kind].field}
          </label>
          {!copied && typed === '' ? (
            <span className="sr-only" id={answerHintId}>
              Vorlage: <span lang={answerLang}>{answer}</span>
            </span>
          ) : null}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <AnswerField
                aria-describedby={
                  hintVisible ? `${promptId} ${answerHintId}` : promptId
                }
                characters={answerCharacters(subject.kind, answerLang)}
                disabled={busy}
                fieldRef={inputRef}
                id={inputId}
                missed={missedMessage !== null}
                multiline={copied}
                onChange={(value) => {
                  setTyped(value);
                  setSaveFailed(false);
                }}
                placeholder={copyLabels[subject.kind].placeholder ?? answer}
                value={typed}
              />
            </div>
            {copied || audio.word === null ? null : (
              // Level with the line the word is written on.
              <span className="flex h-12 shrink-0 items-center">
                <SoundButton label="Wort anhören" sound={audio.word} />
              </span>
            )}
          </div>
          <p
            aria-live="polite"
            className="mt-2 text-sm text-warning-foreground empty:mt-0"
          >
            {missedMessage}
          </p>
        </div>
        {subject.kind === 'language' ? (
          <>
            <SpellingPitfallNote
              covered={!hintVisible}
              language={subject.targetLanguage}
              pitfalls={shownPitfalls(item)}
            />
            <LearnExample
              item={item}
              pending={examplePending}
              sentence={audio.sentence}
              targetLanguage={subject.targetLanguage}
            />
          </>
        ) : null}
      </WordCard>
      {saveFailed ? (
        <p className="text-destructive text-sm" role="alert">
          {copyLabels[subject.kind].saveFailed}
        </p>
      ) : null}
      <ActionBar
        primary={
          <Button disabled={busy || typed.trim() === ''} type="submit">
            {actionLabel}
          </Button>
        }
        secondary={null}
      />
    </form>
  );
};
