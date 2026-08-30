import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import {
  getCourse,
  retryExtraction,
} from '../../../features/import/server-fns';
import {
  maximumUploadBatchSize,
  type ProcessableQueuedPage,
  processQueuedPage,
  type QueuedPage,
} from '../../../features/import/services/upload-queue';
import { CaptureScreen as CaptureScreenView } from '../../../features/import/ui/capture-screen';

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

const useUploadQueue = (courseId: string) => {
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

const CaptureScreen = () => {
  const course = Route.useLoaderData();
  const router = useRouter();
  const queue = useUploadQueue(course.id);

  return (
    <CaptureScreenView
      backControl={
        <Link
          className="text-muted-foreground text-sm underline"
          onClick={() =>
            router.clearCache({
              filter: (match) => match.routeId === '/',
            })
          }
          to="/"
        >
          ← Übersicht
        </Link>
      }
      busy={queue.busy}
      courseName={course.name}
      error={queue.error}
      onFilesSelected={queue.addFiles}
      onRemove={queue.removePage}
      onRetry={queue.retryPage}
      onSubmit={queue.onSubmit}
      pages={queue.pages}
      renderVerifyAction={(page) => (
        <Link
          className="font-medium underline underline-offset-4"
          params={{ pageId: page.pageId }}
          to="/pages/$pageId/verify"
        >
          Seite prüfen
        </Link>
      )}
    />
  );
};

export const Route = createFileRoute('/courses/$courseId/import')({
  loader: ({ params }) => getCourse({ data: params.courseId }),
  component: CaptureScreen,
});
