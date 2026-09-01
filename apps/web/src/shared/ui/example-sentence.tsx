import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { PreparedExampleSentence } from '../examples/example-model';

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
  <div className="grid gap-2 border-border border-l pl-3">
    <p className="eyebrow">Im Satz</p>
    <div className="grid gap-1">
      <p className="font-medium" lang={targetLanguage}>
        {example.targetText}
      </p>
      {example.nativeText === null ? null : (
        <p className="text-muted-foreground text-sm">{example.nativeText}</p>
      )}
    </div>
    {controls}
  </div>
);
