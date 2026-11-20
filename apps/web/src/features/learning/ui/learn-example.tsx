import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { SoundControl } from '../../../shared/audio/use-pronunciation-audio';
import {
  ExampleFrame,
  ExampleSentence,
} from '../../../shared/ui/example-sentence';
import type { LearnAudioInput } from './use-learn-audio';

type LearnExampleProps = LearnAudioInput & {
  readonly sentence: SoundControl | null;
  readonly targetLanguage: LanguageCode;
};

// The word's example sentence, or the place it will take while it is being
// prepared.
export const LearnExample = ({
  item,
  pending,
  sentence,
  targetLanguage,
}: LearnExampleProps) => {
  if (pending) {
    return (
      <ExampleFrame sentence={null}>
        <p className="text-muted-foreground text-sm" role="status">
          Beispielsatz wird vorbereitet …
        </p>
      </ExampleFrame>
    );
  }
  if (item.example === null) {
    return null;
  }
  return (
    <ExampleSentence
      example={item.example}
      sentence={sentence}
      targetLanguage={targetLanguage}
    />
  );
};
