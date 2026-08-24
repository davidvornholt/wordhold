import { describe, expect, it } from 'bun:test';
import { Tts } from '@wordhold/ai/tts';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportDatabaseError } from '../errors/import-database-error';
import {
  generateAudio,
  maximumAudioProviderCallsPerImport,
} from './audio-generation';
import { ImportRepository } from './repository';
import { makeImportRepository, makeStorage } from './test-services';

const uuidSuffixWidth = 12;
const entries = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `d9428888-122b-41e1-b85c-${String(index).padStart(uuidSuffixWidth, '0')}`,
    targetText: `Wort ${index}`,
  }));

describe('generateAudio', () => {
  it('never exceeds the provider-call budget for one import', async () => {
    let providerCalls = 0;
    const generated = await Effect.runPromise(
      generateAudio(entries(maximumAudioProviderCallsPerImport + 1), 'fr').pipe(
        Effect.provideService(
          Tts,
          Tts.make({
            synthesize: () => {
              providerCalls += 1;
              return Effect.succeed({
                voice: 'Lea',
                audio: new Uint8Array([1]),
              });
            },
          }),
        ),
        Effect.provideService(ImportRepository, makeImportRepository()),
        Effect.provideService(Storage, makeStorage()),
      ),
    );
    expect(providerCalls).toBe(maximumAudioProviderCallsPerImport);
    expect(generated).toBe(maximumAudioProviderCallsPerImport);
  });

  it('removes audio after a database-reference failure', async () => {
    const actions: Array<string> = [];
    await Effect.runPromise(
      generateAudio(entries(1), 'fr').pipe(
        Effect.provideService(
          Tts,
          Tts.make({
            synthesize: () =>
              Effect.succeed({ voice: 'Lea', audio: new Uint8Array([1]) }),
          }),
        ),
        Effect.provideService(
          ImportRepository,
          makeImportRepository({
            upsertAudioReference: () =>
              Effect.sync(() => actions.push('insert')).pipe(
                Effect.zipRight(
                  Effect.fail(
                    new ImportDatabaseError({
                      operation: 'insert',
                      cause: new Error('insert failed'),
                      message: 'insert failed',
                    }),
                  ),
                ),
              ),
          }),
        ),
        Effect.provideService(
          Storage,
          makeStorage({
            write: () => Effect.sync(() => actions.push('write')),
            remove: () => Effect.sync(() => actions.push('remove')),
          }),
        ),
      ),
    );
    expect(actions).toEqual(['write', 'insert', 'remove']);
  });
});
