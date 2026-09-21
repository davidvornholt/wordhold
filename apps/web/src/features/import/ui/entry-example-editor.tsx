import { maximumExampleLength } from '@wordhold/ai/extraction/schema';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import type {
  DraftEntry,
  ExampleGenerationSource,
  GeneratedExample,
} from './entry-row';
import { useExampleTranslation } from './use-example-translation';

type EntryExampleEditorProps = {
  readonly disabled: boolean;
  readonly entry: DraftEntry;
  readonly generate: (
    targetText: string,
    nativeText: string,
  ) => Promise<{ readonly target: string; readonly native: string }>;
  readonly translate: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly onChange: (entry: DraftEntry) => void;
  readonly onTranslated: (sentence: string, native: string) => void;
  readonly onGenerated: (
    source: ExampleGenerationSource,
    generated: GeneratedExample,
  ) => void;
};

// The example sentence and its German translation, side by side and both
// editable. A printed sentence gets its translation from the page reading
// or, failing that, from a translation requested here; rewriting the
// sentence clears the translation and requests a new one when the field is
// left, so what is imported always belongs together.
export const EntryExampleEditor = ({
  disabled,
  entry,
  generate,
  translate,
  onChange,
  onGenerated,
  onTranslated,
}: EntryExampleEditorProps) => {
  const [generationError, setGenerationError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { translating, translationError, translateSentence } =
    useExampleTranslation({ entry, disabled, translate, onTranslated });
  const translationRef = useRef<HTMLInputElement>(null);
  const previousGeneratedRef = useRef(entry.exampleGenerated);
  const sentence = entry.example.trim();
  const canGenerate =
    entry.targetText.trim() !== '' && entry.nativeText.trim() !== '';

  useEffect(() => {
    const generatedNow =
      previousGeneratedRef.current === undefined &&
      entry.exampleGenerated === true;
    previousGeneratedRef.current = entry.exampleGenerated;
    if (generatedNow) {
      translationRef.current?.focus();
    }
  }, [entry.exampleGenerated]);

  const generateExample = async () => {
    setGenerating(true);
    setGenerationError(false);
    try {
      const source = {
        targetText: entry.targetText.trim(),
        nativeText: entry.nativeText.trim(),
        example: entry.example,
      };
      const generated = await generate(source.targetText, source.nativeText);
      onGenerated(source, generated);
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
        onBlur={() => {
          translateSentence().catch(() => undefined);
        }}
        onChange={(event) =>
          onChange({
            ...entry,
            example: event.target.value,
            exampleNativeText: '',
          })
        }
        placeholder="Beispielsatz (optional)"
        value={entry.example}
      />
      {sentence === '' ? null : (
        <input
          aria-busy={translating}
          aria-label="Deutsche Übersetzung des Beispielsatzes"
          className={fieldCompactClass}
          disabled={disabled || translating}
          maxLength={maximumExampleLength}
          onChange={(event) =>
            onChange({ ...entry, exampleNativeText: event.target.value })
          }
          placeholder={
            translating ? 'Übersetzung wird erzeugt …' : 'Deutsche Übersetzung'
          }
          ref={translationRef}
          value={entry.exampleNativeText}
        />
      )}
      {sentence === '' ? (
        <Button
          className="w-fit"
          disabled={disabled || generating || !canGenerate}
          onClick={generateExample}
          variant="quiet-muted"
        >
          {generating ? 'Satz wird erzeugt …' : 'Beispielsatz erzeugen'}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">
          {entry.exampleGenerated === true
            ? 'Mit KI erzeugt. Prüfe Satz und Übersetzung vor dem Import.'
            : 'Übersetzung mit KI erzeugt. Prüfe sie vor dem Import.'}
        </p>
      )}
      {generationError ? (
        <p className="text-destructive text-sm" role="alert">
          Der Beispielsatz konnte nicht erzeugt werden. Versuche es noch einmal.
        </p>
      ) : null}
      {translationError ? (
        <p className="text-destructive text-sm" role="alert">
          Die Übersetzung konnte nicht erzeugt werden. Trage sie ein oder
          versuche es noch einmal, indem du den Satz erneut verlässt.
        </p>
      ) : null}
    </div>
  );
};
