import { useEffect, useRef, useState } from 'react';
import type { DraftEntry } from './entry-row';

type ExampleTranslationInput = {
  readonly entry: DraftEntry;
  readonly disabled: boolean;
  readonly translate: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly onChange: (entry: DraftEntry) => void;
};

// Fills a missing German translation for the example sentence: once when the
// row appears (pages read before translations were part of the reading, or a
// model that skipped one) and whenever the sentence field is left after a
// rewrite cleared the translation.
export const useExampleTranslation = ({
  entry,
  disabled,
  translate,
  onChange,
}: ExampleTranslationInput) => {
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const latestEntryRef = useRef(entry);
  latestEntryRef.current = entry;
  const sentence = entry.example.trim();
  const needsTranslation = sentence !== '' && entry.exampleNativeText === '';

  const translateSentence = async () => {
    if (!needsTranslation || translating || disabled) {
      return;
    }
    setTranslating(true);
    setTranslationError(false);
    try {
      const translated = await translate(sentence);
      const latest = latestEntryRef.current;
      // The learner may have gone on typing; a translation of an older
      // sentence must not land next to a newer one.
      if (
        latest.example.trim() === sentence &&
        latest.exampleNativeText === ''
      ) {
        onChange({ ...latest, exampleNativeText: translated.native });
      }
    } catch {
      setTranslationError(true);
    } finally {
      setTranslating(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Runs once per row on purpose; later requests come from leaving the sentence field.
  useEffect(() => {
    translateSentence().catch(() => undefined);
  }, []);

  return { translating, translationError, translateSentence };
};
