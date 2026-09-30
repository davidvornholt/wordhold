import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { TermEntryStore } from './term-entry-store';
import { VocabularyExampleStore } from './vocabulary-example-store';

const subjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const languageCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bookId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const languageBookId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const missingCourseId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const definition =
  'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt.';

const runStoreTest = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Database | TermEntryStore | VocabularyExampleStore
  >,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(
          Layer.mergeAll(
            TermEntryStore.live.pipe(Layer.provide(databaseLayer)),
            VocabularyExampleStore.live.pipe(Layer.provide(databaseLayer)),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedCourses = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses
      (id, name, kind, target_language, native_language, directions)
    values
      (${subjectId}, 'Chemie', 'terms', 'de', 'de', '{to_native}')
  `;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${languageCourseId}, 'Französisch', 'fr')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${subjectId}, 'Allgemein', 0),
      (${languageBookId}, ${languageCourseId}, 'Découvertes 3', 0)
  `;
});

const term = (text: string, courseId = subjectId) => ({
  courseId,
  term: text,
  definition,
});

const createdId = (
  result: Effect.Effect.Success<ReturnType<TermEntryStore['Type']['create']>>,
) => (result.kind === 'created' ? result.entryId : '');

describe('TermEntryStore', () => {
  it('stores a term with one card and its definition as the answer', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* TermEntryStore;
        const entryId = createdId(yield* store.create(term('Katalysator')));
        const [entry] = yield* sql<{
          readonly bookId: string;
          readonly unitId: string | null;
        }>`select book_id as "bookId", unit_id as "unitId" from entries where id = ${entryId}`;
        expect(entry).toEqual({ bookId, unitId: null });
        const cards = yield* sql<{
          readonly direction: string;
        }>`select direction from cards where entry_id = ${entryId}`;
        expect(cards).toEqual([{ direction: 'to_native' }]);
        const answers = yield* sql<{
          readonly direction: string;
          readonly text: string;
        }>`select direction, text from accepted_answers where entry_id = ${entryId}`;
        expect(answers).toEqual([{ direction: 'to_native', text: definition }]);
        expect(yield* store.readTerm(subjectId, entryId)).toEqual({
          term: 'Katalysator',
          definition,
          keyPoints: null,
        });
        // A term has no example sentence to prepare.
        expect(
          yield* Effect.flatMap(VocabularyExampleStore, (examples) =>
            examples.read(entryId),
          ),
        ).toBeUndefined();
      }),
    );
  });

  it('refuses a repeated term, a missing subject and a language course', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* TermEntryStore;
        yield* store.create(term('Katalysator'));
        expect(yield* store.create(term('Katalysator'))).toEqual({
          kind: 'duplicate',
        });
        expect((yield* store.create(term('katalysator'))).kind).toBe('created');
        expect(yield* store.create(term('Enzym', missingCourseId))).toEqual({
          kind: 'course-missing',
        });
        expect(yield* store.create(term('Enzym', languageCourseId))).toEqual({
          kind: 'not-terms',
        });
        expect(yield* store.readCourse(subjectId)).toEqual({
          kind: 'terms',
          name: 'Chemie',
        });
        expect(yield* store.readCourse(missingCourseId)).toBeUndefined();
      }),
    );
  });
});

describe('TermEntryStore key points', () => {
  it('keeps the first derived key points and replaces them on an edit', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* TermEntryStore;
        const entryId = createdId(yield* store.create(term('Katalysator')));
        const first = ['senkt die Aktivierungsenergie'];
        expect(
          yield* store.saveDerivedKeyPoints(entryId, definition, first),
        ).toEqual(first);
        expect(
          yield* store.saveDerivedKeyPoints(entryId, definition, [
            'beschleunigt eine Reaktion',
          ]),
        ).toEqual(first);
        expect(
          yield* store.saveDerivedKeyPoints(
            entryId,
            'Eine andere Definition.',
            ['anders'],
          ),
        ).toBeNull();
        const edited = [
          'senkt die Aktivierungsenergie',
          'wird nicht verbraucht',
        ];
        expect(yield* store.setKeyPoints(subjectId, entryId, edited)).toBe(
          true,
        );
        expect((yield* store.readTerm(subjectId, entryId))?.keyPoints).toEqual(
          edited,
        );
        expect(
          yield* store.setKeyPoints(languageCourseId, entryId, edited),
        ).toBe(false);
        const [languageEntry] = yield* sql<{ readonly id: string }>`
          insert into entries (course_id, book_id, target_text, native_text)
          values (${languageCourseId}, ${languageBookId}, 'livre', 'Buch')
          returning id
        `;
        const languageEntryId = languageEntry?.id ?? '';
        expect(
          yield* store.setKeyPoints(languageCourseId, languageEntryId, edited),
        ).toBe(false);
        expect(
          yield* store.readTerm(languageCourseId, languageEntryId),
        ).toBeUndefined();
      }),
    );
  });
});

describe('TermEntryStore edits', () => {
  it('corrects a term and clears its key points only for a new definition', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* TermEntryStore;
        const entryId = createdId(yield* store.create(term('Katalysator')));
        const keyPoints = ['senkt die Aktivierungsenergie'];
        yield* store.setKeyPoints(subjectId, entryId, keyPoints);
        yield* sql`update cards set reps = 3 where entry_id = ${entryId}`;
        yield* sql`
          insert into accepted_answers
            (entry_id, direction, text, normalized, source)
          values (${entryId}, 'to_native', 'Beschleunigt Reaktionen.',
            'beschleunigt reaktionen', 'judge')
        `;
        const edit = { courseId: subjectId, entryId };
        expect(
          yield* store.update({ ...edit, term: 'Katalysatoren', definition }),
        ).toEqual({ kind: 'updated', definitionChanged: false });
        expect(yield* store.readTerm(subjectId, entryId)).toEqual({
          term: 'Katalysatoren',
          definition,
          keyPoints,
        });
        const corrected = 'Ein Stoff, der eine Reaktion beschleunigt.';
        expect(
          yield* store.update({
            ...edit,
            term: 'Katalysatoren',
            definition: corrected,
          }),
        ).toEqual({ kind: 'updated', definitionChanged: true });
        expect(yield* store.readTerm(subjectId, entryId)).toEqual({
          term: 'Katalysatoren',
          definition: corrected,
          keyPoints: null,
        });
        const answers = yield* sql<{
          readonly text: string;
          readonly source: string;
        }>`select text, source from accepted_answers where entry_id = ${entryId}`;
        expect(answers).toEqual([{ text: corrected, source: 'textbook' }]);
        const cards = yield* sql<{
          readonly reps: number;
        }>`select reps from cards where entry_id = ${entryId}`;
        expect(cards).toEqual([{ reps: 3 }]);
      }),
    );
  });

  it('refuses a repeated term and a term of another course', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* TermEntryStore;
        yield* store.create(term('Enzym'));
        const entryId = createdId(yield* store.create(term('Katalysator')));
        const edit = { courseId: subjectId, entryId, definition };
        expect(yield* store.update({ ...edit, term: 'Enzym' })).toEqual({
          kind: 'duplicate',
        });
        expect(
          yield* store.update({
            ...edit,
            term: 'Katalysator',
            definition: 'Neu.',
          }),
        ).toEqual({ kind: 'updated', definitionChanged: true });
        expect(
          yield* store.update({
            ...edit,
            courseId: languageCourseId,
            term: 'Katalysator',
          }),
        ).toEqual({ kind: 'term-missing' });
        expect((yield* store.readTerm(subjectId, entryId))?.term).toBe(
          'Katalysator',
        );
      }),
    );
  });
});
