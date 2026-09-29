import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import { PlaceVocabularyEmpty } from './place-vocabulary-empty';
import { VocabularyLibrary } from './vocabulary-library';

type PlaceVocabularyProps = {
  readonly place: 'book' | 'unit';
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly subject: CourseSubject;
  // Null for a subject, whose terms are typed rather than photographed.
  readonly importAction: ReactNode | null;
  // The form for a word or a term, saving into this book or unit.
  readonly entryForm: ReactNode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly renderEntryDetail: (entry: VocabularyEntry) => ReactNode;
};

// A unit's entries, or the entries directly in a book, with the one way to
// grow them by hand. The form sits under the heading, above the list, and
// stays open until the learner is done, so several entries can be typed in a
// row and appear below as they are saved. An empty book or unit of a language
// offers typing next to photographing.
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
  const nouns = courseNouns(subject);
  const isEmpty = entries.length === 0;
  let content: ReactNode = null;
  if (!isEmpty) {
    content = (
      <VocabularyLibrary
        enabledDirections={enabledDirections}
        entries={entries}
        initialFilter="all"
        renderEntryDetail={renderEntryDetail}
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
            {nouns.singular} eintragen
          </Button>
        }
        importAction={importAction}
        place={place}
        subject={subject}
      />
    );
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          {isEmpty ? `${nouns.plural} hinzufügen` : nouns.plural}
        </h2>
        {isEmpty && !adding ? null : (
          <Button
            aria-expanded={adding}
            onClick={() => setAdding((current) => !current)}
            variant="quiet-muted"
          >
            {adding ? 'Fertig' : `${nouns.singular} eintragen`}
          </Button>
        )}
      </div>
      {adding ? entryForm : null}
      {content}
    </section>
  );
};
