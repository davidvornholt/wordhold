import { useState } from 'react';
import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import type {
  CreatedVocabularyEntry,
  UpdatedVocabularyEntry,
} from '../src/features/courses/services/vocabulary-entry-service';
import type { NewVocabularyEntryDraft } from '../src/features/courses/ui/use-new-vocabulary-entry';
import type { WordSide } from '../src/features/courses/ui/word-pair-fields';
import { fixtureEntry } from './course-fixture-data';

const tripExample = 'Wir packten unsere Koffer für die Reise.';

export const fixtureDraftExample = (targetText: string) =>
  Promise.resolve({
    target: `We packed our bags for the ${targetText}.`,
    native: tripExample,
  });

export const fixtureExampleTranslation = () =>
  Promise.resolve({ native: tripExample });

export const fixtureTranslation = (text: string, given: WordSide) =>
  Promise.resolve({
    translation: given === 'target' ? 'die Reise' : `the ${text}`,
  });

const storedExample = (draft: NewVocabularyEntryDraft) =>
  draft.example === undefined
    ? null
    : {
        targetText: draft.example.targetText,
        nativeText: draft.example.nativeText ?? null,
        source: draft.example.source,
      };

const pronunciation = (targetText: string) =>
  targetText === 'silence' ? 'failed' : 'generated';

// Typed, corrected and deleted entries change the list in memory so the
// flows can be exercised end to end without a server. "silence" stands for a
// word whose pronunciation cannot be made.
export const useFixtureEntries = (initial: ReadonlyArray<VocabularyEntry>) => {
  const [entries, setEntries] = useState(initial);
  const createEntry = (
    draft: NewVocabularyEntryDraft,
    book: CourseBook,
    unit: CourseUnit | null,
  ): Promise<CreatedVocabularyEntry> => {
    const added = {
      ...fixtureEntry(
        entries.length + 1,
        [draft.targetText, draft.nativeText, false],
        book,
        unit,
      ),
      example: storedExample(draft),
    };
    setEntries((current) => [...current, added]);
    return Promise.resolve({
      entryId: added.id,
      audio: pronunciation(draft.targetText),
    });
  };
  const updateEntry = (
    entryId: string,
    draft: NewVocabularyEntryDraft,
  ): Promise<UpdatedVocabularyEntry> => {
    const stored = entries.find((entry) => entry.id === entryId);
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              targetText: draft.targetText,
              nativeText: draft.nativeText,
              example: storedExample(draft),
            }
          : entry,
      ),
    );
    return Promise.resolve({
      audio:
        stored?.targetText === draft.targetText
          ? 'kept'
          : pronunciation(draft.targetText),
    });
  };
  const removeEntry = (entryId: string) =>
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  return { entries, createEntry, updateEntry, removeEntry };
};
