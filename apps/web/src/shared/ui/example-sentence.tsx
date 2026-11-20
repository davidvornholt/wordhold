import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { SoundControl } from '../audio/use-pronunciation-audio';
import type { PreparedExampleSentence } from '../examples/example-model';
import { SoundButton } from './sound-button';

type ExampleFrameProps = {
  readonly children: ReactNode;
  readonly sentence: SoundControl | null;
};

// Where a word's example sentence sits on a card, with the button to hear it
// at the end of the line, as a dictionary sets an example: in italics, its
// translation beneath. A card can hold the place while the sentence is still
// being prepared.
export const ExampleFrame = ({ children, sentence }: ExampleFrameProps) => (
  <div className="flex items-start gap-3">
    <div className="grid min-w-0 flex-1 gap-1">{children}</div>
    {sentence === null ? null : (
      <SoundButton label="Satz anhören" sound={sentence} />
    )}
  </div>
);

type ExampleSentenceProps = {
  readonly example: PreparedExampleSentence;
  readonly targetLanguage: LanguageCode;
  readonly sentence: SoundControl | null;
};

export const ExampleSentence = ({
  example,
  targetLanguage,
  sentence,
}: ExampleSentenceProps) => (
  <ExampleFrame sentence={sentence}>
    <p
      className="wrap-break-word font-display text-lg italic leading-snug"
      lang={targetLanguage}
    >
      {example.targetText}
    </p>
    {example.nativeText === null ? null : (
      <p className="wrap-break-word text-muted-foreground text-sm">
        {example.nativeText}
      </p>
    )}
  </ExampleFrame>
);
