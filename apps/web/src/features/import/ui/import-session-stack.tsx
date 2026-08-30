import type { ReactNode } from 'react';

type ImportSessionPage = {
  readonly id: string;
  readonly position: number;
  readonly status: 'awaiting_verification' | 'verified';
  readonly extractionReady: boolean;
};

type ImportSessionStackProps = {
  readonly pages: ReadonlyArray<ImportSessionPage>;
  readonly pageImageSource: (page: ImportSessionPage) => string;
  readonly reviewAction: ReactNode;
};

const statusLabel = (page: ImportSessionPage) => {
  if (page.status === 'verified') {
    return 'Geprüft';
  }
  return page.extractionReady ? 'Bereit zum Prüfen' : 'Auslesen fehlgeschlagen';
};

const pendingPageLabel = (pendingCount: number) => {
  if (pendingCount === 0) {
    return 'Alle Seiten sind geprüft.';
  }
  return pendingCount === 1
    ? 'Eine Seite ist noch offen.'
    : `${pendingCount} Seiten sind noch offen.`;
};

export const ImportSessionStack = ({
  pages,
  pageImageSource,
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
        </div>
        {reviewAction}
      </div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {pages.map((page) => (
          <li
            className="flex gap-3 border border-border bg-card p-3"
            key={page.id}
          >
            <img
              alt=""
              className="h-24 w-20 shrink-0 border border-border object-cover"
              src={pageImageSource(page)}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-display text-lg">Seite {page.position + 1}</p>
              <p className="text-muted-foreground text-sm">
                {statusLabel(page)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
