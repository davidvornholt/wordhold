import { describe, expect, it } from 'bun:test';
import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { pageRepositoryLive } from './page-repository-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unitId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const entryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const verifiedAt = new Date('2026-08-30T12:00:00.000Z');

describe('pageRepositoryLive', () => {
  it('lists verified pages with stale audio until the current profile is stored', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'French', 'fr')
          `;
          yield* sql`
            insert into pages (id, course_id, image_path, status, verified_at)
            values (${pageId}, ${courseId}, 'page.png', 'verified', ${verifiedAt})
          `;
          yield* sql`
            insert into units (id, course_id, name, position)
            values (${unitId}, ${courseId}, 'Unit 1', 0)
          `;
          yield* sql`
            insert into entries (id, course_id, unit_id, page_id, target_text, native_text)
            values (${entryId}, ${courseId}, ${unitId}, ${pageId}, 'donner qc à qn.', 'jemandem etwas geben')
          `;
          yield* sql`
            insert into entry_audio (entry_id, voice, path)
            values (${entryId}, 'Lea', 'audio/old.mp3')
          `;

          expect(yield* pageRepositoryLive(sql).listAudioRecoveryPages).toEqual(
            [
              {
                id: pageId,
                courseId,
                courseName: 'French',
                missingAudio: 1,
                verifiedAt,
              },
            ],
          );

          yield* sql`
            update entry_audio
            set voice = ${ttsAudioProfile('donner qc à qn.', 'fr')}
            where entry_id = ${entryId}
          `;

          expect(yield* pageRepositoryLive(sql).listAudioRecoveryPages).toEqual(
            [],
          );
        }).pipe(Effect.provide(databaseLayer));
      }),
    );
  });
});
