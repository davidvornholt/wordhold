import { Effect, Schema } from 'effect';
import { type SubmitEvent, useRef, useState } from 'react';
import { retryExtraction } from '../server-fns';
import {
  hasStoredUpload,
  type ProcessableQueuedPage,
  processQueuedPage,
  processQueuedPages,
  type QueuedPage,
} from '../services/upload-queue';
import { usePageRemoval } from './use-page-removal';
import { useQueueLock } from './use-queue-lock';
import { useQueueSelection } from './use-queue-selection';
import { useUploadQueuePersistence } from './use-upload-queue-persistence';

const UploadResponse = Schema.Struct({
  pageId: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});

const decodeUploadResponse = Schema.decodeUnknownSync(UploadResponse);

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

const storePagePhoto = (
  courseId: string,
  importSessionId: string,
  expectedPageCount: number,
  page: Pick<ProcessableQueuedPage, 'file' | 'id' | 'position'>,
) =>
  Effect.tryPromise({
    try: async () => {
      const formData = new FormData();
      formData.set('courseId', courseId);
      formData.set('importSessionId', importSessionId);
      formData.set('pageId', page.id);
      formData.set('importPosition', String(page.position));
      formData.set('importExpectedCount', String(expectedPageCount));
      formData.set('image', page.file);
      const response = await fetch('/api/pages', {
        method: 'POST',
        body: formData,
      });
      const body = decodeUploadResponse(await response.json());
      if (!response.ok || body.pageId === undefined) {
        throw new Error(body.error ?? 'Hochladen fehlgeschlagen.');
      }
      return body.pageId;
    },
    catch: asError,
  });

const extractStoredPage = (pageId: string) =>
  Effect.tryPromise({
    try: async () => {
      await retryExtraction({ data: pageId });
    },
    catch: asError,
  });

const processPage =
  (
    courseId: string,
    importSessionId: string,
    expectedPageCount: number,
    updatePage: (updated: QueuedPage) => void,
  ) =>
  (page: ProcessableQueuedPage) =>
    processQueuedPage(page, {
      store: () =>
        storePagePhoto(courseId, importSessionId, expectedPageCount, page),
      extract: extractStoredPage,
      onStageChange: updatePage,
    }).pipe(Effect.tap((updated) => Effect.sync(() => updatePage(updated))));

export const useUploadQueue = (courseId: string) => {
  const [importSessionId, setImportSessionId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const {
    pages,
    pagesRef,
    setPages,
    previewUrlsRef,
    updatePage,
    removePage,
    selectionsRef,
    selecting,
    error,
    setError,
  } = useQueueSelection();
  const startedRef = useRef(false);
  const lock = useQueueLock(selectionsRef);
  const [processingStarted, setProcessingStarted] = useState(false);

  const { clearPersistedQueue, hydrated } = useUploadQueuePersistence({
    courseId,
    importSessionId,
    pages,
    previewUrls: previewUrlsRef,
    processingStarted,
    setImportSessionId,
    setPages,
    setProcessingStarted,
  });

  const runPages = async (
    selected: ReadonlyArray<ProcessableQueuedPage>,
  ): Promise<void> => {
    if (
      !hydrated ||
      selectionsRef.current === null ||
      selectionsRef.current.pending ||
      lock.held() ||
      selected.length === 0
    ) {
      return;
    }
    startedRef.current = true;
    setProcessingStarted(true);
    setError(null);
    const expectedPageCount = pagesRef.current.length;
    await lock.run(() =>
      Effect.runPromise(
        processQueuedPages(
          selected,
          processPage(courseId, importSessionId, expectedPageCount, updatePage),
        ),
      ),
    );
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    return runPages(
      pagesRef.current.filter(
        (page): page is Extract<QueuedPage, { readonly stage: 'waiting' }> =>
          page.stage === 'waiting',
      ),
    );
  };

  const batchStarted = () =>
    startedRef.current ||
    processingStarted ||
    hasStoredUpload(pagesRef.current);

  const addFiles = async (files: ReadonlyArray<File>): Promise<void> => {
    if (!hydrated || batchStarted()) {
      setError(
        'Die Fotoauswahl ist nach dem ersten Verarbeitungsversuch gesperrt. Versuche fehlgeschlagene Seiten erneut oder entferne sie.',
      );
      return;
    }
    await selectionsRef.current?.addFiles(files);
  };

  const removeQueuedPage = usePageRemoval({
    courseId,
    importSessionId,
    hydrated,
    lock,
    pagesRef,
    batchStarted,
    removePage,
    setError,
    startOver: () => {
      startedRef.current = false;
      setProcessingStarted(false);
      setImportSessionId(crypto.randomUUID());
    },
  });

  return {
    busy: lock.busy || selecting || !hydrated,
    clearPersistedQueue,
    error,
    importSessionId,
    pages,
    processingStarted,
    addFiles,
    removePage: removeQueuedPage,
    retryPage: (page: ProcessableQueuedPage) => runPages([page]),
    onSubmit,
  };
};
