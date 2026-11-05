import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { VocabularyEntryStore } from './vocabulary-entry-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bookId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const secondBookId = 'c2222222-cccc-4ccc-8ccc-cccccccccccc';
const otherCourseBookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const unitId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const secondUnitId = 'e2222222-eeee-4eee-8eee-eeeeeeeeeeee';
const secondBookUnitId = 'e3333333-eeee-4eee-8eee-eeeeeeeeeeee';

const practisedReps = 3;
const nextDue = '2030-01-15T08:00:00.000Z';

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | VocabularyEntryStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      effect.pipe(
        Effect.provide(VocabularyEntryStore.live),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

const seedCourses = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'French', 'fr'), (${otherCourseId}, 'Spanish', 'es')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${courseId}, 'Découvertes 3', 0),
      (${secondBookId}, ${courseId}, 'Découvertes 4', 1),
      (${otherCourseBookId}, ${otherCourseId}, 'Encuentros 1', 0)
  `;
  yield* sql`
    insert into units (id, course_id, book_id, name, position)
    values (${unitId}, ${courseId}, ${bookId}, 'Unité 1', 0),
      (${secondUnitId}, ${courseId}, ${bookId}, 'Unité 2', 1),
      (${secondBookUnitId}, ${courseId}, ${secondBookId}, 'Unité 3', 0)
  `;
});

const practisedWord = (targetText: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const store = yield* VocabularyEntryStore;
    const created = yield* store.create({
      courseId,
      bookId,
      unitId,
      targetText,
      nativeText: `${targetText} auf Deutsch`,
    });
    const entryId = created.kind === 'created' ? created.entryId : '';
    yield* sql`
      update cards
      set reps = ${practisedReps}, due_at = ${nextDue}::timestamptz
      where entry_id = ${entryId}
    `;
    yield* sql`
      insert into reviews (card_id, rating, answer_text)
      select id, 3, ${targetText} from cards where entry_id = ${entryId}
    `;
    yield* sql`
      insert into accepted_answers
        (entry_id, direction, text, normalized, source)
      values (${entryId}, 'to_native', 'das Andenken', 'das andenken', 'judge')
    `;
    return entryId;
  });

const placeOf = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const [place] = yield* sql<{
      readonly bookId: string;
      readonly unitId: string | null;
    }>`select book_id as "bookId", unit_id as "unitId" from entries where id = ${entryId}`;
    return place;
  });

const learnedAbout = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const cards = yield* sql<{
      readonly id: string;
      readonly reps: number;
      readonly dueAt: Date;
    }>`select id, reps, due_at as "dueAt" from cards where entry_id = ${entryId} order by id`;
    const [reviews] = yield* sql<{ readonly count: number }>`
      select count(*)::int as count from reviews r
      join cards c on c.id = r.card_id
      where c.entry_id = ${entryId}
    `;
    const answers = yield* sql<{ readonly text: string }>`
      select text from accepted_answers where entry_id = ${entryId}
    `;
    return { cards, reviews: reviews?.count, answers };
  });

describe('VocabularyEntryStore move', () => {
  it('keeps what was learned about a word', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        const entryId = yield* practisedWord('la mémoire');
        const before = yield* learnedAbout(entryId);
        expect(before.cards.length).toBeGreaterThan(0);
        expect(before.cards[0]?.reps).toBe(practisedReps);
        expect(before.reviews).toBe(before.cards.length);
        expect(
          yield* store.move({
            courseId,
            entryIds: [entryId],
            bookId,
            unitId: secondUnitId,
          }),
        ).toEqual({ kind: 'moved', moved: 1 });
        expect(yield* learnedAbout(entryId)).toEqual(before);
        expect(yield* placeOf(entryId)).toEqual({
          bookId,
          unitId: secondUnitId,
        });
      }),
    );
  });

  it('moves every word of the selection and nothing else', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        const first = yield* practisedWord('la mémoire');
        const second = yield* practisedWord('le voyage');
        const kept = yield* practisedWord('vous');
        expect(
          yield* store.move({
            courseId,
            entryIds: [first, second],
            bookId: secondBookId,
            unitId: secondBookUnitId,
          }),
        ).toEqual({ kind: 'moved', moved: 2 });
        const moved = { bookId: secondBookId, unitId: secondBookUnitId };
        expect(yield* placeOf(first)).toEqual(moved);
        expect(yield* placeOf(second)).toEqual(moved);
        expect(yield* placeOf(kept)).toEqual({ bookId, unitId });
      }),
    );
  });

  it('moves a word out of its unit, directly into a book', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        const entryId = yield* practisedWord('la mémoire');
        expect(
          yield* store.move({
            courseId,
            entryIds: [entryId],
            bookId: secondBookId,
            unitId: null,
          }),
        ).toEqual({ kind: 'moved', moved: 1 });
        expect(yield* placeOf(entryId)).toEqual({
          bookId: secondBookId,
          unitId: null,
        });
      }),
    );
  });
});

describe('VocabularyEntryStore move limits', () => {
  it('refuses a place outside the course or a unit of another book', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        const entryId = yield* practisedWord('la mémoire');
        const entryIds = [entryId];
        expect(
          yield* store.move({
            courseId,
            entryIds,
            bookId: otherCourseBookId,
            unitId: null,
          }),
        ).toEqual({ kind: 'place-missing' });
        expect(
          yield* store.move({
            courseId,
            entryIds,
            bookId: secondBookId,
            unitId,
          }),
        ).toEqual({ kind: 'place-missing' });
        expect(yield* placeOf(entryId)).toEqual({ bookId, unitId });
      }),
    );
  });

  it('skips a word of another course and one already gone', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* VocabularyEntryStore;
        const entryId = yield* practisedWord('la mémoire');
        const gone = yield* practisedWord('le voyage');
        yield* sql`delete from entries where id = ${gone}`;
        const created = yield* store.create({
          courseId: otherCourseId,
          bookId: otherCourseBookId,
          unitId: null,
          targetText: 'la memoria',
          nativeText: 'die Erinnerung',
        });
        const foreign = created.kind === 'created' ? created.entryId : '';
        expect(
          yield* store.move({
            courseId,
            entryIds: [entryId, gone, foreign],
            bookId: secondBookId,
            unitId: null,
          }),
        ).toEqual({ kind: 'moved', moved: 1 });
        expect(yield* placeOf(foreign)).toEqual({
          bookId: otherCourseBookId,
          unitId: null,
        });
      }),
    );
  });
});
