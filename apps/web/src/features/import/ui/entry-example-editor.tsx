import { maximumExampleLength } from '@wordhold/ai/extraction/schema';
import { useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import type { DraftEntry } from './entry-row';

type EntryExampleEditorProps = {
  readonly disabled: boolean;
  readonly entry: DraftEntry;
  readonly generate: (
    targetText: string,
    nativeText: string,
  ) => Promise<{ readonly target: string; readonly native: string }>;
  readonly onChange: (entry: DraftEntry) => void;
};

export const EntryExampleEditor = ({
  disabled,
  entry,
  generate,
  onChange,
}: EntryExampleEditorProps) => {
  const [generationError, setGenerationError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const canGenerate =
    entry.targetText.trim() !== '' && entry.nativeText.trim() !== '';

  const generateExample = async () => {
    setGenerating(true);
    setGenerationError(false);
    try {
      const generated = await generate(
        entry.targetText.trim(),
        entry.nativeText.trim(),
      );
      onChange({
        ...entry,
        example: generated.target,
        generatedExample: { nativeText: generated.native },
      });
    } catch {
      setGenerationError(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-2">
      <input
        aria-label="Beispielsatz"
        className={fieldCompactClass}
        disabled={disabled}
        maxLength={maximumExampleLength}
        onChange={(event) =>
          onChange({ ...entry, example: event.target.value })
        }
        placeholder="Beispielsatz (optional)"
        value={entry.example}
      />
      {entry.generatedExample === undefined ? null : (
        <input
          aria-label="Deutsche Übersetzung des Beispielsatzes"
          className={fieldCompactClass}
          disabled={disabled || generating}
          maxLength={maximumExampleLength}
          onChange={(event) =>
            onChange({
              ...entry,
              generatedExample: { nativeText: event.target.value },
            })
          }
          placeholder="Deutsche Übersetzung"
          value={entry.generatedExample.nativeText}
        />
      )}
      {entry.example.trim() === '' ? (
        <Button
          className="w-fit"
          disabled={disabled || generating || !canGenerate}
          onClick={generateExample}
          variant="quiet-muted"
        >
          {generating ? 'Satz wird erzeugt …' : 'Beispielsatz erzeugen'}
        </Button>
      ) : null}
      {entry.generatedExample === undefined ||
      entry.example.trim() === '' ? null : (
        <p className="text-muted-foreground text-xs">
          Mit KI erzeugt. Prüfe Satz und Übersetzung vor dem Import.
        </p>
      )}
      {generationError ? (
        <p className="text-destructive text-sm" role="alert">
          Der Beispielsatz konnte nicht erzeugt werden. Versuche es noch einmal.
        </p>
      ) : null}
    </div>
  );
};
