import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import { Button } from '../../../shared/ui/button';
import { ExampleSentence } from '../../../shared/ui/example-sentence';

type PracticeFeedbackExampleProps = {
  readonly example: PreparedExampleSentence;
  readonly playSentence: (() => Promise<void>) | null;
  readonly playWord: (() => Promise<void>) | null;
  readonly targetLanguage: LanguageCode;
};

export const PracticeFeedbackExample = ({
  example,
  playSentence,
  playWord,
  targetLanguage,
}: PracticeFeedbackExampleProps) => (
  <ExampleSentence
    controls={
      playSentence === null && playWord === null ? null : (
        <div className="flex flex-wrap gap-3">
          {playSentence === null ? null : (
            <Button onClick={playSentence} variant="quiet">
              Satz anhören
            </Button>
          )}
          {playWord === null ? null : (
            <Button onClick={playWord} variant="quiet-muted">
              Wort anhören
            </Button>
          )}
        </div>
      )
    }
    example={example}
    targetLanguage={targetLanguage}
  />
);
