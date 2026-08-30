import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  hasStoredUpload,
  nextUploadPosition,
  type ProcessableQueuedPage,
  processQueuedPage,
  processQueuedPages,
  type QueuedPage,
  uploadConcurrency,
} from './upload-queue';

const file = new File(['page'], 'page.jpg', { type: 'image/jpeg' });
const pageAfterFirstWave = uploadConcurrency;
const queuedPageIndexes = [0, 1, 2, pageAfterFirstWave];
const firstPosition = 0;
const holePosition = 2;
const lastPosition = 3;
const waitingPage: ProcessableQueuedPage = {
  id: 'page-1',
  file,
  position: 0,
  previewUrl: 'blob:page-1',
  stage: 'waiting',
};

describe('processQueuedPage', () => {
  it('stores before extracting and reports both live stages', async () => {
    const actions: Array<string> = [];
    const stages: Array<QueuedPage['stage']> = [];
    const result = await Effect.runPromise(
      processQueuedPage(waitingPage, {
        store: () =>
          Effect.sync(() => {
            actions.push('store');
            return 'stored-page';
          }),
        extract: () =>
          Effect.sync(() => {
            actions.push('extract');
          }),
        onStageChange: (page) => stages.push(page.stage),
      }),
    );

    expect(actions).toEqual(['store', 'extract']);
    expect(stages).toEqual(['uploading', 'extracting']);
    expect(result).toMatchObject({ stage: 'ready', pageId: 'stored-page' });
  });

  it('retries extraction without storing the photo again', async () => {
    const actions: Array<string> = [];
    const result = await Effect.runPromise(
      processQueuedPage(
        {
          ...waitingPage,
          stage: 'failed',
          pageId: 'stored-page',
          error: 'provider unavailable',
        },
        {
          store: () =>
            Effect.sync(() => {
              actions.push('store');
              return 'replacement-page';
            }),
          extract: () =>
            Effect.sync(() => {
              actions.push('extract');
            }),
          onStageChange: () => undefined,
        },
      ),
    );

    expect(actions).toEqual(['extract']);
    expect(result).toMatchObject({ stage: 'ready', pageId: 'stored-page' });
  });

  it('keeps a stored page recoverable when extraction fails', async () => {
    const result = await Effect.runPromise(
      processQueuedPage(waitingPage, {
        store: () => Effect.succeed('stored-page'),
        extract: () => Effect.fail(new Error('Auslesen fehlgeschlagen.')),
        onStageChange: () => undefined,
      }),
    );

    expect(result).toEqual({
      ...waitingPage,
      stage: 'failed',
      pageId: 'stored-page',
      error: 'Auslesen fehlgeschlagen.',
    });
  });

  it('processes at most three pages at once', async () => {
    let active = 0;
    let peak = 0;
    const firstWaveStarted = Promise.withResolvers<void>();
    const releaseFirstWave = Promise.withResolvers<void>();
    const running = Effect.runPromise(
      processQueuedPages(queuedPageIndexes, (page) =>
        Effect.tryPromise({
          try: async () => {
            active += 1;
            peak = Math.max(peak, active);
            if (peak === uploadConcurrency) {
              firstWaveStarted.resolve();
            }
            if (page < uploadConcurrency) {
              await releaseFirstWave.promise;
            }
            active -= 1;
          },
          catch: () => new Error('queue failed'),
        }),
      ),
    );

    await firstWaveStarted.promise;
    expect(peak).toBe(uploadConcurrency);
    releaseFirstWave.resolve();
    await running;
    expect(peak).toBe(uploadConcurrency);
  });
});

describe('nextUploadPosition', () => {
  it('fills the first available slot after a queued page is removed', () => {
    const usedPositions = new Set([firstPosition, holePosition, lastPosition]);
    expect(nextUploadPosition(usedPositions)).toBe(firstPosition + 1);
  });
});

describe('hasStoredUpload', () => {
  it('locks the batch once any page has been stored', () => {
    expect(hasStoredUpload([waitingPage])).toBe(false);
    expect(
      hasStoredUpload([
        {
          ...waitingPage,
          stage: 'failed',
          pageId: 'stored-page',
          error: 'Auslesen fehlgeschlagen.',
        },
      ]),
    ).toBe(true);
  });
});
