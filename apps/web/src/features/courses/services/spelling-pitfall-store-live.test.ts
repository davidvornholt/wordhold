import { describe, expect, it } from 'bun:test';
import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { SpellingPitfallStore } from './spelling-pitfall-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const subjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bookId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const subjectBookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const adolescentId = '11111111-1111-4111-8111-111111111111';
const tableId = '22222222-2222-4222-8222-222222222222';
const termId = '33333333-3333-4333-8333-333333333333';

const adolescent: ReadonlyArray<SpellingPitfall> = [
  {
    segments: [
      { text: 'adoles', tricky: false },
      { text: 'c', tricky: true },
      { text: 'ent', tricky: false },
    ],
    note: 'Das c hört man nicht, wie in adolescence.',
  },
];

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | SpellingPitfallStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      effect.pipe(
        Effect.provide(SpellingPitfallStore.live),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

const seed = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'English', 'en')
  `;
  yield* sql`
    insert into courses
      (id, name, kind, target_language, native_language, directions)
    values (${subjectId}, 'Chemie', 'terms', 'de', 'de', '{to_native}')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${courseId}, 'Green Line 6', 0),
      (${subjectBookId}, ${subjectId}, 'Chemie 1', 0)
  `;
  yield* sql`
    insert into entries (id, course_id, book_id, target_text, native_text)
    values (${adolescentId}, ${courseId}, ${bookId}, 'adolescent', 'Jugendliche/r'),
      (${tableId}, ${courseId}, ${bookId}, 'the table', 'der Tisch'),
      (${termId}, ${subjectId}, ${subjectBookId}, 'Oxidation', 'Elektronenabgabe')
  `;
  yield* sql`
    update entries set spelling_pitfalls = '[]'::jsonb where id = ${tableId}
  `;
});

describe('SpellingPitfallStore', () => {
  it('reads the language course words asked for with their pitfalls', async () => {
    const words = await runStoreTest(
      Effect.gen(function* () {
        yield* seed;
        const store = yield* SpellingPitfallStore;
        return yield* store.read([adolescentId, tableId, termId]);
      }),
    );
    expect(
      [...words].sort((left, right) =>
        left.entryId.localeCompare(right.entryId),
      ),
    ).toEqual([
      {
        entryId: adolescentId,
        targetText: 'adolescent',
        nativeText: 'Jugendliche/r',
        targetLanguage: 'en',
        pitfalls: null,
      },
      {
        entryId: tableId,
        targetText: 'the table',
        nativeText: 'der Tisch',
        targetLanguage: 'en',
        pitfalls: [],
      },
    ]);
  });

  it('stores pitfalls once and only for the spelling they were found for', async () => {
    const result = await runStoreTest(
      Effect.gen(function* () {
        yield* seed;
        const store = yield* SpellingPitfallStore;
        const respelled = yield* store.save({
          entryId: adolescentId,
          targetText: 'adolesent',
          pitfalls: adolescent,
        });
        const first = yield* store.save({
          entryId: adolescentId,
          targetText: 'adolescent',
          pitfalls: adolescent,
        });
        const again = yield* store.save({
          entryId: adolescentId,
          targetText: 'adolescent',
          pitfalls: [],
        });
        const [stored] = yield* store.read([adolescentId]);
        return { respelled, first, again, pitfalls: stored?.pitfalls };
      }),
    );
    expect(result).toEqual({
      respelled: false,
      first: true,
      again: false,
      pitfalls: adolescent,
    });
  });
});
