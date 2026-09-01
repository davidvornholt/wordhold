import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { decodeImportPayload } from '../schemas/import-payload';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('verifyPageLive generated example persistence', () => {
  it('persists the reviewed translation and generated source', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'French', 'fr')
          `;
          yield* sql`
            insert into pages (id, course_id, image_path)
            values (${pageId}, ${courseId}, 'first.png')
          `;
          yield* verifyPageLive(
            sql,
            decodeImportPayload({
              pageId,
              entries: [
                {
                  unit: { kind: 'new', name: 'Unit 3' },
                  targetText: 'mémoire',
                  nativeText: 'Erinnerung',
                  example: {
                    targetText: 'Cette mémoire est importante.',
                    nativeText: 'Diese Erinnerung ist wichtig.',
                    source: 'generated',
                  },
                },
              ],
            }),
            courseId,
          );

          const examples = yield* sql<{
            readonly targetText: string;
            readonly nativeText: string | null;
            readonly source: string;
          }>`
            select target_text as "targetText",
              native_text as "nativeText", source
            from entry_examples
          `;
          expect(examples).toEqual([
            {
              targetText: 'Cette mémoire est importante.',
              nativeText: 'Diese Erinnerung ist wichtig.',
              source: 'generated',
            },
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
