import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureCourseId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { CourseDatabaseError } from '../errors/courses-errors';
import { CourseStore } from './course-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const missingCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | CourseStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(CourseStore.live.pipe(Layer.provide(databaseLayer))),
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
});

describe('CourseStore PostgreSQL direction contract', () => {
  it('round-trips settings and distinguishes a missing course', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourse;
        const store = yield* CourseStore;
        expect(yield* store.readDirections(courseId)).toEqual([
          'to_target',
          'to_native',
        ]);
        expect(yield* store.writeDirections(courseId, ['to_native'])).toBe(
          true,
        );
        expect(yield* store.readDirections(courseId)).toEqual(['to_native']);
        expect(yield* store.readDirections(missingCourseId)).toBeUndefined();
        expect(
          yield* store.writeDirections(missingCourseId, ['to_target']),
        ).toBe(false);
      }),
    );
  });

  it('maps malformed stored directions to a typed read error', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourse;
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`
          update courses
          set directions = '{to_target,to_target}'::answer_direction[]
          where id = ${courseId}
        `;
        const result = yield* store
          .readDirections(courseId)
          .pipe(Effect.either);
        const error = result._tag === 'Left' ? result.left : undefined;
        expect(result._tag).toBe('Left');
        expect(error).toBeInstanceOf(CourseDatabaseError);
        expect(error?.operation).toBe('read course directions');
      }),
    );
  });

  it('maps PostgreSQL read and write failures to their operations', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`drop table courses cascade`;
        const read = yield* store.readDirections(courseId).pipe(Effect.either);
        const write = yield* store
          .writeDirections(courseId, ['to_target'])
          .pipe(Effect.either);
        const readError = read._tag === 'Left' ? read.left : undefined;
        const writeError = write._tag === 'Left' ? write.left : undefined;
        expect(read._tag).toBe('Left');
        expect(write._tag).toBe('Left');
        expect(readError?.operation).toBe('read course directions');
        expect(writeError?.operation).toBe('write course directions');
      }),
    );
  });

  it('counts learned and unlearned words for each course unit', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`
          insert into units (course_id, name, position)
          values (${fixtureCourseId}, 'Unit 2', 1)
        `;

        expect(yield* store.listUnits(fixtureCourseId)).toEqual([
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            name: 'Unit 1',
            words: 3,
            unlearned: 1,
          },
          expect.objectContaining({
            name: 'Unit 2',
            words: 0,
            unlearned: 0,
          }),
        ]);
        expect(yield* store.listUnits(missingCourseId)).toEqual([]);
      }),
    );
  });
});
