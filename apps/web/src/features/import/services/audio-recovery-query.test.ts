import { describe, expect, it } from 'bun:test';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import { Effect, Option, Result } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportDatabaseError } from '../errors/import-database-error';
import { retryPageAudio } from './audio-generation';
import { AudioGenerationStore } from './audio-generation-store';
import { audioRecoveryPages } from './audio-recovery-query';
import { importVerifiedPage } from './import-page';
import { ImportRepository } from './repository';
import {
  makeAudioGenerationStore,
  makeImportRepository,
  makeStorage,
} from './test-services';

const ownerId = 'owner';
const pageId = 'd9428888-122b-41e1-b85c-61cd3cbb3210';
const courseId = 'd9428888-122b-41e1-b85c-61cd3cbb3211';
const entryId = 'd9428888-122b-41e1-b85c-61cd3cbb3212';
const recoveryPage = {
  id: pageId,
  courseId,
  courseName: 'Französisch',
  missingAudio: 1,
  verifiedAt: new Date(1),
};

describe('audioRecoveryPages', () => {
  it('retains a typed database failure', async () => {
    const cause = new ImportDatabaseError({
      operation: 'list pages missing audio',
      cause: new Error('database unavailable'),
      message: 'database unavailable',
    });
    const result = await Effect.runPromise(
      audioRecoveryPages(ownerId).pipe(
        Effect.provideService(
          ImportRepository,
          makeImportRepository({
            listAudioRecoveryPages: () => Effect.fail(cause),
          }),
        ),
        Effect.result,
      ),
    );

    expect(Option.getOrUndefined(Result.getFailure(result))).toBe(cause);
  });

  it('lists an audio failure until a later retry creates the reference', async () => {
    let verified = false;
    let missingAudio = false;
    let synthesize: Tts['Service']['synthesize'] = () =>
      Effect.fail(new TtsError({ cause: new Error('provider unavailable') }));
    const repository = makeImportRepository({
      listAudioRecoveryPages: () =>
        Effect.sync(() => (verified && missingAudio ? [recoveryPage] : [])),
      verifyPage: () =>
        Effect.sync(() => {
          verified = true;
          missingAudio = true;
          return [{ id: entryId, targetText: 'mémoire' }];
        }),
    });
    const audioStore = makeAudioGenerationStore({
      listMissingForPage: () =>
        Effect.sync(() =>
          missingAudio
            ? [
                {
                  id: entryId,
                  targetText: 'mémoire',
                  language: 'fr' as const,
                },
              ]
            : [],
        ),
      hasReference: () => Effect.sync(() => !missingAudio),
      upsertReference: () =>
        Effect.sync(() => {
          missingAudio = false;
        }),
    });
    const provider = Tts.of({
      synthesize: (input) => synthesize(input),
    });
    const provide = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.provideService(ImportRepository, repository),
        Effect.provideService(AudioGenerationStore, audioStore),
        Effect.provideService(Storage, makeStorage()),
        Effect.provideService(Tts, provider),
        Effect.provide(untrackedAiUsage),
      );

    const imported = await Effect.runPromise(
      provide(
        importVerifiedPage({
          pageId,
          book: { kind: 'new', name: 'Green Line 3' },
          entries: [
            {
              unit: { kind: 'new', name: 'Unité 3' },
              targetText: 'mémoire',
              nativeText: 'Erinnerung',
            },
          ],
        }),
      ),
    );
    expect(imported.audio.pending).toBe(1);
    expect(
      await Effect.runPromise(provide(audioRecoveryPages(ownerId))),
    ).toEqual([recoveryPage]);

    synthesize = () => Effect.succeed({ audio: new Uint8Array([1]) });
    expect(
      (await Effect.runPromise(provide(retryPageAudio(pageId)))).pending,
    ).toBe(0);
    expect(
      await Effect.runPromise(provide(audioRecoveryPages(ownerId))),
    ).toEqual([]);
  });
});
