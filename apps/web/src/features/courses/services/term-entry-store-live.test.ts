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
const unitId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const languageBookId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const missingUnitId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

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
  yield* sql`
    insert into units (id, course_id, book_id, name, position)
    values (${unitId}, ${subjectId}, ${bookId}, 'Kinetik', 0)
  `;
});

const term = (text: string, place: { readonly unitId: string | null }) => ({
  courseId: subjectId,
  bookId,
  unitId: place.unitId,
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
        const entryId = createdId(
          yield* store.create(term('Katalysator', { unitId })),
        );
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

  it('refuses a repeated term, a vanished place and a language course', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* TermEntryStore;
        yield* store.create(term('Katalysator', { unitId }));
        expect(
          yield* store.create(term('Katalysator', { unitId: null })),
        ).toEqual({ kind: 'duplicate', location: 'Allgemein · Kinetik' });
        expect(
          (yield* store.create(term('katalysator', { unitId: null }))).kind,
        ).toBe('created');
        expect(
          yield* store.create(term('Enzym', { unitId: missingUnitId })),
        ).toEqual({ kind: 'place-missing' });
        expect(
          yield* store.create({
            ...term('Enzym', { unitId: null }),
            courseId: languageCourseId,
            bookId: languageBookId,
          }),
        ).toEqual({ kind: 'not-terms' });
        expect(yield* store.readPlace(subjectId, { bookId, unitId })).toEqual({
          kind: 'terms',
          courseName: 'Chemie',
          unitName: 'Kinetik',
        });
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
        const entryId = createdId(
          yield* store.create(term('Katalysator', { unitId })),
        );
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
