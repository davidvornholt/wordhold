import { describe, expect, it } from 'bun:test';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import {
  PageNotPendingError,
  retryPendingExtraction,
} from './extraction-retry';

const extraction: ExtractionResult = {
  modelId: 'test-model',
  page: { entries: [], overallConfidence: 1 },
};

const deferred = () => {
  let resolve: (value: ExtractionResult) => void = () => undefined;
  const promise = new Promise<ExtractionResult>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

describe('retryPendingExtraction', () => {
  it('spends no provider call on a verified page', async () => {
    let providerCalls = 0;
    await expect(
      retryPendingExtraction({
        loadPending: () => Promise.resolve(undefined),
        extract: () => {
          providerCalls += 1;
          return Promise.resolve(extraction);
        },
        saveIfPending: () => Promise.resolve(undefined),
      }),
    ).rejects.toThrow(PageNotPendingError);
    expect(providerCalls).toBe(0);
  });

  it('discards a delayed result when verification wins the race', async () => {
    const pendingPages = new Set(['page']);
    let saved = false;
    const provider = deferred();
    const retry = retryPendingExtraction({
      loadPending: () =>
        Promise.resolve(pendingPages.has('page') ? 'image' : undefined),
      extract: () => provider.promise,
      saveIfPending: () => {
        if (!pendingPages.has('page')) {
          return Promise.resolve(undefined);
        }
        saved = true;
        return Promise.resolve('updated');
      },
    });

    pendingPages.clear();
    provider.resolve(extraction);
    await expect(retry).rejects.toThrow(PageNotPendingError);
    expect(saved).toBe(false);
  });
});
