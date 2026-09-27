import { type ReactNode, useId } from 'react';
import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import {
  directionDescription,
  directionLabel,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import type { ActionVariant } from '../../../shared/ui/action-styles';
import { ProgressMeter } from '../../../shared/ui/progress-meter';
import { cardListClass } from '../../../shared/ui/surface-styles';
import {
  type DirectionProgress,
  type RecommendedAction,
  recommendedAction,
  type WordProgress,
} from '../schemas/course-units';

type DirectionPlanProps = {
  // A unit's words, or the words that live directly in a book.
  readonly progress: WordProgress;
  readonly targetLabel: string;
  readonly renderLearnAction: (
    progress: DirectionProgress,
    variant: ActionVariant,
  ) => ReactNode;
  readonly renderScheduledAction: (
    progress: DirectionProgress,
    variant: ActionVariant,
  ) => ReactNode;
};

const isRecommended = (
  recommendation: RecommendedAction | null,
  kind: RecommendedAction['kind'],
  progress: DirectionProgress,
): boolean =>
  recommendation?.kind === kind &&
  recommendation.direction === progress.direction;

const practiceStatus = (progress: DirectionProgress): string | null => {
  if (progress.due > 0) {
    return `Üben: ${countNoun(progress.due, 'Wiederholung', 'Wiederholungen')} offen`;
  }
  if (progress.firstReviews > 0) {
    return `Üben: ${countNoun(progress.firstReviews, 'Karte', 'Karten')} zum ersten Mal`;
  }
  if (progress.nextDueAt !== null) {
    return `Üben: nächster Termin ${formatLearningDateInline(progress.nextDueAt)}`;
  }
  if (progress.introduced === 0) {
    return null;
  }
  return progress.unintroduced > 0
    ? 'Üben: nichts offen'
    : 'Üben: für jetzt geschafft';
};

export const DirectionPlan = ({
  progress: words,
  targetLabel,
  renderLearnAction,
  renderScheduledAction,
}: DirectionPlanProps) => {
  const headingId = useId();
  const recommendation = recommendedAction(words);
  const recommendedProgress = words.directions.find(
    (progress) => progress.direction === recommendation?.direction,
  );
  let leadingAction: ReactNode = null;
  if (recommendation !== null && recommendedProgress !== undefined) {
    leadingAction =
      recommendation.kind === 'learn'
        ? renderLearnAction(recommendedProgress, 'primary')
        : renderScheduledAction(recommendedProgress, 'primary');
  }
  // The recommended step leads the page like the course page's own primary
  // action; the per-direction detail below explains where it comes from.
  return (
    <>
      {leadingAction === null ? null : (
        <div className="flex flex-col sm:items-start">{leadingAction}</div>
      )}
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl" id={headingId}>
            Lernstand nach Richtung
          </h2>
          <p className="text-muted-foreground text-sm">
            Jede Richtung wird einzeln kennengelernt und geübt.
          </p>
        </div>
        <ul className={cardListClass}>
          {words.directions.map((progress) => {
            const label = directionLabel(progress.direction, targetLabel);
            const learnIsNext = isRecommended(
              recommendation,
              'learn',
              progress,
            );
            const hasInlineAction = progress.unintroduced > 0 && !learnIsNext;
            const status = practiceStatus(progress);
            return (
              <li
                className={
                  hasInlineAction ? 'grid gap-4 p-4 sm:grid-cols-2' : 'p-4'
                }
                key={label}
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-display text-xl">{label}</h3>
                    <p className="text-muted-foreground text-sm">
                      {directionDescription(progress.direction, targetLabel)}
                    </p>
                  </div>
                  <ProgressMeter
                    accessibleName={`${label}: Kennenlernfortschritt`}
                    description={`${progress.introduced} von ${progress.total} kennengelernt`}
                    total={progress.total}
                    value={progress.introduced}
                  />
                  {status === null ? null : <p className="text-sm">{status}</p>}
                </div>
                {hasInlineAction ? (
                  <div className="flex flex-col items-stretch sm:items-end sm:self-end">
                    {renderLearnAction(progress, 'outline')}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
};
