import { useId } from 'react';

type BatchReviewProgressProps = {
  readonly actionLabel: string;
  readonly busy: boolean;
  readonly onAction: () => void;
  readonly position: number;
  readonly total: number;
};

export const BatchReviewProgress = ({
  actionLabel,
  busy,
  onAction,
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
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Stapelprüfung
          </p>
          <h2 className="font-display text-xl" id={headingId}>
            Seite {position} von {total}
          </h2>
        </div>
        <span className="text-muted-foreground text-sm">
          {position - 1} von {total} geprüft
        </span>
      </div>
      <progress
        aria-label="Geprüfte Seiten"
        className="h-2 w-full accent-primary"
        max={total}
        value={position - 1}
      />
      <p className="text-muted-foreground text-sm">
        Nach dem Import öffnet Wordhold die nächste Seite.
      </p>
      <button
        className="w-fit text-sm underline underline-offset-4 disabled:opacity-50"
        disabled={busy}
        onClick={onAction}
        type="button"
      >
        {actionLabel}
      </button>
    </section>
  );
};
