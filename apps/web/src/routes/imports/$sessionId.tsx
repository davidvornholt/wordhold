import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { batchReviewSearchFor } from '../../features/import/schemas/batch-review-search';
import { getImportSession } from '../../features/import/server-fns';
import { ImportSessionStack } from '../../features/import/ui/import-session-stack';
import { ActionLink } from '../../shared/ui/action-link';
import { BackLink } from '../../shared/ui/back-link';
import { PageLayout } from '../../shared/ui/page-layout';

const ImportSessionScreen = () => {
  const session = Route.useLoaderData();
  const pageIds = session.pages.map((page) => page.id);
  const firstPendingPage = session.pages.find(
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
      <ActionLink to="/" variant="quiet">
        Zur Übersicht
      </ActionLink>
    );
  } else {
    reviewAction = (
      <ActionLink
        params={{ pageId: firstPendingPage.id }}
        search={batchReviewSearchFor(pageIds, firstPendingPage.id)}
        to="/pages/$pageId/verify"
      >
        {firstPendingPage.position === 0
          ? 'Mit Seite 1 beginnen'
          : `Mit Seite ${firstPendingPage.position + 1} fortfahren`}
      </ActionLink>
    );
  }

  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title={`${session.courseName}: Seitenstapel`}
    >
      <p className="-mt-4 text-muted-foreground text-sm">
        Import vom {new Date(session.capturedAt).toLocaleDateString('de-DE')}
      </p>
      <ImportSessionStack
        pageImageSource={(page) => `/api/pages/${page.id}/image`}
        pages={session.pages}
        reviewAction={reviewAction}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/imports/$sessionId')({
  loader: ({ params }) => getImportSession({ data: params.sessionId }),
  component: ImportSessionScreen,
});
