import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { PreparedExampleSentence } from '../examples/example-model';

type ExampleFrameProps = {
  readonly children: ReactNode;
  readonly controls: ReactNode;
};

// Where a word's example sentence sits on a card, with the controls to hear
// it. A card can hold the place while the sentence is still being prepared.
export const ExampleFrame = ({ children, controls }: ExampleFrameProps) => (
  <div className="grid gap-2 border-border border-l pl-3">
    <p className="eyebrow">Im Satz</p>
    {children}
    {controls}
  </div>
);

type ExampleSentenceProps = {
  readonly example: PreparedExampleSentence;
  readonly targetLanguage: LanguageCode;
  readonly controls: ReactNode;
};

export const ExampleSentence = ({
  example,
  targetLanguage,
  controls,
}: ExampleSentenceProps) => (
  <ExampleFrame controls={controls}>
    <div className="grid gap-1">
      <p className="font-medium" lang={targetLanguage}>
        {example.targetText}
      </p>
      {example.nativeText === null ? null : (
        <p className="text-muted-foreground text-sm">{example.nativeText}</p>
      )}
    </div>
  </ExampleFrame>
);
