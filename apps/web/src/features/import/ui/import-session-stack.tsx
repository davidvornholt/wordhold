import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';

type ImportSessionPage = {
  readonly id: string;
  readonly pageNumber: number | null;
  readonly position: number;
  readonly status: 'awaiting_verification' | 'verified';
  readonly extractionReady: boolean;
};

type ImportSessionStackProps = {
  readonly pages: ReadonlyArray<ImportSessionPage>;
  readonly pageImageSource: (page: ImportSessionPage) => string;
  readonly reviewOrder: 'page_number' | 'scan';
  readonly reviewAction: ReactNode;
};

const statusDetails = (page: ImportSessionPage) => {
  if (page.status === 'verified') {
    return { label: 'Geprüft', borderClass: 'border-l-primary' };
  }
  return page.extractionReady
    ? { label: 'Bereit zum Prüfen', borderClass: 'border-l-border' }
    : { label: 'Auslesen fehlgeschlagen', borderClass: 'border-l-destructive' };
};

const pendingPageLabel = (pendingCount: number) => {
  if (pendingCount === 0) {
    return 'Alle Seiten sind geprüft.';
  }
  return `${countNoun(pendingCount, 'Seite ist', 'Seiten sind')} noch offen.`;
};

export const ImportSessionStack = ({
  pages,
  pageImageSource,
  reviewOrder,
  reviewAction,
}: ImportSessionStackProps) => {
  const pendingCount = pages.filter(
    (page) => page.status === 'awaiting_verification',
  ).length;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-border border-b pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl">Seiten im Stapel</h2>
          <p className="text-muted-foreground text-sm">
            {pendingPageLabel(pendingCount)}
          </p>
          <p className="text-muted-foreground text-sm">
            {reviewOrder === 'page_number'
              ? 'Nach erkannten Buchseiten sortiert.'
              : 'In Scanreihenfolge sortiert.'}
          </p>
        </div>
        {reviewAction}
      </div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {pages.map((page) => {
          const status = statusDetails(page);
          return (
            <li
              className={`flex gap-3 border border-border border-l-4 bg-card p-3 ${status.borderClass}`}
              key={page.id}
            >
              <img
                alt=""
                className="h-24 w-20 shrink-0 border border-border object-cover"
                src={pageImageSource(page)}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-display text-lg">
                  {reviewOrder === 'page_number' && page.pageNumber !== null
                    ? `Buchseite ${page.pageNumber}`
                    : `Scan ${page.position + 1}`}
                </p>
                <p className="text-muted-foreground text-sm">{status.label}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
