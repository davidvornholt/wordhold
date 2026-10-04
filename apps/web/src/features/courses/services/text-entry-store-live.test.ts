import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { maximumMemorizedTextLength } from '../../../shared/vocabulary/entry-fields';
import { TextEntryStore } from './text-entry-store';

const collectionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const subjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bookId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const subjectBookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const missingCourseId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

// From the Luther Bible of 1912, which is in the public domain.
const verse =
  'Also hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn gab.';

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | TextEntryStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(
          Layer.merge(
            TextEntryStore.live.pipe(Layer.provide(databaseLayer)),
            databaseLayer,
          ),
        ),
      );
    }),
  );

const seedCourses = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses
      (id, name, kind, target_language, native_language, directions)
    values
      (${collectionId}, 'Bibelverse', 'texts', 'de', 'de', '{to_native}'),
      (${subjectId}, 'Chemie', 'terms', 'de', 'de', '{to_native}')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${collectionId}, 'Allgemein', 0),
      (${subjectBookId}, ${subjectId}, 'Allgemein', 0)
  `;
});

const text = (title: string, body = verse, courseId = collectionId) => ({
  courseId,
  title,
  text: body,
});

const createdId = (
  result: Effect.Effect.Success<ReturnType<TextEntryStore['Type']['create']>>,
) => (result.kind === 'created' ? result.entryId : '');

describe('TextEntryStore', () => {
  it('stores a long text with one card and no accepted answers', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* TextEntryStore;
        const psalm = `${verse}\n`.repeat(
          Math.floor(maximumMemorizedTextLength / (verse.length + 1)),
        );
        const entryId = createdId(
          yield* store.create(text('Psalm 119', psalm)),
        );
        const entries = yield* sql<{
          readonly bookId: string;
          readonly nativeText: string;
        }>`
          select book_id as "bookId", native_text as "nativeText"
          from entries where id = ${entryId}
        `;
        expect(entries).toEqual([{ bookId, nativeText: psalm }]);
        const cards = yield* sql<{ readonly direction: string }>`
          select direction from cards where entry_id = ${entryId}
        `;
        expect(cards).toEqual([{ direction: 'to_native' }]);
        const answers = yield* sql`
          select id from accepted_answers where entry_id = ${entryId}
        `;
        expect(answers).toEqual([]);
      }),
    );
  });

  it('refuses a repeated title, a missing course and another kind', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* TextEntryStore;
        yield* store.create(text('Johannes 3,16'));
        expect(yield* store.create(text('Johannes 3,16'))).toEqual({
          kind: 'duplicate',
        });
        expect(
          yield* store.create(text('Johannes 3,16', verse, missingCourseId)),
        ).toEqual({ kind: 'course-missing' });
        expect(
          yield* store.create(text('Katalysator', verse, subjectId)),
        ).toEqual({ kind: 'not-texts' });
      }),
    );
  });

  it('corrects a title and text and keeps the card', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* TextEntryStore;
        const entryId = createdId(yield* store.create(text('Joh 3,16')));
        const otherId = createdId(yield* store.create(text('Psalm 23,1')));
        const [card] = yield* sql<{ readonly id: string }>`
          select id from cards where entry_id = ${entryId}
        `;
        const corrected = {
          courseId: collectionId,
          entryId,
          title: 'Johannes 3,16',
          text: 'Denn so sehr hat Gott die Welt geliebt.',
        };
        expect(yield* store.update(corrected)).toEqual({ kind: 'updated' });
        expect(yield* store.update({ ...corrected, entryId: otherId })).toEqual(
          { kind: 'duplicate' },
        );
        expect(
          yield* store.update({ ...corrected, courseId: subjectId }),
        ).toEqual({ kind: 'text-missing' });
        const rows = yield* sql<{
          readonly targetText: string;
          readonly nativeText: string;
          readonly cardId: string;
        }>`
          select e.target_text as "targetText",
            e.native_text as "nativeText", c.id as "cardId"
          from entries e join cards c on c.entry_id = e.id
          where e.id = ${entryId}
        `;
        expect(rows).toEqual([
          {
            targetText: corrected.title,
            nativeText: corrected.text,
            cardId: card?.id ?? '',
          },
        ]);
      }),
    );
  });
});
