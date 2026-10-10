import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type CourseSubject, isListCourse } from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CourseEntryActions } from './entry-actions';
import { EntryDeletion } from './entry-deletion';
import { ScheduleItems } from './vocabulary-schedule';

type VocabularyEntryDetailsProps = {
  readonly entry: VocabularyEntry;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  // The example sentence of a word, or the key points of a term. A text has
  // none.
  readonly detail: ReactNode;
};

const nativeLabels = {
  language: 'Übersetzung',
  terms: 'Definition',
  texts: 'Text',
} as const satisfies Record<CourseSubject['kind'], string>;

// What an entry's row leaves out: each direction's schedule and the example
// sentence or key points, which can be changed here. A definition or text
// keeps its line breaks.
const VocabularyEntryDetails = ({
  entry,
  enabledDirections,
  now,
  subject,
  detail,
}: VocabularyEntryDetailsProps) => (
  <div className="flex flex-col gap-4 text-sm">
    <dl className="grid gap-3">
      <div className="grid gap-0.5">
        <dt className="font-medium">{nativeLabels[subject.kind]}</dt>
        <dd
          className={
            isListCourse(subject.kind)
              ? 'hyphens-auto whitespace-pre-line'
              : 'hyphens-auto'
          }
        >
          {entry.nativeText}
        </dd>
      </div>
      <ScheduleItems
        enabledDirections={enabledDirections}
        entry={entry}
        now={now}
        subject={subject}
      />
    </dl>
    {detail}
  </div>
);

type EntryView = 'details' | 'edit' | 'delete';

type EntryDialogBodyProps = Omit<VocabularyEntryDetailsProps, 'detail'> & {
  readonly actions: CourseEntryActions;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onRemoved: () => void;
};

// The details, the form that corrects them, or the question whether to
// delete the entry. Leaving the form or the question returns focus to the
// button that led there.
const EntryDialogBody = ({
  entry,
  enabledDirections,
  now,
  subject,
  actions,
  onBusyChange,
  onRemoved,
}: EntryDialogBodyProps) => {
  const [view, setView] = useState<EntryView>('details');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const focusAfterRef = useRef<RefObject<HTMLButtonElement | null> | null>(
    null,
  );

  useEffect(() => {
    if (view === 'details' && focusAfterRef.current !== null) {
      focusAfterRef.current.current?.focus();
      focusAfterRef.current = null;
    }
  }, [view]);

  const showDetails = (focusAfter: RefObject<HTMLButtonElement | null>) => {
    focusAfterRef.current = focusAfter;
    setView('details');
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    onBusyChange(true);
    try {
      await actions.remove(entry);
      onBusyChange(false);
      onRemoved();
    } catch {
      setDeleteError(
        'Das Löschen hat nicht geklappt. Versuche es noch einmal.',
      );
      setDeleting(false);
      onBusyChange(false);
    }
  };

  const views: Record<EntryView, () => ReactNode> = {
    edit: () =>
      actions.renderEditor(entry, {
        onBusyChange,
        onSaved: (saved) => {
          setNotice(saved);
          showDetails(editRef);
        },
        onCancel: () => showDetails(editRef),
      }),
    delete: () => (
      <EntryDeletion
        deleting={deleting}
        error={deleteError}
        onConfirm={() => {
          remove().catch(() => undefined);
        }}
        onKeep={() => showDetails(deleteRef)}
      />
    ),
    details: () => (
      <div className="flex flex-col gap-4">
        <VocabularyEntryDetails
          detail={actions.renderDetail(entry)}
          enabledDirections={enabledDirections}
          entry={entry}
          now={now}
          subject={subject}
        />
        <div className="flex flex-wrap gap-3 border-border border-t pt-4">
          <Button
            onClick={() => {
              setNotice('');
              setView('edit');
            }}
            ref={editRef}
            variant="outline"
          >
            Bearbeiten
          </Button>
          <Button
            onClick={() => {
              setNotice('');
              setDeleteError(null);
              setView('delete');
            }}
            ref={deleteRef}
            variant="quiet-muted"
          >
            Löschen
          </Button>
        </div>
      </div>
    ),
  };

  // The notice stays mounted across the views, so a saved correction is
  // announced when the details return.
  return (
    <div className="flex flex-col">
      <output
        aria-label="Status beim Bearbeiten"
        className="not-empty:mb-4 text-sm"
      >
        {notice}
      </output>
      {views[view]()}
    </div>
  );
};

type VocabularyEntryDialogProps = {
  // Undefined while no entry's details are open.
  readonly entry: VocabularyEntry | undefined;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  readonly actions: CourseEntryActions;
  // Where focus goes on closing when the entry's row is gone.
  readonly returnFocusRef: RefObject<HTMLElement | null> | undefined;
  readonly onClose: () => void;
  readonly onRemoved: (entryId: string) => void;
};

// One entry's details over its list, titled with the word or term, where
// the entry can also be corrected or deleted. The dialog stays open while a
// change is saved.
export const VocabularyEntryDialog = ({
  entry,
  enabledDirections,
  now,
  subject,
  actions,
  returnFocusRef,
  onClose,
  onRemoved,
}: VocabularyEntryDialogProps) => {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      closable={!busy}
      closeLabel="Schließen"
      onClose={onClose}
      open={entry !== undefined}
      returnFocusRef={returnFocusRef}
      title={
        <span
          lang={isListCourse(subject.kind) ? undefined : subject.targetLanguage}
        >
          {entry?.targetText}
        </span>
      }
    >
      {entry === undefined ? null : (
        <EntryDialogBody
          actions={actions}
          enabledDirections={enabledDirections}
          entry={entry}
          key={entry.id}
          now={now}
          onBusyChange={setBusy}
          onRemoved={() => onRemoved(entry.id)}
          subject={subject}
        />
      )}
    </Dialog>
  );
};
