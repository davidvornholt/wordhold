import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useState } from 'react';
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
  // Null when the pass covers the whole course.
  readonly selection: PlaceSelectionData | null;
  readonly current: AnswerDirection;
  readonly currentRemaining: number;
  readonly onContinueCurrent: () => Promise<unknown>;
  readonly next: {
    readonly direction: AnswerDirection;
    readonly count: number;
  } | null;
  readonly subject: CourseSubject;
};

type ContinueLearningButtonProps = {
  readonly onContinue: () => Promise<unknown>;
  readonly children: ReactNode;
};

// The next section loads before it shows, so the button says so until the
// new section replaces it, as the practice start buttons do.
export const ContinueLearningButton = ({
  onContinue,
  children,
}: ContinueLearningButtonProps) => {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      aria-busy={loading}
      onClick={async () => {
        if (loading) {
          return;
        }
        setLoading(true);
        try {
          await onContinue();
        } finally {
          setLoading(false);
        }
      }}
      variant="outline"
    >
      {/* biome-ignore lint/suspicious/noLeakedRender: children is the button's own label, shown whenever it is not loading; nothing is rendered by accident. */}
      {loading ? 'Wird vorbereitet …' : children}
    </Button>
  );
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
        <ContinueLearningButton onContinue={onContinueCurrent}>
          Weitere{' '}
          {countNoun(
            itemsInNextSection(currentRemaining),
            nouns.singular,
            nouns.plural,
          )}{' '}
          kennenlernen · {directionLabel(current, subject)}
        </ContinueLearningButton>
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
