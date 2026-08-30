import { describe, expect, it } from 'bun:test';
import { Tts } from '@wordhold/ai/tts';
import { Effect, Either, Option } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { PageReviewOrderError } from '../errors/page-review-order-error';
import { AudioGenerationStore } from './audio-generation-store';
import { importVerifiedPage } from './import-page';
import { ImportRepository } from './repository';
import {
  makeAudioGenerationStore,
  makeImportRepository,
  makeStorage,
} from './test-services';

const earlierPageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const currentPageId = 'd9428888-122b-41e1-b85c-61cd3cbb3210';

describe('import page order', () => {
  it('rejects a later page while an earlier page remains unchecked', async () => {
    let verified = false;
    const repository = makeImportRepository({
      getImportSession: () =>
        Effect.succeed({
          id: 'd9428888-122b-41e1-b85c-61cd3cbb3213',
          courseId: 'd9428888-122b-41e1-b85c-61cd3cbb3211',
          courseName: 'Französisch',
          capturedAt: new Date(0),
          expectedPageCount: 2,
          isComplete: true,
          pages: [
            {
              id: earlierPageId,
              position: 0,
              status: 'awaiting_verification',
              extractionReady: true,
            },
            {
              id: currentPageId,
              position: 1,
              status: 'awaiting_verification',
              extractionReady: true,
            },
          ],
        }),
      verifyPage: () =>
        Effect.sync(() => {
          verified = true;
          return [];
        }),
    });

    const result = await Effect.runPromise(
      importVerifiedPage({
        pageId: currentPageId,
        entries: [
          {
            unit: { kind: 'new', name: 'Unité 1' },
            targetText: 'mémoire',
            nativeText: 'Erinnerung',
          },
        ],
      }).pipe(
        Effect.provideService(ImportRepository, repository),
        Effect.provideService(AudioGenerationStore, makeAudioGenerationStore()),
        Effect.provideService(Storage, makeStorage()),
        Effect.provideService(
          Tts,
          Tts.make({ synthesize: () => Effect.dieMessage('unexpected TTS') }),
        ),
        Effect.either,
      ),
    );

    expect(Option.getOrUndefined(Either.getLeft(result))).toBeInstanceOf(
      PageReviewOrderError,
    );
    expect(verified).toBe(false);
  });

  it('rejects a page until every expected upload has arrived', async () => {
    let verified = false;
    const repository = makeImportRepository({
      getImportSession: () =>
        Effect.succeed({
          id: 'd9428888-122b-41e1-b85c-61cd3cbb3213',
          courseId: 'd9428888-122b-41e1-b85c-61cd3cbb3211',
          courseName: 'Französisch',
          capturedAt: new Date(0),
          expectedPageCount: 2,
          isComplete: false,
          pages: [
            {
              id: currentPageId,
              position: 0,
              status: 'awaiting_verification',
              extractionReady: true,
            },
          ],
        }),
      verifyPage: () =>
        Effect.sync(() => {
          verified = true;
          return [];
        }),
    });

    const result = await Effect.runPromise(
      importVerifiedPage({
        pageId: currentPageId,
        entries: [
          {
            unit: { kind: 'new', name: 'Unité 1' },
            targetText: 'mémoire',
            nativeText: 'Erinnerung',
          },
        ],
      }).pipe(
        Effect.provideService(ImportRepository, repository),
        Effect.provideService(AudioGenerationStore, makeAudioGenerationStore()),
        Effect.provideService(Storage, makeStorage()),
        Effect.provideService(
          Tts,
          Tts.make({ synthesize: () => Effect.dieMessage('unexpected TTS') }),
        ),
        Effect.either,
      ),
    );

    expect(Option.getOrUndefined(Either.getLeft(result))).toBeInstanceOf(
      PageReviewOrderError,
    );
    expect(verified).toBe(false);
  });
});
