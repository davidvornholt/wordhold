import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import {
  advanceBatchReview,
  type BatchReviewSearchData,
  type BatchReviewSummary,
  resolveBatchReviewSession,
} from '../schemas/batch-review-search';
import {
  refreshOverviewAfterMutation,
  retireOverviewCache,
  returnToFreshOverview,
} from './overview-navigation';

export const useVerificationNavigation = (
  pageId: string,
  search: BatchReviewSearchData,
) => {
  const navigate = useNavigate();
  const router = useRouter();
  const [batchSummary, setBatchSummary] = useState<BatchReviewSummary | null>(
    null,
  );
  const batchSession = resolveBatchReviewSession(search, pageId);
  const clearOverviewCache = () =>
    router.clearCache({
      filter: (match) => match.routeId === '/',
    });
  const retireCachedOverview = () =>
    retireOverviewCache({ clearOverviewCache });
  const refreshOverview = () =>
    refreshOverviewAfterMutation((options) => router.invalidate(options));
  const goToOverview = () =>
    returnToFreshOverview({
      clearOverviewCache,
      navigate: () => navigate({ to: '/' }),
    });
  const advanceReview = async (): Promise<void> => {
    if (batchSession === null) {
      await goToOverview();
      return;
    }
    const next = advanceBatchReview(batchSession);
    if ('pageId' in next) {
      await navigate({
        params: { pageId: next.pageId },
        search: next.search,
        to: '/pages/$pageId/verify',
      });
      return;
    }
    setBatchSummary(next);
  };

  return {
    advanceReview,
    batchIsLastPage:
      batchSession !== null &&
      batchSession.position === batchSession.pageIds.length - 1,
    batchSession,
    batchSummary,
    goToOverview,
    refreshOverview,
    retireCachedOverview,
  };
};
