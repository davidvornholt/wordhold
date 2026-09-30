import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useState } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import { PlaceVocabularyEmpty } from './place-vocabulary-empty';
import { VocabularyLibrary } from './vocabulary-library';

type PlaceVocabularyProps = {
  readonly place: 'book' | 'unit';
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly subject: CourseSubject;
  readonly importAction: ReactNode;
  // The form for a word, saving into this book or unit.
  readonly entryForm: ReactNode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly renderEntryDetail: (entry: VocabularyEntry) => ReactNode;
};

// A unit's vocabulary, or the words directly in a book, with the one way to
// grow it by hand. The form sits under the heading, above the list, and stays
// open until the learner is done, so several words can be typed in a row and
// appear below as they are saved. An empty book or unit offers typing next to
// photographing.
export const PlaceVocabulary = ({
  place,
  entries,
  enabledDirections,
  subject,
  importAction,
  entryForm,
  renderStudyAction,
  renderEntryDetail,
}: PlaceVocabularyProps) => {
  const [adding, setAdding] = useState(false);
  const headingId = useId();
  const isEmpty = entries.length === 0;
  let content: ReactNode = null;
  if (!isEmpty) {
    content = (
      <VocabularyLibrary
        enabledDirections={enabledDirections}
        entries={entries}
        initialFilter="all"
        renderEntryDetail={renderEntryDetail}
        layout="flat"
        renderStudyAction={renderStudyAction}
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
      {adding ? entryForm : null}
      {content}
    </section>
  );
};
