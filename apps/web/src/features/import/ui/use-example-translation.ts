import { useEffect, useRef, useState } from 'react';
import type { DraftEntry } from './entry-row';

type ExampleTranslationInput = {
  readonly entry: DraftEntry;
  readonly disabled: boolean;
  readonly translate: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly onTranslated: (sentence: string, native: string) => void;
};

// Translate on mount and on blur, never on every keystroke. A later blur can
// supersede an unfinished request without losing the learner's rewrite.
export const useExampleTranslation = ({
  entry,
  disabled,
  translate,
  onTranslated,
}: ExampleTranslationInput) => {
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const activeRequestRef = useRef<{ readonly sentence: string } | null>(null);
  const sentence = entry.example.trim();
  const needsTranslation = sentence !== '' && entry.exampleNativeText === '';

  const translateSentence = async () => {
    if (
      !needsTranslation ||
      disabled ||
      activeRequestRef.current?.sentence === sentence
    ) {
      return;
    }
    const request = { sentence };
    activeRequestRef.current = request;
    setTranslating(true);
    setTranslationError(false);
    try {
      const translated = await translate(sentence);
      if (activeRequestRef.current === request) {
        onTranslated(sentence, translated.native);
      }
    } catch {
      if (activeRequestRef.current === request) {
        setTranslationError(true);
      }
    } finally {
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null;
        setTranslating(false);
      }
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Runs once per row on purpose; later requests come from leaving the sentence field.
  useEffect(() => {
    translateSentence().catch(() => undefined);
    return () => {
      activeRequestRef.current = null;
    };
  }, []);

  return { translating, translationError, translateSentence };
};
