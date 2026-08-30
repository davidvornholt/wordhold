import type { ReactNode } from 'react';
import type { BatchReviewSummary } from '../schemas/batch-review-search';

type BatchReviewCompleteProps = BatchReviewSummary & {
  readonly overviewAction: ReactNode;
};

const importedCopy = (total: number): string =>
  total === 1
    ? '1 Seite wurde importiert.'
    : `${total} Seiten wurden importiert.`;

export const BatchReviewComplete = ({
  overviewAction,
  total,
}: BatchReviewCompleteProps) => (
  <section
    aria-live="polite"
    className="page-column flex flex-col items-start gap-4 px-6"
  >
    <div className="w-full border border-primary border-l-4 bg-card p-5">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {total} {total === 1 ? 'Seite' : 'Seiten'} im Stapel
      </p>
      <h2 className="font-display text-xl">Stapel geprüft</h2>
      <p className="mt-2 text-sm">
        {importedCopy(total)} Alle Seiten sind erledigt.
      </p>
    </div>
    {overviewAction}
  </section>
);
