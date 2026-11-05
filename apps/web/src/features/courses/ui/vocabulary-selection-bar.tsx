import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import {
  ActionMenu,
  type ActionMenuItem,
} from '../../../shared/ui/action-menu';
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
// stay reachable however long the list grows. Everything else a selection can
// do waits in a menu: skipping the directions still to learn, moving elsewhere
// in the course as long as there is somewhere else, and deleting.
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
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
  // The list empties the selection as the dialog closes on success, which takes
  // the menu with it.
  const changeFocusRef =
    entries.length === 0 ? fallbackFocusRef : menuTriggerRef;
  const menuItems: ReadonlyArray<ActionMenuItem> = [
    ...(canSkip
      ? [
          {
            label: 'Kennenlernen überspringen',
            onSelect: () => setSkipping(true),
            opensDialog: true,
          },
        ]
      : []),
    ...(targets.length === 0
      ? []
      : [
          {
            label: 'Auswahl verschieben',
            onSelect: () => startChange('move'),
            opensDialog: true,
          },
        ]),
    {
      destructive: true,
      label: 'Auswahl löschen',
      onSelect: () => startChange('delete'),
      opensDialog: true,
    },
  ];
  // Each action keeps its own slot, so it stays in place while the selection
  // changes whether the other one is offered.
  const studyAction = (intent: StudyIntent) =>
    intents.includes(intent)
      ? renderStudyAction(intent, intents[0] === intent)
      : null;
  return (
    <>
      {entries.length === 0 ? null : (
        <div className="sticky bottom-4 flex flex-col gap-3 border border-primary bg-card p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              {countNoun(entries.length, nouns.singular, nouns.plural)}{' '}
              ausgewählt
            </p>
            <ActionMenu
              items={menuItems}
              label="Weitere Aktionen"
              triggerRef={menuTriggerRef}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {studyAction('learn')}
            {studyAction('practice')}
          </div>
        </div>
      )}
      <SkipLearningDialog
        actions={actions}
        enabledDirections={enabledDirections}
        entries={entries}
        onClose={() => setSkipping(false)}
        open={skipping}
        returnFocusRef={menuTriggerRef}
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
