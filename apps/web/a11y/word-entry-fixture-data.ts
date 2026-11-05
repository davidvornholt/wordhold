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
import type { WordPlace } from '../src/features/courses/ui/word-places';
import { courseOutline, fixtureEntry } from './course-fixture-data';
import { changeLearning } from './fixture-learning';

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

// Typed, corrected, moved and deleted entries change the list in memory so the
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
  const removeEntries = (entryIds: ReadonlyArray<string>) =>
    setEntries((current) =>
      current.filter((entry) => !entryIds.includes(entry.id)),
    );
  const moveEntries = (entryIds: ReadonlyArray<string>, place: WordPlace) => {
    const book = courseOutline.books.find(({ id }) => id === place.bookId);
    const unit = courseOutline.units.find(({ id }) => id === place.unitId);
    setEntries((current) =>
      current.map((entry) =>
        entryIds.includes(entry.id)
          ? {
              ...entry,
              bookId: place.bookId,
              bookName: book?.name ?? entry.bookName,
              unitId: place.unitId,
              unitName: unit?.name ?? null,
            }
          : entry,
      ),
    );
  };
  const changeEntryLearning = (
    cardIds: ReadonlyArray<string>,
    change: 'skip' | 'return',
  ) => {
    const result = changeLearning(entries, cardIds, change);
    setEntries(result.entries);
    return Promise.resolve(result.changed);
  };
  return {
    entries,
    createEntry,
    updateEntry,
    removeEntries,
    moveEntries,
    changeEntryLearning,
  };
};
