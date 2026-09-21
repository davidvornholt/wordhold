import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { CourseStore } from './course-store';
import { VocabularyEntryStore } from './vocabulary-entry-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherUnitId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const missingUnitId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const directionsPerEntry = 2;
// "vous", its casing variant "Vous", and "vous" in the other unit.
const storedVariants = 3;

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | VocabularyEntryStore | CourseStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(
          Layer.mergeAll(
            VocabularyEntryStore.live.pipe(Layer.provide(databaseLayer)),
            CourseStore.live.pipe(Layer.provide(databaseLayer)),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedCourse = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'French', 'fr')
  `;
  yield* sql`
    insert into units (id, course_id, name, position)
    values (${unitId}, ${courseId}, 'Unité 1', 0),
      (${otherUnitId}, ${courseId}, 'Unité 2', 1)
  `;
});

const word = (targetText: string, nativeText = `Deutsch ${targetText}`) => ({
  courseId,
  unitId,
  targetText,
  nativeText,
});

describe('VocabularyEntryStore PostgreSQL contract', () => {
  it('stores a typed entry with the same companions an import creates', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourse;
        const sql = yield* Database;
        const store = yield* VocabularyEntryStore;
        const created = yield* store.create({
          ...word('la mémoire', 'die Erinnerung'),
          example: {
            targetText: 'Ce voyage est un bon souvenir.',
            nativeText: 'Diese Reise ist eine schöne Erinnerung.',
            source: 'textbook',
          },
        });
        expect(created.kind).toBe('created');
        const entryId = created.kind === 'created' ? created.entryId : '';
        const entries = yield* sql<{
          readonly pageId: string | null;
          readonly unitId: string;
        }>`select page_id as "pageId", unit_id as "unitId" from entries where id = ${entryId}`;
        expect(entries).toEqual([{ pageId: null, unitId }]);
        const cards = yield* sql<{
          readonly direction: string;
        }>`select direction from cards where entry_id = ${entryId}`;
        expect(cards.map((card) => card.direction).sort()).toEqual([
          'to_native',
          'to_target',
        ]);
        const answers = yield* sql<{
          readonly text: string;
        }>`select text from accepted_answers where entry_id = ${entryId} order by text`;
        expect(answers.map((answer) => answer.text)).toEqual([
          'die Erinnerung',
          'la mémoire',
        ]);
        const examples = yield* sql<{
          readonly targetText: string;
          readonly source: string;
        }>`select target_text as "targetText", source from entry_examples where entry_id = ${entryId}`;
        expect(examples).toEqual([
          { targetText: 'Ce voyage est un bon souvenir.', source: 'textbook' },
        ]);
        const listed = yield* Effect.flatMap(CourseStore, (courses) =>
          courses.listVocabulary(courseId),
        );
        expect(listed).toHaveLength(1);
        expect(listed[0]?.cards).toHaveLength(directionsPerEntry);
        expect(listed[0]?.example?.nativeText).toBe(
          'Diese Reise ist eine schöne Erinnerung.',
        );
      }),
    );
  });

  it('refuses an exact repeat but stores a casing variant and the same word in another unit', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourse;
        const sql = yield* Database;
        const store = yield* VocabularyEntryStore;
        expect((yield* store.create(word('vous'))).kind).toBe('created');
        expect((yield* store.create(word('vous'))).kind).toBe('duplicate');
        expect((yield* store.create(word(' vous! '))).kind).toBe('duplicate');
        expect((yield* store.create(word('Vous'))).kind).toBe('created');
        expect(
          (yield* store.create({ ...word('vous'), unitId: otherUnitId })).kind,
        ).toBe('created');
        const count = yield* sql<{
          readonly count: number;
        }>`select count(*)::int as count from entries`;
        expect(count[0]?.count).toBe(storedVariants);
      }),
    );
  });

  it('reports a unit that no longer belongs to the course without writing', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourse;
        const sql = yield* Database;
        const store = yield* VocabularyEntryStore;
        yield* sql`
          insert into courses (id, name, target_language)
          values (${missingUnitId}, 'Spanish', 'es')
        `;
        const foreignUnit = yield* sql<{ readonly id: string }>`
          insert into units (course_id, name, position)
          values (${missingUnitId}, 'Unidad 1', 0)
          returning id
        `;
        const result = yield* store.create({
          ...word('hola'),
          unitId: foreignUnit[0]?.id ?? missingUnitId,
        });
        expect(result.kind).toBe('unit-missing');
        const missing = yield* store.create({
          ...word('hola'),
          unitId: missingUnitId,
        });
        expect(missing.kind).toBe('unit-missing');
        const count = yield* sql<{
          readonly count: number;
        }>`select count(*)::int as count from entries`;
        expect(count[0]?.count).toBe(0);
      }),
    );
  });

  it('reads the course language and records pronunciation audio', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourse;
        const sql = yield* Database;
        const store = yield* VocabularyEntryStore;
        expect(yield* store.readTargetLanguage(courseId)).toBe('fr');
        expect(yield* store.readTargetLanguage(missingUnitId)).toBeUndefined();
        const created = yield* store.create(word('bonjour'));
        const entryId = created.kind === 'created' ? created.entryId : '';
        yield* store.storeAudio(entryId, 'fr-voice', 'audio/first.mp3');
        yield* store.storeAudio(entryId, 'fr-voice', 'audio/second.mp3');
        const audio = yield* sql<{
          readonly path: string;
        }>`select path from entry_audio where entry_id = ${entryId}`;
        expect(audio).toEqual([{ path: 'audio/second.mp3' }]);
      }),
    );
  });
});
