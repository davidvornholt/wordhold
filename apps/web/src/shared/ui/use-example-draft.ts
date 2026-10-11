import { maximumExampleLength } from '@wordhold/ai/extraction/schema';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type ExampleDraft,
  type ExampleGenerationSource,
  exampleGenerationSource,
  type GeneratedExample,
} from '../examples/example-draft';
import { useExampleTranslation } from './use-example-translation';

type ExampleDraftInput<T extends ExampleDraft> = {
  readonly disabled: boolean;
  readonly entry: T;
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

type TextField = HTMLInputElement | HTMLTextAreaElement;

// The example sentence and its German translation, both editable. A typed
// sentence gets its translation from the page reading or, failing that,
// from a translation requested here; rewriting the sentence clears the
// translation and requests a new one when the field is left, so what is
// stored always belongs together. Callers lay out the two fields.
export const useExampleDraft = <T extends ExampleDraft>({
  disabled,
  entry,
  generate,
  translate,
  onChange,
  onGenerated,
  onTranslated,
}: ExampleDraftInput<T>) => {
  const [generationError, setGenerationError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { translating, translationError, translateSentence } =
    useExampleTranslation({ entry, disabled, translate, onTranslated });
  const translationRef = useRef<HTMLElement | null>(null);
  // The sentence this editor's own button just produced. Only that request
  // moves focus to the translation for review; a sentence written by the
  // page-wide "Beispielsätze erzeugen" must not pull the page to its row.
  const requestedSentenceRef = useRef<string | null>(null);

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

  const attachTranslation = useCallback((element: HTMLElement | null) => {
    translationRef.current = element;
  }, []);

  return {
    sentence: entry.example.trim(),
    canGenerate:
      entry.targetText.trim() !== '' && entry.nativeText.trim() !== '',
    generating,
    generationError,
    translating,
    translationError,
    generateExample: () => {
      generateExample().catch(() => undefined);
    },
    sentenceField: {
      disabled,
      maxLength: maximumExampleLength,
      onBlur: () => {
        translateSentence().catch(() => undefined);
      },
      onChange: (event: ChangeEvent<TextField>) =>
        onChange({
          ...entry,
          example: event.target.value,
          exampleNativeText: '',
          exampleStored: undefined,
        }),
      value: entry.example,
    },
    translationField: {
      'aria-busy': translating,
      disabled: disabled || translating,
      maxLength: maximumExampleLength,
      onChange: (event: ChangeEvent<TextField>) =>
        onChange({ ...entry, exampleNativeText: event.target.value }),
      ref: attachTranslation,
      value: entry.exampleNativeText,
    },
  };
};
