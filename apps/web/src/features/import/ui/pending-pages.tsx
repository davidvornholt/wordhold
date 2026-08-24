import type { ReactNode } from 'react';

type PendingPage = {
  readonly id: string;
  readonly courseName: string;
  readonly label: string | null;
  readonly capturedAt: Date;
};

type PendingPagesProps = {
  readonly pages: ReadonlyArray<PendingPage>;
  readonly renderPageAction: (page: PendingPage, label: string) => ReactNode;
};

export const PendingPages = ({
  pages,
  renderPageAction,
}: PendingPagesProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="font-medium text-lg">Seiten zur Überprüfung</h2>
    {pages.length === 0 ? (
      <p className="text-neutral-500 text-sm">
        Keine Seiten warten auf Überprüfung.
      </p>
    ) : (
      <ul className="flex flex-col gap-2">
        {pages.map((page) => {
          const label = `${page.courseName}${
            page.label === null ? '' : ` – ${page.label}`
          } (${new Date(page.capturedAt).toLocaleDateString('de-DE')})`;
          return <li key={page.id}>{renderPageAction(page, label)}</li>;
        })}
      </ul>
    )}
  </section>
);
