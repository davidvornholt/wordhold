import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useState } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import type { GeneratedExample } from '../../../shared/examples/example-draft';
import { germanLabels } from '../../../shared/languages';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CreatedVocabularyEntry } from '../services/vocabulary-entry-service';
import { NewVocabularyForm } from './new-vocabulary-form';
import { PlaceVocabularyEmpty } from './place-vocabulary-empty';
import type { NewVocabularyEntryDraft } from './use-new-vocabulary-entry';
import { VocabularyLibrary } from './vocabulary-library';
import type { SuggestTranslation } from './word-pair-fields';

type PlaceVocabularyProps = {
  readonly place: 'book' | 'unit';
  readonly entries: ReadonlyArray<VocabularyEntry>;
  // Every entry of the course, which a typed word is checked against.
  readonly courseEntries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly subject: CourseSubject;
  readonly importAction: ReactNode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly generateExample: (
    entryId: string,
  ) => Promise<NonNullable<VocabularyEntry['example']>>;
  readonly createEntry: (
    draft: NewVocabularyEntryDraft,
  ) => Promise<CreatedVocabularyEntry>;
  readonly generateDraftExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateDraftExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly suggestTranslation: SuggestTranslation;
};

// A unit's vocabulary, or the words directly in a book, with the one way to
// grow it by hand. The form sits under the heading, above the list, and stays
// open until the learner is done, so several words can be typed in a row and
// appear below as they are saved. An empty book or unit offers typing next to
// photographing.
export const PlaceVocabulary = ({
  place,
  entries,
  courseEntries,
  enabledDirections,
  subject,
  importAction,
  renderStudyAction,
  generateExample,
  createEntry,
  generateDraftExample,
  translateDraftExample,
  suggestTranslation,
}: PlaceVocabularyProps) => {
  const [adding, setAdding] = useState(false);
  const headingId = useId();
  const isEmpty = entries.length === 0;
  const form = adding ? (
    <NewVocabularyForm
      createEntry={createEntry}
      entries={courseEntries}
      generateExample={generateDraftExample}
      suggestTranslation={suggestTranslation}
      targetLabel={germanLabels[subject.targetLanguage]}
      targetLanguage={subject.targetLanguage}
      translateExample={translateDraftExample}
    />
  ) : null;
  let content: ReactNode = null;
  if (!isEmpty) {
    content = (
      <VocabularyLibrary
        enabledDirections={enabledDirections}
        entries={entries}
        generateExample={generateExample}
        initialFilter="all"
        renderStudyAction={renderStudyAction}
        scope="place"
        subject={subject}
      />
    );
  } else if (!adding) {
    content = (
      <PlaceVocabularyEmpty
        addAction={
          <Button onClick={() => setAdding(true)} variant="outline">
            Vokabel eintragen
          </Button>
        }
        importAction={importAction}
        place={place}
      />
    );
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          {isEmpty ? 'Vokabeln hinzufügen' : 'Vokabeln'}
        </h2>
        {isEmpty && !adding ? null : (
          <Button
            aria-expanded={adding}
            onClick={() => setAdding((current) => !current)}
            variant="quiet-muted"
          >
            {adding ? 'Fertig' : 'Vokabel eintragen'}
          </Button>
        )}
      </div>
      {form}
      {content}
    </section>
  );
};
