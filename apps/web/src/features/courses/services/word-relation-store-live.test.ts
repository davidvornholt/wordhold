import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { WordRelationStore } from './word-relation-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const subjectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const otherBookId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const subjectBookId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const hostileId = '11111111-1111-4111-8111-111111111111';
const braveId = '22222222-2222-4222-8222-222222222222';
const otherWordId = '33333333-3333-4333-8333-333333333333';
const termId = '44444444-4444-4444-8444-444444444444';

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | WordRelationStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      effect.pipe(
        Effect.provide(WordRelationStore.live),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

const seed = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'English', 'en'), (${otherCourseId}, 'Spanish', 'es')
  `;
  yield* sql`
    insert into courses
      (id, name, kind, target_language, native_language, directions)
    values (${subjectId}, 'Chemie', 'terms', 'de', 'de', '{to_native}')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${courseId}, 'Green Line 5', 0),
      (${otherBookId}, ${otherCourseId}, 'Encuentros 1', 0),
      (${subjectBookId}, ${subjectId}, 'Chemie 1', 0)
  `;
  yield* sql`
    insert into entries (id, course_id, book_id, target_text, native_text)
    values (${hostileId}, ${courseId}, ${bookId}, 'hostile', 'feindselig'),
      (${braveId}, ${courseId}, ${bookId}, 'brave', 'mutig'),
      (${otherWordId}, ${otherCourseId}, ${otherBookId}, 'valiente', 'mutig'),
      (${termId}, ${subjectId}, ${subjectBookId}, 'Oxidation', 'Elektronenabgabe')
  `;
  yield* sql`
    insert into entry_examples (entry_id, target_text, position)
    values (${hostileId}, 'The crowd was hostile.', 1),
      (${hostileId}, 'A hostile takeover.', 0)
  `;
});

const storedLists = Effect.gen(function* () {
  const sql = yield* Database;
  return yield* sql<{
    readonly id: string;
    readonly synonyms: ReadonlyArray<string> | null;
    readonly antonyms: ReadonlyArray<string> | null;
  }>`select id, synonyms, antonyms from entries order by target_text`;
});

describe('WordRelationStore', () => {
  it('reads only the language course words asked for, with their first example', async () => {
    const words = await runStoreTest(
      Effect.gen(function* () {
        yield* seed;
        const store = yield* WordRelationStore;
        const own = yield* store.read(courseId, [
          hostileId,
          braveId,
          otherWordId,
        ]);
        const subject = yield* store.read(subjectId, [termId]);
        return { own, subject };
      }),
    );
    expect(
      [...words.own].sort((a, b) => a.targetText.localeCompare(b.targetText)),
    ).toEqual([
      {
        entryId: braveId,
        targetText: 'brave',
        nativeText: 'mutig',
        example: null,
        targetLanguage: 'en',
      },
      {
        entryId: hostileId,
        targetText: 'hostile',
        nativeText: 'feindselig',
        example: 'A hostile takeover.',
        targetLanguage: 'en',
      },
    ]);
    expect(words.subject).toEqual([]);
  });

  it('saves the lists of the course words and leaves other courses alone', async () => {
    const result = await runStoreTest(
      Effect.gen(function* () {
        yield* seed;
        const store = yield* WordRelationStore;
        const written = yield* store.save({
          courseId,
          words: [
            {
              entryId: hostileId,
              synonyms: ['unfriendly'],
              antonyms: ['friendly'],
            },
            { entryId: braveId, synonyms: [], antonyms: null },
            { entryId: otherWordId, synonyms: ['audaz'], antonyms: [] },
          ],
        });
        return { written, lists: yield* storedLists };
      }),
    );
    expect(result.written).toBe(2);
    expect(result.lists).toEqual([
      { id: braveId, synonyms: [], antonyms: null },
      { id: hostileId, synonyms: ['unfriendly'], antonyms: ['friendly'] },
      { id: termId, synonyms: null, antonyms: null },
      { id: otherWordId, synonyms: null, antonyms: null },
    ]);
  });

  it('refuses to save lists in a subject', async () => {
    const result = await runStoreTest(
      Effect.gen(function* () {
        yield* seed;
        return yield* (yield* WordRelationStore)
          .save({
            courseId: subjectId,
            words: [{ entryId: termId, synonyms: ['Abgabe'], antonyms: null }],
          })
          .pipe(Effect.result);
      }),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'CourseKindMismatchError' },
    });
  });
});
