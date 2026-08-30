import { ImportSessionStack } from '../src/features/import/ui/import-session-stack';
import { navigateToFixture } from './fixture-state';
import { photographedPage } from './verification-fixture-data';

const pages = [
  {
    id: 'page-1',
    position: 0,
    status: 'awaiting_verification' as const,
    extractionReady: true,
  },
  {
    id: 'page-2',
    position: 1,
    status: 'awaiting_verification' as const,
    extractionReady: true,
  },
];

export const ImportSessionFixture = () => (
  <main className="page-column flex flex-col gap-8 p-6">
    <header className="flex flex-col gap-3 border-border border-b pb-5">
      <button
        className="w-fit text-muted-foreground text-sm underline"
        onClick={() => navigateToFixture('dashboard')}
        type="button"
      >
        ← Übersicht
      </button>
      <div>
        <p className="text-muted-foreground text-sm">Import vom 24.8.2026</p>
        <h1 className="font-display font-semibold text-2xl">
          English A2: Seitenstapel
        </h1>
      </div>
    </header>
    <ImportSessionStack
      pageImageSource={() => photographedPage}
      pages={pages}
      renderPageAction={() => (
        <button
          className="font-medium text-sm underline underline-offset-4"
          onClick={() => navigateToFixture('verification-batch-first')}
          type="button"
        >
          Seite prüfen
        </button>
      )}
      reviewAction={
        <button
          className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
          onClick={() => navigateToFixture('verification-batch-first')}
          type="button"
        >
          2 Seiten nacheinander prüfen
        </button>
      }
    />
  </main>
);
