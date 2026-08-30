import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { batchReviewSearchFor } from '../../features/import/schemas/batch-review-search';
import { getImportSession } from '../../features/import/server-fns';
import { ImportSessionStack } from '../../features/import/ui/import-session-stack';

const ImportSessionScreen = () => {
  const session = Route.useLoaderData();
  const pageIds = session.pages.map((page) => page.id);
  const firstPendingPage = session.pages.find(
    (page) => page.status === 'awaiting_verification',
  );
  const firstPendingIndex = session.pages.findIndex(
    (page) => page.status === 'awaiting_verification',
  );
  let reviewAction: ReactNode;
  if (!session.isComplete) {
    reviewAction = (
      <p className="text-muted-foreground text-sm" role="status">
        Die restlichen Seiten werden noch verarbeitet.
      </p>
    );
  } else if (firstPendingPage === undefined) {
    reviewAction = (
      <Link className="text-sm underline underline-offset-4" to="/">
        Zur Übersicht
      </Link>
    );
  } else {
    reviewAction = (
      <Link
        className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        params={{ pageId: firstPendingPage.id }}
        search={batchReviewSearchFor(pageIds, firstPendingPage.id)}
        to="/pages/$pageId/verify"
      >
        {firstPendingIndex === 0 ? 'Prüfung beginnen' : 'Prüfung fortsetzen'}
      </Link>
    );
  }

  return (
    <main className="page-column flex flex-col gap-8 p-6">
      <header className="flex flex-col gap-3 border-border border-b pb-5">
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
        <div>
          <p className="text-muted-foreground text-sm">
            Import vom{' '}
            {new Date(session.capturedAt).toLocaleDateString('de-DE')}
          </p>
          <h1 className="font-display font-semibold text-2xl">
            {session.courseName}: Seitenstapel
          </h1>
        </div>
      </header>
      <ImportSessionStack
        pageImageSource={(page) => `/api/pages/${page.id}/image`}
        pages={session.pages}
        reviewOrder={session.reviewOrder}
        reviewAction={reviewAction}
      />
    </main>
  );
};

export const Route = createFileRoute('/imports/$sessionId')({
  loader: ({ params }) => getImportSession({ data: params.sessionId }),
  component: ImportSessionScreen,
});
