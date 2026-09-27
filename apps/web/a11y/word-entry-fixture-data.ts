import { useState } from 'react';
import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import type { CreatedVocabularyEntry } from '../src/features/courses/services/vocabulary-entry-service';
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

// Typed entries join the list in memory so the add flow can be exercised end
// to end without a server. "silence" stands for a word whose pronunciation
// cannot be made.
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
      example:
        draft.example === undefined
          ? null
          : {
              targetText: draft.example.targetText,
              nativeText: draft.example.nativeText ?? null,
              source: draft.example.source,
            },
    };
    setEntries((current) => [...current, added]);
    return Promise.resolve({
      entryId: added.id,
      audio: draft.targetText === 'silence' ? 'failed' : 'generated',
    });
  };
  return { entries, createEntry };
};
