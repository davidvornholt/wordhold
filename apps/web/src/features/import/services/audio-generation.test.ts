import { describe, expect, it } from 'bun:test';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import { Effect } from 'effect';
import { FileReferenceError } from '../../../shared/storage/file-reference-error';
import { Storage } from '../../../shared/storage/server';
import { StorageError } from '../../../shared/storage/storage-error';
import { ImportDatabaseError } from '../errors/import-database-error';
import {
  generateAudio,
  maximumAudioProviderCallsPerImport,
} from './audio-generation';
import { AudioGenerationStore } from './audio-generation-store';
import { makeAudioGenerationStore, makeStorage } from './test-services';

const uuidSuffixWidth = 12;
const entries = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `d9428888-122b-41e1-b85c-${String(index).padStart(uuidSuffixWidth, '0')}`,
    targetText: `Wort ${index}`,
  }));

const runGeneration = (
  count: number,
  store = makeAudioGenerationStore(),
  storage = makeStorage(),
  synthesize: Tts['synthesize'] = () =>
    Effect.succeed({ audio: new Uint8Array([1]) }),
) =>
  Effect.runPromise(
    generateAudio(entries(count), 'fr').pipe(
      Effect.provideService(Tts, Tts.make({ synthesize })),
      Effect.provideService(AudioGenerationStore, store),
      Effect.provideService(Storage, storage),
    ),
  );

describe('generateAudio', () => {
  it('never exceeds the provider-call budget for one import', async () => {
    let providerCalls = 0;
    const report = await runGeneration(
      maximumAudioProviderCallsPerImport + 1,
      undefined,
      undefined,
      () => {
        providerCalls += 1;
        return Effect.succeed({
          audio: new Uint8Array([1]),
        });
      },
    );
    expect(providerCalls).toBe(maximumAudioProviderCallsPerImport);
    expect(report.generated).toBe(maximumAudioProviderCallsPerImport);
    expect(report.pending).toBe(1);
  });

  it('retains a TTS failure for its caller', async () => {
    const cause = new TtsError({ cause: new Error('provider unavailable') });
    const report = await runGeneration(1, undefined, undefined, () =>
      Effect.fail(cause),
    );
    expect(report.generated).toBe(0);
    expect(report.failures[0]?.cause).toBe(cause);
  });

  it('retains a storage failure for its caller', async () => {
    const cause = new StorageError({
      operation: 'write file',
      cause: new Error('disk unavailable'),
      message: 'disk unavailable',
    });
    const report = await runGeneration(
      1,
      undefined,
      makeStorage({ write: () => Effect.fail(cause) }),
    );
    expect(report.generated).toBe(0);
    expect(report.failures[0]?.cause).toBe(cause);
  });

  it('retains a database-reference failure and removes the written file', async () => {
    const actions: Array<string> = [];
    const cause = new ImportDatabaseError({
      operation: 'insert audio reference',
      cause: new Error('database unavailable'),
      message: 'database unavailable',
    });
    const report = await runGeneration(
      1,
      makeAudioGenerationStore({
        upsertReference: () =>
          Effect.sync(() => actions.push('insert')).pipe(
            Effect.zipRight(Effect.fail(cause)),
          ),
      }),
      makeStorage({
        write: () => Effect.sync(() => actions.push('write')),
        remove: () => Effect.sync(() => actions.push('remove')),
      }),
    );
    expect(actions).toEqual(['write', 'insert', 'remove']);
    expect(report.generated).toBe(0);
    expect(report.failures[0]?.cause).toBe(cause);
  });

  it('retains both failures when reference compensation also fails', async () => {
    const persistenceError = new ImportDatabaseError({
      operation: 'insert audio reference',
      cause: new Error('database unavailable'),
      message: 'database unavailable',
    });
    const cleanupError = new StorageError({
      operation: 'remove file',
      cause: new Error('disk unavailable'),
      message: 'disk unavailable',
    });
    const report = await runGeneration(
      1,
      makeAudioGenerationStore({
        upsertReference: () => Effect.fail(persistenceError),
      }),
      makeStorage({ remove: () => Effect.fail(cleanupError) }),
    );
    const cause = report.failures[0]?.cause;
    expect(cause).toBeInstanceOf(FileReferenceError);
    expect(cause).toMatchObject({ persistenceError, cleanupError });
  });
});

describe('pronunciation audio revisions', () => {
  it('regenerates stale abbreviation audio without replacing current plain audio', async () => {
    const insertedEntries = [
      {
        id: 'd9428888-122b-41e1-b85c-000000000100',
        targetText: 'donner qc à qn.',
      },
      {
        id: 'd9428888-122b-41e1-b85c-000000000101',
        targetText: 'mémoire',
      },
    ];
    const synthesized: Array<string> = [];
    const report = await Effect.runPromise(
      generateAudio(insertedEntries, 'fr').pipe(
        Effect.provideService(
          Tts,
          Tts.make({
            synthesize: (request) =>
              Effect.sync(() => {
                synthesized.push(request.text);
                return {
                  audio: new Uint8Array([1]),
                };
              }),
          }),
        ),
        Effect.provideService(
          AudioGenerationStore,
          makeAudioGenerationStore({
            hasReference: (_entryId, audioProfile) =>
              Effect.succeed(audioProfile === ttsAudioProfile('mémoire', 'fr')),
          }),
        ),
        Effect.provideService(Storage, makeStorage()),
      ),
    );

    expect(synthesized).toEqual(['donner qc à qn.']);
    expect(report.generated).toBe(1);
    expect(report.alreadyAvailable).toBe(1);
  });
});
