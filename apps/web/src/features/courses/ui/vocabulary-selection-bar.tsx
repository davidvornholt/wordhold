import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import { DeleteSelectionDialog } from './delete-selection-dialog';
import type { CourseEntryActions } from './entry-actions';
import { MoveSelectionDialog } from './move-selection-dialog';
import { SkipLearningDialog } from './skip-learning-dialog';
import { type StudyIntent, studyIntents } from './study-action';
import { hasOpenLearning } from './vocabulary-schedule-status';
import { moveTargets } from './word-places';

type VocabularySelectionBarProps = {
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly subject: CourseSubject;
  readonly actions: CourseEntryActions;
  // Learning what the selection still has open, or practising what it has
  // learned. The leading one is primary.
  readonly renderStudyAction: (
    intent: StudyIntent,
    primary: boolean,
  ) => ReactNode;
  // Where focus goes once the selection was moved or deleted, since the bar
  // is gone by then.
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
  // A move or deletion is being considered, or is done and the selection over.
  readonly onChangeStarted: () => void;
  readonly onChanged: (notice: string) => void;
};

// Floats above the list edge while a selection exists, so the study actions
// stay reachable however long the list grows. A selection with directions
// still to learn can skip them instead. Once nothing is left to skip, its
// button is gone, so closing the dialog hands focus to the selection's count.
// A selection can also move elsewhere in the course, as long as there is
// somewhere else, or be deleted.
export const VocabularySelectionBar = ({
  entries,
  enabledDirections,
  subject,
  actions,
  renderStudyAction,
  fallbackFocusRef,
  onChangeStarted,
  onChanged,
}: VocabularySelectionBarProps) => {
  const [skipping, setSkipping] = useState(false);
  const [change, setChange] = useState<'move' | 'delete' | null>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const nouns = courseNouns(subject);
  const canSkip = hasOpenLearning(entries, enabledDirections);
  const intents = studyIntents(entries, enabledDirections);
  const targets =
    actions.moving === null ? [] : moveTargets(actions.moving.places, entries);
  const startChange = (next: 'move' | 'delete') => {
    onChangeStarted();
    setChange(next);
  };
  const finishChange = (notice: string) => {
    setChange(null);
    onChanged(notice);
  };
  // The list empties the selection as the dialog closes on success. Otherwise
  // focus returns to the button that opened it.
  const changeFocusRef = entries.length === 0 ? fallbackFocusRef : undefined;
  // Each action keeps its own slot, so it stays in place while the selection
  // changes whether the other one is offered.
  const studyAction = (intent: StudyIntent) =>
    intents.includes(intent)
      ? renderStudyAction(intent, intents[0] === intent)
      : null;
  return (
    <>
      {entries.length === 0 ? null : (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 border border-primary bg-card p-4 shadow-lg">
          <p
            className="font-medium focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            ref={countRef}
            tabIndex={-1}
          >
            {countNoun(entries.length, nouns.singular, nouns.plural)} ausgewählt
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {studyAction('learn')}
            {studyAction('practice')}
            {canSkip || skipping ? (
              <Button
                aria-haspopup="dialog"
                onClick={() => setSkipping(true)}
                variant="quiet"
              >
                Kennenlernen überspringen
              </Button>
            ) : null}
            {targets.length === 0 ? null : (
              <Button
                aria-haspopup="dialog"
                onClick={() => startChange('move')}
                variant="quiet"
              >
                Auswahl verschieben
              </Button>
            )}
            <Button
              aria-haspopup="dialog"
              onClick={() => startChange('delete')}
              variant="quiet-muted"
            >
              Auswahl löschen
            </Button>
          </div>
        </div>
      )}
      <SkipLearningDialog
        actions={actions}
        enabledDirections={enabledDirections}
        entries={entries}
        onClose={() => setSkipping(false)}
        open={skipping}
        returnFocusRef={canSkip ? undefined : countRef}
        subject={subject}
      />
      {actions.moving === null ? null : (
        <MoveSelectionDialog
          entries={entries}
          move={actions.moving.move}
          onClose={() => setChange(null)}
          onMoved={finishChange}
          open={change === 'move'}
          options={targets}
          returnFocusRef={changeFocusRef}
          subject={subject}
        />
      )}
      <DeleteSelectionDialog
        entries={entries}
        onClose={() => setChange(null)}
        onDeleted={finishChange}
        open={change === 'delete'}
        remove={actions.remove}
        returnFocusRef={changeFocusRef}
        subject={subject}
      />
    </>
  );
};
