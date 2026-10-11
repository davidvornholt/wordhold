import { useId } from 'react';
import { ProgressMeter } from '../../../shared/ui/progress-meter';

type BatchReviewProgressProps = {
  readonly position: number;
  readonly total: number;
};

export const BatchReviewProgress = ({
  position,
  total,
}: BatchReviewProgressProps) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-display text-xl" id={headingId}>
          Seite {position} von {total}
        </h2>
        <span className="text-muted-foreground text-sm">
          {position - 1} von {total} geprüft
        </span>
      </div>
      <ProgressMeter
        accessibleName="Geprüfte Seiten"
        total={total}
        value={position - 1}
      />
    </section>
  );
};
