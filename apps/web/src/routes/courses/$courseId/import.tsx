import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { batchReviewSearchFor } from '../../../features/import/schemas/batch-review-search';
import { getCourse } from '../../../features/import/server-fns';
import { CaptureScreen as CaptureScreenView } from '../../../features/import/ui/capture-screen';
import { useUploadQueue } from '../../../features/import/ui/use-upload-queue';

const CaptureScreen = () => {
  const course = Route.useLoaderData();
  const router = useRouter();
  const queue = useUploadQueue(course.id);
  const storedPageIds = queue.pages.flatMap((page) =>
    'pageId' in page && page.pageId !== null ? [page.pageId] : [],
  );
  const reviewAvailable =
    !queue.busy &&
    queue.pages.every((page) => page.stage !== 'waiting') &&
    storedPageIds.length > 0;

  return (
    <CaptureScreenView
      backControl={
        <Link
          className="text-muted-foreground text-sm underline"
          onClick={() =>
            router.clearCache({
              filter: (match) => match.routeId === '/',
            })
          }
          to="/"
        >
          ← Übersicht
        </Link>
      }
      busy={queue.busy}
      courseName={course.name}
      error={queue.error}
      onFilesSelected={queue.addFiles}
      onRemove={queue.removePage}
      onRetry={queue.retryPage}
      onSubmit={queue.onSubmit}
      pages={queue.pages}
      reviewAction={
        reviewAvailable ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            params={{ pageId: storedPageIds[0] }}
            search={batchReviewSearchFor(storedPageIds, storedPageIds[0])}
            to="/pages/$pageId/verify"
          >
            {storedPageIds.length}{' '}
            {storedPageIds.length === 1 ? 'Seite' : 'Seiten'} prüfen
          </Link>
        ) : null
      }
      renderVerifyAction={(page) => (
        <Link
          className="font-medium underline underline-offset-4"
          params={{ pageId: page.pageId }}
          search={batchReviewSearchFor(storedPageIds, page.pageId)}
          to="/pages/$pageId/verify"
        >
          Seite prüfen
        </Link>
      )}
    />
  );
};

export const Route = createFileRoute('/courses/$courseId/import')({
  loader: ({ params }) => getCourse({ data: params.courseId }),
  component: CaptureScreen,
});
