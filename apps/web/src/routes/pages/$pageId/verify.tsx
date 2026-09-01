import { createFileRoute, redirect } from '@tanstack/react-router';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import type { MouseEvent } from 'react';
import {
  type BatchReviewSearchData,
  batchReviewSearchFor,
  parseBatchReviewSearch,
} from '../../../features/import/schemas/batch-review-search';
import {
  generateDraftExample,
  getImportSession,
  getPage,
} from '../../../features/import/server-fns';
import type {
  Course,
  Unit,
  UnitEntry,
} from '../../../features/import/services/repository';
import { BatchReviewComplete } from '../../../features/import/ui/batch-review-complete';
import type { DraftEntry } from '../../../features/import/ui/entry-row';
import { useVerificationFlow } from '../../../features/import/ui/use-verification-flow';
import { VerificationWorkbench } from '../../../features/import/ui/verification-workbench';
import { germanLabels } from '../../../shared/languages';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';

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
  readonly unitEntries: ReadonlyArray<UnitEntry>;
};

const VerificationPageScreen = ({
  course,
  page,
  search,
  units,
  unitEntries,
}: VerificationPageScreenProps) => {
  const flow = useVerificationFlow(page, search);
  const targetLabel = germanLabels[course.targetLanguage];
  const leaveThroughBackLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    flow.leavePage();
  };

  return (
    <main className="verification-screen">
      <div className="verification-header">
        <BackLink
          onClick={leaveThroughBackLink}
          params={{ sessionId: page.importSessionId }}
          to="/imports/$sessionId"
        >
          Seitenstapel
        </BackLink>
        <h1 className="font-display font-semibold text-2xl">
          {course.name}:{' '}
          {flow.batchSummary === null ? 'Seite überprüfen' : 'Seiten geprüft'}
        </h1>
        {flow.error === null || flow.completed !== null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {flow.error}
          </p>
        )}
      </div>
      {flow.batchSummary === null ? null : (
        <BatchReviewComplete
          overviewAction={
            <ActionLink
              params={{ sessionId: page.importSessionId }}
              to="/imports/$sessionId"
            >
              Zum Seitenstapel
            </ActionLink>
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
          error={flow.error}
          existingEntries={unitEntries}
          extractionKey={
            flow.extraction === null
              ? null
              : flow.extraction.modelId +
                String(flow.extraction.page.entries.length)
          }
          generateExample={(targetText, nativeText) =>
            generateDraftExample({
              data: { pageId: page.id, targetText, nativeText },
            })
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
  const { course, page, reviewSearch, units, unitEntries } =
    Route.useLoaderData();
  const routeSearch = Route.useSearch();
  const search = reviewSearch ?? routeSearch ?? {};
  return (
    <VerificationPageScreen
      course={course}
      key={page.id}
      page={page}
      search={search}
      unitEntries={unitEntries}
      units={units}
    />
  );
};

export const Route = createFileRoute('/pages/$pageId/verify')({
  validateSearch: parseBatchReviewSearch,
  loader: async ({ params }) => {
    const page = await getPage({ data: params.pageId });
    if (page.page.status !== 'awaiting_verification') {
      return { ...page, reviewSearch: null };
    }
    const session = await getImportSession({
      data: page.page.importSessionId,
    });
    const firstPendingPage = session.pages.find(
      (candidate) => candidate.status === 'awaiting_verification',
    );
    if (!session.isComplete || firstPendingPage?.id !== page.page.id) {
      throw redirect({
        to: '/imports/$sessionId',
        params: { sessionId: page.page.importSessionId },
      });
    }
    return {
      ...page,
      reviewSearch: batchReviewSearchFor(
        session.pages.map((candidate) => candidate.id),
        firstPendingPage.id,
      ),
    };
  },
  component: VerifyScreen,
});
