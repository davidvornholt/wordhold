import { Effect, Either } from 'effect';

export const maximumUploadBatchSize = 10;

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
  readonly duplicates: number;
  readonly overLimit: number;
};

// Applies the batch rules to a selection: drop bytes already in the queue or
// earlier in the same selection, then cut at the batch size.
export const selectFiles = async (
  files: ReadonlyArray<File>,
  knownDigests: ReadonlySet<string>,
  remaining: number,
): Promise<FileSelection> => {
  const seen = new Set(knownDigests);
  const fresh: Array<{ readonly file: File; readonly digest: string }> = [];
  for (const file of files) {
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
    duplicates: files.length - fresh.length,
    overLimit: Math.max(fresh.length - remaining, 0),
  };
};

type UploadQueueOperations = {
  readonly store: (file: File) => Effect.Effect<string, unknown>;
  readonly extract: (pageId: string) => Effect.Effect<void, unknown>;
  readonly onStageChange: (page: QueuedPage) => void;
};

const errorMessage = (cause: unknown): string =>
  typeof cause === 'object' &&
  cause !== null &&
  'message' in cause &&
  typeof cause.message === 'string'
    ? cause.message
    : String(cause);

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
      const stored = yield* Effect.either(operations.store(page.file));
      if (Either.isLeft(stored)) {
        return {
          ...base,
          stage: 'failed' as const,
          pageId: null,
          error: errorMessage(stored.left),
        };
      }
      pageId = stored.right;
    }

    yield* reportStage(
      { ...base, stage: 'extracting', pageId },
      operations.onStageChange,
    );
    const extracted = yield* Effect.either(operations.extract(pageId));
    if (Either.isLeft(extracted)) {
      return {
        ...base,
        stage: 'failed' as const,
        pageId,
        error: errorMessage(extracted.left),
      };
    }
    return { ...base, stage: 'ready' as const, pageId };
  });

export const processedUploadCount = (
  pages: ReadonlyArray<QueuedPage>,
): number =>
  pages.filter((page) => page.stage === 'ready' || page.stage === 'failed')
    .length;
