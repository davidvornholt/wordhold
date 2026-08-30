import { createFileRoute, Link } from '@tanstack/react-router';
import { batchReviewSearchFor } from '../../features/import/schemas/batch-review-search';
import { getImportSession } from '../../features/import/server-fns';
import { ImportSessionStack } from '../../features/import/ui/import-session-stack';

const ImportSessionScreen = () => {
  const session = Route.useLoaderData();
  const pendingPageIds = session.pages.flatMap((page) =>
    page.status === 'awaiting_verification' ? [page.id] : [],
  );
  const [firstPendingPageId] = pendingPageIds;

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
        renderPageAction={(page) => (
          <Link
            className="font-medium text-sm underline underline-offset-4"
            params={{ pageId: page.id }}
            search={batchReviewSearchFor(pendingPageIds, page.id)}
            to="/pages/$pageId/verify"
          >
            Seite prüfen
          </Link>
        )}
        reviewAction={
          firstPendingPageId === undefined ? (
            <Link className="text-sm underline underline-offset-4" to="/">
              Zur Übersicht
            </Link>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              params={{ pageId: firstPendingPageId }}
              search={batchReviewSearchFor(pendingPageIds, firstPendingPageId)}
              to="/pages/$pageId/verify"
            >
              {pendingPageIds.length === 1
                ? 'Seite prüfen'
                : `${pendingPageIds.length} Seiten nacheinander prüfen`}
            </Link>
          )
        }
      />
    </main>
  );
};

export const Route = createFileRoute('/imports/$sessionId')({
  loader: ({ params }) => getImportSession({ data: params.sessionId }),
  component: ImportSessionScreen,
});
