import type { ReactNode } from 'react';
import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { EditVocabularyForm } from '../src/features/courses/ui/edit-vocabulary-form';
import type { CourseEntryActions } from '../src/features/courses/ui/entry-actions';
import { targetLabel } from './course-fixture-data';
import {
  fixtureDraftExample,
  fixtureExampleTranslation,
  fixtureTranslation,
  useFixtureEntries,
} from './word-entry-fixture-data';

// The English course's words, which the entry dialog corrects and deletes in
// memory. The list refreshes after the dialog has closed, as the page's
// loader does.
export const useFixtureWords = (
  initialEntries: ReadonlyArray<VocabularyEntry>,
  renderDetail: (entry: VocabularyEntry) => ReactNode,
) => {
  const { entries, createEntry, updateEntry, removeEntry } =
    useFixtureEntries(initialEntries);
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
    remove: (entry) => {
      globalThis.setTimeout(() => removeEntry(entry.id));
      return Promise.resolve();
    },
  };
  return { entries, createEntry, entryActions };
};
