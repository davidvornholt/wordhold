import type { ReactNode } from 'react';
import type { BatchReviewSummary } from '../schemas/batch-review-search';

type BatchReviewCompleteProps = BatchReviewSummary & {
  readonly overviewAction: ReactNode;
};

const importedCopy = (imported: number): string =>
  imported === 1
    ? '1 Seite wurde importiert.'
    : `${imported} Seiten wurden importiert.`;

const skippedCopy = (skipped: number): string | null => {
  if (skipped === 0) {
    return null;
  }
  return skipped === 1
    ? '1 Seite bleibt zur späteren Prüfung offen.'
    : `${skipped} Seiten bleiben zur späteren Prüfung offen.`;
};

export const BatchReviewComplete = ({
  imported,
  overviewAction,
  skipped,
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
        {importedCopy(imported)}{' '}
        {skippedCopy(skipped) ?? 'Alle Seiten sind erledigt.'}
      </p>
    </div>
    {overviewAction}
  </section>
);
