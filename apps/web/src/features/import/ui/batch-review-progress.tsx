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
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Stapelprüfung</p>
          <h2 className="font-display text-xl" id={headingId}>
            Seite {position} von {total}
          </h2>
        </div>
        <span className="text-muted-foreground text-sm">
          {position - 1} von {total} geprüft
        </span>
      </div>
      <ProgressMeter
        accessibleName="Geprüfte Seiten"
        total={total}
        value={position - 1}
      />
      <p className="text-muted-foreground text-sm">
        Prüfe die Seiten in ihrer Reihenfolge. Nach dem Import öffnet Wordhold
        die nächste Seite.
      </p>
    </section>
  );
};
