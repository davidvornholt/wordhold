import { Effect, Result } from 'effect';

export const maximumUploadBatchSize = 10;

// The formats the page upload stores. A dropped file can be anything, such
// as an iPhone photo in HEIC, and is left out before upload.
export const acceptedImageTypes: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type QueuedPageBase = {
  readonly id: string;
  readonly file: File;
  readonly position: number;
  readonly previewUrl: string;
};

export type QueuedPage = QueuedPageBase &
  (
    | { readonly stage: 'waiting' }
    | { readonly stage: 'uploading' }
    | { readonly stage: 'extracting'; readonly pageId: string }
    | { readonly stage: 'ready'; readonly pageId: string }
    | {
        readonly stage: 'failed';
        readonly pageId: string | null;
        readonly error: string;
      }
  );

export type ProcessableQueuedPage = Extract<
  QueuedPage,
  { readonly stage: 'waiting' | 'failed' }
>;

export const hasStoredUpload = (pages: ReadonlyArray<QueuedPage>): boolean =>
  pages.some((page) => 'pageId' in page && page.pageId !== null);

// Photos are told apart by their bytes, not their names: a pasted screenshot
// is always called "image.png", and the same file picked twice must not
// become two pages.
const hexadecimal = 16;

export const fileDigest = async (file: Blob): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(hexadecimal).padStart(2, '0'),
  ).join('');
};

export type FileSelection = {
  readonly accepted: ReadonlyArray<{
    readonly file: File;
    readonly digest: string;
  }>;
  readonly unsupported: number;
  readonly duplicates: number;
  readonly overLimit: number;
};

// Applies the batch rules to a selection: drop files in other formats and
// bytes already in the queue or earlier in the same selection, then cut at
// the batch size. A file without a type is kept; the upload checks its bytes.
export const selectFiles = async (
  files: ReadonlyArray<File>,
  knownDigests: ReadonlySet<string>,
  remaining: number,
): Promise<FileSelection> => {
  const images = files.filter(
    (file) => file.type === '' || acceptedImageTypes.has(file.type),
  );
  const seen = new Set(knownDigests);
  const fresh: Array<{ readonly file: File; readonly digest: string }> = [];
  for (const file of images) {
    // Sequential on purpose: a duplicate within the selection is only known
    // once the earlier file has been hashed.
    // biome-ignore lint/performance/noAwaitInLoops: See above.
    const digest = await fileDigest(file);
    if (!seen.has(digest)) {
      seen.add(digest);
      fresh.push({ file, digest });
    }
  }
  return {
    accepted: fresh.slice(0, Math.max(remaining, 0)),
    unsupported: files.length - images.length,
    duplicates: images.length - fresh.length,
    overLimit: Math.max(fresh.length - remaining, 0),
  };
};

type UploadQueueOperations = {
  readonly store: (file: File) => Effect.Effect<string, unknown>;
  readonly extract: (pageId: string) => Effect.Effect<void, unknown>;
  readonly onStageChange: (page: QueuedPage) => void;
};

const fallbackMessage =
  'Die Seite konnte nicht verarbeitet werden. Versuche es noch einmal.';

// Server failures arrive as errors with the typed German message; anything
// without a usable message gets a sentence the learner can act on.
const errorMessage = (cause: unknown): string => {
  const message =
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string'
      ? cause.message
      : String(cause);
  return message.trim() === '' ? fallbackMessage : message;
};

const reportStage = (
  page: QueuedPage,
  onStageChange: UploadQueueOperations['onStageChange'],
) => Effect.sync(() => onStageChange(page));

const queueBase = (page: QueuedPage): QueuedPageBase => ({
  id: page.id,
  file: page.file,
  position: page.position,
  previewUrl: page.previewUrl,
});

export const uploadConcurrency = 3;

export const nextUploadPosition = (usedPositions: ReadonlySet<number>) => {
  let position = 0;
  while (usedPositions.has(position)) {
    position += 1;
  }
  return position;
};

// Later pages move up into the freed position, as they do on the server: a
// batch completes once it holds every position below its size.
export const withoutQueuedPage = (
  pages: ReadonlyArray<QueuedPage>,
  pageId: string,
): ReadonlyArray<QueuedPage> => {
  const removed = pages.find((page) => page.id === pageId);
  if (removed === undefined) {
    return pages;
  }
  return pages
    .filter((page) => page.id !== pageId)
    .map((page) =>
      page.position > removed.position
        ? { ...page, position: page.position - 1 }
        : page,
    );
};

export const processQueuedPages = <A, B, E, R>(
  pages: ReadonlyArray<A>,
  process: (page: A) => Effect.Effect<B, E, R>,
) =>
  Effect.forEach(pages, process, {
    concurrency: uploadConcurrency,
    discard: true,
  });

export const processQueuedPage = (
  page: ProcessableQueuedPage,
  operations: UploadQueueOperations,
): Effect.Effect<QueuedPage> =>
  Effect.gen(function* () {
    const base = queueBase(page);
    let pageId = page.stage === 'failed' ? page.pageId : null;
    if (pageId === null) {
      yield* reportStage(
        { ...base, stage: 'uploading' },
        operations.onStageChange,
      );
      const stored = yield* Effect.result(operations.store(page.file));
      if (Result.isFailure(stored)) {
        return {
          ...base,
          stage: 'failed' as const,
          pageId: null,
          error: errorMessage(stored.failure),
        };
      }
      pageId = stored.success;
    }

    yield* reportStage(
      { ...base, stage: 'extracting', pageId },
      operations.onStageChange,
    );
    const extracted = yield* Effect.result(operations.extract(pageId));
    if (Result.isFailure(extracted)) {
      return {
        ...base,
        stage: 'failed' as const,
        pageId,
        error: errorMessage(extracted.failure),
      };
    }
    return { ...base, stage: 'ready' as const, pageId };
  });

export const processedUploadCount = (
  pages: ReadonlyArray<QueuedPage>,
): number =>
  pages.filter((page) => page.stage === 'ready' || page.stage === 'failed')
    .length;
