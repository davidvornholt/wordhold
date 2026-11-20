import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { SoundControl } from '../../../shared/audio/use-pronunciation-audio';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { SoundButton } from '../../../shared/ui/sound-button';
import { sentenceTone, toneText } from './feedback-tone';
import type { SentenceOutcome } from './use-sentence-check';

const sentenceHeading = (
  outcome: SentenceOutcome,
  repeated: boolean,
): string => {
  if (outcome.kind === 'skipped') {
    return 'Nicht gewusst';
  }
  if (!outcome.result.graded) {
    return outcome.result.message;
  }
  if (!outcome.result.correct) {
    return 'Noch nicht richtig';
  }
  return repeated ? 'Diesmal richtig' : 'Richtig';
};

const sameSentence = (left: string, right: string) =>
  normalizeAnswerForComparison(left) === normalizeAnswerForComparison(right);

const LabelledSentence = ({
  label,
  lang,
  sentence,
  sound,
}: {
  readonly label: string;
  readonly lang: LanguageCode;
  readonly sentence: string;
  readonly sound: SoundControl | null;
}) => (
  <div className="flex items-start gap-3">
    <div className="grid min-w-0 flex-1 gap-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className="wrap-break-word hyphens-auto font-display text-xl leading-snug"
        lang={lang}
      >
        {sentence}
      </p>
    </div>
    {sound === null ? null : <SoundButton label="Satz anhören" sound={sound} />}
  </div>
);

// "Musterlösung" beside "Richtig" would read as a correction, so a correct
// answer that differs from the stored translation shows it as another way
// to say the same thing.
const referenceLabel = (outcome: SentenceOutcome): string =>
  outcome.kind === 'checked' && outcome.result.graded && outcome.result.correct
    ? 'Auch möglich'
    : 'Musterlösung';

type SentenceFeedbackProps = {
  // Links the "Weiter" action to this panel as its description.
  readonly id: string;
  readonly outcome: SentenceOutcome;
  readonly reference: string;
  readonly targetLanguage: LanguageCode;
  // The stored translation read aloud.
  readonly sentence: SoundControl | null;
  // The sentence was missed earlier in the round and is asked again.
  readonly repeated: boolean;
};

// The back of a sentence card, under the learner's sentence: the verdict,
// the sentence with the fewest changes that fix it, why, and the stored
// translation to listen to.
export const SentenceFeedback = ({
  id,
  outcome,
  reference,
  targetLanguage,
  sentence,
  repeated,
}: SentenceFeedbackProps) => {
  const tone = sentenceTone(outcome);
  const graded =
    outcome.kind === 'checked' && outcome.result.graded ? outcome.result : null;
  const correction = graded?.correction ?? null;
  const explanation = graded?.explanation ?? null;
  const repeatsReference =
    outcome.kind === 'checked' && sameSentence(outcome.answer, reference);
  return (
    <div
      aria-live="polite"
      className="flex animate-ink flex-col gap-4"
      id={id}
      role="status"
    >
      <div className="flex items-center gap-3">
        <p className={`font-medium text-sm ${toneText[tone]}`}>
          {sentenceHeading(outcome, repeated)}
        </p>
        {repeatsReference && sentence !== null ? (
          <span className="ml-auto flex shrink-0">
            <SoundButton label="Satz anhören" sound={sentence} />
          </span>
        ) : null}
      </div>
      {correction === null || sameSentence(correction, reference) ? null : (
        <LabelledSentence
          label="Korrigiert"
          lang={targetLanguage}
          sentence={correction}
          sound={null}
        />
      )}
      {explanation === null ? null : <p className="text-sm">{explanation}</p>}
      {repeatsReference ? null : (
        <LabelledSentence
          label={referenceLabel(outcome)}
          lang={targetLanguage}
          sentence={reference}
          sound={sentence}
        />
      )}
    </div>
  );
};
