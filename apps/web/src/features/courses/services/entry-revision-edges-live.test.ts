import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { TermEntryStore } from './term-entry-store';
import { VocabularyEntryStore } from './vocabulary-entry-store';

const run = <A, E>(
  effect: Effect.Effect<A, E, Database | TermEntryStore | VocabularyEntryStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      effect.pipe(
        Effect.provide(
          Layer.mergeAll(TermEntryStore.live, VocabularyEntryStore.live),
        ),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

const insertCourse = (kind: 'language' | 'terms') =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const courseId = crypto.randomUUID();
    const bookId = crypto.randomUUID();
    yield* sql`
      insert into courses (id, name, kind, target_language, native_language, directions)
      values (${courseId}, 'Synthetic course', ${kind}, 'de', 'de', '{to_native}')
    `;
    yield* sql`
      insert into books (id, course_id, name, position)
      values (${bookId}, ${courseId}, 'Synthetic book', 0)
    `;
    return { courseId, bookId };
  });

const revisionOf = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const [row] = yield* sql<{ readonly revision: number }>`
      select revision from entries where id = ${entryId}
    `;
    return row?.revision;
  });

it('refuses a term save from before another tab corrected its key points', async () => {
  const outcome = await run(
    Effect.gen(function* () {
      const store = yield* TermEntryStore;
      const sql = yield* Database;
      const { courseId } = yield* insertCourse('terms');
      const created = yield* store.create({
        courseId,
        term: 'Original term',
        definition: 'Original definition',
      });
      if (created.kind !== 'created') {
        return yield* Effect.die('The term was not created.');
      }
      const { entryId } = created;
      const loaded = yield* revisionOf(entryId);
      yield* store.setKeyPoints(courseId, entryId, ['Corrected point']);
      const refused = yield* store.update({
        courseId,
        entryId,
        revision: loaded ?? 0,
        term: 'Original term',
        definition: 'New definition',
      });
      const [row] = yield* sql<{ readonly keyPoints: ReadonlyArray<string> }>`
        select key_points as "keyPoints" from entries where id = ${entryId}
      `;
      return { refused: refused.kind, keyPoints: row?.keyPoints };
    }),
  );
  expect(outcome).toEqual({ refused: 'stale', keyPoints: ['Corrected point'] });
});

it('leaves the revision alone for a vocabulary save that changes nothing', async () => {
  const outcome = await run(
    Effect.gen(function* () {
      const store = yield* VocabularyEntryStore;
      const { courseId, bookId } = yield* insertCourse('language');
      const created = yield* store.create({
        courseId,
        bookId,
        unitId: null,
        targetText: 'Original label',
        nativeText: 'Original wording',
      });
      if (created.kind !== 'created') {
        return yield* Effect.die('The word was not created.');
      }
      const { entryId } = created;
      const form = (revision: number, nativeText: string) => ({
        courseId,
        entryId,
        revision,
        targetText: 'Original label',
        nativeText,
        synonyms: null,
        antonyms: null,
      });
      // Two editors load the word; the first one saves without changing it.
      const loaded = (yield* revisionOf(entryId)) ?? -1;
      const unchanged = yield* store.update(form(loaded, 'Original wording'));
      const revisionAfterUnchanged = yield* revisionOf(entryId);
      // The other editor still corrects the wording.
      const corrected = yield* store.update(form(loaded, 'Corrected wording'));
      return {
        unchanged: unchanged.kind,
        revisionAfterUnchanged,
        corrected: corrected.kind,
        final: yield* revisionOf(entryId),
      };
    }),
  );
  expect(outcome).toEqual({
    unchanged: 'updated',
    revisionAfterUnchanged: 0,
    corrected: 'updated',
    final: 1,
  });
});
