import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  advanceBatchReview,
  type BatchReviewSearchData,
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
  // After the last page the stack has nothing left to offer, so a finished
  // batch returns to the overview exactly like a single page does; the course
  // card there shows the new vocabulary as the next step.
  const advanceReview = async (): Promise<void> => {
    const next =
      batchSession === null ? null : advanceBatchReview(batchSession);
    if (next === null) {
      await goToOverview();
      return;
    }
    await navigate({
      params: { pageId: next.pageId },
      search: next.search,
      to: '/pages/$pageId/verify',
    });
  };

  return {
    advanceReview,
    batchIsLastPage:
      batchSession !== null &&
      batchSession.position === batchSession.pageIds.length - 1,
    batchSession,
    goToOverview,
    refreshOverview,
    retireCachedOverview,
  };
};
