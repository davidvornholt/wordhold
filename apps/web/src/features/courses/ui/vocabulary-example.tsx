import type { LanguageCode } from '@wordhold/db/schema/courses';
import { useState } from 'react';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';

type VocabularyExampleProps = {
  readonly entry: VocabularyEntry;
  readonly targetLanguage: LanguageCode;
  readonly generate: () => Promise<NonNullable<VocabularyEntry['example']>>;
};

export const VocabularyExample = ({
  entry,
  targetLanguage,
  generate,
}: VocabularyExampleProps) => {
  const [example, setExample] = useState(entry.example);
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);

  if (example !== null) {
    return (
      <div className="grid gap-1 border-border border-l pl-3 text-sm">
        <p className="font-medium" lang={targetLanguage}>
          {example.targetText}
        </p>
        {example.nativeText === null ? null : (
          <p className="text-muted-foreground">{example.nativeText}</p>
        )}
        {example.source === 'generated' ? (
          <p className="text-muted-foreground text-xs">Mit KI erzeugt</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        disabled={generating}
        onClick={async () => {
          setGenerating(true);
          setFailed(false);
          try {
            setExample(await generate());
          } catch {
            setFailed(true);
          } finally {
            setGenerating(false);
          }
        }}
        variant="quiet-muted"
      >
        {generating ? 'Satz wird erzeugt …' : 'Beispielsatz erzeugen'}
      </Button>
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          Der Beispielsatz konnte nicht erzeugt werden. Versuche es noch einmal.
        </p>
      ) : null}
    </div>
  );
};
