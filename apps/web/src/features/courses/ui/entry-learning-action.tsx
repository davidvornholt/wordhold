import { Button } from '../../../shared/ui/button';
import type { CourseEntryActions } from './entry-actions';
import {
  learningChangeFailure,
  useLearningChange,
} from './use-learning-change';
import {
  learningChangeFor,
  type VocabularyCard,
} from './vocabulary-schedule-status';

// Visually the direction is already named above the button; a screen reader
// moving from button to button hears it too.
export const DirectionSuffix = ({
  direction,
}: {
  readonly direction: string | null;
}) =>
  direction === null ? null : <span className="sr-only"> · {direction}</span>;

const actionLabels = {
  skip: 'Kennenlernen überspringen',
  return: 'Wieder kennenlernen',
} as const;

const changeNotice = (
  change: 'skip' | 'return',
  changed: number,
  direction: string | null,
): string => {
  if (changed === 0) {
    return 'Daran hat sich inzwischen schon etwas geändert.';
  }
  const done =
    change === 'skip'
      ? 'Kennenlernen übersprungen'
      : 'Kennenlernen wieder offen';
  return direction === null ? done : `${done} · ${direction}`;
};

type EntryLearningActionProps = {
  readonly card: VocabularyCard;
  // The direction's name, or null for a subject's only direction.
  readonly direction: string | null;
  readonly actions: CourseEntryActions;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onChanged: (notice: string) => void;
};

// One direction of an entry skips the learning pass, or goes back to it while
// it has not been practised. The button then offers the opposite, so a slip
// is undone where it happened.
export const EntryLearningAction = ({
  card,
  direction,
  actions,
  onBusyChange,
  onChanged,
}: EntryLearningActionProps) => {
  const { busy, failed, buttonRef, run } = useLearningChange(onBusyChange);
  const change = learningChangeFor(card);
  if (change === null) {
    return null;
  }
  const onClick = () =>
    run(async () => {
      const changed =
        change === 'skip'
          ? await actions.skipLearning([card.cardId])
          : await actions.returnToLearning([card.cardId]);
      onChanged(changeNotice(change, changed.length, direction));
    });
  return (
    <dd className="flex flex-col items-start">
      <Button
        className="-my-1.5"
        disabled={busy}
        onClick={onClick}
        ref={buttonRef}
        variant="quiet"
      >
        {busy ? 'Wird gespeichert …' : actionLabels[change]}
        <DirectionSuffix direction={direction} />
      </Button>
      {failed ? (
        <p className="text-destructive" role="alert">
          {learningChangeFailure}
        </p>
      ) : null}
    </dd>
  );
};
