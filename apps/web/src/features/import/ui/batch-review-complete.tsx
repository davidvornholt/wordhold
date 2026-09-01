import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import type { BatchReviewSummary } from '../schemas/batch-review-search';

type BatchReviewCompleteProps = BatchReviewSummary & {
  readonly overviewAction: ReactNode;
};

export const BatchReviewComplete = ({
  overviewAction,
  total,
}: BatchReviewCompleteProps) => (
  <section
    aria-live="polite"
    className="page-column flex flex-col items-start gap-4 px-6"
  >
    <div className="w-full border border-primary border-l-4 bg-card p-5">
      <p className="eyebrow">{countNoun(total, 'Seite', 'Seiten')} im Stapel</p>
      <h2 className="font-display text-xl">Stapel geprüft</h2>
      <p className="mt-2 text-sm">
        {countNoun(total, 'Seite wurde', 'Seiten wurden')} importiert. Alle
        Seiten sind erledigt.
      </p>
    </div>
    {overviewAction}
  </section>
);
