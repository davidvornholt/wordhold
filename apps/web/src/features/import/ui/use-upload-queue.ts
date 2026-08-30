import { Effect, Schema } from 'effect';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { retryExtraction } from '../server-fns';
import {
  maximumUploadBatchSize,
  type ProcessableQueuedPage,
  processQueuedPage,
  type QueuedPage,
} from '../services/upload-queue';

const UploadResponse = Schema.Struct({
  pageId: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});

const decodeUploadResponse = Schema.decodeUnknownSync(UploadResponse);

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

const storePagePhoto = (courseId: string, file: File) =>
  Effect.tryPromise({
    try: async () => {
      const formData = new FormData();
      formData.set('courseId', courseId);
      formData.set('image', file);
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
  const previewUrls = useRef(new Set<string>());
  const [pages, setPages] = useState<ReadonlyArray<QueuedPage>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      for (const previewUrl of previewUrls.current) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [],
  );

  const updatePage = (updated: QueuedPage): void => {
    setPages((current) =>
      current.map((page) => (page.id === updated.id ? updated : page)),
    );
  };

  const processPage = (page: ProcessableQueuedPage) =>
    processQueuedPage(page, {
      store: (file) => storePagePhoto(courseId, file),
      extract: extractStoredPage,
      onStageChange: updatePage,
    }).pipe(Effect.tap((updated) => Effect.sync(() => updatePage(updated))));

  const runPages = async (
    selected: ReadonlyArray<ProcessableQueuedPage>,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    await Effect.runPromise(
      Effect.forEach(selected, processPage, {
        concurrency: 1,
        discard: true,
      }),
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

  const addFiles = (files: ReadonlyArray<File>): void => {
    const remaining = maximumUploadBatchSize - pages.length;
    const accepted = files.slice(0, remaining);
    setError(
      files.length > remaining
        ? `${accepted.length} von ${files.length} Fotos wurden hinzugefügt. Pro Durchgang sind höchstens ${maximumUploadBatchSize} möglich.`
        : null,
    );
    const added = accepted.map((file): QueuedPage => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        stage: 'waiting',
      };
    });
    setPages((current) => [...current, ...added]);
  };

  const removePage = (pageId: string): void => {
    setPages((current) => {
      const removed = current.find((page) => page.id === pageId);
      if (removed !== undefined) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((page) => page.id !== pageId);
    });
  };

  return {
    busy,
    error,
    pages,
    addFiles,
    removePage,
    retryPage: (page: ProcessableQueuedPage) => runPages([page]),
    onSubmit,
  };
};
