import { type ReactNode, useId } from 'react';
import type {
  ExampleDraft,
  ExampleGenerationSource,
  GeneratedExample,
} from '../examples/example-draft';
import { Button } from './button';
import { fieldOnCardClass } from './field-styles';
import { useExampleDraft } from './use-example-draft';

type ExampleDraftEditorProps<T extends ExampleDraft> = {
  readonly disabled: boolean;
  readonly entry: T;
  // Names the step the learner reviews the AI text before, e.g. "Eintragen".
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
  readonly label: string;
  readonly hint?: string;
  readonly children: (fieldProps: {
    readonly className: string;
    readonly id: string;
  }) => ReactNode;
};

const Field = ({ label, hint, children }: FieldProps) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="font-medium" htmlFor={id}>
        {label}
        {hint === undefined ? null : (
          <span className="font-normal text-muted-foreground"> ({hint})</span>
        )}
      </label>
      {children({ className: fieldOnCardClass, id })}
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

// The example sentence and its German translation as labelled fields of a
// standalone form on a card.
export const ExampleDraftEditor = <T extends ExampleDraft>({
  reviewStep,
  ...input
}: ExampleDraftEditorProps<T>) => {
  const example = useExampleDraft(input);
  return (
    <div className="grid gap-2">
      <Field hint="optional" label="Beispielsatz">
        {(fieldProps) => <input {...fieldProps} {...example.sentenceField} />}
      </Field>
      {example.sentence === '' ? null : (
        <Field label="Deutsche Übersetzung des Beispielsatzes">
          {(fieldProps) => (
            <input
              {...fieldProps}
              {...example.translationField}
              placeholder={
                example.translating ? 'Übersetzung wird erzeugt …' : undefined
              }
            />
          )}
        </Field>
      )}
      {example.sentence === '' ? (
        <Button
          className="w-fit"
          disabled={
            input.disabled || example.generating || !example.canGenerate
          }
          onClick={example.generateExample}
          variant="quiet-muted"
        >
          {example.generating ? 'Satz wird erzeugt …' : 'Beispielsatz erzeugen'}
        </Button>
      ) : (
        <ReviewHint entry={input.entry} reviewStep={reviewStep} />
      )}
      <ExampleErrors
        generationError={example.generationError}
        translationError={example.translationError}
      />
    </div>
  );
};

export const ExampleErrors = ({
  generationError,
  translationError,
}: {
  readonly generationError: boolean;
  readonly translationError: boolean;
}) => (
  <>
    {generationError ? (
      <p className="text-destructive text-sm" role="alert">
        Der Beispielsatz konnte nicht erzeugt werden. Versuche es noch einmal.
      </p>
    ) : null}
    {translationError ? (
      <p className="text-destructive text-sm" role="alert">
        Die Übersetzung konnte nicht erzeugt werden. Trage sie ein oder versuche
        es noch einmal, indem du den Satz erneut verlässt.
      </p>
    ) : null}
  </>
);
