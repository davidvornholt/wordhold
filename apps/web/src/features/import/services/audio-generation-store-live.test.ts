import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  AudioGenerationStore,
  AudioGenerationStoreLive,
} from './audio-generation-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unitId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const abbreviationEntryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const plainEntryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const seedAudioTargets = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'French', 'fr')
  `;
  yield* sql`
    insert into pages (id, course_id, image_path)
    values (${pageId}, ${courseId}, 'page.png')
  `;
  yield* sql`
    insert into units (id, course_id, name, position)
    values (${unitId}, ${courseId}, 'Unit 1', 0)
  `;
  yield* sql`
    insert into entries (id, course_id, unit_id, page_id, target_text, native_text)
    values
      (${abbreviationEntryId}, ${courseId}, ${unitId}, ${pageId}, 'donner qc à qn.', 'jemandem etwas geben'),
      (${plainEntryId}, ${courseId}, ${unitId}, ${pageId}, 'mémoire', 'Erinnerung')
  `;
  yield* sql`
    insert into entry_audio (entry_id, voice, path)
    values
      (${abbreviationEntryId}, 'Lea', 'audio/old-abbreviation.mp3'),
      (${plainEntryId}, 'Lea', 'audio/current-plain.mp3')
  `;
});

describe('AudioGenerationStoreLive', () => {
  it('lists only audio whose pronunciation profile is missing', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedAudioTargets;
          const store = yield* AudioGenerationStore;

          expect(yield* store.listMissingForPage(pageId)).toEqual([
            {
              id: abbreviationEntryId,
              targetText: 'donner qc à qn.',
              language: 'fr',
            },
          ]);
        }).pipe(
          Effect.provide(
            AudioGenerationStoreLive.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});
