import { createFileRoute, redirect } from '@tanstack/react-router';
import { batchReviewSearchFor } from '../../features/import/schemas/batch-review-search';
import { getImportSession } from '../../features/import/server-fns';

// "Stapel prüfen" and "Stapel fortsetzen" land on the next page to check,
// not on the stack overview. The overview stays one step back, behind the
// "Seitenstapel" link on the verification screen, and is where a stack that
// is still being processed or already finished sends the learner instead.
export const Route = createFileRoute('/imports/$sessionId_/review')({
  loader: async ({ params }) => {
    const session = await getImportSession({ data: params.sessionId });
    const firstPendingPage = session.pages.find(
      (page) => page.status === 'awaiting_verification',
    );
    if (!session.isComplete) {
      throw redirect({
        to: '/imports/$sessionId',
        params: { sessionId: params.sessionId },
      });
    }
    if (firstPendingPage === undefined) {
      throw redirect({ to: '/' });
    }
    throw redirect({
      to: '/pages/$pageId/verify',
      params: { pageId: firstPendingPage.id },
      search: batchReviewSearchFor(
        session.pages.map((page) => page.id),
        firstPendingPage.id,
      ),
    });
  },
});
