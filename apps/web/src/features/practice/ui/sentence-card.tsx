import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type SubmitEvent, useCallback, useEffect, useId, useRef } from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import { germanLabels } from '../../../shared/languages';
import { answerCharacters } from '../../../shared/practice/answer-characters';
import { ActionBar } from '../../../shared/ui/action-bar';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import { WordCard } from '../../../shared/ui/word-card';
import { CheckActions } from './card-actions';
import { SentenceFeedback } from './sentence-feedback';
import { SubmissionNotice } from './submission-notice';
import {
  type CheckSentence,
  type SentenceOutcome,
  useSentenceCheck,
} from './use-sentence-check';

// A sentence ready to be asked: the entry's first example, which has a
// German side to translate from.
export type SentencePrompt = {
  readonly entryId: string;
  // The German side of the word the sentence practises.
  readonly word: string;
  readonly sentence: string;
  readonly reference: string;
  readonly hasAudio: boolean;
};

// The judge can be wrong about a free sentence, and an answer it could not
// check is the learner's to assess against the stored translation. As in
// word practice, overruling counts the sentence as correct and moves on.
const canAccept = (outcome: SentenceOutcome): boolean =>
  outcome.kind === 'checked' &&
  !(outcome.result.graded && outcome.result.correct);

type SentenceCardProps = {
  readonly prompt: SentencePrompt;
  readonly targetLanguage: LanguageCode;
  // Sentences still waiting behind this one in the round.
  readonly deck: number;
  readonly check: CheckSentence;
  // Fires as soon as the answer is judged, before "Weiter" moves on.
  readonly onOutcome: (outcome: SentenceOutcome) => void;
  readonly onNext: () => void;
  // Counts the judged sentence as correct and moves on.
  readonly onAccept: () => void;
  // The sentence was missed earlier in the round and is asked again.
  readonly repeated: boolean;
};

// One German sentence to translate, written on the card's lined page. Focus
// follows the loop as on a word card: the field while answering, "Weiter"
// once judged, when the sentence also plays. Giving up needs no server: the
// stored translation is shown straight away.
export const SentenceCard = ({
  prompt,
  targetLanguage,
  deck,
  check,
  onOutcome,
  onNext,
  onAccept,
  repeated,
}: SentenceCardProps) => {
  const inputRef = useRef<AnswerFieldElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const promptId = useId();
  const hintId = useId();
  const feedbackId = useId();
  const { playAudio, sound } = useAudioPlayback();
  const audioUrl = prompt.hasAudio
    ? `/api/entries/${prompt.entryId}/example-audio`
    : null;
  const playSentence = useCallback(
    () => playAudio(audioUrl),
    [playAudio, audioUrl],
  );
  const sentenceCheck = useSentenceCheck({
    entryId: prompt.entryId,
    sentence: prompt.sentence,
    check,
    onOutcome: (judged) => {
      onOutcome(judged);
      playSentence().catch(() => undefined);
    },
  });
  const { answer, busy, error, reconnecting, outcome } = sentenceCheck;
  useEffect(() => {
    if (busy) {
      return;
    }
    const target = outcome === null ? inputRef : nextButtonRef;
    const focusTask = globalThis.setTimeout(() => target.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, outcome]);
  // A sentence takes room to write, so the field wraps; Enter still submits,
  // and once judged moves on.
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (outcome === null) {
      sentenceCheck.submit().catch(() => undefined);
    } else {
      onNext();
    }
  };

  return (
    <form aria-busy={busy} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <WordCard
        deck={deck}
        hint={
          <p className="text-muted-foreground text-sm" id={hintId}>
            Verwende das Wort für „{prompt.word}“.
          </p>
        }
        instruction={`Übersetze auf ${germanLabels[targetLanguage]}${
          repeated ? ' · Noch einmal' : ''
        }`}
        size="sentence"
        word={prompt.sentence}
        wordId={promptId}
        wordLang={undefined}
      >
        <AnswerField
          aria-describedby={`${promptId} ${hintId}`}
          aria-label="Deine Übersetzung"
          characters={
            outcome === null
              ? answerCharacters('language', targetLanguage)
              : null
          }
          disabled={busy || outcome !== null}
          fieldRef={inputRef}
          lang={targetLanguage}
          multiline={true}
          onChange={sentenceCheck.setAnswer}
          pending={busy}
          placeholder="Deine Übersetzung"
          value={answer}
        />
        {outcome === null ? null : (
          <SentenceFeedback
            id={feedbackId}
            outcome={outcome}
            reference={
              outcome.kind === 'checked'
                ? outcome.result.reference
                : prompt.reference
            }
            repeated={repeated}
            sentence={sound(audioUrl)}
            targetLanguage={targetLanguage}
          />
        )}
      </WordCard>
      <SubmissionNotice error={error} reconnecting={reconnecting} />
      {outcome === null ? (
        <CheckActions
          blocked={busy}
          checking={busy}
          empty={answer.trim() === ''}
          nextButtonRef={nextButtonRef}
          onSkip={sentenceCheck.skip}
          skipping={false}
        />
      ) : (
        <ActionBar
          primary={
            <Button
              aria-describedby={feedbackId}
              ref={nextButtonRef}
              type="submit"
            >
              Weiter
            </Button>
          }
          secondary={
            canAccept(outcome) ? (
              <Button onClick={onAccept} variant="quiet">
                Als richtig werten
              </Button>
            ) : null
          }
        />
      )}
    </form>
  );
};
