import type { LanguageCode } from '@wordhold/db/schema/courses';
import { useId } from 'react';
import type {
  ExampleDraft,
  ExampleGenerationSource,
  GeneratedExample,
} from '../examples/example-draft';
import { entryTextLineClass, entryTranslationLineClass } from './field-styles';
import { LineAction, LineWithAction } from './line-action';
import { useExampleDraft } from './use-example-draft';

type ExampleDraftEditorProps<T extends ExampleDraft> = {
  readonly disabled: boolean;
  readonly entry: T;
  // The language the sentence is written in.
  readonly targetLanguage: LanguageCode;
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

// The example sentence and its German translation, written on a card under
// the word: the sentence on a line of its own, which offers to write one
// while it is empty, and its translation a size smaller on the line below.
// The translation line is there from the start, so writing the sentence
// moves nothing.
export const ExampleDraftEditor = <T extends ExampleDraft>({
  reviewStep,
  targetLanguage,
  ...input
}: ExampleDraftEditorProps<T>) => {
  const example = useExampleDraft(input);
  const sentenceId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="eyebrow" htmlFor={sentenceId}>
        Beispielsatz <span className="text-muted-foreground">(optional)</span>
      </label>
      <LineWithAction
        action={
          example.sentence === '' ? (
            <LineAction
              disabled={
                input.disabled || example.generating || !example.canGenerate
              }
              onClick={example.generateExample}
            >
              {example.generating
                ? 'Satz wird erzeugt …'
                : 'Beispielsatz erzeugen'}
            </LineAction>
          ) : null
        }
        line={
          <input
            {...example.sentenceField}
            className={entryTextLineClass}
            id={sentenceId}
            lang={targetLanguage}
          />
        }
      />
      <input
        {...example.translationField}
        aria-label="Deutsche Übersetzung des Beispielsatzes"
        className={entryTranslationLineClass}
        disabled={example.translationField.disabled || example.sentence === ''}
        placeholder={
          example.translating
            ? 'Übersetzung wird erzeugt …'
            : 'Deutsche Übersetzung'
        }
      />
      <div className="flex min-h-5 flex-col gap-1 text-sm">
        {example.sentence === '' ? null : (
          <ReviewHint entry={input.entry} reviewStep={reviewStep} />
        )}
        <ExampleErrors
          generationError={example.generationError}
          translationError={example.translationError}
        />
      </div>
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
