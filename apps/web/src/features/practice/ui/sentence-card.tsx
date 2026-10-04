import type { LanguageCode } from '@wordhold/db/schema/courses';
import {
  type RefObject,
  type SubmitEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import { germanLabels } from '../../../shared/languages';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import { type CardTone, WordCard } from '../../../shared/ui/word-card';
import { sentenceTone, toneField } from './feedback-tone';
import { SentenceFeedback } from './sentence-feedback';
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

type SentenceAnswerFormProps = {
  readonly check: ReturnType<typeof useSentenceCheck>;
  readonly describedBy: string;
  readonly inputRef: RefObject<AnswerFieldElement | null>;
  readonly targetLanguage: LanguageCode;
  readonly tone: CardTone;
};

// A sentence takes room to write, so the field wraps; Enter still submits.
// Giving up needs no server: the stored translation is shown straight away.
const SentenceAnswerForm = ({
  check,
  describedBy,
  inputRef,
  targetLanguage,
  tone,
}: SentenceAnswerFormProps) => {
  const { answer, busy, outcome } = check;
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    check.submit().catch(() => undefined);
  };
  return (
    <form aria-busy={busy} className="flex flex-col gap-3" onSubmit={onSubmit}>
      <AnswerField
        aria-describedby={describedBy}
        aria-label="Deine Übersetzung"
        borderClass={toneField[tone]}
        disabled={busy || outcome !== null}
        fieldRef={inputRef}
        lang={targetLanguage}
        multiline={true}
        onChange={check.setAnswer}
        placeholder="Deine Übersetzung"
        value={answer}
      />
      {outcome === null ? (
        <>
          <Button disabled={busy || answer.trim() === ''} type="submit">
            {busy ? 'Wird geprüft …' : 'Prüfen'}
          </Button>
          <Button
            className="w-fit self-center px-3 py-2"
            disabled={busy}
            onClick={check.skip}
            variant="quiet-muted"
          >
            Weiß ich nicht
          </Button>
        </>
      ) : null}
    </form>
  );
};

// The judge can be wrong about a free sentence, and an answer it could not
// check is the learner's to assess against the stored translation. As in
// word practice, overruling counts the sentence as correct and moves on.
const canAccept = (outcome: SentenceOutcome): boolean =>
  outcome.kind === 'checked' &&
  !(outcome.result.graded && outcome.result.correct);

type SentenceActionsProps = {
  readonly outcome: SentenceOutcome;
  readonly feedbackId: string;
  readonly nextButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onNext: () => void;
  readonly onAccept: () => void;
  readonly playing: boolean;
  readonly stopAudio: () => void;
};

// "Weiter" takes the place "Prüfen" had. The row beneath keeps its height
// and columns, as on a word card, so "Audio stoppen" can come and go beside
// "Als richtig werten" without moving it.
const SentenceActions = ({
  outcome,
  feedbackId,
  nextButtonRef,
  onNext,
  onAccept,
  playing,
  stopAudio,
}: SentenceActionsProps) => {
  const acceptable = canAccept(outcome);
  const stop = (
    <Button onClick={stopAudio} variant="quiet-muted">
      Audio stoppen
    </Button>
  );
  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-describedby={feedbackId}
        onClick={onNext}
        ref={nextButtonRef}
      >
        Weiter
      </Button>
      <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-x-4">
        <span />
        <div className="flex items-center justify-center">
          {acceptable ? (
            <Button onClick={onAccept} variant="quiet">
              Als richtig werten
            </Button>
          ) : null}
          {playing && !acceptable ? stop : null}
        </div>
        <div className="justify-self-start">
          {playing && acceptable ? stop : null}
        </div>
      </div>
    </div>
  );
};

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

// One German sentence to translate. Focus follows the loop as on a word
// card: the field while answering, "Weiter" once judged, when the sentence
// also plays.
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
  const { playAudio, playing, stopAudio } = useAudioPlayback();
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
  const { busy, error, outcome } = sentenceCheck;
  useEffect(() => {
    if (busy) {
      return;
    }
    const target = outcome === null ? inputRef : nextButtonRef;
    const focusTask = globalThis.setTimeout(() => target.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, outcome]);
  const tone = outcome === null ? 'neutral' : sentenceTone(outcome);

  return (
    <>
      <WordCard
        deck={deck}
        eyebrow={`Übersetze auf ${germanLabels[targetLanguage]}${
          repeated ? ' · Noch einmal' : ''
        }`}
        size="sentence"
        tone={tone}
        word={prompt.sentence}
        wordId={promptId}
        wordLang={undefined}
      >
        <p className="text-muted-foreground text-sm" id={hintId}>
          Verwende das Wort für „{prompt.word}“.
        </p>
        {outcome === null ? null : (
          <SentenceFeedback
            id={feedbackId}
            outcome={outcome}
            playSentence={audioUrl === null ? null : playSentence}
            reference={
              outcome.kind === 'checked'
                ? outcome.result.reference
                : prompt.reference
            }
            repeated={repeated}
            targetLanguage={targetLanguage}
          />
        )}
      </WordCard>
      <SentenceAnswerForm
        check={sentenceCheck}
        describedBy={`${promptId} ${hintId}`}
        inputRef={inputRef}
        targetLanguage={targetLanguage}
        tone={tone}
      />
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      {outcome === null ? null : (
        <SentenceActions
          feedbackId={feedbackId}
          nextButtonRef={nextButtonRef}
          onAccept={onAccept}
          onNext={onNext}
          outcome={outcome}
          playing={playing}
          stopAudio={stopAudio}
        />
      )}
    </>
  );
};
