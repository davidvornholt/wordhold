import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import { Button } from '../../../shared/ui/button';
import { PlaceLearnLink, placeSearch } from './-course-place';

type LearnCompletionControlsProps = {
  readonly courseId: string;
  readonly selection: PlaceSelectionData;
  readonly current: AnswerDirection;
  readonly currentRemaining: number;
  readonly onContinueCurrent: () => Promise<unknown>;
  readonly next: {
    readonly direction: AnswerDirection;
    readonly count: number;
  } | null;
  readonly targetLabel: string;
};

export const LearnCompletionControls = ({
  courseId,
  selection,
  current,
  currentRemaining,
  onContinueCurrent,
  next,
  targetLabel,
}: LearnCompletionControlsProps) => (
  <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
    <ActionLink
      params={{ courseId }}
      search={{ direction: current, ...placeSearch(selection) }}
      to="/courses/$courseId/practice"
    >
      Jetzt üben · {directionLabel(current, targetLabel)}
    </ActionLink>
    {currentRemaining === 0 ? null : (
      <Button onClick={onContinueCurrent} variant="outline">
        Weitere{' '}
        {countNoun(itemsInNextSection(currentRemaining), 'Vokabel', 'Vokabeln')}{' '}
        kennenlernen · {directionLabel(current, targetLabel)}
      </Button>
    )}
    {next === null ? null : (
      <PlaceLearnLink
        courseId={courseId}
        direction={next.direction}
        selection={selection}
        variant="outline"
      >
        {countNoun(next.count, 'Vokabel', 'Vokabeln')} kennenlernen ·{' '}
        {directionLabel(next.direction, targetLabel)}
      </PlaceLearnLink>
    )}
  </div>
);
