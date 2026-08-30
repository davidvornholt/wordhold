import { describe, expect, it } from 'bun:test';
import {
  advanceBatchReview,
  batchReviewSearchFor,
  parseBatchReviewSearch,
  resolveBatchReviewSession,
} from './batch-review-search';

const firstPageId = '11111111-1111-4111-8111-111111111111';
const secondPageId = '22222222-2222-4222-8222-222222222222';
const thirdPageId = '33333333-3333-4333-8333-333333333333';

describe('batch review search', () => {
  it('starts with a selected page and preserves every other page', () => {
    expect(
      batchReviewSearchFor(
        [firstPageId, secondPageId, thirdPageId],
        secondPageId,
      ),
    ).toEqual({
      batch: [secondPageId, thirdPageId, firstPageId].join(','),
      step: 0,
      skipped: 0,
    });
  });

  it('rejects stale or hand-edited session positions', () => {
    expect(
      resolveBatchReviewSession(
        {
          batch: [firstPageId, secondPageId].join(','),
          step: 1,
          skipped: 0,
        },
        firstPageId,
      ),
    ).toBeNull();
    expect(parseBatchReviewSearch({ step: 'broken' })).toEqual({});
  });

  it('advances through imports and counts deferred pages at completion', () => {
    const session = resolveBatchReviewSession(
      {
        batch: [firstPageId, secondPageId].join(','),
        step: 0,
        skipped: 0,
      },
      firstPageId,
    );
    expect(session).not.toBeNull();
    if (session === null) {
      return;
    }
    const destination = advanceBatchReview(session, true);
    expect(destination).toEqual({
      pageId: secondPageId,
      search: {
        batch: [firstPageId, secondPageId].join(','),
        step: 1,
        skipped: 1,
      },
    });
    if (!('pageId' in destination)) {
      return;
    }
    const finalSession = resolveBatchReviewSession(
      destination.search,
      destination.pageId,
    );
    expect(finalSession).not.toBeNull();
    if (finalSession === null) {
      throw new Error('Expected the second review page to resolve.');
    }
    expect(advanceBatchReview(finalSession, false)).toEqual({
      imported: 1,
      skipped: 1,
      total: 2,
    });
  });
});
