import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import {
  fixtureAddedAt,
  fixtureBookId,
  fixtureCourseId,
  fixtureNow,
  fixtureUnitId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { CourseDatabaseError } from '../errors/courses-errors';
import { CourseStore } from './course-store';
import {
  directionsAfterNativeRemoved,
  directionsAfterTargetIntroduced,
  emptyDirections,
  initialDirections,
  missingCourseId,
  runCourseStoreTest,
} from './course-store-content-test-fixtures';

describe('CourseStore PostgreSQL course contents', () => {
  it('lists empty and populated units in deterministic course order', async () => {
    await runCourseStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`
          insert into units (id, course_id, book_id, name, position)
          values
            ('ffffffff-ffff-4fff-8fff-ffffffffffff', ${fixtureCourseId}, ${fixtureBookId}, 'Unit 3', 2),
            ('99999999-9999-4999-8999-999999999999', ${fixtureCourseId}, ${fixtureBookId}, 'Unit 2', 1)
        `;

        expect(yield* store.listUnits(fixtureCourseId, fixtureNow)).toEqual([
          {
            id: fixtureUnitId,
            bookId: fixtureBookId,
            name: 'Unit 1',
            entries: 3,
            introduced: 2,
            unintroduced: 1,
            due: 1,
            firstReviews: 2,
            nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
            lastAddedAt: fixtureAddedAt,
            directions: initialDirections,
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            bookId: fixtureBookId,
            name: 'Unit 2',
            entries: 0,
            introduced: 0,
            unintroduced: 0,
            due: 0,
            firstReviews: 0,
            nextDueAt: null,
            lastAddedAt: null,
            directions: emptyDirections,
          },
          {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            bookId: fixtureBookId,
            name: 'Unit 3',
            entries: 0,
            introduced: 0,
            unintroduced: 0,
            due: 0,
            firstReviews: 0,
            nextDueAt: null,
            lastAddedAt: null,
            directions: emptyDirections,
          },
        ]);
        expect(yield* store.listUnits(missingCourseId, fixtureNow)).toEqual([]);
      }),
    );
  });
});

describe('CourseStore PostgreSQL book contents', () => {
  it("counts only a book's own words in its progress", async () => {
    const directEntryId = '12121212-1212-4212-8212-121212121212';
    const directAddedAt = new Date('2026-08-10T12:00:00.000Z');
    await runCourseStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* CourseStore;
        expect(yield* store.listBooks(fixtureCourseId, fixtureNow)).toEqual([
          expect.objectContaining({
            id: fixtureBookId,
            entries: 0,
            lastAddedAt: null,
          }),
        ]);

        yield* sql`
          insert into entries (
            id, course_id, book_id, target_text, native_text, created_at
          ) values (
            ${directEntryId}, ${fixtureCourseId}, ${fixtureBookId},
            'le souvenir', 'die Erinnerung', ${directAddedAt}
          )
        `;
        yield* sql`
          insert into cards (entry_id, direction)
          values (${directEntryId}, 'to_target'), (${directEntryId}, 'to_native')
        `;
        expect(yield* store.listBooks(fixtureCourseId, fixtureNow)).toEqual([
          expect.objectContaining({
            id: fixtureBookId,
            name: 'Découvertes 3',
            entries: 1,
            introduced: 0,
            unintroduced: 1,
            lastAddedAt: directAddedAt,
          }),
        ]);
        expect(
          yield* store.listUnits(fixtureCourseId, fixtureNow),
        ).toContainEqual(
          expect.objectContaining({ id: fixtureUnitId, entries: 3 }),
        );
        expect(yield* store.listBooks(missingCourseId, fixtureNow)).toEqual([]);
      }),
    );
  });
});

describe('CourseStore PostgreSQL entry contents', () => {
  it('lists entries deterministically and exposes partially introduced entries', async () => {
    await runCourseStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`
          update cards
          set introduced_at = ${new Date('2026-08-20T12:00:00.000Z')}
          where entry_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            and direction = 'to_target'
        `;
        yield* sql`
          insert into entry_examples (
            entry_id, target_text, native_text, source, position
          ) values (
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            'Je lis un livre.',
            'Ich lese ein Buch.',
            'textbook',
            0
          )
        `;

        yield* sql`
          update entries set synonyms = array['bouquin'], antonyms = '{}'
          where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
        `;

        const listed = yield* store.listVocabulary(fixtureCourseId);
        expect(listed.map(({ cards: _cards, ...entry }) => entry)).toEqual([
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            targetText: 'livre',
            nativeText: 'Buch',
            keyPoints: null,
            synonyms: ['bouquin'],
            antonyms: [],
            example: {
              targetText: 'Je lis un livre.',
              nativeText: 'Ich lese ein Buch.',
              source: 'textbook',
            },
            introduced: true,
            bookId: fixtureBookId,
            bookName: 'Découvertes 3',
            unitId: fixtureUnitId,
            unitName: 'Unit 1',
          },
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            targetText: 'mémoire',
            nativeText: 'Erinnerung',
            keyPoints: null,
            synonyms: null,
            antonyms: null,
            example: null,
            introduced: true,
            bookId: fixtureBookId,
            bookName: 'Découvertes 3',
            unitId: fixtureUnitId,
            unitName: 'Unit 1',
          },
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            targetText: 'neuf',
            nativeText: 'neu',
            keyPoints: null,
            synonyms: null,
            antonyms: null,
            example: null,
            introduced: true,
            bookId: fixtureBookId,
            bookName: 'Découvertes 3',
            unitId: fixtureUnitId,
            unitName: 'Unit 1',
          },
        ]);
        expect(yield* store.listVocabulary(missingCourseId)).toEqual([]);
        expect(
          yield* store.listUnits(fixtureCourseId, fixtureNow),
        ).toContainEqual({
          id: fixtureUnitId,
          bookId: fixtureBookId,
          name: 'Unit 1',
          entries: 3,
          introduced: 3,
          unintroduced: 1,
          due: 1,
          firstReviews: 3,
          nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
          lastAddedAt: fixtureAddedAt,
          directions: directionsAfterTargetIntroduced,
        });

        yield* sql`
          delete from cards
          where entry_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            and direction = 'to_native'
        `;
        expect(yield* store.listVocabulary(fixtureCourseId)).toContainEqual({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          targetText: 'neuf',
          nativeText: 'neu',
          keyPoints: null,
          synonyms: null,
          antonyms: null,
          example: null,
          introduced: true,
          bookId: fixtureBookId,
          bookName: 'Découvertes 3',
          unitId: fixtureUnitId,
          unitName: 'Unit 1',
          cards: expect.any(Array),
        });
        expect(
          yield* store.listUnits(fixtureCourseId, fixtureNow),
        ).toContainEqual({
          id: fixtureUnitId,
          bookId: fixtureBookId,
          name: 'Unit 1',
          entries: 3,
          introduced: 3,
          unintroduced: 0,
          due: 1,
          firstReviews: 3,
          nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
          lastAddedAt: fixtureAddedAt,
          directions: directionsAfterNativeRemoved,
        });
      }),
    );
  });
});

describe('CourseStore PostgreSQL course content errors', () => {
  it('maps PostgreSQL unit and entry failures to their operations', async () => {
    await runCourseStoreTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`drop table entries cascade`;
        const units = yield* store
          .listUnits(fixtureCourseId, fixtureNow)
          .pipe(Effect.result);
        const entries = yield* store
          .listVocabulary(fixtureCourseId)
          .pipe(Effect.result);
        const unitsError = units._tag === 'Failure' ? units.failure : undefined;
        const entriesError =
          entries._tag === 'Failure' ? entries.failure : undefined;
        expect(units._tag).toBe('Failure');
        expect(entries._tag).toBe('Failure');
        expect(unitsError).toBeInstanceOf(CourseDatabaseError);
        expect(entriesError).toBeInstanceOf(CourseDatabaseError);
        expect(unitsError?.operation).toBe('list units');
        expect(entriesError?.operation).toBe('list vocabulary');
      }),
    );
  });
});
