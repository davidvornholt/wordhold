import type { ReactNode } from 'react';
import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { EditVocabularyForm } from '../src/features/courses/ui/edit-vocabulary-form';
import type { CourseEntryActions } from '../src/features/courses/ui/entry-actions';
import { wordPlaceOptions } from '../src/features/courses/ui/word-places';
import { courseOutline, targetLabel } from './course-fixture-data';
import { prepareAdolescentPitfalls } from './pitfall-fixture-data';
import {
  fixtureDraftExample,
  fixtureExampleTranslation,
  fixtureTranslation,
  useFixtureEntries,
} from './word-entry-fixture-data';

const selectionFails = () =>
  new URLSearchParams(globalThis.location.search).get('selectionResponse') ===
  'failure';

// The English course's words, which the entry dialog corrects and a selection
// moves or deletes in memory. The list refreshes after the dialog has closed,
// as the page's loader does. A list of one place loses the words moved away,
// and the course's whole list shows them at their new place.
export const useFixtureWords = (
  initialEntries: ReadonlyArray<VocabularyEntry>,
  renderDetail: (entry: VocabularyEntry) => ReactNode,
  layout: 'flat' | 'by-place',
) => {
  const {
    entries,
    createEntry,
    updateEntry,
    removeEntries,
    moveEntries,
    changeEntryLearning,
  } = useFixtureEntries(initialEntries);
  const entryActions: CourseEntryActions = {
    renderDetail,
    renderEditor: (entry, control) => (
      <EditVocabularyForm
        control={control}
        entries={entries}
        entry={entry}
        generateExample={fixtureDraftExample}
        suggestTranslation={fixtureTranslation}
        targetLabel={targetLabel}
        targetLanguage="en"
        translateExample={fixtureExampleTranslation}
        updateEntry={(draft) => updateEntry(entry.id, draft)}
      />
    ),
    remove: (entryIds) => {
      if (selectionFails()) {
        return Promise.reject(new Error('Die Verbindung ist abgebrochen.'));
      }
      globalThis.setTimeout(() => removeEntries(entryIds));
      return Promise.resolve();
    },
    moving: {
      places: wordPlaceOptions(courseOutline),
      move: (entryIds, place) => {
        if (selectionFails()) {
          return Promise.reject(
            new Error('Diese Einheit gibt es nicht mehr. Lade die Seite neu.'),
          );
        }
        globalThis.setTimeout(() =>
          layout === 'flat'
            ? removeEntries(entryIds)
            : moveEntries(entryIds, place),
        );
        return Promise.resolve(entryIds.length);
      },
    },
    skipLearning: (cardIds) => changeEntryLearning(cardIds, 'skip'),
    returnToLearning: (cardIds) => changeEntryLearning(cardIds, 'return'),
    preparePitfalls: prepareAdolescentPitfalls,
  };
  return { entries, createEntry, entryActions };
};
