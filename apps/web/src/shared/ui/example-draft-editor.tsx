import { maximumExampleLength } from '@wordhold/ai/extraction/schema';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  type ExampleDraft,
  type ExampleGenerationSource,
  exampleGenerationSource,
  type GeneratedExample,
} from '../examples/example-draft';
import { Button } from './button';
import { fieldCompactClass, fieldOnCardClass } from './field-styles';
import { useExampleTranslation } from './use-example-translation';

// 'row': one dense line per extracted entry in the verify workbench, named
// through placeholders. 'form': a standalone form on a card, with visible
// labels and regular field height.
type EditorVariant = 'row' | 'form';

const fieldClasses: Record<EditorVariant, string> = {
  row: fieldCompactClass,
  form: fieldOnCardClass,
};

type ExampleDraftEditorProps<T extends ExampleDraft> = {
  readonly disabled: boolean;
  readonly entry: T;
  readonly variant: EditorVariant;
  // Names the step the learner reviews the AI text before, e.g. "Import".
  readonly reviewStep: string;
  readonly generate: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translate: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly onChange: (entry: T) => void;
  readonly onTranslated: (sentence: string, native: string) => void;
  readonly onGenerated: (
    source: ExampleGenerationSource,
    generated: GeneratedExample,
  ) => void;
};

type FieldProps = {
  readonly variant: EditorVariant;
  readonly label: string;
  readonly hint?: string;
  // Row placeholder when the accessible name is too long to sit in the field.
  readonly placeholder?: string;
  readonly children: (fieldProps: {
    readonly 'aria-label'?: string;
    readonly className: string;
    readonly id: string;
    readonly placeholder?: string;
  }) => ReactNode;
};

const Field = ({ variant, label, hint, placeholder, children }: FieldProps) => {
  const id = useId();
  if (variant === 'row') {
    return children({
      'aria-label': label,
      className: fieldClasses.row,
      id,
      placeholder:
        hint === undefined
          ? (placeholder ?? label)
          : `${placeholder ?? label} (${hint})`,
    });
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="font-medium" htmlFor={id}>
        {label}
        {hint === undefined ? null : (
          <span className="font-normal text-muted-foreground"> ({hint})</span>
        )}
      </label>
      {children({ className: fieldClasses.form, id })}
    </div>
  );
};

// Only AI text needs the learner's review; a saved sentence had it.
const ReviewHint = ({
  entry,
  reviewStep,
}: {
  readonly entry: ExampleDraft;
  readonly reviewStep: string;
}) => {
  if (entry.exampleStored === true) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-xs">
      {entry.exampleGenerated === true
        ? `Mit KI erzeugt. Prüfe Satz und Übersetzung vor dem ${reviewStep}.`
        : `Übersetzung mit KI erzeugt. Prüfe sie vor dem ${reviewStep}.`}
    </p>
  );
};

// The example sentence and its German translation, side by side and both
// editable. A typed sentence gets its translation from the page reading
// or, failing that, from a translation requested here; rewriting the
// sentence clears the translation and requests a new one when the field is
// left, so what is stored always belongs together.
export const ExampleDraftEditor = <T extends ExampleDraft>({
  disabled,
  entry,
  variant,
  reviewStep,
  generate,
  translate,
  onChange,
  onGenerated,
  onTranslated,
}: ExampleDraftEditorProps<T>) => {
  const [generationError, setGenerationError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { translating, translationError, translateSentence } =
    useExampleTranslation({ entry, disabled, translate, onTranslated });
  const translationRef = useRef<HTMLInputElement>(null);
  // The sentence this editor's own button just produced. Only that request
  // moves focus to the translation for review; a sentence written by the
  // page-wide "Beispielsätze erzeugen" must not pull the page to its row.
  const requestedSentenceRef = useRef<string | null>(null);
  const sentence = entry.example.trim();
  const canGenerate =
    entry.targetText.trim() !== '' && entry.nativeText.trim() !== '';

  useEffect(() => {
    const requested = requestedSentenceRef.current;
    if (requested === null || generating) {
      return;
    }
    requestedSentenceRef.current = null;
    if (entry.exampleGenerated === true && entry.example === requested) {
      translationRef.current?.focus();
    }
  }, [entry.example, entry.exampleGenerated, generating]);

  const generateExample = async () => {
    setGenerating(true);
    setGenerationError(false);
    try {
      const source = exampleGenerationSource(entry);
      const generated = await generate(source.targetText, source.nativeText);
      requestedSentenceRef.current = generated.target;
      onGenerated(source, generated);
    } catch {
      setGenerationError(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Field hint="optional" label="Beispielsatz" variant={variant}>
        {(fieldProps) => (
          <input
            {...fieldProps}
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
                exampleStored: undefined,
              })
            }
            value={entry.example}
          />
        )}
      </Field>
      {sentence === '' ? null : (
        <Field
          label="Deutsche Übersetzung des Beispielsatzes"
          placeholder="Deutsche Übersetzung"
          variant={variant}
        >
          {(fieldProps) => (
            <input
              {...fieldProps}
              aria-busy={translating}
              disabled={disabled || translating}
              maxLength={maximumExampleLength}
              onChange={(event) =>
                onChange({ ...entry, exampleNativeText: event.target.value })
              }
              placeholder={
                translating
                  ? 'Übersetzung wird erzeugt …'
                  : fieldProps.placeholder
              }
              ref={translationRef}
              value={entry.exampleNativeText}
            />
          )}
        </Field>
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
        <ReviewHint entry={entry} reviewStep={reviewStep} />
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
