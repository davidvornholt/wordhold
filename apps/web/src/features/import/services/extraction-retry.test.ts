import { describe, expect, it } from 'bun:test';
import { Extraction, type ExtractionResult } from '@wordhold/ai/extraction';
import { ExtractionError } from '@wordhold/ai/extraction/error';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { StorageError } from '../../../shared/storage/storage-error';
import { ExtractionFailedError } from '../errors/extraction-failed-error';
import { ImportDatabaseError } from '../errors/import-database-error';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { retryPendingExtraction } from './extraction-retry';
import { ImportRepository } from './repository';
import { makeImportRepository, makeStorage } from './test-services';

const extraction: ExtractionResult = {
  modelId: 'test-model',
  page: { entries: [], overallConfidence: 1 },
};

const runRetry = (
  repository: ReturnType<typeof makeImportRepository>,
  extract: () => Effect.Effect<ExtractionResult>,
) =>
  Effect.runPromise(
    retryPendingExtraction('page').pipe(
      Effect.provideService(ImportRepository, repository),
      Effect.provideService(Storage, makeStorage()),
      Effect.provideService(Extraction, Extraction.of({ extract })),
      Effect.provide(untrackedAiUsage),
    ),
  );

describe('retryPendingExtraction', () => {
  it('retains a database failure before reading storage or calling the provider', async () => {
    let storageReads = 0;
    let providerCalls = 0;
    const databaseError = new ImportDatabaseError({
      operation: 'load pending extraction',
      cause: new Error('database unavailable'),
      message: 'database unavailable',
    });
    const failure = await Effect.runPromise(
      Effect.flip(
        retryPendingExtraction('page').pipe(
          Effect.provideService(
            ImportRepository,
            makeImportRepository({
              loadPendingExtraction: () => Effect.fail(databaseError),
            }),
          ),
          Effect.provideService(
            Storage,
            makeStorage({
              read: () => {
                storageReads += 1;
                return Effect.succeed(new Uint8Array());
              },
            }),
          ),
          Effect.provideService(
            Extraction,
            Extraction.of({
              extract: () => {
                providerCalls += 1;
                return Effect.succeed(extraction);
              },
            }),
          ),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
    expect(failure).toBe(databaseError);
    expect(storageReads).toBe(0);
    expect(providerCalls).toBe(0);
  });

  it('retains a storage failure without calling the provider', async () => {
    let providerCalls = 0;
    const storageError = new StorageError({
      operation: 'read file',
      cause: new Error('disk unavailable'),
      message: 'disk unavailable',
    });
    const failure = await Effect.runPromise(
      Effect.flip(
        retryPendingExtraction('page').pipe(
          Effect.provideService(ImportRepository, makeImportRepository()),
          Effect.provideService(
            Storage,
            makeStorage({ read: () => Effect.fail(storageError) }),
          ),
          Effect.provideService(
            Extraction,
            Extraction.of({
              extract: () => {
                providerCalls += 1;
                return Effect.succeed(extraction);
              },
            }),
          ),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
    expect(failure).toBe(storageError);
    expect(providerCalls).toBe(0);
  });

  it('retains the provider failure after loading the pending image', async () => {
    const providerError = new ExtractionError({
      reason: 'provider',
      message: 'provider unavailable',
      cause: new Error('provider unavailable'),
    });
    const failure = await Effect.runPromise(
      Effect.flip(
        retryPendingExtraction('page').pipe(
          Effect.provideService(ImportRepository, makeImportRepository()),
          Effect.provideService(Storage, makeStorage()),
          Effect.provideService(
            Extraction,
            Extraction.of({ extract: () => Effect.fail(providerError) }),
          ),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
    expect(failure).toBeInstanceOf(ExtractionFailedError);
    expect(failure).toMatchObject({
      message:
        'Der Lesedienst konnte die Seite nicht auslesen. Versuche es in ein paar Minuten noch einmal.',
      cause: providerError,
    });
  });
});

describe('retryPendingExtraction photo', () => {
  it('sends the stored photo and asks for a new one when it cannot be read', async () => {
    const stored = new Uint8Array([1, 2, 3]);
    const sent: Array<Uint8Array> = [];
    const unreadable = new ExtractionError({
      reason: 'unreadableImage',
      message: 'The page photo could not be decoded.',
      cause: new Error('decode failed'),
    });
    const failure = await Effect.runPromise(
      Effect.flip(
        retryPendingExtraction('page').pipe(
          Effect.provideService(ImportRepository, makeImportRepository()),
          Effect.provideService(
            Storage,
            makeStorage({ read: () => Effect.succeed(stored) }),
          ),
          Effect.provideService(
            Extraction,
            Extraction.of({
              extract: ({ image }) => {
                sent.push(image);
                return Effect.fail(unreadable);
              },
            }),
          ),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
    expect(sent).toEqual([stored]);
    expect(failure).toMatchObject({
      message:
        'Das Foto lässt sich nicht lesen. Entferne es und importiere die Seite mit einem neuen Foto.',
      cause: unreadable,
    });
  });
});

describe('retryPendingExtraction guards', () => {
  it('spends no provider call on a verified page', async () => {
    let providerCalls = 0;
    const error = await Effect.runPromise(
      Effect.flip(
        retryPendingExtraction('page').pipe(
          Effect.provideService(
            ImportRepository,
            makeImportRepository({
              loadPendingExtraction: () => Effect.succeed(undefined),
            }),
          ),
          Effect.provideService(Storage, makeStorage()),
          Effect.provideService(
            Extraction,
            Extraction.of({
              extract: () => {
                providerCalls += 1;
                return Effect.succeed(extraction);
              },
            }),
          ),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
    expect(error).toBeInstanceOf(PageNotPendingError);
    expect(providerCalls).toBe(0);
  });

  it('discards a delayed result when verification wins the race', async () => {
    const pendingPages = new Set(['page']);
    let saved = false;
    let release: (result: ExtractionResult) => void = () => undefined;
    const provider = new Promise<ExtractionResult>((resolve) => {
      release = resolve;
    });
    let providerCalled: () => void = () => undefined;
    const providerStarted = new Promise<void>((resolve) => {
      providerCalled = resolve;
    });
    const retry = runRetry(
      makeImportRepository({
        loadPendingExtraction: () =>
          Effect.succeed(
            pendingPages.has('page')
              ? { imagePath: 'pages/page.png', language: 'fr' }
              : undefined,
          ),
        saveExtractionIfPending: (_pageId, result) => {
          if (!pendingPages.has('page')) {
            return Effect.succeed(undefined);
          }
          saved = true;
          return Effect.succeed({
            id: 'page',
            courseId: 'course',
            importSessionId: 'session',
            importPosition: 0,
            imagePath: 'pages/page.png',
            extraction: result,
            status: 'awaiting_verification',
            capturedAt: new Date(0),
            verifiedAt: null,
          });
        },
      }),
      () =>
        Effect.promise(() => {
          providerCalled();
          return provider;
        }),
    );

    // Verification finishes while the provider is still reading the page.
    await providerStarted;
    pendingPages.clear();
    release(extraction);
    await expect(retry).rejects.toThrow(
      'Die Seite wurde während des Auslesens bereits importiert.',
    );
    expect(saved).toBe(false);
  });
});
