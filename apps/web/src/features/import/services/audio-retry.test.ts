import { describe, expect, it } from 'bun:test';
import { Tts } from '@wordhold/ai/tts';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportDatabaseError } from '../errors/import-database-error';
import {
  maximumAudioProviderCallsPerImport,
  retryPageAudio,
} from './audio-generation';
import {
  AudioGenerationStore,
  type AudioTarget,
} from './audio-generation-store';
import { makeAudioGenerationStore, makeStorage } from './test-services';

const uuidSuffixWidth = 12;
const targets = (count: number): ReadonlyArray<AudioTarget> =>
  Array.from({ length: count }, (_, index) => ({
    id: `d9428888-122b-41e1-b85c-${String(index).padStart(uuidSuffixWidth, '0')}`,
    targetText: `Wort ${index}`,
    language: 'fr',
  }));

const runRetry = (
  store: ReturnType<typeof makeAudioGenerationStore>,
  providerCall: () => void,
) =>
  Effect.runPromise(
    retryPageAudio('page').pipe(
      Effect.provideService(
        Tts,
        Tts.make({
          synthesize: () =>
            Effect.sync(() => {
              providerCall();
              return { voice: 'Lea', audio: new Uint8Array([1]) };
            }),
        }),
      ),
      Effect.provideService(AudioGenerationStore, store),
      Effect.provideService(Storage, makeStorage()),
    ),
  );

const makeStatefulStore = (
  entries: ReadonlyArray<AudioTarget>,
  failFirstReference = false,
) => {
  const references = new Set<string>();
  const mutex = Effect.unsafeMakeSemaphore(1);
  let referenceAttempts = 0;
  const store = makeAudioGenerationStore({
    listMissingForPage: () =>
      Effect.sync(() => entries.filter((entry) => !references.has(entry.id))),
    hasReference: (entryId) => Effect.sync(() => references.has(entryId)),
    upsertReference: (entryId) =>
      Effect.suspend(() => {
        referenceAttempts += 1;
        if (failFirstReference && referenceAttempts === 1) {
          return Effect.fail(
            new ImportDatabaseError({
              operation: 'upsert audio reference',
              cause: new Error('database unavailable'),
              message: 'database unavailable',
            }),
          );
        }
        return Effect.sync(() => {
          references.add(entryId);
        });
      }),
    withCriticalSection: (_entryId, effect) => mutex.withPermits(1)(effect),
  });
  return { references, store };
};

describe('retryPageAudio', () => {
  it('recovers a failed database reference on a later retry', async () => {
    const { references, store } = makeStatefulStore(targets(1), true);
    let providerCalls = 0;
    const first = await runRetry(store, () => {
      providerCalls += 1;
    });
    expect(first.pending).toBe(1);
    expect(first.failures[0]?.cause._tag).toBe('ImportDatabaseError');

    const second = await runRetry(store, () => {
      providerCalls += 1;
    });
    expect(second.pending).toBe(0);
    expect(second.generated).toBe(1);
    expect(references.size).toBe(1);
    expect(providerCalls).toBe(2);
  });

  it('coordinates concurrent retries and is idempotent after success', async () => {
    const { store } = makeStatefulStore(targets(1));
    let providerCalls = 0;
    const [first, second] = await Promise.all([
      runRetry(store, () => {
        providerCalls += 1;
      }),
      runRetry(store, () => {
        providerCalls += 1;
      }),
    ]);
    expect(first.pending).toBe(0);
    expect(second.pending).toBe(0);
    expect(providerCalls).toBe(1);

    const repeated = await runRetry(store, () => {
      providerCalls += 1;
    });
    expect(repeated.pending).toBe(0);
    expect(repeated.generated).toBe(0);
    expect(providerCalls).toBe(1);
  });

  it('caps provider calls for one retry request', async () => {
    const { store } = makeStatefulStore(
      targets(maximumAudioProviderCallsPerImport + 1),
    );
    let providerCalls = 0;
    const report = await runRetry(store, () => {
      providerCalls += 1;
    });
    expect(providerCalls).toBe(maximumAudioProviderCallsPerImport);
    expect(report.pending).toBe(1);
  });
});
