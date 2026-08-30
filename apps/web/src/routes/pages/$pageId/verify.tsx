import { createFileRoute, Link } from '@tanstack/react-router';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import {
  type BatchReviewSearchData,
  parseBatchReviewSearch,
} from '../../../features/import/schemas/batch-review-search';
import { getPage } from '../../../features/import/server-fns';
import type {
  Course,
  Unit,
} from '../../../features/import/services/repository';
import { BatchReviewComplete } from '../../../features/import/ui/batch-review-complete';
import type { DraftEntry } from '../../../features/import/ui/entry-row';
import { useVerificationFlow } from '../../../features/import/ui/use-verification-flow';
import { VerificationWorkbench } from '../../../features/import/ui/verification-workbench';
import { germanLabels } from '../../../shared/languages';

const draftsFromExtraction = (
  extraction: ExtractionResult | null,
): ReadonlyArray<DraftEntry> =>
  extraction === null
    ? []
    : extraction.page.entries.map((entry) => ({
        targetText: entry.targetText,
        nativeText: entry.nativeText,
        example: entry.example ?? '',
        ...(entry.grammar === undefined ? {} : { grammar: entry.grammar }),
        confidence: entry.confidence,
      }));

type VerificationPageScreenProps = {
  readonly course: Pick<Course, 'name' | 'targetLanguage'>;
  readonly page: {
    readonly extraction: ExtractionResult | null;
    readonly id: string;
    readonly importSessionId: string;
    readonly status: 'awaiting_verification' | 'verified';
  };
  readonly search: BatchReviewSearchData;
  readonly units: ReadonlyArray<Unit>;
};

const VerificationPageScreen = ({
  course,
  page,
  search,
  units,
}: VerificationPageScreenProps) => {
  const flow = useVerificationFlow(page, search);
  const targetLabel = germanLabels[course.targetLanguage];

  return (
    <main className="verification-screen">
      <div className="verification-header">
        <Link
          className="text-muted-foreground text-sm underline"
          params={{ sessionId: page.importSessionId }}
          to="/imports/$sessionId"
        >
          ← Zum Seitenstapel
        </Link>
        <h1 className="font-display font-semibold text-2xl">
          {course.name}:{' '}
          {flow.batchSummary === null ? 'Seite überprüfen' : 'Seiten geprüft'}
        </h1>
        {flow.error === null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {flow.error}
          </p>
        )}
      </div>
      {flow.batchSummary === null ? null : (
        <BatchReviewComplete
          overviewAction={
            <Link
              className="inline-flex min-h-11 items-center bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              params={{ sessionId: page.importSessionId }}
              to="/imports/$sessionId"
            >
              Zum Seitenstapel
            </Link>
          }
          total={flow.batchSummary.total}
        />
      )}
      {flow.batchSummary === null ? (
        <VerificationWorkbench
          batchIsLastPage={flow.batchIsLastPage}
          batchSession={flow.batchSession}
          busy={flow.busy}
          completed={flow.completed}
          extractionKey={
            flow.extraction === null
              ? null
              : flow.extraction.modelId +
                String(flow.extraction.page.entries.length)
          }
          initialEntries={draftsFromExtraction(flow.extraction)}
          initialUnitName={flow.extraction?.page.unitName}
          onExtractionRetry={flow.retryPageExtraction}
          onRetryAudio={flow.retryPageAudio}
          onSubmit={flow.submitPage}
          pageImageSource={`/api/pages/${page.id}/image`}
          targetLabel={targetLabel}
          units={units}
        />
      ) : null}
    </main>
  );
};

const VerifyScreen = () => {
  const { course, page, units } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <VerificationPageScreen
      course={course}
      key={page.id}
      page={page}
      search={search}
      units={units}
    />
  );
};

export const Route = createFileRoute('/pages/$pageId/verify')({
  validateSearch: parseBatchReviewSearch,
  loader: ({ params }) => getPage({ data: params.pageId }),
  component: VerifyScreen,
});
