import { Effect, Result } from 'effect';
import type { RefObject } from 'react';
import { removeImportPage } from '../server-fns';
import type { QueuedPage } from '../services/upload-queue';
import type { QueueLock } from './use-queue-lock';

const removeStoredPage = (
  courseId: string,
  importSessionId: string,
  page: Pick<QueuedPage, 'id' | 'position'>,
) =>
  Effect.tryPromise({
    try: () =>
      removeImportPage({
        data: {
          courseId,
          importSessionId,
          pageId: page.id,
          position: page.position,
        },
      }),
    catch: (cause) => {
      const message = cause instanceof Error ? cause.message.trim() : '';
      return new Error(
        message === ''
          ? 'Die Seite konnte nicht entfernt werden. Versuche es noch einmal.'
          : message,
      );
    },
  });

type UsePageRemovalOptions = {
  readonly courseId: string;
  readonly importSessionId: string;
  readonly hydrated: boolean;
  readonly lock: QueueLock;
  readonly pagesRef: RefObject<ReadonlyArray<QueuedPage>>;
  readonly batchStarted: () => boolean;
  readonly removePage: (pageId: string) => void;
  readonly setError: (error: string | null) => void;
  readonly startOver: () => void;
};

// Takes a page out of the queue unless it is being uploaded or read. Once the
// batch has reached the server, its stored pages move up with the queue, so
// the server removes the page first. An emptied batch starts over.
export const usePageRemoval =
  ({
    courseId,
    importSessionId,
    hydrated,
    lock,
    pagesRef,
    batchStarted,
    removePage,
    setError,
    startOver,
  }: UsePageRemovalOptions) =>
  async (pageId: string): Promise<void> => {
    const page = pagesRef.current.find((candidate) => candidate.id === pageId);
    if (
      !hydrated ||
      page === undefined ||
      lock.held() ||
      page.stage === 'uploading' ||
      page.stage === 'extracting'
    ) {
      return;
    }
    if (!batchStarted()) {
      removePage(pageId);
      return;
    }
    await lock.run(async () => {
      setError(null);
      const removal = await Effect.runPromise(
        Effect.result(removeStoredPage(courseId, importSessionId, page)),
      );
      if (Result.isFailure(removal)) {
        setError(removal.failure.message);
        return;
      }
      removePage(page.id);
      if (pagesRef.current.length === 0) {
        startOver();
      }
    });
  };
