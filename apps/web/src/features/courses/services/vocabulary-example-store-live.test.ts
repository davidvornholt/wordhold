import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { seedIntroducedCardFixture } from '../../../shared/testing/introduced-card-fixture';
import { VocabularyExampleStore } from './vocabulary-example-store';

const entryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('VocabularyExampleStore PostgreSQL contract', () => {
  it('stores one generated example and preserves it on repeated writes', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* VocabularyExampleStore;
          expect(yield* store.read(entryId)).toMatchObject({
            targetText: 'livre',
            nativeText: 'Buch',
            targetLanguage: 'fr',
            example: null,
          });

          const first = yield* store.storeGenerated(entryId, {
            targetText: 'Je lis un livre.',
            nativeText: 'Ich lese ein Buch.',
          });
          expect(first).toEqual({
            targetText: 'Je lis un livre.',
            nativeText: 'Ich lese ein Buch.',
            source: 'generated',
          });
          if (first === undefined) {
            throw new Error('Expected the generated example to be stored.');
          }

          yield* sql`
            update entry_examples set native_text = null
            where entry_id = ${entryId}
          `;
          expect(
            yield* store.storeTranslation(
              entryId,
              first.targetText,
              'Ich lese ein Buch.',
            ),
          ).toBe(true);

          expect(
            yield* store.storeGenerated(entryId, {
              targetText: 'Un autre livre.',
              nativeText: 'Ein anderes Buch.',
            }),
          ).toEqual(first);
          expect(
            yield* store.storeAudio(
              entryId,
              first.targetText,
              'voice-profile',
              'audio/example.mp3',
            ),
          ).toBe(true);
          expect(yield* store.read(entryId)).toMatchObject({
            example: first,
            exampleAudioProfile: 'voice-profile',
            exampleAudioPath: 'audio/example.mp3',
          });
        }).pipe(
          Effect.provide(
            VocabularyExampleStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});
