import type { LanguageCode } from '@wordhold/db/schema/courses';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { Button } from '../../../shared/ui/button';
import { sentenceTone, toneDivider, toneText } from './feedback-tone';
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
}: {
  readonly label: string;
  readonly lang: LanguageCode;
  readonly sentence: string;
}) => (
  <p>
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="wrap-break-word hyphens-auto text-lg" lang={lang}>
      {sentence}
    </span>
  </p>
);

// "Musterlösung" beside "Richtig" would read as a correction, so a correct
// answer that differs from the stored translation shows it as another way
// to say the same thing.
const referenceLabel = (outcome: SentenceOutcome): string =>
  outcome.kind === 'checked' && outcome.result.graded && outcome.result.correct
    ? 'Auch möglich: '
    : 'Musterlösung: ';

type SentenceFeedbackProps = {
  // Links the "Weiter" action to this panel as its description.
  readonly id: string;
  readonly outcome: SentenceOutcome;
  readonly reference: string;
  readonly targetLanguage: LanguageCode;
  readonly playSentence: (() => Promise<void>) | null;
  // The sentence was missed earlier in the round and is asked again.
  readonly repeated: boolean;
};

// The back of a sentence card: the verdict, the learner's sentence with the
// fewest changes that fix it, why, and the stored translation to listen to.
export const SentenceFeedback = ({
  id,
  outcome,
  reference,
  targetLanguage,
  playSentence,
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
      className={`flex animate-rise flex-col gap-3 border-t pt-5 ${toneDivider[tone]}`}
      id={id}
      role="status"
    >
      <p className={`font-medium ${toneText[tone]}`}>
        {sentenceHeading(outcome, repeated)}
      </p>
      {correction === null || sameSentence(correction, reference) ? null : (
        <LabelledSentence
          label="Korrigiert: "
          lang={targetLanguage}
          sentence={correction}
        />
      )}
      {explanation === null ? null : <p className="text-sm">{explanation}</p>}
      {repeatsReference ? null : (
        <LabelledSentence
          label={referenceLabel(outcome)}
          lang={targetLanguage}
          sentence={reference}
        />
      )}
      {playSentence === null ? null : (
        <Button className="w-fit" onClick={playSentence} variant="quiet">
          Satz anhören
        </Button>
      )}
    </div>
  );
};
