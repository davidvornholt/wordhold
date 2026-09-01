import { type ReactNode, useId } from 'react';
import { formatLearningDate } from '../../../shared/dates/learning-date';
import {
  directionDescription,
  directionLabel,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import type { ActionVariant } from '../../../shared/ui/action-styles';
import { ProgressMeter } from '../../../shared/ui/progress-meter';
import {
  cardCompactClass,
  cardListClass,
} from '../../../shared/ui/surface-styles';
import {
  type CourseUnit,
  recommendedUnitAction,
  type UnitAction,
  type UnitDirectionProgress,
} from '../schemas/course-units';

type UnitDirectionPlanProps = {
  readonly unit: CourseUnit;
  readonly targetLabel: string;
  readonly renderLearnAction: (
    progress: UnitDirectionProgress,
    variant: ActionVariant,
  ) => ReactNode;
  readonly renderScheduledAction: (
    progress: UnitDirectionProgress,
    variant: ActionVariant,
  ) => ReactNode;
};

const isRecommended = (
  recommendation: UnitAction | null,
  kind: UnitAction['kind'],
  progress: UnitDirectionProgress,
): boolean =>
  recommendation?.kind === kind &&
  recommendation.direction === progress.direction;

const practiceStatus = (progress: UnitDirectionProgress): string | null => {
  if (progress.due > 0) {
    return `Üben: ${countNoun(progress.due, 'Wiederholung', 'Wiederholungen')} offen`;
  }
  if (progress.firstReviews > 0) {
    return `Üben: ${countNoun(progress.firstReviews, 'Karte', 'Karten')} zum ersten Mal`;
  }
  if (progress.nextDueAt !== null) {
    return `Üben: nächster Termin ${formatLearningDate(progress.nextDueAt).toLocaleLowerCase('de-DE')}`;
  }
  if (progress.introduced === 0) {
    return null;
  }
  return progress.unintroduced > 0
    ? 'Üben: nichts offen'
    : 'Üben: für jetzt geschafft';
};

export const UnitDirectionPlan = ({
  unit,
  targetLabel,
  renderLearnAction,
  renderScheduledAction,
}: UnitDirectionPlanProps) => {
  const headingId = useId();
  const recommendation = recommendedUnitAction(unit);
  const recommendedProgress = unit.directions.find(
    (progress) => progress.direction === recommendation?.direction,
  );
  let recommendedAction: ReactNode = null;
  if (recommendation !== null && recommendedProgress !== undefined) {
    recommendedAction =
      recommendation.kind === 'learn'
        ? renderLearnAction(recommendedProgress, 'primary')
        : renderScheduledAction(recommendedProgress, 'primary');
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl" id={headingId}>
          Lernstand nach Richtung
        </h2>
        <p className="text-muted-foreground text-sm">
          Jede Richtung wird einzeln kennengelernt und geübt.
        </p>
      </div>
      {recommendedAction === null ? null : (
        <div
          className={`${cardCompactClass} flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between`}
        >
          <p className="eyebrow">Als Nächstes</p>
          {recommendedAction}
        </div>
      )}
      <ul className={cardListClass}>
        {unit.directions.map((progress) => {
          const label = directionLabel(progress.direction, targetLabel);
          const learnIsNext = isRecommended(recommendation, 'learn', progress);
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
  );
};
