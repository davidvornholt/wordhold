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
    removePage,
    selectionsRef,
    selecting,
    error,
    setError,
  } = useQueueSelection();
  const processingRef = useRef({ busy: false, started: false });
  const [busy, setBusy] = useState(false);
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

  const updatePage = (updated: QueuedPage): void => {
    setPages((current) =>
      current.map((page) => (page.id === updated.id ? updated : page)),
    );
  };

  const runPages = async (
    selected: ReadonlyArray<ProcessableQueuedPage>,
  ): Promise<void> => {
    if (
      !hydrated ||
      selectionsRef.current === null ||
      selectionsRef.current.pending ||
      processingRef.current.busy ||
      selected.length === 0
    ) {
      return;
    }
    processingRef.current = { busy: true, started: true };
    setProcessingStarted(true);
    setBusy(true);
    setError(null);
    const expectedPageCount = pagesRef.current.length;
    try {
      await Effect.runPromise(
        processQueuedPages(
          selected,
          processPage(courseId, importSessionId, expectedPageCount, updatePage),
        ),
      );
    } finally {
      processingRef.current.busy = false;
      if (selectionsRef.current !== null) {
        setBusy(false);
      }
    }
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

  const addFiles = async (files: ReadonlyArray<File>): Promise<void> => {
    if (
      !hydrated ||
      processingRef.current.started ||
      processingStarted ||
      hasStoredUpload(pagesRef.current)
    ) {
      setError(
        'Die Fotoauswahl ist nach dem ersten Verarbeitungsversuch gesperrt. Versuche fehlgeschlagene Seiten erneut.',
      );
      return;
    }
    await selectionsRef.current?.addFiles(files);
  };

  return {
    busy: busy || selecting || !hydrated,
    clearPersistedQueue,
    error,
    importSessionId,
    pages,
    processingStarted,
    addFiles,
    removePage: (pageId: string) => {
      if (
        !(
          processingRef.current.started ||
          processingStarted ||
          hasStoredUpload(pagesRef.current)
        )
      ) {
        removePage(pageId);
      }
    },
    retryPage: (page: ProcessableQueuedPage) => runPages([page]),
    onSubmit,
  };
};
