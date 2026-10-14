import {
  maximumPitfallBatch,
  type SpellingPitfall,
} from '@wordhold/ai/pitfalls/schema';
import { useEffect, useRef, useState } from 'react';
import type { PreparePitfalls } from '../../../shared/pitfalls/pitfall-model';
import type { VocabularyEntry } from '../schemas/course-units';

type ListWord = Pick<VocabularyEntry, 'id' | 'targetText'>;

// A respelled word has its pitfalls found again, so they are kept by
// spelling.
const spellingKey = (word: ListWord): string => `${word.id} ${word.targetText}`;

// Finds the pitfalls of listed words that have none stored yet, such as
// words learned before pitfalls existed, a batch at a time so the provider is
// not hit with the whole list. Each word is asked once while the list is
// open; a word whose pitfalls could not be found stays without them.
export const useListPitfalls = (
  words: ReadonlyArray<ListWord>,
  preparePitfalls: PreparePitfalls,
) => {
  const requestedRef = useRef(new Set<string>());
  const queueRef = useRef<Array<ListWord>>([]);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const [found, setFound] = useState<
    ReadonlyMap<string, ReadonlyArray<SpellingPitfall>>
  >(new Map());
  const [searching, setSearching] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const requested = requestedRef.current;
    const missing = words.filter((word) => !requested.has(spellingKey(word)));
    if (missing.length === 0) {
      return;
    }
    for (const word of missing) {
      requested.add(spellingKey(word));
    }
    queueRef.current.push(...missing);
    setSearching((count) => count + missing.length);
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    const next = (): Promise<void> => {
      const batch = queueRef.current.splice(0, maximumPitfallBatch);
      if (batch.length === 0 || !mountedRef.current) {
        runningRef.current = false;
        return Promise.resolve();
      }
      return preparePitfalls({ data: batch.map((word) => word.id) })
        .catch(() => [])
        .then((prepared) => {
          if (!mountedRef.current) {
            runningRef.current = false;
            return;
          }
          setFound((current) => {
            const updated = new Map(current);
            for (const { entryId, pitfalls } of prepared) {
              const word = batch.find((candidate) => candidate.id === entryId);
              if (word !== undefined) {
                updated.set(spellingKey(word), pitfalls);
              }
            }
            return updated;
          });
          setSearching((count) => count - batch.length);
          return next();
        });
    };
    next().catch(() => undefined);
  }, [words, preparePitfalls]);

  return {
    // The entry with the pitfalls found for its current spelling.
    withPitfalls: (entry: VocabularyEntry): VocabularyEntry =>
      entry.spellingPitfalls === null
        ? { ...entry, spellingPitfalls: found.get(spellingKey(entry)) ?? null }
        : entry,
    // Words still being searched.
    searching,
  } as const;
};
