import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { directionLabel } from '../../../../../shared/directions';
import { countNoun } from '../../../../../shared/format/count';
import { itemsInNextSection } from '../../../../../shared/session/section-policy';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { Button } from '../../../../../shared/ui/button';

type LearnCompletionControlsProps = {
  readonly courseId: string;
  readonly unitId: string;
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
  unitId,
  current,
  currentRemaining,
  onContinueCurrent,
  next,
  targetLabel,
}: LearnCompletionControlsProps) => (
  <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
    <ActionLink
      params={{ courseId }}
      search={{ direction: current, unit: unitId }}
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
      <ActionLink
        params={{ courseId, unitId }}
        search={{ direction: next.direction }}
        to="/courses/$courseId/units/$unitId/learn"
        variant="outline"
      >
        {countNoun(next.count, 'Vokabel', 'Vokabeln')} kennenlernen ·{' '}
        {directionLabel(next.direction, targetLabel)}
      </ActionLink>
    )}
  </div>
);
