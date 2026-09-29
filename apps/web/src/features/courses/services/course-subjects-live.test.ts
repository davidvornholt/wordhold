import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { CourseService } from './course-service';
import { CourseStore } from './course-store';

const languageCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const missingCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const runServiceTest = <A, E>(
  effect: Effect.Effect<A, E, Database | CourseService>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(
          CourseService.Default.pipe(
            Layer.provide(CourseStore.live.pipe(Layer.provide(databaseLayer))),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedLanguageCourse = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${languageCourseId}, 'Französisch', 'fr')
  `;
});

const failureTag = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
  );

describe('course subjects', () => {
  it('creates a subject with one book and a term-to-definition direction', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject({ name: 'Chemie' });
        const [course] = yield* sql<{
          readonly name: string;
          readonly kind: string;
          readonly directions: ReadonlyArray<string>;
        }>`select name, kind, directions::text[] as directions from courses where id = ${courseId}`;
        expect(course).toEqual({
          name: 'Chemie',
          kind: 'terms',
          directions: ['to_native'],
        });
        const books = yield* sql<{
          readonly name: string;
        }>`select name from books where course_id = ${courseId}`;
        expect(books).toEqual([{ name: 'Allgemein' }]);
      }),
    );
  });

  it('refuses a name another course already has, in any casing', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const service = yield* CourseService;
        yield* service.createSubject({ name: 'Chemie' });
        expect(
          yield* failureTag(service.createSubject({ name: 'chemie' })),
        ).toBe('SubjectConflictError');
        expect(
          yield* failureTag(service.createSubject({ name: 'Französisch' })),
        ).toBe('SubjectConflictError');
      }),
    );
  });

  it('renames a subject but never a language course', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const sql = yield* Database;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject({ name: 'Chemie' });
        yield* service.createSubject({ name: 'Biologie' });
        expect(
          yield* service.renameSubject({ courseId, name: 'Organische Chemie' }),
        ).toEqual({ name: 'Organische Chemie' });
        // Its own name in another casing is not a conflict.
        expect(
          yield* service.renameSubject({ courseId, name: 'organische Chemie' }),
        ).toEqual({ name: 'organische Chemie' });
        expect(
          yield* failureTag(
            service.renameSubject({ courseId, name: 'Biologie' }),
          ),
        ).toBe('SubjectConflictError');
        expect(
          yield* failureTag(
            service.renameSubject({
              courseId: languageCourseId,
              name: 'Latein',
            }),
          ),
        ).toBe('CourseSettingsNotFoundError');
        const [language] = yield* sql<{
          readonly name: string;
        }>`select name from courses where id = ${languageCourseId}`;
        expect(language?.name).toBe('Französisch');
      }),
    );
  });

  it('keeps the one direction of a subject', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject({ name: 'Chemie' });
        expect(
          yield* failureTag(
            service.setDirections({ courseId, directions: ['to_target'] }),
          ),
        ).toBe('CourseKindMismatchError');
        expect(
          yield* failureTag(
            service.setDirections({
              courseId: missingCourseId,
              directions: ['to_target'],
            }),
          ),
        ).toBe('CourseSettingsNotFoundError');
        expect(
          yield* service.setDirections({
            courseId: languageCourseId,
            directions: ['to_target'],
          }),
        ).toEqual(['to_target']);
      }),
    );
  });
});
