import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  type ProcessableQueuedPage,
  processQueuedPage,
  type QueuedPage,
} from './upload-queue';

const file = new File(['page'], 'page.jpg', { type: 'image/jpeg' });
const waitingPage: ProcessableQueuedPage = {
  id: 'page-1',
  file,
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
});
