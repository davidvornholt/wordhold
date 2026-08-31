import { createFileRoute, useRouter } from '@tanstack/react-router';
import { getCourse } from '../../../features/import/server-fns';
import { hasStoredUpload } from '../../../features/import/services/upload-queue';
import { CaptureScreen as CaptureScreenView } from '../../../features/import/ui/capture-screen';
import { useUploadQueue } from '../../../features/import/ui/use-upload-queue';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';

const CaptureScreen = () => {
  const course = Route.useLoaderData();
  const router = useRouter();
  const queue = useUploadQueue(course.id);
  const storedPageIds = queue.pages.flatMap((page) =>
    'pageId' in page && page.pageId !== null ? [page.pageId] : [],
  );
  const reviewAvailable =
    !queue.busy &&
    queue.pages.length > 0 &&
    queue.pages.every((page) => page.stage === 'ready') &&
    storedPageIds.length === queue.pages.length;
  const hasUnstoredPage = queue.pages.some(
    (page) => !('pageId' in page) || page.pageId === null,
  );
  let captureStatus: string | null = null;
  if (queue.busy) {
    captureStatus = 'Bitte warte, bis alle Fotos verarbeitet sind.';
  } else if (hasUnstoredPage && hasStoredUpload(queue.pages)) {
    captureStatus =
      'Bitte wiederhole fehlgeschlagene Seiten, bevor du den Stapel verlässt.';
  } else if (hasUnstoredPage) {
    captureStatus =
      'Verarbeite oder entferne die offenen Seiten, bevor du den Stapel verlässt.';
  }

  return (
    <CaptureScreenView
      backControl={
        captureStatus === null ? (
          <BackLink
            onClick={() => {
              queue.clearPersistedQueue();
              router.clearCache({
                filter: (match) => match.routeId === '/',
              });
            }}
            to="/"
          >
            Übersicht
          </BackLink>
        ) : (
          <p className="text-muted-foreground text-sm" role="status">
            {captureStatus}
          </p>
        )
      }
      busy={queue.busy}
      batchStarted={queue.processingStarted}
      courseName={course.name}
      error={queue.error}
      onFilesSelected={queue.addFiles}
      onRemove={queue.removePage}
      onRetry={queue.retryPage}
      onSubmit={queue.onSubmit}
      pages={queue.pages}
      reviewAction={
        reviewAvailable ? (
          <ActionLink
            onClick={queue.clearPersistedQueue}
            params={{ sessionId: queue.importSessionId }}
            to="/imports/$sessionId"
          >
            Stapel prüfen
          </ActionLink>
        ) : null
      }
    />
  );
};

export const Route = createFileRoute('/courses/$courseId/import')({
  loader: ({ params }) => getCourse({ data: params.courseId }),
  component: CaptureScreen,
});
