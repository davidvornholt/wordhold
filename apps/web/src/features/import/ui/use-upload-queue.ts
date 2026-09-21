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
import { queueSelectedFiles } from './queue-selection';
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

export const useUploadQueue = (courseId: string) => {
  const [importSessionId, setImportSessionId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const previewUrlsRef = useRef(new Set<string>());
  // Content digests of queued pages, by page id; restored pages are hashed
  // the first time a selection has to be compared against them.
  const digestsRef = useRef(new Map<string, string>());
  const [pages, setPages] = useState<ReadonlyArray<QueuedPage>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const processPage = (
    page: ProcessableQueuedPage,
    expectedPageCount: number,
  ) =>
    processQueuedPage(page, {
      store: () =>
        storePagePhoto(courseId, importSessionId, expectedPageCount, page),
      extract: extractStoredPage,
      onStageChange: updatePage,
    }).pipe(Effect.tap((updated) => Effect.sync(() => updatePage(updated))));

  const runPages = async (
    selected: ReadonlyArray<ProcessableQueuedPage>,
  ): Promise<void> => {
    setProcessingStarted(true);
    setBusy(true);
    setError(null);
    await Effect.runPromise(
      processQueuedPages(selected, (page) => processPage(page, pages.length)),
    );
    setBusy(false);
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    return runPages(
      pages.filter(
        (page): page is Extract<QueuedPage, { readonly stage: 'waiting' }> =>
          page.stage === 'waiting',
      ),
    );
  };

  const addFiles = async (files: ReadonlyArray<File>): Promise<void> => {
    if (!hydrated || processingStarted || hasStoredUpload(pages)) {
      setError(
        'Die Fotoauswahl ist nach dem ersten Verarbeitungsversuch gesperrt. Versuche fehlgeschlagene Seiten erneut.',
      );
      return;
    }
    const { added, notice } = await queueSelectedFiles({
      files,
      pages,
      digests: digestsRef.current,
      previewUrls: previewUrlsRef.current,
    });
    setError(notice);
    setPages((current) => [...current, ...added]);
  };

  const removePage = (pageId: string): void => {
    setPages((current) => {
      const removed = current.find((page) => page.id === pageId);
      if (removed !== undefined) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((page) => page.id !== pageId);
    });
  };

  return {
    busy: busy || !hydrated,
    clearPersistedQueue,
    error,
    importSessionId,
    pages,
    processingStarted,
    addFiles,
    removePage,
    retryPage: (page: ProcessableQueuedPage) => runPages([page]),
    onSubmit,
  };
};
