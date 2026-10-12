import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useRef, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CourseEntryActions } from './entry-actions';
import { SkipLearningDialog } from './skip-learning-dialog';
import { type StudyIntent, studyIntents } from './study-action';
import { hasOpenLearning } from './vocabulary-schedule-status';

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
};

// Floats above the list edge while a selection exists, so the study actions
// stay reachable however long the list grows. A selection with directions
// still to learn can skip them instead. Once nothing is left to skip, its
// button is gone, so closing the dialog hands focus to the selection's count.
export const VocabularySelectionBar = ({
  entries,
  enabledDirections,
  subject,
  actions,
  renderStudyAction,
}: VocabularySelectionBarProps) => {
  const [skipping, setSkipping] = useState(false);
  const countRef = useRef<HTMLParagraphElement>(null);
  const nouns = courseNouns(subject);
  const canSkip = hasOpenLearning(entries, enabledDirections);
  const intents = studyIntents(entries, enabledDirections);
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
    </>
  );
};
