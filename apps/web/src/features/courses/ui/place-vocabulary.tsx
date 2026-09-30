import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useRef, useState } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
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
// grow it by hand. The form opens in a dialog that stays open until the
// learner is done, so several words can be typed in a row and appear in the
// list behind it as they are saved. An empty book or unit offers typing next
// to photographing.
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
  // The first saved word replaces the empty state's button with this one.
  const addRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const isEmpty = entries.length === 0;
  let content: ReactNode = null;
  if (isEmpty) {
    content = (
      <PlaceVocabularyEmpty
        addAction={
          <Button
            aria-haspopup="dialog"
            onClick={() => setAdding(true)}
            variant="outline"
          >
            Vokabel eintragen
          </Button>
        }
        importAction={importAction}
        place={place}
      />
    );
  } else {
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
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          {isEmpty ? 'Vokabeln hinzufügen' : 'Vokabeln'}
        </h2>
        {isEmpty ? null : (
          <Button
            aria-haspopup="dialog"
            onClick={() => setAdding(true)}
            ref={addRef}
            variant="quiet-muted"
          >
            Vokabel eintragen
          </Button>
        )}
      </div>
      {content}
      <Dialog
        closable={true}
        closeLabel="Fertig"
        onClose={() => setAdding(false)}
        open={adding}
        returnFocusRef={addRef}
        title="Vokabel eintragen"
      >
        {entryForm}
      </Dialog>
    </section>
  );
};
