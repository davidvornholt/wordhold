import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
} from '../../../shared/directions';
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
  readonly subject: CourseSubject;
};

export const LearnCompletionControls = ({
  courseId,
  selection,
  current,
  currentRemaining,
  onContinueCurrent,
  next,
  subject,
}: LearnCompletionControlsProps) => {
  const nouns = courseNouns(subject);
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
      <ActionLink
        params={{ courseId }}
        search={{ direction: current, ...placeSearch(selection) }}
        to="/courses/$courseId/practice"
      >
        Jetzt üben · {directionLabel(current, subject)}
      </ActionLink>
      {currentRemaining === 0 ? null : (
        <Button onClick={onContinueCurrent} variant="outline">
          Weitere{' '}
          {countNoun(
            itemsInNextSection(currentRemaining),
            nouns.singular,
            nouns.plural,
          )}{' '}
          kennenlernen · {directionLabel(current, subject)}
        </Button>
      )}
      {next === null ? null : (
        <PlaceLearnLink
          courseId={courseId}
          direction={next.direction}
          selection={selection}
          variant="outline"
        >
          {countNoun(next.count, nouns.singular, nouns.plural)} kennenlernen ·{' '}
          {directionLabel(next.direction, subject)}
        </PlaceLearnLink>
      )}
    </div>
  );
};
