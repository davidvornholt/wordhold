import { useRouter } from '@tanstack/react-router';
import { deriveTermKeyPoints } from '../../../features/courses/services/term-server-fns';
import type { BatchReviewSearchData } from '../../../features/import/schemas/batch-review-search';
import type { NotesReading } from '../../../features/import/services/repository';
import { TermVerificationWorkbench } from '../../../features/import/ui/term-verification-workbench';
import { useTermVerificationFlow } from '../../../features/import/ui/use-term-verification-flow';
import { BackLink } from '../../../shared/ui/back-link';

// A few at a time, so a full page of notes does not queue a burst of model
// requests while the learner moves on.
const keyPointWorkers = 3;

type TermReviewScreenProps = {
  readonly course: { readonly id: string; readonly name: string };
  readonly page: {
    readonly extraction: NotesReading | null;
    readonly id: string;
    readonly importSessionId: string;
    readonly status: 'awaiting_verification' | 'verified';
  };
  readonly existingTerms: ReadonlyArray<string>;
  readonly search: BatchReviewSearchData;
};

// A subject's photographed notes become terms. Their key points are derived
// after the save, as for a typed term; practice derives any still missing.
export const TermReviewScreen = ({
  course,
  page,
  existingTerms,
  search,
}: TermReviewScreenProps) => {
  const router = useRouter();
  const flow = useTermVerificationFlow(
    page,
    search,
    ({ courseId, entryIds }) => {
      const waiting = [...entryIds];
      // Each worker takes the next waiting term once its last one settles.
      const worker = (): Promise<void> => {
        const entryId = waiting.shift();
        return entryId === undefined
          ? Promise.resolve()
          : deriveTermKeyPoints({ data: { courseId, entryId } })
              .catch(() => undefined)
              .then(worker);
      };
      Promise.all(Array.from({ length: keyPointWorkers }, worker))
        .then(() => router.invalidate())
        .catch(() => undefined);
    },
  );

  return (
    <main className="verification-screen">
      <div className="verification-header">
        <BackLink
          params={{ sessionId: page.importSessionId }}
          to="/imports/$sessionId"
        >
          Seitenstapel
        </BackLink>
        <h1 className="font-display font-semibold text-2xl">
          {course.name}: Notizen überprüfen
        </h1>
        {flow.error === null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {flow.error}
          </p>
        )}
      </div>
      <TermVerificationWorkbench
        batchIsLastPage={flow.batchIsLastPage}
        batchSession={flow.batchSession}
        busy={flow.busy}
        courseId={course.id}
        existingTerms={existingTerms}
        onRetryReading={flow.retryReading}
        onSubmit={flow.submitTerms}
        pageImageSource={`/api/pages/${page.id}/image?revision=${flow.readingRevision}`}
        reading={flow.reading}
        readingRevision={flow.readingRevision}
        retrying={flow.retrying}
        verified={page.status === 'verified'}
      />
    </main>
  );
};
